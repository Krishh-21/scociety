# 01 — Product plan (PRD)

**Working name: JODO** — *"Society services, together."*
(Hindi *jodo* = to join/connect. Alternatives: Padosi, Saath, GroupSe, Tower, Bulkk. Name is a placeholder; everything else here is name-independent.)

---

## 1. Problem

**Resident side.** A flat owner needs AC servicing, deep cleaning, pest control, plumbing, painting, a car wash. Today they either (a) call an unvetted local vendor from a WhatsApp group, with zero price reference and zero recourse, or (b) book Urban Company at full retail. Both are per-flat transactions: the vendor travels for one job, so travel + idle time is priced into every invoice.

**Vendor side.** The real cost structure of a small services business in India is **customer acquisition + travel + idle time**, not labour. A technician does 3–4 jobs a day, half of it spent on the road. Aggregator commission is 20–30%. The vendor will happily cut 30–40% off the sticker price for a guaranteed block of 20 jobs in one building on one day — because his cost per job collapses.

**Society side.** The secretary/RWA already does this badly over WhatsApp: a message, 40 replies, a spreadsheet, chasing payments in cash, no accountability when the vendor no-shows.

**The gap:** nobody has productised *"the building books together."* Everyone sells to the flat. The natural unit of demand in urban India is the **tower**.

## 2. Insight / wedge

> Density is the asset. In a 200-flat society, 20 identical jobs on one Sunday is a vendor's dream route. The discount is not a subsidy — it is **real cost that disappears** when travel and acquisition are amortised across a building.

The video's mechanic is right and must be kept literal: **a public price that falls as neighbours join.** It is a visible, social, FOMO-driven counter — the product's whole personality.

## 3. Target users

| Persona | Who | Core need | What we give them |
|---|---|---|---|
| **Joiner (Rahul, 34)** | Salaried flat owner, 1 BHK–3 BHK, metro/tier-1 | Fair price, trusted vendor, no haggling | One tap to join a deal his neighbours are already in |
| **Starter (Priya, 41)** | The resident who always organises things | Get her job done cheaper, look useful | Create a deal in 30s, share to the WhatsApp group |
| **Secretary / RWA (Mr. Kulkarni, 58)** | Managing-committee member | Zero liability, no cash handling, vendor accountability | Verified vendors, approval control, a record of every job |
| **Vendor (Suresh, 32)** | AC tech / cleaning contractor, 3–12 staff | Full days, no acquisition cost, guaranteed payment | A block of 20 jobs in one building, paid T+1 |
| **Ops (internal)** | City ops associate | Keep fill-rate high | Console: deals at risk, vendor assignment, SLA breaches |

## 4. Scope — what the product is and is not

**Is:** a group-booking layer for scheduled, batchable home services inside gated residential societies.
**Is not:** an on-demand "plumber in 30 minutes" app (that is Urban Company's game and it is the opposite of batching); not a society ERP (maintenance dues, gate passes — that is MyGate/ApnaComplex); not a classifieds board.

**Category filter — a service belongs on JODO only if it passes all four:**
1. **Schedulable** (can wait 3–10 days for the group to fill).
2. **Repeatable & identical** across flats (same SKU, same time per unit).
3. **Travel-heavy** relative to job value (so batching creates real margin).
4. **Trust-sensitive** (neighbours' endorsement is worth something).

**Launch categories (v1):** AC service & repair · Deep cleaning · Sofa/carpet shampoo · Pest control · Water-tank cleaning · Car wash (weekend, recurring) · Chimney cleaning.
**Phase 2:** painting, plumbing/electrical AMC, appliance AMC, RO service, laundry pickup, salon-at-home slots, grocery/bulk staples, EV charger install, solar.
**Never:** anything emergency or same-hour.

## 5. The core mechanic — "Group Deal"

A **Group Deal** is: `society × service SKU × service date × vendor × price ladder × join deadline`.

### 5.1 Price ladder (slab pricing)
The vendor publishes a ladder once per SKU; residents see it live.

| Flats joined | Price / flat | Example (AC service) |
|---|---|---|
| 1–4 | List price | ₹999 |
| 5–9 | −15% | ₹849 |
| 10–19 | −25% | ₹749 |
| 20+ | −35% | ₹645 |
| 35+ (stretch) | −40% | ₹599 |

**Rules that make it fair and un-gameable:**
- **Everyone pays the final slab**, including the first joiner. Early joiners are never punished — the card says *"You'll be charged the final group price, whatever it falls to."* This is the single most important trust rule.
- The ladder is **set by the vendor at listing time** and frozen for the deal's life.
- **Minimum viable slab (MVS)** = the flat count below which the vendor is not obliged to serve (usually slab 2 or 3). Shown as the big "X / 20 flats" goal.
- **Deadline** (typically T-48h before service date). At deadline:
  - MVS met → deal **locks**, payment captured, slots assigned.
  - MVS not met → deal **fails safe**: no charge, everyone notified, offered (a) roll into next week's deal at the same price, or (b) solo booking at list price. *Nobody loses money when the group doesn't fill.*

### 5.2 Lifecycle
`DRAFT → OPEN (filling) → LOCKED (threshold met, payment authorised) → SCHEDULED (slots assigned) → IN_PROGRESS (service day) → COMPLETED → SETTLED`
Failure branches: `EXPIRED (threshold missed)`, `CANCELLED_BY_VENDOR` (→ auto re-tender to backup vendor), `DISPUTED`.

### 5.3 Money flow
- On join: **authorise** (UPI mandate / card pre-auth), do not capture.
- On lock: capture to **JODO escrow**.
- On completion + resident OTP: release to vendor **T+1**, minus take rate.
- Dispute window: 48h post-service; disputed amount held, ops arbitrates; warranty 30 days on workmanship.
- Cash is allowed at v1 (India reality) but **capped**: cash deals get no escrow protection and the UI nudges hard toward UPI. Vendors with >30% cash jobs lose "Assured" badge.

## 6. Trust architecture (why this isn't a WhatsApp group)

1. **Residency verification** — flat number + society, verified by one of: RWA/secretary approval, an existing verified neighbour's vouch, maintenance-receipt upload, or MyGate-style gate record. No stranger can see or join a society's deals.
2. **Vendor vetting** — GST/Aadhaar/PAN, police verification of every technician, insurance for damage up to ₹50k, trade proof, 3 reference jobs. Badges: *Verified*, *Society-Approved*, *Assured* (escrow + warranty).
3. **Visible social proof** — "Amit Kulkarni and 11 neighbours joined" with real names and flat numbers (A-402). This is the mechanic Urban Company structurally cannot copy: they don't know who your neighbours are.
4. **RWA governance mode** — societies can switch on *Approval required*: deals go live only after a committee member approves. Default off for speed, on for conservative RWAs.
5. **Post-service**: photo proof by technician, resident OTP to close the job, 1-tap rating, 30-day workmanship warranty, one-tap re-raise.

## 7. Business model

| Stream | Mechanic | Rate (plan) |
|---|---|---|
| **Take rate** (primary) | Commission on GMV, charged to vendor | 12–18% (vs 20–30% UC) — our pitch: *we are cheaper than UC because we hand you a full day, not a lead* |
| **Vendor SaaS** | ₹999/mo: calendar, crew routing, payouts, deal analytics | Phase 2 |
| **Society plan** | ₹3–5k/yr per society: AMC bundles, annual service calendar, preferred vendors, spend dashboard for the RWA | Phase 2 |
| **Financing** | Instant payout (T+0) at 1.5%; vendor working-capital via NBFC partner | Phase 3 |
| **Brand/CPG** | Sponsored category days (a paint brand sponsors "Society Painting Week") | Phase 3 |
| **Never** | Charging residents a fee to join a deal — it kills the mechanic | — |

### Unit economics (illustrative, AC service)
- Solo market price ₹999 → group price ₹645 at 20 flats.
- Vendor economics: solo = 3 jobs/day, ₹999 each, ~₹400 travel+acquisition per job → ₹1,797 contribution/day.
  Group = 12 jobs/day in one tower, ₹645 each, ~₹60 travel per job → ₹7,020 contribution/day. **~4x.**
- JODO at 15% of ₹645 × 20 = **₹1,935 GMV commission per deal**; payment + ops cost ~₹400 → **~₹1,500 contribution per deal**.
- One 200-flat society doing ~2.5 deals/month ≈ **₹3,750/month contribution per society**. 400 societies ≈ ₹1.5 Cr/yr contribution. CAC per society (one ops visit + secretary incentive) ≈ ₹3–5k → **payback ~6–8 weeks**.

## 8. Competition & moat

| Player | What they own | Why they don't do this |
|---|---|---|
| **Urban Company** | Supply + brand, per-flat pricing | Group discounting cannibalises retail price; their unit is the customer, not the building; no society graph |
| **NoBroker** | Society management + some services | Services are a cross-sell, not a group mechanic; priced per flat |
| **MyGate / ApnaComplex / ADDA** | The society graph (gate, dues) — **the real threat** | Monetise via maintenance software; services are a marketplace listing, not aggregated demand |
| **WhatsApp + secretary** | Everything today | No price ladder, no escrow, no accountability, no memory |

**Moat, in order of durability:**
1. **Society-level liquidity** — per-tower, not per-city. Winning 60% of towers in one pincode makes vendor routing dense and prices structurally lower; a competitor entering must refill society by society.
2. **Supply lock** — vendors who restructure crews around full-building days get calendar dependence.
3. **The social graph of verified neighbours** + deal history (what this building buys, when).
4. **Recurrence data** — "AC service every March, deep clean every October" → auto-generated calendar, i.e. demand we create rather than wait for.

## 9. Go-to-market

**Phase 0 — one pincode, 10 societies, manual (weeks 1–8).**
- Pick one high-density pocket (e.g. Hinjewadi/Wakad, Pune; or Gachibowli; or Thane West). 150+ flats per tower, 2015+ construction (AC/appliance heavy), active RWA.
- Sign **3 vendors per category** before touching residents. Vendors come from existing society work — ask the secretary who they already use and onboard *that* vendor. Supply = trust shortcut.
- **Secretary-first GTM.** The secretary is the distribution channel: give them a *Society Champion* dashboard, a QR poster for the lift/noticeboard, and a WhatsApp-ready deal link. Incentive: ₹500/successful deal or free service once a quarter. Never paid ads at this stage.
- Seed the first deal manually: ops picks the obvious seasonal job (pre-Diwali deep clean, pre-summer AC service), prices it, and the secretary posts it.

**Phase 1 — 100 societies, one city (months 3–9).** Self-serve deal creation, vendor app, referral between neighbouring societies ("Palm Grove next door saved ₹600/flat"). Seasonal calendar push (AC: Feb–May, deep clean: Sep–Oct Diwali, pest: monsoon, painting: Nov–Feb).
**Phase 2 — 3 cities, 1,000 societies (months 9–24).** Society plans, AMC subscriptions, recurring car-wash as the daily-habit hook.

**The wedge campaign:** *"Your building is paying 3 different prices for the same job."* Show the tower a real price comparison.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Chicken-and-egg** (empty feed) | Ops-seeded deals + secretary champion + vendor pre-signed; never launch a society without a live deal on day 1 |
| **Threshold rarely met** | Start MVS low (8–10 flats), use "stretch slabs" for upside; auto-extend deadline once by 48h; merge adjacent-tower deals in the same complex |
| **Vendor disintermediation** (vendor takes the building off-platform next time) | Escrow + warranty only on-platform; vendor rating & calendar value; society plan ties the RWA to us; price ladder requires our aggregation to exist |
| **Quality failure damages a whole building at once** | Blast radius is the risk of this model: insurance, tech-level (not just vendor-level) ratings, staged rollout within a deal (first 3 flats early slot, ops watches), instant stop-work authority for the secretary |
| **Seasonality** | Category calendar engineered across the year + recurring car wash/housekeeping as a baseload |
| **RWA politics / kickback culture** | Transparent pricing, optional RWA commission share declared in-app, never off-book |
| **MyGate ships group booking** | Speed, vendor exclusivity in launch pincodes, deeper vendor tooling, and an integration offer (be their services layer) |
| **Payments friction / cash culture** | UPI autopay mandates, cash allowed but un-assured, vendor paid T+1 regardless |

## 11. Success metrics

**North star: *flats served per society per month* (density of repeat demand).**

| Layer | Metric | v1 target |
|---|---|---|
| Activation | % residents verified in an onboarded society | 25% in 30 days |
| Core | Deal fill rate (deals reaching MVS) | > 65% |
| Core | Median flats per completed deal | ≥ 14 |
| Core | Time from deal open → lock | < 72h |
| Retention | Resident repeat within 90 days | > 35% |
| Supply | Vendor on-time arrival | > 92% |
| Quality | CSAT post-service | > 4.5 / 5 |
| Money | Take rate realised / contribution per deal | 15% / ₹1,500 |
| Society | Societies with ≥ 2 deals/month | > 50% |

## 12. Release plan

**V0 — Concierge (4 weeks, no app).** WhatsApp + a web deal page with the live counter and ladder. Prove fill rate and vendor discount in 10 societies. *Kill criterion: fill rate < 40% after 20 attempted deals.*
**V1 — Resident app + vendor web (10 weeks).** Everything in `04-screens-spec.md` Tier 1: onboarding/verification, feed, deal detail + live ladder, join + pay, slot pick, booking tracking, OTP completion, rating, my bookings, create-deal, notifications. Vendor: deal inbox, ladder listing, crew-day view, payouts.
**V2 — Scale (months 4–9).** Vendor mobile app, recurring deals & AMC, society plan + RWA dashboard, referral between societies, ops console v2, ratings-driven vendor ranking, multi-vendor bidding on a deal.
**V3 — Platform (months 9–24).** Open vendor marketplace with auto price-ladder suggestions, demand forecasting per society, financing, CPG-sponsored category weeks, API/integration with MyGate-type apps.

See `06-roadmap.md` for the sprint-level breakdown.
