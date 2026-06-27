# Pre-Deployment Flight-Check Report: OBBO iManage

**Target Environment:** Vercel Production
**Generated:** 2026-06-11 | **Commit:** `94872d6` | **Branch:** `develop`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Readiness** | **NOT READY** |
| **Build Status** | FAIL |
| **Lint Status** | 88 errors, 48 warnings |
| **Test Status** | UNAVAILABLE (dependency issue) |
| **Bug Fixes (plan01)** | 5/5 FIXED |
| **Design System Audit** | 2/30 FIXED (7%) |
| **Critical Blockers** | 3 |

### Critical Blockers

1. **Production build fails** — TypeScript error in `prisma.config.ts` (missing `prisma/config` module)
2. **Test suite cannot execute** — Vitest dependencies not installed or not resolvable
3. **4 critical dark mode issues remain** — Hardcoded colors break UI in dark theme

---

## 1. Deployment & Build Status

### 1.1 Production Build (`npm run build`)

| Check | Status | Details |
|-------|--------|---------|
| **Next.js Compilation** | PASS | Compiled successfully in 11.1s via Turbopack |
| **TypeScript Type Check** | **FAIL** | `prisma.config.ts:4:30` — Cannot find module `prisma/config` |
| **Serwist PWA Warning** | WARN | Serwist does not support Turbopack in dev mode; production build works |

**Build Error:**
```
./prisma.config.ts:4:30
Type error: Cannot find module 'prisma/config' or its corresponding type declarations.

> 4 | import { defineConfig } from "prisma/config";
```

**Root Cause:** The `prisma/config` module requires Prisma CLI to be installed as a dev dependency. The `prisma.config.ts` file uses `defineConfig` from `prisma/config` which is not resolvable during the Next.js build type-check phase.

**Fix Required:** Ensure `prisma` is in `devDependencies` (currently at `^7.8.0`) and that `npx prisma generate` has been run before build. Alternatively, exclude `prisma.config.ts` from the TypeScript build via `tsconfig.json` `exclude`.

---

### 1.2 Environment Variables

| Variable | Status | Location |
|----------|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | PRESENT | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PRESENT | `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | PRESENT | `.env.local` |
| `RESEND_API_KEY` | PRESENT | `.env.local` |
| `DATABASE_URL` | **MISSING** | Required by `prisma.config.ts` for Prisma operations |

**Note:** No `.env.example` file exists to document required variables for new developers or CI/CD.

---

### 1.3 Bundle & Performance Configuration

| Setting | Value |
|---------|-------|
| **Bundler** | Turbopack (enabled in `next.config.ts`) |
| **PWA Plugin** | Serwist v9.5.11 (precaching + runtime caching) |
| **Image Optimization** | Remote patterns configured for Supabase storage |
| **CSS Framework** | Tailwind CSS v4 via `@tailwindcss/postcss` |

---

## 2. Application Workflow & Route Verification

### 2.1 Complete Route Map

#### Public Routes

| Route | File | Purpose | Status |
|-------|------|---------|--------|
| `/` | `src/app/page.tsx` | Landing page (Hero, Features, HowItWorks, FAQ, CTA) | Verified |
| `/login` | `src/app/login/page.tsx` | Email/password login via Supabase Auth | Verified |
| `/register` | `src/app/register/page.tsx` | 5-step registration wizard with KYC | Verified |
| `/pending` | `src/app/pending/page.tsx` | Post-registration "under review" page | Verified |

#### Admin Portal (`/admin/*`)

| Route | File | Purpose | Status |
|-------|------|---------|--------|
| `/admin` | `src/app/admin/page.tsx` | Redirects to `/admin/dashboard` | Verified |
| `/admin/dashboard` | `src/app/admin/dashboard/page.tsx` | KPIs, activity feed, shipments, orders | Verified |
| `/admin/clients` | `src/app/admin/clients/page.tsx` | Client directory + KYC approval hub | Verified |
| `/admin/orders` | `src/app/admin/orders/page.tsx` | 4-tab order lifecycle management | Verified |
| `/admin/products` | `src/app/admin/products/page.tsx` | Product CRUD management | Verified |
| `/admin/inventory` | `src/app/admin/inventory/page.tsx` | Shipments, PO List, DR List tabs | Verified |
| `/admin/reports` | `src/app/admin/reports/page.tsx` | Warehouse, customer, sales/profit reports | Verified |
| `/admin/reports/warehouse-manager` | `src/app/admin/reports/warehouse-manager/page.tsx` | Daily warehouse reports | Verified |
| `/admin/profile` | `src/app/admin/profile/page.tsx` | Admin profile + avatar upload | Verified |
| `/admin/settings` | `src/app/admin/settings/page.tsx` | 7-tab settings panel | Verified |

#### Client Portal (`/client/*`)

| Route | File | Purpose | Status |
|-------|------|---------|--------|
| `/client` | `src/app/client/page.tsx` | Redirects to `/client/dashboard` | Verified |
| `/client/dashboard` | `src/app/client/dashboard/page.tsx` | KPIs, notifications, recent orders | Verified |
| `/client/catalog` | `src/app/client/catalog/page.tsx` | Product catalog browsing | Verified |
| `/client/orders` | `src/app/client/orders/page.tsx` | Order list view | Verified |
| `/client/orders/new` | `src/app/client/orders/new/page.tsx` | 5-step order wizard | Verified |
| `/client/orders/[id]` | `src/app/client/orders/[id]/page.tsx` | Dynamic order detail + status timeline | Verified |
| `/client/ledger` | `src/app/client/ledger/page.tsx` | Balance ledger (KYC-gated) | Verified |
| `/client/pending-kyc` | `src/app/client/pending-kyc/page.tsx` | KYC pending explanation page | Verified |
| `/client/profile` | `src/app/client/profile/page.tsx` | Client profile & settings | Verified |
| `/client/contact-admin` | `src/app/client/contact-admin/page.tsx` | Contact info display | Verified |

#### API Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/auth/send-otp` | POST | Generate & email OTP via Resend | Public (rate-limited) |
| `/api/auth/verify-otp` | POST | Validate OTP code | Public |
| `/api/admin/kyc-document` | GET | Download KYC document from storage | Admin/WM only |

---

### 2.2 Missing Next.js Special Routes

| File Type | Status | Impact |
|-----------|--------|--------|
| `middleware.ts` | **MISSING** | No source-level middleware; auth guards rely on component-level checks |
| `loading.tsx` | **MISSING** | No loading UI for any route; users see blank during data fetch |
| `error.tsx` | **MISSING** | No error boundaries; unhandled errors show default Next.js error |
| `not-found.tsx` | **MISSING** | No custom 404 page |
| `template.tsx` | **MISSING** | No route-level template wrappers |
| Route groups `()` | **MISSING** | No layout sharing between related routes |

---

### 2.3 PWA & Assets Verification

| Component | File | Status |
|-----------|------|--------|
| **Service Worker** | `src/app/sw.ts` | Serwist precaching configured with `skipWaiting`, `clientsClaim`, `navigationPreload` |
| **Web Manifest** | `src/app/manifest.ts` | App name "OBBO iManage", standalone display, 192x192 + 512x512 icons |
| **PWA Icons** | `public/logo.png` | Single icon source; no separate 192x192/512x512 variants |
| **OG Image** | `public/og-image.png` | Present for social sharing |

---

### 2.4 Authentication Workflow

```
Landing (/)
  -> Register (/register) -- 5-step wizard
      Step 1: Account Type (Individual / Company)
      Step 2: Credentials (Email + Password + OTP verification via Resend)
      Step 3: Profile Details (Name, phone, address, business permit, TIN)
      Step 4: Documents (Valid ID, business permit upload)
      Step 5: Review & Submit
      -> Supabase Auth signUp() with metadata (role: "client", kyc_status: "pending_verification")
      -> Upload KYC docs to Supabase Storage (kyc-documents bucket)
      -> Trigger admin notification
      -> Sign out, redirect to /login?registered=true

Login (/login)
  -> supabase.auth.signInWithPassword()
  -> router.refresh() + router.replace("/client/dashboard")
  -> Layout-level role/KYC checks redirect accordingly

Admin Approval
  -> Admin reviews KYC in /admin/clients
  -> Approve/Reject -> updates kyc_status in profiles table
  -> Real-time notification to client via Supabase Realtime
```

---

### 2.5 Role-Based Access Control (RBAC)

| Role | Portal | Access |
|------|--------|--------|
| `admin` | Admin | Full access: dashboard, products, clients, reports, settings |
| `warehouse_manager` | Admin | Dashboard, orders, products, inventory, warehouse reports, clients (read-only) |
| `client` | Client | Dashboard, catalog, orders, ledger (KYC-gated), profile, contact admin |

#### KYC-Gated Features (Client Portal)

| Feature | KYC Required | Implementation |
|---------|-------------|----------------|
| Dashboard | No | Shows KYC banner if unverified |
| Product Catalog | No | Always accessible |
| My Orders (list) | No | Always accessible |
| New Order | **Yes** | `LOCKED_HREFS` array disables button with Lock icon |
| Balance Ledger | **Yes** | Server-side check returns "KYC Required" page |
| Profile & Settings | No | Always accessible |
| Contact Admin | No | Always accessible |

---

### 2.6 Order Lifecycle Workflow

```
Client: Browse Catalog (/client/catalog)
  -> New Order (/client/orders/new) -- 5-step wizard
      Step 1: Products (select products, quantities)
      Step 2: Source (select warehouse/supplier)
      Step 3: Service Type (delivery/pickup)
      Step 4: PO & Payment (PO number, payment method, check details)
      Step 5: Review & Submit
  -> Order created with status: "pending"

Admin: New Requests tab (/admin/orders?tab=new)
  -> Approve -> status: "approved" (or "partially_approved")
  -> Reject -> status: "rejected"
  -> [If check payment] Confirm Check -> status: "approved"

Admin: Fulfillment tab (/admin/orders?tab=fulfillment)
  -> Dispatch -> status: "dispatched" + shipment created

Admin: Tracking tab (/admin/orders?tab=tracking)
  -> Update tracking: "in_transit" -> "delivered" -> "completed"

Client: My Orders (/client/orders)
  -> View detail (/client/orders/[id])
  -> Status timeline: pending -> approved -> dispatched -> completed

After partial delivery:
  -> customer_balances record created
  -> Client views Balance Ledger (/client/ledger)
  -> Requests re-delivery from remaining balance
  -> New order with order_type: "redelivery"
```

---

### 2.7 Inventory Management Workflow

```
Admin: Inventory (/admin/inventory)
  -> Shipments tab: Add/manage shipment batches (JB/SB quantities)
  -> PO List tab: Manage purchase orders from suppliers
      - Searchable client dropdown (cmdk)
      - Required: PO Number, PO Photo
  -> DR List tab: Manage delivery receipts tied to shipments

Warehouse Manager: Reports (/admin/reports/warehouse-manager)
  -> Daily inventory reconciliation reports
  -> Auto-submit end-of-day reports

ShipmentLedger: Transaction log per shipment (PO, DR, returns)
```

---

### 2.8 Notification System

Both admin and client layouts implement:
- Real-time notification subscriptions via Supabase Realtime (`postgres_changes`)
- Unread count badges (dynamic for admin: pending orders + KYC counts)
- Notification popover with severity icons (info/warning/success)
- Mark-as-read functionality
- Notifications table with `user_id`, `title`, `message`, `href`, `severity`, `is_read`

---

## 3. Database & Prisma ORM Health

### 3.1 Schema Overview

**14 models** defined in `prisma/schema.prisma` — all PostgreSQL with UUID primary keys:

| Model | Table | Description |
|-------|-------|-------------|
| `Profile` | `profiles` | Users (admin, client, warehouse_manager) with KYC fields |
| `Product` | `products` | Cement products (JB/SB bag types, port/warehouse pricing) |
| `Shipment` | `shipments` | Inventory batches with JB/SB stock tracking |
| `ShipmentLedger` | `shipment_ledger` | Transaction log per shipment |
| `DeliveryReceipt` | `delivery_receipts` | DR records linked to shipments |
| `Order` | `orders` | Client orders with status workflow, split delivery, tracking |
| `OrderItem` | `order_items` | Line items per order |
| `CustomerBalance` | `customer_balances` | Remaining bags per client/order |
| `PurchaseOrder` | `purchase_orders` | PO records with payment details |
| `WarehouseReport` | `warehouse_reports` | Daily warehouse inventory reports |
| `AdminSetting` | `admin_settings` | Key-value JSON config store |
| `ActivityLog` | `activity_log` | Audit trail for all actions |
| `OrderReturn` | `order_returns` | Return requests per order |
| `Notification` | `notifications` | User notifications with severity + read status |

### 3.2 Migration Status

| Check | Status | Details |
|-------|--------|---------|
| **Prisma Migrations** | **EMPTY** | `prisma/migrations/` directory has no migration files |
| **SQL Migrations** | 17 files | `.agents/migrations/` contains SQL scripts (002-017) |
| **Supabase Migrations** | 7 files | `supabase/migrations/` contains incremental SQL |
| **Migration Strategy** | `prisma db push` | Uses `--no-erase` flag; schema pushed directly to DB |

**Risk:** No Prisma migration history means `prisma migrate deploy` (the `prisma:migrate:prod` script) will have nothing to deploy. The schema state is managed via SQL scripts and `db push`, which is not recommended for production.

### 3.3 Edge/Serverless Compatibility

| Concern | Status |
|---------|--------|
| **Connection Pooling** | Not configured; no Supabase Accelerate or PgBouncer setup detected |
| **Prisma Client Generation** | Output to `src/generated/prisma` (custom path) |
| **Edge Runtime** | Not explicitly configured; default Node.js runtime used |

---

## 4. Test Suite & Code Quality

### 4.1 Vitest Test Suite

| Metric | Value |
|--------|-------|
| **Status** | **UNAVAILABLE** |
| **Config** | `vitest.config.ts` (jsdom, globals, React plugin) |
| **Setup** | `vitest.setup.ts` (jest-dom/vitest matchers) |
| **Test Files Found** | 2 |

**Error:** `npx vitest run` fails with `Cannot find module 'vitest/config'`. The vitest dependencies (`vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`) are listed in `devDependencies` but are not installed or not resolvable.

**Test Files:**
1. `src/app/client/ledger/components/ledger-client.test.tsx` — Client ledger component tests
2. `src/lib/actions/client-actions.test.ts` — Client actions unit tests

**Coverage:** Minimal — only 2 test files for a codebase with 50+ components and 20+ routes.

---

### 4.2 ESLint Results

**Total:** 136 problems (88 errors, 48 warnings)

| Rule | Count | Type | Severity |
|------|-------|------|----------|
| `@typescript-eslint/no-explicit-any` | 61 | Error | High — weakens type safety |
| `@typescript-eslint/no-unused-vars` | 45 | Warning | Low — dead code |
| `react-hooks/set-state-in-effect` | 14 | Error | Medium — cascading renders risk |
| `react/no-unescaped-entities` | 12 | Error | Low — JSX escaping |
| `@next/next/no-img-element` | 2 | Warning | Low — should use `<Image>` |
| `react-hooks/exhaustive-deps` | 1 | Warning | Medium — missing dependency |
| `react/no-unescaped-entities` (quotes) | 1 | Error | Low |

#### Error Distribution by File (Top Offenders)

| File | Errors | Warnings |
|------|--------|----------|
| `src/app/admin/orders/page.tsx` | 7 | 1 |
| `src/app/admin/settings/page.tsx` | 8 | 3 |
| `src/app/admin/reports/page.tsx` | 6 | 3 |
| `src/app/admin/inventory/components/shipments-tab.tsx` | 5 | 2 |
| `src/app/admin/inventory/components/po-list-tab.tsx` | 5 | 0 |
| `src/lib/actions/admin-actions.ts` | 6 | 2 |
| `src/app/admin/clients/page.tsx` | 4 | 1 |
| `src/app/admin/dashboard/dashboard-client.tsx` | 3 | 2 |

---

### 4.3 shadcn/ui Components

| Setting | Value |
|---------|-------|
| **Style** | `base-nova` |
| **Base Color** | `neutral` |
| **CSS Variables** | Enabled |
| **Icon Library** | `lucide` |
| **Components Installed** | 22 (avatar, badge, button, card, command, dialog, dropdown-menu, input, label, optimized-image, popover, radio-group, select, separator, sheet, skeleton, sonner, step-indicator, table, tabs, textarea) |

---

## 5. Bug Fix Plan Status (bug_fix_plan01.md)

All 5 bugs from the fix plan have been **verified as FIXED**:

| Bug | Title | Status | Evidence |
|-----|-------|--------|----------|
| #1 | Dynamic Sidebar Notification Badges | **FIXED** | `admin/layout.tsx` uses `pendingOrderCount`/`pendingKycCount` state with real-time Supabase subscriptions |
| #2 | Searchable Client Dropdown for Manual PO | **FIXED** | `po-list-tab.tsx` uses `Popover` + `Command` (cmdk) searchable dropdown for verified clients |
| #3 | Required Fields — PO Number & PO Photo | **FIXED** | Both fields have `text-red-500` required markers; `handleSubmit` validates and shows toast errors |
| #4 | Check Payment Details in Fulfillment | **FIXED** | `fulfillment-tab.tsx` displays payment method badge, check number, check image link, and amount |
| #5 | Remove "Save as Draft" from Client Ordering | **FIXED** | Button and `handleSaveDraft` function fully removed from `catalog-client.tsx` |

---

## 6. Design System Audit (Re-Audit June 11, 2026)

### Previous Audit: May 18, 2026 (30 issues)
### Current Status: 2 FIXED, 28 STILL PRESENT (7% fix rate)

### CRITICAL — Dark Mode Broken (4 remaining)

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| 1 | `admin/clients/page.tsx` | 708 | `bg-amber-200 text-amber-900` on pending KYC avatar | STILL PRESENT |
| 2 | `admin/profile/page.tsx` | 112 | `bg-emerald-100 text-emerald-800 border-emerald-200` on KYC badge | STILL PRESENT |
| 3 | `client/orders/new/page.tsx` | 97 | `bg-white` on inactive step indicator | **FIXED** |
| 4 | `client/orders/new/page.tsx` | 227 | `bg-amber-50 border-amber-200 text-amber-800` info box | **FIXED** |
| 5 | `client/orders/components/orders-client.tsx` | 61 | `bg-white` on inactive tracking step | STILL PRESENT |
| 6 | `admin/inventory/components/dr-list-tab.tsx` | 430 | `bg-white/90 hover:bg-white` image overlay | STILL PRESENT |

### HIGH — Accessibility (2 remaining)

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| 7 | `layout.tsx` | 21-22 | `maximumScale: 1, userScalable: false` blocks pinch-to-zoom (WCAG 2.1 SC 1.4.4) | STILL PRESENT |
| 8 | `real-time-clock.tsx` | 20 | `text-white` hardcoded — breaks outside sidebar context | STILL PRESENT |

### MEDIUM — Significant Issues (13 remaining)

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| 9 | `admin/layout.tsx` | 187 | `bg-red-500 text-white` KYC badge | STILL PRESENT |
| 10 | `admin/dashboard/dashboard-client.tsx` | 327-329 | `fill="#1dd1a1"`, `fill="#feca57"`, `fill="#3b82f6"` hardcoded hex | STILL PRESENT |
| 11 | `admin/dashboard/dashboard-client.tsx` | 148,172,194,216 | `bg-[#ff9f43]`, `bg-[#feca57]`, etc. KPI accent bars | STILL PRESENT |
| 12 | `admin/clients/page.tsx` | 64 | `hover:bg-red-100` on rejected badge | STILL PRESENT |
| 13 | `admin/clients/page.tsx` | 235 | `border-red-200 text-red-700 hover:bg-red-50` Reject button | STILL PRESENT |
| 14 | `admin/clients/page.tsx` | 703 | `border-amber-200 bg-amber-50/40` pending KYC card | STILL PRESENT |
| 15 | `client/layout.tsx` | 383 | Sign-out button missing `focus-visible:ring` | STILL PRESENT |
| 16 | `client/dashboard/page.tsx` | 199,281 | `text-gray-300`, `text-gray-600` hardcoded | STILL PRESENT |
| 17 | `client/ledger/components/ledger-client.tsx` | 352 | `text-emerald-600 border-emerald-200 bg-emerald-50` fulfilled badge | STILL PRESENT |
| 18 | `client/profile/components/profile-client.tsx` | 95,171 | `text-gray-500`, `text-emerald-700` hardcoded | STILL PRESENT |
| 19 | `client/orders/components/orders-client.tsx` | 65,70 | `text-emerald-700`, `bg-gray-200` tracking labels | STILL PRESENT |
| 20 | `bottom-navbar.tsx` | 55 | `pb-safe` — dead CSS class, not defined anywhere | STILL PRESENT |
| 21 | `globals.css` | 60-67 | `--color-industrial-*` vars have no `.dark` overrides | STILL PRESENT |

### LOW — Minor/Cosmetic (9 remaining)

| # | Issue | Status |
|---|-------|--------|
| 22-24 | Hardcoded `bg-white` in orders-client.tsx, dr-list-tab.tsx | STILL PRESENT |
| 25-27 | Touch target sizes below 44px WCAG minimum (sign-out buttons `py-1.5`/`py-2.5`) | STILL PRESENT |
| 28-30 | `window.location.href = "/login"` instead of `router.push()` in client layout | STILL PRESENT |

### Audit Summary

| Severity | Total | Fixed | Remaining | Fix Rate |
|----------|-------|-------|-----------|----------|
| CRITICAL | 6 | 2 | 4 | 33% |
| HIGH | 2 | 0 | 2 | 0% |
| MEDIUM | 13 | 0 | 13 | 0% |
| LOW | 9 | 0 | 9 | 0% |
| **TOTAL** | **30** | **2** | **28** | **7%** |

---

## 7. Development Workspace & Agent State

| File | Status | Purpose |
|------|--------|---------|
| `AGENTS.md` | Present | Project agent instructions, references design system rules |
| `CLAUDE.md` | Present | References AGENTS.md |
| `bug_fix_plan01.md` | **COMPLETE** | All 5 bugs verified fixed |
| `.agents/rules/design-system.md` | Present | Clean Industrial design rules |
| `.agents/reports/system-audit-2026-05-18.md` | Present | Previous audit (30 issues, 28 still open) |
| `.github/instructions/clean-industrial.instructions.md` | Present | Auto-applied frontend instructions |
| `.github/skills/` | Present | 4 SKILL.md files for UI, audit, INP, page-load |

---

## 8. Post-Deployment Smoke Tests

Execute these checks immediately after Vercel deployment goes live:

### Infrastructure
- [ ] Domain resolves under HTTPS without redirection loops
- [ ] Vercel deployment logs show no build errors
- [ ] Environment variables are set in Vercel dashboard (all 5)

### Authentication Flow
- [ ] Registration wizard completes all 5 steps successfully
- [ ] OTP email arrives via Resend
- [ ] Login redirects to correct portal based on role
- [ ] KYC approval flow works end-to-end (admin approves -> client gains access)
- [ ] Sign-out redirects to `/login` without errors

### Core Workflows
- [ ] Admin dashboard loads with real KPI data
- [ ] Client catalog displays products
- [ ] Order wizard completes all 5 steps and creates order
- [ ] Admin can approve/reject orders
- [ ] Fulfillment tab shows payment details correctly
- [ ] Real-time notifications deliver to both portals

### PWA
- [ ] Service worker registers and activates
- [ ] Manifest loads with correct app name and icons
- [ ] App is installable on mobile devices

### Dark Mode
- [ ] Landing page renders correctly in dark mode
- [ ] Admin portal renders correctly in dark mode
- [ ] Client portal renders correctly in dark mode
- [ ] Theme toggle persists across page navigation

---

## 9. Pre-Deployment Action Items (Priority Order)

### P0 — Must Fix Before Deployment

1. **Fix build failure:** Resolve `prisma/config` module error in `prisma.config.ts`
2. **Fix test dependencies:** Run `npm install` to ensure vitest and testing-library are installed
3. **Fix critical dark mode issues:** 4 remaining hardcoded color issues in admin/clients, admin/profile, client/orders

### P1 — Should Fix Before Deployment

4. **Add `loading.tsx`** to admin and client route groups for better UX during data fetch
5. **Add `error.tsx`** and `not-found.tsx` for proper error handling
6. **Fix `maximumScale`/`userScalable`** in root layout for WCAG compliance
7. **Reduce `no-explicit-any` errors** (61 occurrences) — most are in admin-actions.ts and admin pages

### P2 — Fix Soon After Deployment

8. **Add Prisma migrations** for production-safe schema management
9. **Expand test coverage** beyond 2 test files
10. **Create `.env.example`** for developer onboarding
11. **Fix remaining 28 design system audit issues**
12. **Resolve `set-state-in-effect` lint errors** (14 occurrences) to prevent cascading renders

---

*Report generated by automated pre-deployment flight-check system.*
