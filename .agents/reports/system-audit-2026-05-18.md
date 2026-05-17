# System Audit Report — May 18, 2026

## Scope

Full audit of 30+ page files, layout components, shared UI components, and global styles for:
- **Mobile responsiveness** (Tailwind breakpoints, touch targets, overflow handling)
- **Dark mode compliance** (no hardcoded colors, proper semantic token usage)
- **Functionality** (missing imports, broken references, dead CSS classes)
- **Accessibility** (viewport meta, touch targets, zoom capability)

---

## CRITICAL (Will visibly break dark mode)

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `src/app/admin/clients/page.tsx` | 708 | `bg-amber-200 text-amber-900` — pending KYC avatar fallback, **invisible** on dark backgrounds |
| 2 | `src/app/admin/profile/page.tsx` | 112 | `bg-emerald-100 text-emerald-800 border-emerald-200` — KYC verified badge, **completely broken** in dark mode |
| 3 | `src/app/client/orders/new/page.tsx` | 97 | `bg-white` on inactive step indicator circle — **bright white disc** on dark backgrounds |
| 4 | `src/app/client/orders/new/page.tsx` | 227 | `bg-amber-50 border-amber-200 text-amber-800` — info box, **no dark variants** at all |
| 5 | `src/app/client/orders/components/orders-client.tsx` | 61 | `bg-white` on inactive tracking step — **bright circle** in dark mode |
| 6 | `src/app/admin/inventory/components/dr-list-tab.tsx` | 409 | `bg-white/90 hover:bg-white` — image overlay button, **hardcoded white** |

## HIGH (Accessibility & Functionality)

| # | File | Line | Issue |
|---|------|------|-------|
| 7 | `src/app/layout.tsx` | 21–22 | `maximumScale: 1`, `userScalable: false` — **disables pinch-to-zoom**, violates WCAG 2.1 SC 1.4.4 |
| 8 | `src/components/real-time-clock.tsx` | 20 | `text-white` hardcoded — breaks if component used outside sidebar |

## MEDIUM (Significant issues)

| # | File | Line | Issue |
|---|------|------|-------|
| 9 | `src/app/admin/layout.tsx` | 187 | `bg-red-500 text-white` — KYC pending badge, should use `bg-destructive text-destructive-foreground` |
| 10 | `src/app/admin/dashboard/dashboard-client.tsx` | 329, 339, 349 | `bg-[#ff6b6b]`, `bg-[#ff9f43]`, `bg-[#3b82f6]` with `text-white` — hardcoded hex colors, dark-mode unsafe |
| 11 | `src/app/admin/dashboard/dashboard-client.tsx` | 148, 172, 194, 216 | `bg-[#ff9f43]`, `bg-[#feca57]`, etc. — KPI card accent bars, no dark variants |
| 12 | `src/app/admin/clients/page.tsx` | 63 | `hover:bg-red-100` — KYC rejected badge hover, invisible in dark mode |
| 13 | `src/app/admin/clients/page.tsx` | 235 | `border-red-200 text-red-700 hover:bg-red-50` — Reject button in KYC dialog, no dark variants |
| 14 | `src/app/admin/clients/page.tsx` | 703 | `border-amber-200 bg-amber-50/40` — pending KYC card, no dark variants |
| 15 | `src/app/client/layout.tsx` | 307 | Raw `<button>` for notification trigger (not `<Button>` component) — missing focus-visible ring |
| 16 | `src/app/client/dashboard/page.tsx` | 199, 281 | `text-gray-300`, `text-gray-600` — hardcoded gray, not theme-adaptive |
| 17 | `src/app/client/ledger/components/ledger-client.tsx` | 345 | `text-emerald-600 border-emerald-200 bg-emerald-50` — fulfilled badge, no dark variant (unlike sibling at line 292) |
| 18 | `src/app/client/profile/components/profile-client.tsx` | 95, 171 | `text-gray-500`, `text-emerald-700` — loading text and verified badge, no dark variants |
| 19 | `src/app/client/orders/components/orders-client.tsx` | 65, 70 | `text-emerald-700`, `bg-gray-200` — tracking labels and connector lines, no dark variants |
| 20 | `src/components/bottom-navbar.tsx` | 55 | `pb-safe` class — **dead/no-op** (not defined in globals.css or Tailwind). On iPhones with home indicator, navbar may be clipped |
| 21 | `src/app/globals.css` | 61–67 | `--color-industrial-*` CSS variables have no `.dark` overrides |

## LOW (Minor / cosmetic)

| # | File | Line | Issue |
|---|------|------|-------|
| 22 | `src/app/admin/orders/components/product-catalog-tab.tsx` | 287 | `bg-white/80` — hardcoded white overlay |
| 23 | `src/app/admin/orders/components/product-catalog-tab.tsx` | 330–341 | `text-white bg-white/20 border-white/40` — only works on dark backgrounds |
| 24 | `src/app/admin/inventory/components/dr-list-tab.tsx` | 284, 337 | `bg-white/80 bg-white/20` — hardcoded white |
| 25 | `src/app/admin/inventory/components/po-list-tab.tsx` | 337 | `bg-white/90 backdrop-blur-sm` — hardcoded white |
| 26 | `src/components/ui/select.tsx` | 44 | `h-8` (32px) default — below 44px touch target |
| 27 | `src/components/ui/button.tsx` | 24 | `h-8` (32px) default, `h-7` (28px) sm — below 44px touch target |
| 28 | `src/components/ui/input.tsx` | 12 | `h-8` (32px) — below 44px touch target |
| 29 | `src/app/client/orders/new/page.tsx` | 127–129 | `h-8 w-8` (32px) — +/- quantity buttons, below 44px touch target |
| 30 | `src/app/client/layout.tsx` | 143 | `window.location.href` for sign-out — full page reload instead of `router.push` |

## Mobile Responsiveness — PASS

All pages use responsive Tailwind breakpoints consistently:
- Grids adapt: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Sidebars: `Sheet` overlay on mobile, fixed on desktop (both admin and client)
- Tables: `overflow-x-auto` where needed
- Dialogs: `max-w-[calc(100%-2rem)]` on mobile, proper `max-h-[90vh]`
- Admin has bottom navbar on mobile (`lg:hidden`), content padded `pb-20`
- No content clipping or overflow issues detected

## What's Working Well

- **Dev server**: Starts clean, no compilation errors, all routes compile
- **Semantic tokens**: 95% of pages use `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`
- **ThemeToggle**: Integrated in both admin and client headers, respects system preference
- **Realtime subscriptions**: Admin+client notifications subscribe correctly with cleanup
- **All imports resolve**: No broken component references across 30+ files
