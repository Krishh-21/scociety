# 06 — Roadmap, team, budget, validation

## Phase 0 · Concierge validation — weeks 1–4 (₹1–2 L)
No app. A one-page web deal page (counter + ladder + join form) + WhatsApp + a spreadsheet.
- Week 1: pick the pincode; sign 6 vendors (2 each: AC, deep clean, car wash) with written slab ladders.
- Week 2: onboard 10 societies via secretaries; poster + QR in lifts; collect flats + phone numbers.
- Weeks 3–4: run 10–20 deals manually. Capture: fill rate, time-to-fill, discount achieved, no-show rate, CSAT.
**Go/no-go:** fill rate ≥ 50%, discount ≥ 25% vs list, CSAT ≥ 4.3, ≥ 30% of joiners repeat or join a second deal. Fail → pivot the mechanic (lower MVS, different categories), not the thesis.

## Phase 1 · V1 build & launch — weeks 5–16 (₹25–40 L)
| Sprint (2 wks) | Deliverable |
|---|---|
| S1 | Auth, society/flat, residency verification, ops console v0, SKU + vendor + ladder admin |
| S2 | **Deal engine** (open → slab → deadline → lock/expire) + full test suite; payments: mandate, pre-auth, capture, refund |
| S3 | App: feed, deal detail, LadderMeter, join sheet, notifications (push + WhatsApp) |
| S4 | Jobs: slots, OTP, photos, completion, rating, invoices; booking tracker |
| S5 | Vendor web app (inbox, ladder, calendar, job execution, payouts) + settlement |
| S6 | Create-deal wizard, share cards, society savings, polish, Play Store beta in the 10 pilot societies |
**Exit:** 25 societies live, ≥ 60% fill rate, ≥ 150 completed jobs/month, NPS ≥ 40.

## Phase 2 · Density & monetisation — months 5–9 (₹60–90 L)
100–150 societies in one city · vendor native app · recurring deals & AMC subscriptions · society plan + RWA dashboard · society-to-society referral · multi-vendor bidding · ops console v2 (deals-at-risk automation) · seasonal campaign engine.
**Exit:** ₹1 Cr monthly GMV, contribution-positive per city.

## Phase 3 · Multi-city platform — months 10–24
3 cities · open vendor marketplace with suggested ladders · demand forecasting per society · instant payouts/financing · CPG-sponsored category weeks · integration/partnership with society-management apps.

## Team
Phase 0: 2 founders + 1 ops associate.
Phase 1: + 1 full-stack, 1 mobile (RN), 1 designer (part-time), 1 city-ops lead. (≈ 6 people.)
Phase 2: + 2 engineers, 1 ops per 50 societies, 1 vendor-supply manager, 1 support.

## Budget sketch (first 12 months)
Build ₹45 L · Ops/supply ₹25 L · Infra+tools ₹6 L · Marketing (secretary incentives, posters, WhatsApp) ₹12 L · Buffer ₹12 L → **≈ ₹1 Cr** to reach ~150 societies with proven unit economics. Raise: ₹1.5–2 Cr pre-seed after Phase 0 numbers exist.

## Measurement plan
Weekly: fill rate, median flats/deal, time-to-fill, discount delivered, on-time %, CSAT, repeat rate, societies ≥ 2 deals/month.
Monthly cohort: residents verified → first join → repeat at 30/60/90 days; society cohort: deals/month curve by onboarding month.
Instrument every event listed in `04-screens-spec.md`.

## Open decisions (owner + by when)
1. **Name & brand** — JODO vs alternatives. *Founder, week 1.*
2. **Launch city/pincode** — Pune vs Hyderabad vs Thane. *Founder + ops, week 1, decided on tower density + RWA access.*
3. **Cash policy** — allow at V1 (un-assured) or UPI-only. *Recommend: allow, capped; revisit at 500 jobs.*
4. **MVS default per SKU** — 8, 10 or 20. *Recommend: start at 10 for AC/cleaning, 15 for car wash; tune from Phase 0 data.*
5. **RWA revenue share** — declare in-app or refuse entirely. *Recommend: optional, declared, capped at 2%.*
6. **MyGate-type integration** — compete or partner. *Revisit at 100 societies.*

## The one-paragraph pitch
> In urban India the natural unit of demand for home services is the building, not the flat — but every player prices per flat. JODO lets a residential society book one service, one day, one vendor, together: the price falls publicly as neighbours join (₹999 → ₹645 at 20 flats), the vendor gets a full day of work in one tower instead of three jobs and six hours of traffic, and nobody is charged until the group locks. We take 12–18% of a market that currently runs on WhatsApp and cash. China's Shifubang proved the model; India's 2.5 lakh gated societies are the distribution.
