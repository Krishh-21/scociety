# JODO — your building books together

A working build of the idea in the reel: **group booking for residential-society services.**
Neighbours pool the same job on the same day, one vendor serves the whole building, and the
price falls publicly as flats join — ₹999 → ₹645 per AC at 20 flats, exactly the mechanic the
video describes.

The thinking behind it (idea decode, PRD, UX, design system, screen specs, architecture,
roadmap) is in [`docs/`](docs). This README is about running the app.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3127 — signed out you get the public landing page; **Find your society**
signs you in. The SQLite file is created and seeded on first request.

```bash
npm test       # pricing, booking, sign-in and society workflows
npm run seed   # wipes .data/ so the next start reseeds from scratch
npm run build  # production build
```

Requires Node 22+ (uses the built-in `node:sqlite` — no native modules to compile).

## Private hosted demo

Create a Supabase project and run `npm run db:hosted` with its Session pooler
connection string in `DATABASE_URL`. Set `DATABASE_CA_CERT` to the PEM root
certificate available in Supabase Database Settings. The initializer creates the
`jodo_demo` schema and seeds it on the first run.

For Vercel, use Node 24 and enable Vercel Authentication for every deployment
before publishing. Set `DATABASE_URL` to the Transaction pooler connection string
and `DATABASE_CA_CERT` to the same certificate. Set a random `CRON_SECRET` for
the daily Vercel schedule in `vercel.json`. The app also checks deadlines as
people use the booking pages. The hosted demo uses the same test accounts below.

## Signing in

No SMS is sent; **the OTP is always `1234`.** Seeded accounts:

| Phone | Who | Lands on |
|---|---|---|
| `9000000001` | Rahul Mehta, A-402 | Resident app |
| `9000000002` | Amit Kulkarni, secretary | Resident app + committee tools |
| `9000000010` | Suresh, CoolCare AC | Vendor console |
| `9000000098` | Green Valley Gate | Guard console |
| `9000000099` | JODO Ops | Ops console |

Any other 10-digit number creates a new resident and runs the onboarding flow.

The consoles are scoped by role. Booking actions use `assertCan` in `lib/authz.ts`. Society
actions check the user’s verified residency or guard assignment before reading or changing
records.

Open **Society** to report complaints, read committee notices, attend meetings, vote, reserve
amenities, approve visitors, or check maintenance bills. A secretary can assign complaints,
publish community updates, manage guard access, issue bills, and record collections and expenses
from the committee dashboard. Guards use their own assigned visitor log.

Maintenance payments and reported bank balances are entered by the committee. The app sends
society alerts through its notification centre. Sign-ins still use the demo OTP described above.

## What's built

**Public site** — landing page at `/` for signed-out visitors (hero with a live, draggable price
ladder built from the real catalogue; how it works; why it's cheaper; services with real prices;
the four promises; "Bring JODO to your society" form; vendor pitch; FAQ), plus `/partners`
(vendor application), `/help`, `/privacy`, `/terms`. SEO and install basics: per-page metadata,
Open Graph cards, `sitemap.xml`, `robots.txt`, a web manifest and an app icon. Set
`NEXT_PUBLIC_SITE_URL` for absolute URLs in production.

**Resident app** — onboarding + flat verification · society feed (live, pending approval,
confirmed, repeat reminders) · deal detail with the live price ladder, slot capacity and a
WhatsApp share card · 3-step join sheet (units → slot → payment) with a real dialog (Escape,
focus trap) · comments and quick replies · notification centre (price drops, confirmations,
service day, issues) · my bookings with status tracker, payment ledger line, queue position and
issue reporting · create-a-group wizard · services catalogue · society page (savings,
neighbours, approved vendors, committee approvals) · profile with language (English/हिंदी) and
light/dark/system appearance.

**Vendor console** (`/vendor`) — groups filling, editable price ladder per deal, service-day
route sheet with per-flat start and completion OTPs, payouts with the 15% commission split.

**Ops console** (`/ops`) — GMV, commission, fill rate, refunds, open issues, view→join funnel,
deals-at-risk queue, committee approvals, the issues queue (refund / revisit / no action), every
deal with lock / close-without-charge / start-service-day, website sign-ups (society requests
and vendor applications) with contacted / won / lost, an audit trail, and demo controls — add
neighbour joins, or reset all demo data when the seed's relative dates have gone stale (ops only,
development only).

## The engine (`lib/`)

- `pricing.ts` — the price ladder. `currentPrice` picks the highest slab the flat count has
  unlocked; `validateSlabs` refuses a ladder that isn't strictly cheaper as flats rise.
- `deals.ts` — the deal lifecycle `open → locked → in_progress → completed`, with `expired` as
  the fail-safe branch. Joining runs inside a `BEGIN IMMEDIATE` transaction. `tick()` runs on
  every feed/board read and closes any deal past its deadline: at or above the minimum it
  **locks** (freezing one final price for every member and creating one job per flat), below it
  **expires** and nobody is charged.
- `db.ts` — schema + seed. Rows are copied into plain objects because `node:sqlite` returns
  null-prototype objects that React Server Components refuse to serialise.
- `session.ts` — phone/OTP sessions in a cookie (expiry, `secure` in production, OTP throttle).
- `authz.ts` — `can` / `assertCan`, deny by default; every mutating action goes through it.
- `notify.ts`, `analytics.ts`, `money.ts`, `share.ts`, `i18n.ts` — notifications, the event log
  behind the ops funnel, one place for deal money maths, the WhatsApp card, and the dictionary.

### Closing deals on time

Locking captures money and creates jobs, so it can't wait for someone to open a page. The first
server-side read starts an in-process ticker (`JODO_TICK_MS`, default 60s). For more than one
instance, set `JODO_DISABLE_TICKER=1` and point a scheduler at `POST /api/cron/tick`
(`JODO_CRON_SECRET` turns on bearer auth).

### Rules the engine guarantees

1. Everyone pays the **final** slab price, including the first flat to join.
2. While a deal is open the price can only fall — `deal.floorPricePaise` ratchets down on every
   join and is never given back, so a member leaving cannot push the price up for the rest.
3. Once anyone has joined, a vendor's ladder edit may only ever be cheaper; an edit that charges
   more at any count is refused.
4. Nothing is captured before lock; a group that misses its minimum charges nobody.
5. A ladder can never be published with a slab that isn't cheaper than the one before it.
6. The ladder counts what the vendor's trip actually scales with — flats for deep cleaning, units
   for AC service and car washes (`sku.ladderBasis`).
7. A group is private to its society: reading or joining one from another society is refused.
   A flat already verified by a neighbour can't be claimed by somebody else.
8. A slot can never be over-booked past one crew's capacity for that window.
9. A group that nearly made it gets exactly one automatic 48-hour extension, then expires.
10. Money is authorised on join, captured only at lock, released on expiry, refunded on a
    resolved issue — every step written to the `payment` ledger.
11. A group can only be given to a vendor who offers that service.

`npm test` covers these booking rules and the society workflows.

## Where the work stands

`docs/07-review-and-gaps.md` is a full review of this build — 31 findings, prioritised, with a
status table at the top for the ones already fixed (the price invariants, authorisation, the
society boundary, session hygiene and the test suite). What remains is listed there in order.

## What is deliberately faked

Payments (UPI AutoPay / pre-auth are modelled as a stored choice, not a Razorpay call), SMS and
push, WhatsApp share cards, technician GPS, and document-based residency verification — every
one of these is a named integration in `docs/05-architecture.md`. JODO ops can open any vendor's console (a vendor only ever
sees their own), which is how the vendor side can be explored without a second browser.

## Stack

Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind v4 · `node:sqlite`.
No external services; everything runs locally.
