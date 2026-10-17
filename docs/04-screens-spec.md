# 04 — Screen-by-screen specification

Tier 1 = V1 build. Tier 2 = V2. Every screen lists: purpose, content, actions, states, instrumentation.

---

## RESIDENT APP

### R1 · Splash + Phone OTP — *Tier 1*
Logo, one-line promise ("Your building books together. Everyone pays less."), phone field, OTP auto-read, language toggle (EN/हिं).
Events: `app_open`, `otp_requested`, `otp_verified`, `otp_failed`.

### R2 · Find your society — *Tier 1*
GPS-sorted list with distance, search, "Join with invite code / QR". Row = society name, locality, "128 neighbours already here" (strong conversion line). Fallback: *My society isn't listed* → request form.
States: loading / no-GPS (search only) / no results.
Events: `society_search`, `society_selected`, `society_requested`.

### R3 · Flat & verification — *Tier 1*
Tower/wing picker, flat number keypad, Owner | Tenant toggle, then verification route (invite link = instant · neighbour vouch = pick a verified neighbour · receipt upload · ops review). Pending screen explains Preview mode and shows a progress stepper with SLA.
Events: `verify_started{route}`, `verify_pending`, `verify_done`, `verify_rejected`.

### R4 · Home / Society feed — *Tier 1* — **the money screen**
1. Header: "Good morning, Rahul" · society chip (🟢 Green Valley Society) · avatar · 🔔.
2. *Live tracker pill* when a booking is in progress today.
3. **Live deals** — DealCard list, ordered by: closing soonest → nearest to next slab → newest.
4. **Society announcement** card (secretary posts, e.g. "AC service this Sunday") — visually the blue band from the reel.
5. **Suggested for Green Valley** — seasonal SKUs with "Start a group".
6. **Society savings strip** — "Your building saved ₹1,42,300 this year".
7. FAB: **Start a group**.
States: loading skeleton · empty (no live deals) · preview/unverified (CTAs → verify) · offline (cached + bar).
Events: `feed_view`, `deal_card_impression{deal_id,slab}`, `deal_card_tap`, `fab_tap`.

### R5 · Deal detail — *Tier 1* — **the conversion screen**
Order on screen (top → bottom):
1. Hero: service + date; **PriceBlock** (₹749 ~~₹999~~, Save ₹250); **FlatCounter 12/20**; **LadderMeter** with "3 more flats → ₹645"; **DeadlinePill**.
2. FailSafeNote.
3. VendorCard (+ "3 jobs done in this society").
4. ScopeList (included / not included), duration per flat, warranty.
5. Slot preview for the service day.
6. NeighbourStack ("Amit Kulkarni A-402 and 11 others").
7. Comments (threaded, "I am in." quick-reply chips).
8. How group pricing works (collapsible, 3 bullets).
Sticky: **[Join group · ₹749]** + "final price may drop further".
States: filling · almost-there (amber band "2 flats to go") · locked (green hero + slot) · expired (fail-safe options) · in-progress (crew tracker) · completed (invoice + rate) · already-joined (CTA becomes *Invite a neighbour*).
Events: `deal_view`, `ladder_expand`, `scope_expand`, `comment_post`, `join_tap`, `share_tap`.

### R6 · Join sheet (3 steps) — *Tier 1*
Step 1 units (how many ACs / cars / BHK) — price recomputes live.
Step 2 slot chips for the service day, capacity-aware, "Most neighbours picked 10–12".
Step 3 payment: UPI autopay (default) · card pre-auth · cash (shows an *Unassured* warning and loses the warranty badge).
Footer always shows: *"₹0 charged now · you pay the final group price."*
Success: plain confirmation + **[Share to WhatsApp]** (primary) + **[Invite neighbour]**.
Events: `join_step{n}`, `join_units_set`, `slot_selected`, `payment_method`, `join_success`, `share_card_sent`.

### R7 · My bookings — *Tier 1*
Upcoming (StatusTracker per booking, slot, vendor, "Stop work" if committee) · History (invoice PDF, warranty days left, [Book again] which pre-fills a new group deal) · Disputes.
Events: `booking_view`, `invoice_download`, `rebook_tap`, `dispute_open`.

### R8 · Service-day tracker — *Tier 1*
Crew en route map/ETA, "3 flats ahead · ~40 min", technician card with photo + ID, START/END OTP, before/after photos, [Call] [Report issue].
Events: `tracker_view`, `otp_shared`, `issue_reported`.

### R9 · Rating & warranty — *Tier 1*
3-emoji rating → optional tags ("on time", "left it clean", "late") → optional note + photos. Then warranty card ("30 days, re-raise in 1 tap") and "Save ₹X next time — your society repeats this in 6 months" with a reminder toggle.
Events: `rating_submit{score}`, `reminder_set`.

### R10 · Create a deal (wizard) — *Tier 1*
Service → date (calendar hints best day) → target flats (default MVS) → deadline → vendor (JODO picks / society-approved list) → preview → publish → share sheet.
Approval-required societies show "Goes to committee for approval (usually < 4h)".
Events: `create_start`, `create_step{n}`, `create_publish`, `create_shared`.

### R11 · Explore services — *Tier 1 (light)*
Category grid, SKU page: list price, what's included, "Next Green Valley group: Sunday — 12/20 joined" or "Start a group", seasonal calendar strip.

### R12 · Society tab — *Tier 2 (basic list in Tier 1)*
Verified neighbours, society savings, approved vendors, committee tools (approve/pin/poster-QR/stop-work), annual service calendar.

### R13 · Profile & settings — *Tier 1*
Flat & verification status, payment methods, notification preferences (per-category), language, refer a society (₹ credit), help/chat, legal.

### R14 · Notification centre — *Tier 1*
Price drops, deadlines, bookings, society announcements; deep-links into deals.

---

## VENDOR APP (web-first at V1, native at V2)

### V1 · Today — jobs for today, route order within the building, crew assignment, earnings so far.
### V2 · Deal inbox — incoming requests (society, distance, date, target flats). Accept → set **price ladder**: list price + up to 4 slabs, with JODO's suggested slabs prefilled from category benchmarks; see projected earnings at each slab.
### V3 · Calendar & capacity — blackout days, max flats/day, crew size; "societies near you with open demand".
### V4 · Job execution — per-flat checklist, START/END OTP, before/after photos, parts/extras add-on (resident must approve in-app — no cash upsell).
### V5 · Payouts — settlement T+1, commission breakdown, instant-payout toggle (1.5%), invoices, TDS/GST docs.
### V6 · Profile & KYC — GST/PAN, technician roster with police verification, insurance, badges, rating history and what to fix.

---

## OPS CONSOLE (internal web)

### O1 · Societies — onboarding pipeline, verified-resident count, deals/month, champion (secretary) contact.
### O2 · Deals board — kanban by lifecycle; **Deals at risk** (below MVS with < 24h) with one-click actions: extend deadline, push notification, merge with adjacent tower, ops-call the champion.
### O3 · Vendor assignment & SLA — fill rate, on-time %, cancellations, auto re-tender to backup vendor.
### O4 · Disputes — queue, evidence (photos/OTP timeline), refund/hold/release, warranty claims.
### O5 · Pricing admin — SKU catalogue, list prices per city, slab templates, floor price per vendor (never let a ladder go below cost-to-serve).
### O6 · Finance — escrow balance, payouts, commission realised, GMV by society/category.

---

## Priority for the clickable prototype
`R4 Feed · R5 Deal detail (filling → locked) · R6 Join sheet · R10 Create deal · R7/R8 Booking tracker · V2 Vendor deal inbox` — these six carry the entire idea.
