# 05 — Technical architecture

## 1. Stack (chosen for a 2–4 person team shipping in 10 weeks)

| Layer | Choice | Why |
|---|---|---|
| Resident app | **React Native (Expo)**, TS | One codebase, OTA updates, small APK; Android-first India |
| Vendor app | Responsive web (Next.js) at V1 → RN at V2 | Vendors live on WhatsApp + browser; ship fast |
| Ops console | Next.js + Tailwind + TanStack Table | Internal, fast to build |
| API | **Node + NestJS** (REST + webhooks), TS end-to-end | Shared types with the apps |
| DB | **Postgres** (Supabase/RDS) + Redis (counters, locks, countdowns) | Deal counters need atomic increments; Redis for hot reads |
| Realtime | Supabase Realtime / Socket.io channel per deal | The live counter is the product |
| Jobs | BullMQ (deadline closers, slab recalcs, reminders, settlements) | |
| Payments | **Razorpay** — UPI Autopay mandates, pre-auth, route/escrow split, payouts | Mandates make "charge later at final price" legal and simple |
| Notifications | FCM (push) + WhatsApp Business API (Gupshup/Interakt) + SMS fallback | WhatsApp is the real distribution channel |
| Files | S3 + CloudFront (job photos, invoices, share cards) | |
| Share cards | Server-rendered PNG (Satori/Resvg) per deal state | |
| Analytics | PostHog (product) + Metabase on a read replica | |
| Infra | AWS ap-south-1, Docker, GitHub Actions; Sentry | |

## 2. Data model (core tables)

```
society(id, name, address, pincode, lat, lng, tower_count, flat_count,
        approval_required bool, champion_user_id, plan, status)
tower(id, society_id, name, floors)
flat(id, tower_id, number, bhk)
user(id, phone, name, avatar, lang, created_at)
residency(id, user_id, flat_id, role[owner|tenant], status[pending|verified|rejected],
          verified_via[invite|vouch|doc|ops], verified_by, verified_at)   -- a user may hold several

service_category(id, name, icon, season_months[])
sku(id, category_id, name, unit[ac|car|bhk|flat|sqft], list_price_paise, duration_min,
    scope_included jsonb, scope_excluded jsonb, warranty_days, mvs_default)

vendor(id, name, owner_phone, gst, pan, kyc_status, insurance_until, rating, badges[], city)
vendor_sku(vendor_id, sku_id, list_price_paise, floor_price_paise, max_units_per_day)
technician(id, vendor_id, name, photo, police_verified bool)

deal(id, society_id, sku_id, vendor_id, created_by, service_date, slot_window[],
     status[draft|open|locked|scheduled|in_progress|completed|expired|cancelled|disputed],
     join_deadline, target_flats, mvs, current_flats, current_price_paise,
     approved_by, created_at, locked_at)
deal_slab(id, deal_id, min_flats, price_paise)                 -- frozen at publish
deal_member(id, deal_id, user_id, flat_id, units, slot, status[joined|left|locked|served|refunded],
            authorised_payment_id, captured_payment_id, price_at_join_paise, final_price_paise)
deal_event(id, deal_id, type[join|leave|slab_change|comment|lock|expire|...], payload, at)  -- append-only
comment(id, deal_id, user_id, body, parent_id, at)

job(id, deal_id, flat_id, technician_id, slot, status, start_otp, end_otp,
    started_at, finished_at, photos_before[], photos_after[], extras jsonb)
rating(id, job_id, user_id, score, tags[], note, photos[])
dispute(id, job_id, raised_by, reason, status, resolution, amount_held_paise)

payment(id, deal_member_id, provider_ref, type[mandate|preauth|capture|refund], amount_paise, status)
payout(id, vendor_id, deal_id, gross_paise, commission_paise, net_paise, utr, status, settled_at)
```

## 3. The pricing engine (the one piece that must be exactly right)

```
currentPrice(deal) = slab with max(min_flats) such that min_flats <= deal.current_flats
                     else deal.list_price
```
Invariants, enforced in the DB and in tests:
1. **Single final price.** At lock, every `deal_member.final_price_paise` = `currentPrice(deal)` — including the first joiner. Early joiners can only ever be refunded the difference, never charged more.
2. **Monotonic.** `current_price` may only decrease while `status = open`. A member leaving does **not** raise the price for those already joined (it may remove the slab for *future* joiners; publicly the deal shows "price held at ₹645 for current members").
3. **Atomic counter.** Join = `SELECT ... FOR UPDATE` on `deal` + insert member + recompute slab, all in one transaction; Redis holds the read-hot copy, Postgres is truth.
4. **Floor price.** `currentPrice >= vendor_sku.floor_price` always — the ladder cannot be published below the vendor's cost-to-serve.
5. **Deadline job** at `join_deadline`: if `current_flats >= mvs` → `lock()` (capture all mandates, assign slots, notify) else → `expire()` (release all authorisations, notify with the three recovery options).
6. **Idempotency keys** on join/capture/refund; every state change appends to `deal_event` (the audit trail that settles disputes).

## 4. Key APIs (sketch)

```
POST /auth/otp            POST /auth/verify
GET  /societies?lat&lng   POST /residency           GET  /me
GET  /feed?society_id     -> {live_deals[], announcements[], suggestions[], savings}
GET  /deals/:id           WS /deals/:id  -> {flats, price, slab, deadline, events}
POST /deals               (create)       POST /deals/:id/approve
POST /deals/:id/join      {units, slot, payment_method}  -> authorisation
DELETE /deals/:id/join    (leave, before lock)
POST /deals/:id/comments
POST /jobs/:id/start      {otp}          POST /jobs/:id/complete {otp, photos}
POST /jobs/:id/rating     POST /disputes
# vendor
GET  /vendor/requests     POST /vendor/requests/:id/accept {slabs[]}
GET  /vendor/calendar     POST /vendor/jobs/:id/...         GET /vendor/payouts
```

## 5. Non-functionals
- Feed TTI < 1.5s on a 4G mid-range Android; deal counter update < 500ms end-to-end.
- Offline: last feed + joined deals readable; join is online-only (money).
- Crash-free sessions > 99.5%; Sentry alerting on payment and lock paths.
- **Security/privacy:** flat numbers and names visible only to verified residents of that society; phone numbers never exposed between residents (masked calling via Exotel for vendor↔resident); DPDP Act consent at onboarding; PII encrypted at rest; least-privilege ops roles with audit log.
- Payments PCI handled entirely by Razorpay (no card data touches our servers).

## 6. Build order (engineering)
1. Auth + society/flat + residency verification.
2. SKU catalogue + vendor + ladder admin (ops console first — ops can run deals manually from day 1).
3. Deal engine: create → open → counter/slab → deadline job → lock/expire. **Test this to death.**
4. Payments: mandate/pre-auth → capture at lock → refund on expire.
5. Feed + deal detail + join sheet (app).
6. Jobs: slots, OTP, photos, completion, rating.
7. Payouts + commission + invoices.
8. Notifications (push/WhatsApp) + share-card renderer.
9. Vendor web app.
10. Analytics events + ops dashboards.
