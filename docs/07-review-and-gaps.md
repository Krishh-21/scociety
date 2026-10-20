# 07 — Review: flow gaps, bugs and improvements

A pass over every file in the build (`lib/`, `app/`, `components/`, `docs/`) against the flows in
`02-ux-flows.md` and the invariants in `01-product-plan.md` §5 and `05-architecture.md` §3.

Verdict: the spine is right — one deal engine, one price function, one lifecycle, and the whole
resident → vendor → ops loop works end to end. What is missing is the **enforcement layer**: the
rules are stated in the docs and in comments, but several of them are not actually guarded in
code, and three of those let a user or a vendor change what someone else pays.

Severity: **P0** = breaks a money/trust promise · **P1** = security or privacy ·
**P2** = flow gap a real user will hit · **P3** = UX/polish · **P4** = engineering hygiene ·
**P5** = specified in the docs, not yet built.

---

## Status — what has since been fixed

| # | Finding | State |
|---|---|---|
| 1 | Price rose when a member left | **Fixed** — `deal.floorPricePaise` ratchets down on every join; `effectivePrice()` charges `min(slab, floor)`; the UI says "price held at ₹645". |
| 2 | Vendor could raise a live ladder | **Fixed** — `ladderRaisesPrice()` compares the old and new ladders at every count; `updateSlabs` refuses any edit that is dearer once anyone has joined. |
| 3 | Deal page rendered closed deals as open | **Fixed** — `tickDeal(id)` runs before the deal page reads the deal. |
| 4 | Ladder counted flats for per-unit services | **Fixed** — `sku.ladderBasis` (`flats` \| `units`); AC and car wash count units, and every surface reads `basisCount` / `basisLabel`. |
| 5 | No authorisation on mutating actions | **Fixed** — `lib/authz.ts` (`can` / `assertCan`), deny by default, wired into all eight mutating actions. |
| 6 | Society boundary was advisory | **Fixed** — enforced in `joinDeal` (`societyId` argument) and on the deal page's read path (`deal.view`). |
| 7 | Demo control in the resident flow | **Fixed** — removed from the deal page; ops-only and non-production in `authz`. |
| 8 | Session hygiene | **Fixed** — `secure` in production, `expiresAt` + sweep, 5-attempts-per-10-minutes OTP throttle. |
| 9 | Target vs minimum confusion | **Fixed** — the counter now tracks one number (the target that unlocks the best price); `mvs` appears only in the fail-safe line. |
| 25 | No tests | **Fixed** — 37 tests (`npm test`) over the pricing functions and the engine: final-price equality, price-held-on-leave, ladder-raise refusal, expire-charges-nobody, deadline close, society boundary, ladder basis. |
| 26 | Commission magic number | **Fixed** — `COMMISSION_BPS` + `commission()` in `lib/pricing.ts`. |
| 10 | No slot capacity | **Fixed** — `sku.unitsPerSlot`; `joinDeal` refuses an over-booked slot, and the sheet and deal page show what's left. |
| 11 | No notifications | **Fixed** — `notification` table + `lib/notify.ts`, written on new deal, price drop, comment, lock, extension, expiry, service day, job done, issue raised/resolved; bell + `/notifications`. |
| 12 | No share moment | **Fixed** — `lib/share.ts` + a share button on the deal, after joining and after creating; `opengraph-image` renders the counter card for the link. |
| 13 | Approval modelled but dead | **Fixed** — `approvalRequired` societies create deals as `pending`; committee (or ops) approves, which announces it. |
| 14 | Expired deals in bookings | **Fixed** — their own row: "didn't fill, not charged" + start again. |
| 15 | No disputes / refunds | **Fixed** — `dispute` table, warranty-window check, resident raises from a completed booking, ops resolves (refund / revisit / no action), refunds written to the ledger. |
| 16 | Service day unrealistic | **Fixed** — slots go out one at a time, start OTP then completion OTP, queue position ("3 flats ahead, ~40 min"). |
| 17 | No deadline extension | **Fixed** — a group at ≥60% of its minimum gets one automatic 48h extension, then expires. |
| 18 | Join sheet not a dialog | **Fixed** — `aria-modal`, Escape, focus trap, focus returned to the opener. |
| 19 | No loading / error states | **Fixed** — `loading.tsx`, `error.tsx` (with the digest for support), `not-found.tsx`. |
| 20 | Counter didn't move | **Fixed** — `AutoRefresh` polls while visible, and pauses while a form is mid-submit. |
| 21 | Dark mode unimplemented | **Fixed** — tokens under `prefers-color-scheme` and `data-theme`, with a system/light/dark toggle in Profile. |
| 22 | No Hindi | **Fixed** — `lib/i18n.ts` dictionary, `user.lang`, toggle in Profile; untranslated keys fall back to English. |
| 24 | Scheduler inside render | **Fixed** — in-process ticker started on first read (`JODO_TICK_MS`) plus `POST /api/cron/tick` for real deployments; `lockDeal` is now idempotent. |
| 27 | Money maths scattered | **Fixed** — `lib/money.ts`. |
| 28 | `getDealView` N+1 | **Improved** — service, vendor and society rows are memoised; deal, member and payment rows are never cached. |
| 29 | No structured errors | **Partly** — `error.tsx` surfaces the digest and logs it; a real Sentry hook is still open. |
| 30 | Dead code | **Fixed** — `sendOtp` removed, `next.config.ts` trimmed; `deal_event` is now read by the ops board's history. |
| P5 | Payments, verification routes, recurring demand, analytics | **Partly** — a payment ledger (authorise → capture → release → refund), repeat reminders per SKU, and an analytics event log behind the ops funnel are in. Real Razorpay, SMS/WhatsApp delivery, document-based verification, society plans, referrals and multi-vendor bidding remain open. |

Still open: #23 (copy nits), #25 is done but coverage can go deeper, #29 (logging), #31 (Postgres
seam), and the P5 integrations listed above.

## Second pass — 21 Oct 2026

A fresh read of every file plus a walk through every screen at phone width turned up these, all
fixed on `improve/ux-and-flow-fixes`:

| Area | Finding | Fix |
|---|---|---|
| Sign-in | A blank or short phone number plus the code signed in as a user with no phone | `isValidPhone` — ten digits starting 6–9 |
| Onboarding | Anyone could claim a flat a neighbour already held, or a society that didn't exist | `claimResidency` refuses both; "a402", "A 402", "A/402" all become "A-402" |
| Create | Every vendor was offered for every service, and the default never changed — a car-wash group went to the AC vendor | `vendor.skuIds`; the form offers only vendors who do the service and the server refuses the rest |
| Create | "flats" wording on AC and car-wash groups; past dates selectable; date picked in UTC | Basis-aware labels, `min` date, local date |
| Feed | Groups past their deadline showed as "Filling · Closed" until the background ticker ran | `feed`, `opsBoard`, `vendorDeals` close due deals before reading |
| Ladder | Rows lit up by flat count on unit-based deals; ops "Lock now" checked flats too | Both use `basisCount` |
| Analytics | `deal_view` fired on every 30-second auto-refresh | Tracked once per visit from the client |
| Deal page | The tab bar sat hidden under the Join bar | Detail screens get a back-chevron header and no tab bar |
| Styling | Component classes were unlayered, so every utility on them lost: tinted cards rendered white, small buttons stayed 48 px | Moved into `@layer components` |
| Theme | The light/dark choice only applied on the Profile page | Applied before first paint from the root layout |
| Dark mode | White rings around avatars | `ring-surface` |
| Share | "Share to WhatsApp" opened a generic share sheet or copied silently | A real `wa.me` link plus a Copy button |
| Comments | An AC question and "I am in." appeared on every group, joined or not | Service-aware, join-aware quick replies; comments show their age |
| Vendor console | The resident's codes were printed in the vendor's input placeholder | Shown only in development |
| Share images | The OG renderer has no ₹ glyph | "Rs" in generated images |
| Demo | Seed dates are relative, so a few days later every group looked closed | "Reset demo data" in ops (development only) |

Also added: a public landing page, `/partners`, `/help`, `/privacy`, `/terms`, society and vendor
sign-up forms feeding an ops table, tab-bar icons, metadata, sitemap, robots, manifest, app icon
and Open Graph cards. Tests: 72.

Everything below this line is the original review, kept as written.

---

## P0 — the price promises are not enforced

### 1. The price can go **up** when a member leaves
`lib/pricing.ts:9` derives the price from the live member count, and `lib/deals.ts:159`
(`leaveDeal`) just flips a member to `left`. So 20 flats → ₹645; one flat leaves → everyone
jumps back to ₹749. The product's second invariant ("while a deal is open the price may only
fall", `05-architecture.md` §3.2) is documented and commented but never implemented.

**Fix:** store `floorPricePaise` on the deal, updated on every join (`min(current, new)`), and
make `currentPrice` return `min(slabPrice, deal.floorPricePaise)`. Show "price held at ₹645 for
current members" when the count has dropped below the slab. Add a test.

### 2. A vendor can raise the price of a group people have already joined
`updateSlabs` (`lib/deals.ts:303`) is callable while the deal is `open`, and `validateSlabs`
(`lib/pricing.ts:39`) only checks that each slab is cheaper than the one *before it* — not that
it is cheaper than what the deal is already offering. CoolCare can edit the 20+ slab from ₹645
to ₹740 after 22 flats have joined, and every member silently owes ₹95 more.
`01-product-plan.md` §5.1 says the ladder is "frozen for the deal's life".

**Fix:** reject any slab edit once `flatsJoined > 0` unless every new slab price is ≤ the old one
at the same flat count; otherwise require the deal to be re-published. Log the edit to
`deal_event` either way.

### 3. Deal state is stale on the surface where people spend money
`tick()` runs inside `feed()`, `opsBoard()` and `vendorDeals()` (`lib/deals.ts:81, 298, 317`) but
**not** in the deal page (`app/deal/[id]/page.tsx:28`). Open a deal whose deadline passed ten
minutes ago by its direct link and it still renders "Filling" with a live Join button. The join
is then refused deeper in (`joinDeal` re-checks the deadline), so no money moves — but the UI
lies, and the fail-safe copy ("if 10 flats don't join by the deadline…") is still showing after
the deadline.

**Fix:** call `tick()` in `getDealView`, or better, move it out of render entirely (see P4.1).

### 4. Slabs count flats, but the video's headline case counts **cars**
`currentPrice` takes `flatsJoined`. The car-wash SKU is priced per car and the reel's pitch is
"50 cars at once" — a single flat with three cars moves the vendor's economics as much as three
flats, but counts as one. `unitsJoined` is computed in `getDealView` and then used only for
display.

**Fix:** put `ladderBasis: "flats" | "units"` on the SKU and feed the right number into
`currentPrice`. Car wash and AC (multi-AC flats) should both be unit-based.

---

## P1 — anyone signed in can do anything

### 5. No authorisation on any mutating action
Every action in `app/actions.ts` calls `requireMe()` and nothing else. A signed-in resident can
POST to `lockAction`, `expireAction`, `startServiceAction`, `updateSlabsAction`,
`completeJobAction` and `rateAction` for **any** deal or job, including another society's.
`rateJob` doesn't check that the rater owns the job; `completeJob` only checks the OTP, which is
printed in the vendor UI placeholder.

**Fix:** one `assertCan(me, "lock" | "rate" | …, resource)` helper — ops role for lock/expire,
`me.user.vendorId === deal.vendorId` for ladder/start/complete, `job.member.userId === me.id`
for rating. Deny by default.

### 6. The society boundary is advisory, not enforced
`joinAction` (`app/actions.ts:74`) takes the deal id from the form and the flat from the
session, but never compares `me.residency.societyId` with `deal.societyId`. The deal page
computes `canJoin` for the button (`app/deal/[id]/page.tsx:33`) — a UI check only. Likewise
`getDealView` will return the full member list (real names + flat numbers) of any society's deal
to any signed-in user. `01-product-plan.md` §6.1 promises the opposite.

**Fix:** enforce society membership in `joinDeal` and in `getDealView`'s read path; 404 a deal
the viewer's society doesn't own.

### 7. Demo controls ship inside the resident flow
`SimulateJoins` renders on the public deal page (`app/deal/[id]/page.tsx:171`) and
`simulateAction` is callable by anyone. It writes real joins at real prices.

**Fix:** gate on `role === "ops"` **and** `process.env.NODE_ENV !== "production"`; keep it on
`/ops` only.

### 8. Session hygiene
Cookie has no `secure` flag and no expiry server-side (`lib/session.ts:16`); sessions are never
cleaned up; OTP is a constant with no rate limit and no attempt counter.

**Fix:** `secure: true` outside dev, `expiresAt` column + sweep, per-phone OTP throttle. This is
also where real OTP delivery lands.

---

## P2 — flow gaps a real user hits

9. **Target vs minimum reads as two different goals.** The counter shows `12 / 20` (target) while
   the lock threshold is `mvs` (10), so a deal can say "Minimum reached" while the bar is at 60%.
   Decide one number for the resident ("20 flats needed to unlock ₹645") and keep `mvs` as the
   internal confirm threshold, shown only as the fail-safe line.
10. **No slot capacity.** `joinDeal` accepts any slot in the list; all 22 flats can pick
    08:00–10:00 (the vendor console shows exactly that today). `02-ux-flows.md` §3.2 specifies
    capacity-aware slots. Derive capacity from `sku.durationMin` × crew size and grey out full
    slots.
11. **Nothing happens at the moment that matters.** The price-drop and lock events are the
    product's heartbeat (`02-ux-flows.md` §5) and there is no notification layer at all — not even
    an in-app notification centre. At minimum: a `notification` table written by
    `joinDeal`/`lockDeal`/`expireDeal`, a bell on the feed, and a WhatsApp-ready share string.
12. **No share moment.** `01-product-plan.md` calls the share card "the actual distribution
    moment"; after a successful join the sheet just closes. Add a success state with a copyable
    WhatsApp line and an OG image route (`/deal/[id]/card.png`).
13. **Society approval is modelled but dead.** `society.approvalRequired` is seeded as 1 for Palm
    Grove and `deal.approvedBy` exists; `createDeal` ignores both, so a committee-gated society
    publishes instantly.
14. **Expired deals sit in "My bookings"** with a tracker stuck at "Joined" and no explanation.
    Give them their own "Didn't fill — not charged" row with the two recovery actions from the
    deal page.
15. **No leave-after-lock path, no cancellation, no dispute, no refund.** The docs specify a 48h
    dispute window and a 30-day warranty claim; neither exists in code. Even a stub
    (`dispute` table + an ops queue) closes the loop.
16. **Service-day realism.** `startService` flips every job to `en_route` at once; there is no
    per-slot progression, no "3 flats ahead", no start-OTP step (only completion), and no photo
    capture — all specified in `04-screens-spec.md` R8/V4.
17. **One deadline, no extension.** `02-ux-flows.md` §3.3 promises a one-time 48h auto-extend when
    a deal is close; `tick()` only locks or expires.

---

## P3 — UX and accessibility

18. **Join sheet is not a proper dialog.** No focus trap, no Escape-to-close, no `aria-modal`, and
    the backdrop is a `div` with `onClick` (keyboard users can't dismiss it).
    `components/JoinSheet.tsx` should use a `<dialog>` element or add the full pattern.
19. **No optimistic UI and no loading skeletons.** Every join/comment is a full server round trip
    with a dead button; there is no `loading.tsx` in any route and no `error.tsx` anywhere, so a
    thrown server error shows Next's raw error page (as it did during the build).
20. **The counter doesn't move on its own.** `Countdown` ticks every 30s but the price and flat
    count only change on refresh — the one screen that should feel alive is static. Poll the deal
    (or SSE) every 15–30s and animate the digits as `03-design-system.md` §5 describes.
21. **Dark mode is specified and not implemented.** `03-design-system.md` §1 defines the full dark
    token set; `app/globals.css` has zero `prefers-color-scheme` rules.
22. **No Hindi.** The language toggle is drawn on the login screen and does nothing; every string
    is hard-coded English in JSX. Extract to a dictionary before the copy multiplies.
23. **Minor copy/layout**: the feed's "Suggested" card can advertise a SKU that already has a live
    deal in another state; `0 AC units · CoolCare` reads oddly on a brand-new deal; the ladder's
    first row renders `1–4 flats` by inferring from the next slab, which breaks if a SKU has one
    slab.

---

## P4 — engineering hygiene

24. **The scheduler lives inside render.** `tick()` is called from Server Components, so deadline
    closing (which captures money and creates jobs) happens as a side effect of someone loading a
    page — and never happens if nobody looks. Move it to a route handler (`/api/cron/tick`) plus
    an in-process interval for dev, and make `lockDeal` idempotent (`INSERT … WHERE NOT EXISTS`
    on jobs) so two concurrent processes can't double-create them.
25. **No tests.** For an engine whose whole value is "everyone pays the final price", there should
    be unit tests on `currentPrice`/`validateSlabs` and integration tests for join → slab change →
    lock → final price equality, leave-after-lock refusal, and expire-charges-nobody. This is the
    single highest-value item in this list after P0.
26. **Commission rate is a magic number in three places** (`app/vendor/page.tsx:28,175`,
    `lib/deals.ts:329`). One `COMMISSION_BPS` constant and a `commission(paise)` helper.
27. **Money maths is scattered.** `gross = Σ final × units` is recomputed in the vendor page, the
    ops board and the society savings query, each slightly differently (`societySavings` uses
    `listPrice − final`, the vendor page uses `final ?? currentPrice`). One `lib/money.ts`.
28. **`getDealView` is an N+1 machine** — one query per deal for sku, vendor, society, members and
    comments, and `feed()` calls it per deal. Fine at seed scale, wrong by 100 societies. Batch
    with joins, or memoise per request with `React.cache`.
29. **`DealError` vs generic errors**: `fail()` swallows everything else into "Something went
    wrong" with a `console.error`; no structured logging, no Sentry hook, no request id.
30. **Dead code and noise**: `sendOtp` is unused; `next.config.ts` carries two empty options;
    `lib/types.ts` `DealStatus` includes `cancelled` which nothing can produce; `deal_event` is
    written faithfully and never read.
31. **SQLite + `node:sqlite` is a single-process store** (and still flagged experimental). Fine
    for this build; the repository boundary in `lib/db.ts` is the right seam for Postgres, but
    `all()/one()` returning `any`-ish rows means a swap will be a type-refactor. Worth narrowing
    now.

---

## P5 — specified in `docs/`, not yet built

Residency verification routes (vouch/receipt/ops queue, currently instant) · secretary approval
and "stop work" · notification centre and WhatsApp/push · share cards · payments (mandate,
capture, refund, escrow, payouts beyond the display table) · disputes, warranty claims, refunds ·
recurring deals and AMC subscriptions · society plan and RWA dashboard · referral between
societies · multi-vendor bidding on one deal · vendor KYC/technician roster · ops deal-at-risk
automation (nudge, extend, merge adjacent towers) · analytics events (`04-screens-spec.md` lists
them per screen; none are emitted).

---

## Suggested order of work

1. **P0 #1, #2, #3** — three small changes in `lib/` that restore the product's central promise.
2. **P4 #25** — tests around those invariants, so they stay restored.
3. **P1 #5, #6, #7** — an `assertCan` helper and the society boundary; delete the demo control
   from the resident path.
4. **P2 #9, #10, #14** — make the counter, slots and expired bookings honest.
5. **P2 #11, #12** — notifications + share card: the first thing that makes the app spread.
6. **P4 #24, #26, #27** — move the scheduler out of render, centralise money.
7. **P3 #18–#22** — dialog semantics, live counter, loading/error states, dark mode, Hindi.
8. Then P5 by product priority: payments → verification → approval/stop-work → recurring deals.
