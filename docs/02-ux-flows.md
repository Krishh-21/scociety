# 02 — UX: information architecture, flows, states

## 1. Design principles

1. **The counter is the product.** Every surface answers "how many flats so far, and what does that make the price?" within one second of landing.
2. **Neighbours, not strangers.** Real names + flat numbers everywhere. Social proof beats star ratings in a building.
3. **Join in two taps.** Feed → Deal → Join. Everything else (slot, payment method, address) is pre-filled from the profile and editable later.
4. **Never punish the early joiner.** Say it on every price surface.
5. **Fail safe and say so.** "If 20 flats don't join by Friday, you are not charged." Printed next to the CTA, not in T&C.
6. **Hinglish-first, 2-language toggle (EN/हिंदी + regional at v2).** Numbers, ₹ and dates are the primary content — keep text short enough to translate without reflow breaking.
7. **Low-end Android first.** < 15 MB APK, works on 3G, offline-readable deal state, no blocking animations.

## 2. Information architecture (resident app)

```
Tab 1  Home (society feed)
        ├─ Live deals (filling)              → Deal detail
        ├─ Starting soon / suggested by JODO → Deal detail
        ├─ Your society activity             → Deal detail
        └─ Start a deal (FAB)                → Create deal wizard
Tab 2  Explore services
        ├─ Category grid → SKU page (list price + "start a group" + next society deal)
        └─ Seasonal calendar ("Pre-Diwali deep clean — Oct")
Tab 3  My bookings
        ├─ Upcoming (status tracker)
        ├─ History (invoice, warranty, re-book)
        └─ Disputes
Tab 4  Society
        ├─ Neighbours (verified, flat no.)
        ├─ Society savings ("₹1.4L saved this year")
        ├─ Approved vendors
        └─ Committee tools (secretary only: approve deal, pin, poster/QR)
Tab 5  Profile
        └─ Flat & verification, payment methods, notifications, language, help, refer
```

**Vendor app IA:** Today → Deal inbox (accept/quote ladder) → Calendar & crew → Jobs (OTP/photo/complete) → Payouts → Profile/KYC.
**Ops console (web):** Societies · Deals at risk · Vendor assignment · SLA & disputes · Payouts · Pricing admin.

## 3. Flows

### 3.1 Onboarding + residency verification (first run)
```
Splash → Phone + OTP
      → "Find your society" (GPS-sorted list, search, or invite link/QR from secretary)
      → Pick tower/wing + flat number → Owner/Tenant
      → Verification route, one of:
           a) Invite link from secretary        → instant verified
           b) Neighbour vouch (pick 1 verified) → verified on their tap (≤ 2h SLA)
           c) Maintenance receipt / ID upload   → ops verify (≤ 12h)
           d) Society not listed                → "Request society" + secretary contact capture
      → While pending: FULL feed is visible in read-only "Preview mode"
         (you can see the counter and price — you cannot join). This is deliberate: the price ladder is the hook.
      → Verified → push: "You're in. 3 live deals in Green Valley."
```
**Empty-society case:** no live deals → show *Suggested for your society* (seasonal SKUs with a "Be the first — invite your neighbours" CTA that generates a WhatsApp card).

### 3.2 Join a deal (the money flow)
```
Feed card → Deal detail
   ├─ Hero: counter 12/20 + live price ₹749 (strikethrough ₹999) + "Save ₹250"
   ├─ Ladder visual: slabs with the current one lit, next slab "3 more flats → ₹645"
   ├─ Deadline countdown: "Closes in 2d 4h"
   ├─ Vendor card: name, rating, badges, 2 past jobs in this society
   ├─ What's included / not included (SKU scope, so disputes don't start here)
   ├─ Neighbours joined (avatars + flat no.) + comments
   └─ Sticky CTA: [Join group · ₹749*]  *final price may drop further
Tap Join →
   Step 1  How many units? (ACs / cars / BHK size) → price recalculated
   Step 2  Pick a slot on the service day (10:00–12:00 etc., capacity-aware)
   Step 3  Pay: UPI mandate / card pre-auth / cash (un-assured, warning)
            Copy: "₹0 charged now. You're charged the FINAL group price only when the group locks."
   → Joined state: confetti-free, utilitarian success + two actions:
            [Share to society WhatsApp]  [Invite a neighbour]
   → Auto-generated share card: "Green Valley — AC service Sunday. 13/20 flats. ₹749 → ₹645 at 20."
```

### 3.3 Price-drop & lock (the retention loop)
- Each slab crossing fires a **push to everyone already joined**: *"Price dropped to ₹645. You now save ₹354 — because 7 more neighbours joined."* (This is the share trigger, and the reason people invite.)
- At deadline: **Lock** → payment captured → slot confirmed → vendor crew assigned → "Group booking confirmed: 20 flats, 1 vendor, Sunday."
- **Threshold missed** → `EXPIRED` screen: no charge, three one-tap options — *extend 48h* (if vendor agrees), *roll to next week's deal*, *book solo at ₹999*.

### 3.4 Service day
```
T-24h  push: "Suresh (AC Care) arrives tomorrow 10–12. Keep the ACs accessible."
T-1h   live tracker: crew en route, position in the building queue ("3 flats ahead, ~40 min")
Arrival → technician photo + ID shown in-app; resident shares a 4-digit START OTP
Work    → technician uploads before/after photos
Finish  → resident gives END OTP → invoice generated → 1-tap rating (😞 🙂 😀) + optional note
T+48h  dispute window closes → vendor settled
```
**Secretary superpower:** a *Stop work* button visible to committee members during IN_PROGRESS, which pauses the whole deal and pings ops.

### 3.5 Create a deal (resident or secretary)
```
FAB "Start a group" →
  1 Pick service (grid)   2 Pick date (calendar shows "most neighbours free: Sun")
  3 How many flats to target (default = SKU's MVS)   4 Deadline (default T-48h)
  5 Vendor: [Let JODO pick top-rated] (default) | pick from society-approved list
  6 Preview card → Publish
  → If society has "Approval required": goes to secretary; otherwise live instantly
  → Immediately offers the WhatsApp share card (this is the actual distribution moment — never skip it)
```

### 3.6 Vendor flow
```
Deal request (push) → see: society, distance, date, target flats, your ladder
  → Accept with ladder (list price + 4 slabs, auto-suggested from category benchmarks)
  → Watch counter fill → LOCKED notification with final flat count + route sheet
  → Service day: crew assignment, per-flat OTP + photos
  → Payout T+1, dashboard: earnings, on-time %, rating, "societies near you with open demand"
```

## 4. State matrix (every screen must handle these)

| State | Feed | Deal detail | Booking |
|---|---|---|---|
| Loading | Skeleton cards | Skeleton hero | Skeleton |
| Empty | "No live deals — start one" + seasonal suggestions | — | "No bookings yet" + explore |
| Unverified | Preview mode banner + locked CTA | CTA → "Verify to join" | — |
| Error/offline | Cached feed + "Showing saved" bar | Cached last price + "may have changed" | Cached |
| Filling | Counter + ladder | Live counter, next-slab nudge | — |
| Almost there | "2 flats to go" amber pill | Urgency band + invite CTA | — |
| Locked | Green "Confirmed" card | Confirmed hero + slot | Tracker |
| Expired | Grey card + "rolled to next week" | Fail-safe screen, 3 options | — |
| In progress | Live tracker pill at top of feed | Crew position + OTP | Live |
| Completed | — | Invoice + rate + warranty | History entry |
| Disputed | — | Dispute status + ops contact | Dispute thread |

## 5. Notification plan (the product's heartbeat)

| Trigger | Channel | Copy pattern |
|---|---|---|
| New deal in your society | Push + WhatsApp | "AC service, Sunday. 4 flats joined. ₹999 → ₹645 at 20." |
| Slab crossed | Push (to joined + not-joined) | "Price dropped to ₹749. 12 flats in." |
| 2 flats from next slab | Push to joined | "2 more flats → you all save ₹104 more. Invite a neighbour." |
| Deadline −12h, not joined | Push | "Closing tonight. 18/20 flats." |
| Locked | Push + WhatsApp + SMS | "Confirmed. Sunday 10–12. ₹645/flat." |
| Expired | Push | "Didn't fill. You weren't charged. Roll to next Sunday?" |
| T−24h / T−1h / arrival | Push | Logistics |
| Post-service | Push | "Rate Suresh. 30-day warranty active." |
| Seasonal | WhatsApp | "Pre-Diwali deep clean — 3 societies near you already booked." |

**Rule:** max 1 marketing push/day, unlimited transactional. Price-drop pushes are transactional (they change what the user owes) and are the reason retention works.

## 6. Accessibility & localisation
- Min touch target 44×44; body text ≥ 15sp; contrast ≥ 4.5:1 (price text ≥ 7:1).
- Numerals always Western Arabic; ₹ always prefix; prices never abbreviated.
- Full dark mode (tokens in `03-design-system.md`).
- Screen-reader labels on the counter ("12 of 20 flats joined, current price 749 rupees per flat").
- Copy ≤ 2 lines per card at Hindi length (+30% expansion budget on every string).
