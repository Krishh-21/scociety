# JODO housing society app

JODO brings a housing society's day-to-day work into one app for residents, committee members,
and gate staff. Residents can approve visitors, read notices, track maintenance dues, report
problems, reserve amenities, and join community meetings and votes. Neighbours can also book
optional group services together.

[`docs/`](docs) contains the original group-booking concept and engineering notes.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3127/demo/sign-in and choose one of the demo accounts below. The SQLite file is
created and seeded on first request. See [`android/README.md`](android/README.md) for the Android
test launcher for the hosted demo.

```bash
npm test       # pricing, booking, sign-in and society workflows
npm run seed   # wipes .data/ so the next start reseeds from scratch
npm run build  # production build
```

Requires Node 22+ (uses the built-in `node:sqlite` — no native modules to compile).

## Private hosted demo

Create a Supabase project and run `npm run db:hosted` with the database owner's
Session pooler connection string in `DATABASE_URL`. Set `DATABASE_CA_CERT` to the PEM root
certificate available in Supabase Database Settings. The initializer creates the
`jodo_demo` schema and seeds it on the first run. Use the same owner connection
for schema upgrades before deploying a new demo build.

For Vercel, use Node 24 and enable Vercel Authentication for every deployment
before publishing. Set `JODO_AUTH_MODE=demo` for the protected demo only. Set `DATABASE_URL` to the Transaction pooler connection string
and `DATABASE_CA_CERT` to the same certificate. Set a random `CRON_SECRET` for
the daily Vercel schedule in `vercel.json`. The app also checks deadlines as
people use the booking pages. The hosted demo uses the same test accounts below.

## Signing in

Residents and staff use `/login` with their mobile number and a six-digit SMS code.
The private demo puts its test accounts at `/demo/sign-in`. Reach it from the **Open demo**
link shown on `/login` when demo mode is enabled. The test workspace sends no SMS.

| Phone | Who | Lands on |
|---|---|---|
| `9000000001` | Rahul Mehta, A-402 | Resident app |
| `9000000002` | Amit Kulkarni, secretary | Resident app + committee tools |
| `9000000010` | Suresh, CoolCare AC | Vendor console |
| `9000000098` | Green Valley Gate | Guard console |
| `9000000099` | JODO Ops | Ops console |

The demo sign-in also accepts a fictional mobile number to try resident onboarding.

The consoles are scoped by role. Booking actions use `assertCan` in `lib/authz.ts`. Society
actions check the user’s verified residency or guard assignment before reading or changing
records.

Open **Society** to report complaints, read committee notices, attend meetings, vote, reserve
amenities, approve visitors, or check maintenance bills. A secretary can assign complaints,
publish community updates, manage guard access, issue bills, and record collections and expenses
from the committee dashboard. Guards use their own assigned visitor log.

Maintenance payments and reported bank balances are entered by the committee. The notification
centre shows society updates while residents use the app. The guard desk allows 30 minutes
for a resident decision and 30 minutes to check in after an ordinary approval. Guards can
cancel open requests. Residents can revoke unused guest passes, which otherwise last up
to 24 hours. If the resident is unreachable in JODO, guards follow the society's phone
or intercom procedure.

## Resident release

Use a separate Vercel project and Supabase project for real residents. Set the following in
Vercel for the resident build. Keep preview deployments protected.

| Setting | Value |
|---|---|
| `JODO_AUTH_MODE` | `sms` |
| `DATABASE_URL` | Supabase transaction pooler URL |
| `DATABASE_CA_CERT` | Supabase database certificate in PEM format |
| `SUPABASE_URL` | Project URL from Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `JODO_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key matching the challenge enabled in Supabase Auth |
| `NEXT_PUBLIC_SITE_URL` | Canonical resident URL |
| `JODO_SUPPORT_EMAIL` | Monitored address for account and privacy requests |
| `CRON_SECRET` | Random secret for the existing cron route |

Set `DATABASE_URL` to the **session** pooler and set `DATABASE_CA_CERT` in the operator's shell,
then run `npm run db:hosted -- --production`. This initializes or updates the `jodo` schema.
Run it before deploying changes that add inbox, gate or receipt fields. The protected
demo uses `jodo_demo` and its own cookies.

To add a society, verify its committee contact, set `JODO_SOCIETY_ID` (a slug),
`JODO_SOCIETY_NAME`, `JODO_SOCIETY_LOCALITY`, `JODO_SOCIETY_CITY`, `JODO_SOCIETY_FLAT_COUNT`,
`JODO_SECRETARY_NAME`, `JODO_SECRETARY_PHONE` (10 digits), and `JODO_SECRETARY_FLAT` (like
`A-402`). Run `npm run db:hosted -- --production --bootstrap` to create the society and its
first committee account together. For someone handling setup enquiries, set `JODO_OPS_PHONE`
and `JODO_OPS_NAME` and run `npm run db:hosted -- --production --bootstrap-ops`.

Enable Phone in Supabase Auth, configure your SMS provider and a six-digit OTP, remove
test phone codes, and enable CAPTCHA with the corresponding Turnstile secret in Supabase.
Check the provider's India SMS requirements, spend controls, and rate limits. New residents
request access to a flat for committee review. The committee can also revoke a departing
resident's access and sign them out from **Society → Flat requests**. Group bookings run only
in the demo.

To offer Google alongside SMS, configure [Google as an identity provider in
Supabase Auth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
Use the Supabase project's `/auth/v1/callback` URL as the authorized redirect URI in
Google, and allow `<resident origin>/auth/google/callback` in Supabase Auth's redirect
URLs. Run the production schema initializer to add the Google account tables, then
set `JODO_GOOGLE_SIGN_IN=1` and `NEXT_PUBLIC_SITE_URL` to the canonical resident origin.
First-time Google sign-in requires SMS verification to link the correct JODO account.
Linked users can sign in with either Google or SMS.

To add **email codes**, enable Email in Supabase Auth and configure
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for resident delivery.
Include `{{ .Token }}` in both the Magic Link and Confirm Signup templates so existing
and first-time email users get a six-digit code. Run the production schema initializer
and set `JODO_EMAIL_SIGN_IN=1` on the resident deployment. After verifying the email,
a first-time user verifies their mobile number by SMS to link their existing JODO
account. Subsequent email sign-ins need only the emailed code.

Before inviting residents, test real SMS delivery and code retries, membership review, guard
assignment and visitor decisions on the hosted stack. Verify backup and restore, monitoring,
account recovery and the privacy/terms drafts with whoever will operate the app. Gate
alerts are currently in-app. Agree with the society on how guards reach a resident who
is away from the app.

See the [Supabase phone sign-in guide](https://supabase.com/docs/guides/auth/phone-login),
[Supabase production security checklist](https://supabase.com/docs/guides/security/production-checklist),
[Vercel Deployment Protection](https://vercel.com/docs/deployment-protection), and
[Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist).

## What's built

### Public website

The landing page covers resident, committee, and gate workflows and accepts inquiries from
societies. `/partners` accepts vendor applications. The site also has help, privacy and terms
pages, share cards, a sitemap, and a web app manifest. Set `NEXT_PUBLIC_SITE_URL` for absolute
URLs in production.

### Society workspace

The resident app brings together visitor approvals and guest passes, committee notices, meetings,
polls, amenity bookings, maintenance dues and receipts, complaints, and notifications. The
committee can manage guard access, issue bills, log collections and expenses, and follow up on
complaints. The gate desk handles requests, pass redemption, and check-in and check-out.

### Group services

Residents can browse services, start a group, and share it on WhatsApp. Each group has a live
price ladder, available slots, comments, and a three-step booking flow. My Bookings tracks visits,
payment records, queue position, and issues. Profile supports English and Hindi and a system,
light, or dark appearance.

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
- `session.ts` — expiring, mode-specific sessions with hashed tokens. Supabase Auth sends
  and verifies SMS codes in resident mode and applies its configured rate limits.
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

## Demo-only integrations

Group-service payments and payouts use simulated records. JODO ops can open a vendor's
console to explore the service flow. The Android APK in this repository is a browser-backed
launcher for the protected demo. A resident Android release needs its own app ID, stable
signing key and resident URL.

## Stack

Next.js 16 (App Router, server actions), React 19, TypeScript, Tailwind v4, SQLite for local
development, and PostgreSQL with Supabase Auth for the hosted resident build.
