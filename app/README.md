# Miraggio Billing — UI Refinement Patch

Drop-in replacements for the 5 source files affected by the refinement spec.
Copy these on top of the existing `src/` tree in your repo:

```
patches/src/index.css                     →  src/index.css
patches/src/lib/utils.js                  →  src/lib/utils.js
patches/src/components/StatusBadge.jsx    →  src/components/StatusBadge.jsx
patches/src/components/MicroSidebar.jsx   →  src/components/MicroSidebar.jsx
patches/src/pages/Dashboard.jsx           →  src/pages/Dashboard.jsx
patches/src/pages/Bills.jsx               →  src/pages/Bills.jsx
patches/src/pages/Vendors.jsx             →  src/pages/Vendors.jsx
patches/src/pages/Contracts.jsx           →  src/pages/Contracts.jsx
```

## What changed

### `index.css`
- `--bg` → soft blue `#eef3f9`; surfaces, hovers, and borders re-toned to match (`--surface2 #f4f7fc`, `--border #dde4ef`).
- Added `--sky` / `--sky-light` (for the new Awaiting-L2 pill).
- Added a global `.clamp-2` utility (2-line truncation with ellipsis).
- Scrollbar thickened slightly (4 → 6 px) for the blue background.

### `lib/utils.js`
- New helper `fmtDateDDMMYY(d)` → `01-05-26` style.

### `components/StatusBadge.jsx`
- `PENDING_L1` → yellow pill (`--yellow-light` + `#b45309`).
- `PENDING_L2` → light-blue pill (`--sky-light` + `#0369a1`).
- Borders/foreground darkened slightly for legibility on the new background.

### `components/MicroSidebar.jsx` *(new in v3 of the patch)*
- Sidebar is **collapsed by default** (64px wide, icon-only). Click the **MIRAGGIO SmS** brand to expand to full width (232px) with labels; click again to collapse. State persists in `localStorage` so it survives reloads.
- When collapsed, the brand area shows the **SmS** mark (matching the second half of the full logo).
- Width transitions smoothly (220ms). Each nav item gets a `title` tooltip when collapsed so users can still identify icons on hover.
- The shared `--side-w` CSS variable is updated dynamically so any layout reading it adjusts in lockstep.
- Sign-out button hides in collapsed mode; the avatar gets a tooltip showing the user name and role.

### `pages/Dashboard.jsx`
- Removed `maxWidth: 1400` cap → main now uses the full remaining width beside the sidebar.
- Metric cards moved to `repeat(4, minmax(0, 1fr))` + `minHeight: 152` → equal height; **widths stay locked regardless of filter values** (money cards no longer push the grid wider).
- Vendor-wise Summary table uses `tableLayout: 'fixed'` + `colgroup` → columns don't reflow when filters change row count.
- Copy:
  - Awaiting L1 subtitle → **"L1 approval pending"**
  - Awaiting L2 subtitle → **"L2 approval pending"**
  - To Pay title → **"To Pay Amount"**, subtitle → **"Number of Invoice: N"**
  - Paid This Month title → **"Amount This Month"**, subtitle → **"Number of Invoice: N"** (counts paid bills this month)

### `pages/Bills.jsx`
- Vendor column now uses `.clamp-2` → vendor names clamp to max 2 lines and truncate with ellipsis. `title` attribute carries the full name on hover.
- Due-date column uses the new `fmtDateDDMMYY` → renders `01-05-26`. OVERDUE tag still appears below when applicable.
- Table uses `tableLayout: 'fixed'` + `colgroup` widths → columns stay stable as you switch tabs / filter results.
- Awaiting L1 / L2 pill colors are picked up automatically from the updated `StatusBadge`.

### `pages/Vendors.jsx`
- Container padding normalised to `32px 32px` and `width: 100%` → page sits flush beside the sidebar, no rightward shift.
- Table moved to `tableLayout: 'fixed'` + `colgroup` widths; wrapped in `overflowX: 'auto'` with `minWidth: 1080` → action column ("View / Ledger") never clips off-screen and the layout scrolls horizontally only if the viewport gets very narrow.
- Vendor name uses `.clamp-2`; email row truncates with ellipsis.
- Action buttons given `flex-wrap: wrap` and tighter padding so they fit cleanly.

### `pages/Contracts.jsx` *(new in v2 of the patch)*
- Same overflow-scroll guard: table is `tableLayout: 'fixed'` + `colgroup` + `minWidth: 1040`, inside an `overflowX: 'auto'` wrapper.
- **Agreement + Addendum columns merged into one "Documents" column** (chips stacked vertically) so the full 100% row fits at native zoom instead of requiring 75-80%.
- Trade Name uses `.clamp-2`; Service description truncates with ellipsis.
- Toolbar buttons (`+ Add Addendum`, `+ Add Agreement`) now `flex-wrap` so they don't overflow the header on narrow widths.
- PDF chips use an inline SVG icon (replaces the 📄 emoji) so they tone-match the soft-blue theme.

### Density pass (applied to all tables)
- Cell padding reduced from `13px 16px` → `10px 12px`.
- Body text size 13 → 12.5; small text 12 → 11.5; pill text 11 → 10.5.
- Page padding `32px 36px` → `24px 24px`.
- Vendors table `minWidth` 1080 → 880; Bills wraps in `overflowX: auto` with `minWidth: 1000`.

The combined effect: the full row of every table fits comfortably at 100% zoom on a standard 1440px-wide monitor with the sidebar expanded, and even more comfortably with the sidebar collapsed.

## Not touched
The following pages were intentionally left alone (no spec changes asked):

- `pages/BillDetail.jsx`, `VendorDetail.jsx`, `VendorLedger.jsx`
- `pages/Payments.jsx`, `Users.jsx`, `Login.jsx`, `Agreements.jsx`
- `components/Sidebar.jsx`, `MicroSidebar.jsx`, `TopBar.jsx`, `MetricCard.jsx`, `Icon.jsx`

The sidebar already looks correct against the new background — no changes needed.

## Preview
Open `Miraggio Refined UI.html` from the project root to interact with all three pages with mock data, including a small Tweaks panel for trying alternate background tones.
