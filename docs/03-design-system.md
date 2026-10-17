# 03 — Design system ("Tower")

Visual direction: **calm civic utility + one loud number.** Light, airy, high-contrast cards on a near-white canvas; a single saturated green reserved for savings/price and a single blue for identity/society. Nothing else competes with the counter and the rupee figure. Inspired by the mock in the reel (blue announcement band, green price chip) but systematised.

## 1. Colour tokens

```css
:root{
  /* brand */
  --brand-700:#0B5FD0; --brand-600:#1570EF; --brand-500:#3B8AF5; --brand-50:#EAF2FE;
  /* money / savings  (ONLY for price + savings + success) */
  --save-700:#05713D; --save-600:#0A8C4E; --save-500:#12A860; --save-50:#E8F8F0;
  /* urgency */
  --warn-600:#B54708; --warn-500:#F79009; --warn-50:#FFF6E8;
  --danger-600:#C01048; --danger-50:#FEE9EF;
  /* neutrals */
  --ink-900:#0C1420; --ink-700:#303B4D; --ink-500:#667085; --ink-300:#A7B0BE;
  --line:#E6E9EF; --surface:#FFFFFF; --canvas:#F6F8FB; --canvas-alt:#EEF2F7;
  /* radii, elevation, motion */
  --r-sm:10px; --r-md:16px; --r-lg:22px; --r-pill:999px;
  --e1:0 1px 2px rgba(16,24,40,.06);
  --e2:0 4px 16px rgba(16,24,40,.08);
  --e3:0 12px 32px rgba(16,24,40,.12);
  --t-fast:140ms cubic-bezier(.2,.7,.3,1); --t-mid:280ms cubic-bezier(.2,.7,.3,1);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --ink-900:#F2F5F9; --ink-700:#C3CBD8; --ink-500:#8E99AA; --ink-300:#5B6578;
    --line:#242C3A; --surface:#141A24; --canvas:#0C1118; --canvas-alt:#111823;
    --brand-50:#10233C; --save-50:#0A2219; --warn-50:#2A1D0B; --danger-50:#2A0F19;
  }
}
```
Dark mode must also be reachable via `:root[data-theme="dark"]`.

**Colour rules**
- Green = money only (current price, savings, locked/confirmed). Never a generic button colour.
- Blue = society/identity/primary action.
- Amber = time pressure ("closes in 6h", "2 flats to go").
- Red = failures and disputes only. An expired deal is **grey**, not red — it is not an error, nobody lost money.

## 2. Type scale (Plus Jakarta Sans (UI) + Noto Sans Devanagari for हिंदी)

| Token | Size/LH | Weight | Use |
|---|---|---|---|
| `display` | 40/44 | 700, -1.5% | The price on deal hero |
| `counter` | 34/36 | 700 tabular | "12 / 20" |
| `h1` | 24/30 | 650 | Screen titles |
| `h2` | 19/25 | 650 | Card titles |
| `body` | 15/22 | 450 | Default |
| `body-strong` | 15/22 | 600 | Inline emphasis |
| `caption` | 13/18 | 500 | Meta, timestamps |
| `micro` | 11/14 | 650, +4% tracking, caps | Badges, eyebrow labels |

All numerals `font-variant-numeric: tabular-nums` so counters don't jitter while animating.

## 3. Core components

| Component | Anatomy & behaviour |
|---|---|
| **DealCard** (feed) | Eyebrow (category + date) · Title · Vendor line · **PriceBlock** · **ProgressBar + "12/20 flats"** · deadline pill · joined-avatars row · CTA. Tappable whole-card. Three visual states: filling / almost there (amber ring) / locked (green ring). |
| **PriceBlock** | `₹749` (display, save-700) + `₹999` struck (ink-500) + `Save ₹250` chip. On slab change: old price slides up & fades, new price counts down over 600ms, chip pulses once. Respects `prefers-reduced-motion`. |
| **LadderMeter** | Horizontal segmented bar, one segment per slab, current slab filled green, next slab labelled "+3 flats → ₹645". Tap → expands to the full slab table. The signature component of the product. |
| **FlatCounter** | `12 / 20` tabular, ring progress, subtext "20 flats needed to unlock the group discount". |
| **DeadlinePill** | Amber when < 24h, grey otherwise. Live countdown, server-time anchored. |
| **NeighbourStack** | Up to 5 avatars + "+8", each with flat no. on tap. Social proof > rating stars. |
| **VendorCard** | Photo, name, rating, badge row (Verified / Society-approved / Assured), "Did 3 jobs in Green Valley". |
| **ScopeList** | ✅ Included / ❌ Not included. Mandatory on every SKU — cheapest dispute prevention there is. |
| **JoinSheet** | Bottom sheet, 3 steps (units → slot → pay), never a new screen; progress dots; sticky price footer that updates live. |
| **StatusTracker** | 5 nodes: Joined → Locked → Scheduled → In progress → Completed. Current node pulses. |
| **FailSafeNote** | One-line reassurance under every CTA: "₹0 now. If 20 flats don't join by Fri 8 PM, you're not charged." |
| **ShareCard** | Auto-rendered 1080×1350 image for WhatsApp with counter, price and society name. Generated at join + at each slab crossing. |
| **EmptyState** | Illustration + 1 line + 1 CTA. Never a dead end. |

## 4. Layout
- 8-pt grid; screen padding 16; card padding 16–20; card gap 12.
- Sticky CTA bar 72px + safe-area inset; content gets bottom padding 96.
- One primary action per screen. Secondary actions are text buttons, never second filled buttons.
- Feed card max height ~ 240 so two cards are visible at once on a 6" screen — the "my neighbours are doing things" feeling needs two cards.

## 5. Motion
- Price countdown 600ms ease-out; counter ticks digit-by-digit.
- Slab unlock: meter segment fills L→R 400ms, then a 1-shot haptic (Android `EFFECT_TICK`).
- Sheets 280ms spring; no bounce.
- Skeletons, not spinners. Max 1 animated element on screen at a time.
- Everything above disabled under `prefers-reduced-motion: reduce` (prices snap, no pulse).

## 6. Voice & copy rules
- Say the number, then the reason: *"₹645. Because 20 flats booked together."*
- Hinglish allowed in marketing/WhatsApp; the app UI is clean English or clean Hindi, never mixed inside a sentence.
- Never "deal", "offer", "sale" for the price mechanic — it's a **group price**, which is a fact, not a promotion.
- Error copy always contains the recovery: *"Didn't fill. You weren't charged. Roll it to next Sunday?"*
