# Changelog

## v1.0.0 (2026-07-02)

### Security

- Fixed OTP generation vulnerability — replaced `Math.random()` with `crypto.randomInt()` from `node:crypto`
- Added Zod validation schemas for all server action inputs (16 schemas across 15 domain files), eliminating `any`-typed parameters
- Removed hardcoded admin default from Zustand store (dead code, zero consumers)
- Changed `createDeliveryReceipt` schema from `.strip()` to `.strict()` — rejects unknown fields instead of silently dropping them
- Added missing RLS update policy for clients on orders table
- Fixed client ledger access — proxy middleware now fetches fresh `kyc_status` from DB instead of stale JWT metadata

### Features

**Admin Portal**

- Full dashboard with real-time KPI monitoring, activity tracking, and low-stock alerts
- Order management: approval, rejection, dispatch, and tracking workflows with fulfillment tab
- Inventory management: purchase orders, delivery receipts, and shipment batch tracking with 10k-record fetch limits
- Warehouse daily reports with auto-generation and XLSX/PDF export
- Product catalog management with image upload and dual pricing (port/warehouse)
- Sales report analytics matrix with interactive cost configuration panel
- Customer balance ledger with real-time inventory tracking
- Admin settings with audit log, notification system, and profile management
- KYC verification dashboard with document review and approval/rejection workflow

**Client Portal**

- 5-step registration wizard with split front/back KYC document upload
- Multi-step order wizard with split delivery and PO upload support
- Dashboard with KPI visualization, real-time notification alerts, and KYC-gated access
- Order tracking, payment submission, and attachment upload components
- Client ledger with balance display and re-delivery request flow
- Profile management, notification preferences, and contact-admin pages
- Landing page with hero section, stats, and navigation

**Order Lifecycle**

- Full flow: request &rarr; approve &rarr; dispatch &rarr; track &rarr; ledger settlement
- Draft order support with resume and delete functionality
- Redelivery request flow with automatic balance deduction on dispatch
- Autonomous warehouse returns via tracking tab (`returned_good` / `returned_waste` statuses)
- DR-to-report pipeline with live auto-load and Module 2 DR inclusion
- Price snapshot capture at order time for profit tracking accuracy

### Bug Fixes

- Fixed 3 mobile overflow issues across admin and client portals
- Fixed Suspense boundary for `useSearchParams` and OTP Zod schema
- Fixed Prisma schema alignment with SQL and DEMO_MODE enforcement
- Fixed Recharts chart colors — CSS vars replaced with hex for correct rendering
- Fixed dark mode contrast across product management and balance ledger
- Fixed global search dialog validation context and layout issues
- Fixed balance ledger depletion on redelivery dispatch
- Fixed notification system: admin-client bypass for registration and schema gaps
- Fixed production build errors and added custom 404/loading/error pages
- Fixed multi-step ordering wizard, registration review layout, and toast UX
- Fixed profile search indexing, dashboard card spacing, and sidebar routing
- Fixed product-images storage bucket and image upload UX

### Refactoring

- Split 2,237-line `admin-actions.ts` into 15 domain files + barrel re-export with zero caller changes
- Removed dead code: `fetchShipments`, `setShipments`, and hardcoded admin store default
- Reorganized test infrastructure with dedicated MSW handlers per domain

### Testing

- Set up MSW infrastructure with 11 Supabase handlers + 5 fixture files
- Added vitest.setup.ts with Supabase mock and auth stubs
- Added 15 tests across products, orders, and purchase-order actions (23 total including pre-existing)
- All tests runnable via `npm test`, `npm run test:watch`, or `npx vitest`

### Performance

- Optimized inventory tabs rendering with lazy-loaded data dependencies
- Replaced Recharts CSS variable references with hex values for faster rendering

### Chores

- Configured Supabase storage buckets and RLS policies for remote image domain support
- Added data seeding scripts for mock data, shipments, and transactions
- Skipped Playwright install on Vercel/CI in postinstall script
- Removed build output logs from repository
