# OBBO iManage -- Project Structure Report

> Generated: June 6, 2026
> Version: 0.1.0
> Repository: `obbo-imanage`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [App Router Architecture](#4-app-router-architecture)
5. [Dual-Portal Design](#5-dual-portal-design)
6. [Component Library](#6-component-library)
7. [Data Layer](#7-data-layer)
8. [Authentication & Security](#8-authentication--security)
9. [State Management](#9-state-management)
10. [Utilities & Services](#10-utilities--services)
11. [Configuration Files](#11-configuration-files)
12. [Scripts & Tooling](#12-scripts--tooling)
13. [Testing](#13-testing)
14. [Design System & Agents](#14-design-system--agents)
15. [Key Observations](#15-key-observations)

---

## 1. Overview

**OBBO iManage** is a cloud-based ordering, inventory, and sales management platform designed for cement distribution operations. It provides role-based access for three user types: **admins**, **warehouse managers**, and **clients**.

| Property          | Value                              |
| ----------------- | ---------------------------------- |
| **Name**          | `obbo-imanage`                     |
| **Version**       | 0.1.0                              |
| **Deployment**    | Vercel (`obbo-imanage.vercel.app`) |
| **Architecture**  | Next.js App Router (standalone)    |
| **Database**      | PostgreSQL via Supabase            |
| **Auth Provider** | Supabase Auth                      |
| **PWA**           | Enabled (Serwist service worker)   |

### Core Capabilities

- **Order Management** -- Multi-step order wizard, approval workflow, split delivery, tracking
- **Inventory Tracking** -- Shipments, purchase orders, delivery receipts, warehouse reports
- **Client Portal** -- KYC-gated access, catalog browsing, order placement, balance ledger
- **Admin Dashboard** -- KPIs, client management, product CRUD, financial reports
- **Real-time Notifications** -- Supabase Realtime subscriptions across both portals
- **Report Generation** -- PDF (jsPDF) and Excel (SheetJS) export

---

## 2. Tech Stack

### Runtime & Framework

| Technology | Version | Purpose                                 |
| ---------- | ------- | --------------------------------------- |
| Next.js    | 16.2.4  | Full-stack React framework (App Router) |
| React      | 19.2.4  | UI library                              |
| React DOM  | 19.2.4  | DOM rendering                           |
| TypeScript | ^5      | Type-safe JavaScript                    |

### Styling & UI

| Technology               | Version  | Purpose                                      |
| ------------------------ | -------- | -------------------------------------------- |
| Tailwind CSS             | v4       | Utility-first CSS framework (PostCSS plugin) |
| shadcn/ui                | ^4.5.0   | Component library (base-nova style)          |
| @base-ui/react           | ^1.4.1   | Component primitives                         |
| Lucide React             | ^1.11.0  | Icon library                                 |
| Motion                   | ^12.38.0 | Animations (Framer Motion successor)         |
| next-themes              | ^0.4.6   | Dark/light theme switching                   |
| tw-animate-css           | ^1.4.0   | Tailwind animation utilities                 |
| class-variance-authority | ^0.7.1   | Component variant management                 |

### Data & Backend

| Technology    | Version  | Purpose                                      |
| ------------- | -------- | -------------------------------------------- |
| Supabase JS   | ^2.104.1 | Database client, auth, realtime, storage     |
| @supabase/ssr | ^0.10.2  | Server-side Supabase with cookie sessions    |
| Prisma        | ^7.8.0   | ORM (type generation + schema documentation) |
| PostgreSQL    | --       | Primary database (via Supabase)              |

### Forms & Validation

| Technology          | Version | Purpose               |
| ------------------- | ------- | --------------------- |
| React Hook Form     | ^7.73.1 | Form state management |
| Zod                 | ^4.3.6  | Schema validation     |
| @hookform/resolvers | ^5.2.2  | RHF + Zod integration |

### Data Visualization & Export

| Technology      | Version | Purpose               |
| --------------- | ------- | --------------------- |
| Recharts        | ^3.8.1  | Chart components      |
| jsPDF           | ^4.2.1  | PDF generation        |
| jspdf-autotable | ^5.0.7  | PDF table generation  |
| xlsx (SheetJS)  | ^0.18.5 | Excel file generation |

### Utilities

| Technology     | Version | Purpose                      |
| -------------- | ------- | ---------------------------- |
| Zustand        | ^5.0.12 | Global state management      |
| date-fns       | ^4.1.0  | Date manipulation            |
| cmdk           | ^1.1.1  | Command palette / search     |
| Sonner         | ^2.0.7  | Toast notifications          |
| Resend         | ^6.12.2 | Transactional email          |
| clsx           | ^2.1.1  | Conditional classnames       |
| tailwind-merge | ^3.5.0  | Tailwind class deduplication |

### PWA

| Technology          | Version | Purpose                  |
| ------------------- | ------- | ------------------------ |
| @serwist/next       | ^9.5.11 | Next.js PWA integration  |
| @serwist/precaching | ^9.5.11 | Asset precaching         |
| @serwist/sw         | ^9.5.11 | Service worker utilities |

### Development & Testing

| Technology                | Version | Purpose                       |
| ------------------------- | ------- | ----------------------------- |
| ESLint                    | ^9      | Linting (flat config)         |
| Vitest                    | ^4.1.6  | Test runner                   |
| @testing-library/react    | ^16.3.2 | Component testing             |
| @testing-library/jest-dom | ^6.9.1  | DOM assertion matchers        |
| jsdom                     | ^29.1.1 | Browser environment for tests |
| @vitejs/plugin-react      | ^6.0.2  | React plugin for Vitest       |

---

## 3. Directory Structure

### Top-Level Layout

```
obbo-imanage/
├── .agents/                    # AI agent rules, migrations, audit reports
│   ├── migrations/             # 17 SQL migration files (002-017)
│   ├── reports/                # System audit report
│   └── rules/                  # Design system rules
├── .github/                    # GitHub skills, instructions, prompts
│   ├── instructions/           # Auto-applied frontend instructions
│   ├── prompts/                # Performance optimization prompts
│   └── skills/                 # 4 specialized skills
├── docs/                       # Project documentation (this report)
├── prisma/                     # Prisma ORM schema
├── public/                     # Static assets (10 files)
├── scratch/                    # Ad-hoc utility scripts (4 files)
├── scripts/                    # Seed/admin/SQL scripts (15 files)
├── src/                        # Application source code (136 files)
├── supabase/                   # Supabase schema + migrations
├── .env                        # Environment variables (gitignored)
├── .env.local                  # Local env overrides (gitignored)
├── .gitignore
├── AGENTS.md                   # Primary agent instruction file
├── CLAUDE.md                   # Points to AGENTS.md
├── README.md                   # Default Next.js readme
├── bug_fix_plan01.md           # Bug fix plan document
├── components.json             # shadcn/ui configuration
├── eslint.config.mjs           # ESLint flat config
├── next-env.d.ts               # Next.js TypeScript declarations
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
├── postcss.config.mjs          # PostCSS (Tailwind v4)
├── prisma.config.ts            # Prisma configuration
├── tsconfig.json               # TypeScript configuration
├── tsconfig.tsbuildinfo        # TypeScript build cache
├── vitest.config.ts            # Vitest test runner config
└── vitest.setup.ts             # Test setup (jest-dom matchers)
```

### Source Code (`src/`)

```
src/
├── app/                        # Next.js App Router (24 routes, 3 layouts)
│   ├── layout.tsx              # Root layout (Geist fonts, ThemeProvider, Toaster)
│   ├── page.tsx                # Landing page (Hero, Features, FAQ, CTA)
│   ├── globals.css             # Tailwind v4 + Clean Industrial design tokens
│   ├── favicon.ico
│   ├── manifest.ts             # PWA manifest
│   ├── sw.ts                   # Serwist service worker
│   │
│   ├── login/
│   │   └── page.tsx            # Login page
│   ├── register/
│   │   └── page.tsx            # Multi-step registration wizard
│   ├── pending/
│   │   └── page.tsx            # Pending verification landing
│   │
│   ├── admin/                  # Admin portal
│   │   ├── layout.tsx          # Admin sidebar layout
│   │   ├── page.tsx            # Admin root redirect
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # KPI dashboard
│   │   │   └── dashboard-client.tsx
│   │   ├── clients/
│   │   │   └── page.tsx        # Client directory + KYC approval
│   │   ├── inventory/
│   │   │   ├── page.tsx        # Inventory management
│   │   │   └── components/
│   │   │       ├── shipments-tab.tsx
│   │   │       ├── po-list-tab.tsx
│   │   │       ├── dr-list-tab.tsx
│   │   │       ├── reports-tab.tsx
│   │   │       └── ledger-entry-dialog.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx        # Order management
│   │   │   └── components/
│   │   │       ├── new-requests-tab.tsx
│   │   │       ├── fulfillment-tab.tsx
│   │   │       ├── tracking-tab.tsx
│   │   │       ├── order-history-tab.tsx
│   │   │       └── product-catalog-tab.tsx
│   │   ├── products/
│   │   │   └── page.tsx        # Product management
│   │   ├── profile/
│   │   │   └── page.tsx        # Admin profile
│   │   ├── reports/
│   │   │   ├── page.tsx        # Admin reports
│   │   │   └── warehouse-manager/
│   │   │       └── page.tsx    # Warehouse manager report submission
│   │   └── settings/
│   │       └── page.tsx        # Admin settings
│   │
│   ├── client/                 # Client portal
│   │   ├── layout.tsx          # Client sidebar layout
│   │   ├── page.tsx            # Client root redirect
│   │   ├── catalog/
│   │   │   ├── page.tsx        # Product catalog
│   │   │   └── components/
│   │   │       └── catalog-client.tsx
│   │   ├── contact-admin/
│   │   │   ├── page.tsx        # Contact admin form
│   │   │   └── components/
│   │   │       └── contact-client.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Client dashboard
│   │   ├── ledger/
│   │   │   ├── page.tsx        # Balance ledger
│   │   │   └── components/
│   │   │       ├── ledger-client.tsx
│   │   │       └── ledger-client.test.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx        # Order listing
│   │   │   ├── components/
│   │   │   │   └── orders-client.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx    # Multi-step order wizard
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Order detail view
│   │   ├── pending-kyc/
│   │   │   └── page.tsx        # KYC pending screen
│   │   └── profile/
│   │       ├── page.tsx        # Profile management
│   │       └── components/
│   │           └── profile-client.tsx
│   │
│   └── api/                    # API routes
│       ├── admin/
│       │   └── kyc-document/
│       │       └── route.ts    # KYC document proxy
│       └── auth/
│           ├── send-otp/
│           │   └── route.ts    # OTP sending endpoint
│           └── verify-otp/
│               └── route.ts    # OTP verification endpoint
│
├── components/                 # Shared React components (38 files)
│   ├── ui/                     # shadcn/ui primitives (21 components)
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── command.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── optimized-image.tsx
│   │   ├── popover.tsx
│   │   ├── radio-group.tsx
│   │   ├── select.tsx
│   │   ├── separator.tsx
│   │   ├── sheet.tsx
│   │   ├── skeleton.tsx
│   │   ├── sonner.tsx
│   │   ├── step-indicator.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── textarea.tsx
│   ├── auth/
│   │   ├── auth-shell.tsx
│   │   └── register/
│   │       ├── register-schema.ts
│   │       ├── step-account-type.tsx
│   │       ├── step-credentials.tsx
│   │       ├── step-documents.tsx
│   │       ├── step-profile-details.tsx
│   │       └── step-review.tsx
│   ├── landing/
│   │   ├── navbar.tsx
│   │   └── stats.tsx
│   ├── orders/
│   │   └── wizard/
│   │       ├── order-schema.ts
│   │       ├── step-po-payment.tsx
│   │       ├── step-products.tsx
│   │       ├── step-review.tsx
│   │       ├── step-service-type.tsx
│   │       └── step-source.tsx
│   ├── avatar-upload.tsx
│   ├── bottom-navbar.tsx
│   ├── count-up.tsx
│   ├── global-search.tsx
│   ├── real-time-clock.tsx
│   ├── scroll-reveal.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
│
├── generated/                  # Prisma generated client (gitignored output)
│
├── lib/                        # Business logic, utilities, types
│   ├── actions/
│   │   ├── admin-actions.ts    # Admin server actions (1858 lines)
│   │   ├── client-actions.ts   # Client server actions (617 lines)
│   │   ├── client-actions.test.ts
│   │   ├── notification-actions.ts
│   │   └── po-utils.ts        # PO number generation
│   ├── context/
│   │   └── client-kyc-context.tsx
│   ├── hooks/
│   │   └── use-persisted-form.ts
│   ├── report-generators/
│   │   ├── report-pdf.ts
│   │   ├── report-xlsx.ts
│   │   └── types.ts
│   ├── store/
│   │   └── app-store.ts       # Zustand global store
│   ├── supabase/
│   │   ├── admin.ts           # Service-role client
│   │   ├── client.ts          # Browser client
│   │   └── server.ts          # Server-side client
│   ├── types/
│   │   └── database.ts        # TypeScript type definitions (303 lines)
│   ├── client-portal-data.ts  # Client portal data + helpers
│   ├── resend.ts              # Email client setup
│   └── utils.ts               # cn() utility
│
└── proxy.ts                    # Middleware-equivalent auth/routing proxy
```

---

## 4. App Router Architecture

### Route Map (24 Pages)

| Route                              | File                                               | Type                    |
| ---------------------------------- | -------------------------------------------------- | ----------------------- |
| `/`                                | `src/app/page.tsx`                                 | Public landing page     |
| `/login`                           | `src/app/login/page.tsx`                           | Authentication          |
| `/register`                        | `src/app/register/page.tsx`                        | Multi-step registration |
| `/pending`                         | `src/app/pending/page.tsx`                         | Pending verification    |
| `/admin`                           | `src/app/admin/page.tsx`                           | Admin root redirect     |
| `/admin/dashboard`                 | `src/app/admin/dashboard/page.tsx`                 | KPI dashboard           |
| `/admin/clients`                   | `src/app/admin/clients/page.tsx`                   | Client directory        |
| `/admin/inventory`                 | `src/app/admin/inventory/page.tsx`                 | Inventory management    |
| `/admin/orders`                    | `src/app/admin/orders/page.tsx`                    | Order management        |
| `/admin/products`                  | `src/app/admin/products/page.tsx`                  | Product CRUD            |
| `/admin/profile`                   | `src/app/admin/profile/page.tsx`                   | Admin profile           |
| `/admin/reports`                   | `src/app/admin/reports/page.tsx`                   | Reports                 |
| `/admin/reports/warehouse-manager` | `src/app/admin/reports/warehouse-manager/page.tsx` | WM report submission    |
| `/admin/settings`                  | `src/app/admin/settings/page.tsx`                  | Admin settings          |
| `/client`                          | `src/app/client/page.tsx`                          | Client root redirect    |
| `/client/catalog`                  | `src/app/client/catalog/page.tsx`                  | Product catalog         |
| `/client/contact-admin`            | `src/app/client/contact-admin/page.tsx`            | Contact form            |
| `/client/dashboard`                | `src/app/client/dashboard/page.tsx`                | Client dashboard        |
| `/client/ledger`                   | `src/app/client/ledger/page.tsx`                   | Balance ledger          |
| `/client/orders`                   | `src/app/client/orders/page.tsx`                   | Order listing           |
| `/client/orders/new`               | `src/app/client/orders/new/page.tsx`               | Order wizard            |
| `/client/orders/[id]`              | `src/app/client/orders/[id]/page.tsx`              | Order detail            |
| `/client/pending-kyc`              | `src/app/client/pending-kyc/page.tsx`              | KYC pending             |
| `/client/profile`                  | `src/app/client/profile/page.tsx`                  | Profile management      |

### Layouts (3)

| Layout | File                        | Purpose                                                            |
| ------ | --------------------------- | ------------------------------------------------------------------ |
| Root   | `src/app/layout.tsx`        | Geist fonts, ThemeProvider, Toaster                                |
| Admin  | `src/app/admin/layout.tsx`  | Sidebar nav, real-time notifications, global search, mobile navbar |
| Client | `src/app/client/layout.tsx` | Sidebar nav, KYC context, notifications, KYC status badges         |

### API Routes (3)

| Method | Route                     | File                                      | Purpose                |
| ------ | ------------------------- | ----------------------------------------- | ---------------------- |
| POST   | `/api/auth/send-otp`      | `src/app/api/auth/send-otp/route.ts`      | OTP generation + email |
| POST   | `/api/auth/verify-otp`    | `src/app/api/auth/verify-otp/route.ts`    | OTP validation         |
| GET    | `/api/admin/kyc-document` | `src/app/api/admin/kyc-document/route.ts` | KYC document proxy     |

### Middleware

- **No `middleware.ts`** -- Uses `src/proxy.ts` as middleware equivalent
- Exports `proxy` function + `config.matcher` pattern
- Handles session refresh, route protection, role-based redirects

---

## 5. Dual-Portal Design

The application implements a **dual-portal architecture** with completely separate admin and client interfaces, unified by a shared root layout and component library.

### Admin Portal (`/admin/*`)

**Access:** `admin` and `warehouse_manager` roles

**Navigation:**

- Dashboard -- KPI overview
- Orders -- New requests, fulfillment, tracking, history, product catalog (5 tabs)
- Inventory -- Shipments, PO list, DR list, reports, ledger entry (5 tabs)
- Clients -- Client directory, KYC approval
- Products -- Product management
- Reports -- Admin reports, warehouse manager report submission
- Settings -- Admin configuration
- Profile -- Admin profile

**Features:**

- Real-time notification badges
- Global search (cmdk)
- Theme toggle
- Bottom mobile navbar

### Client Portal (`/client/*`)

**Access:** `client` role (KYC-gated for restricted routes)

**Navigation:**

- Dashboard -- Client overview
- Catalog -- Product browsing
- Orders -- Order listing, new order wizard, order detail
- Ledger -- Balance ledger (KYC-verified only)
- Profile -- Profile management
- Contact Admin -- Contact form

**KYC Gating:**

- Unverified clients are redirected to `/client/pending-kyc` when accessing:
  - `/client/orders/new`
  - `/client/ledger`
- Verified clients have full access

### Role-Based Access Control

| Role                | Portal | Capabilities                                  |
| ------------------- | ------ | --------------------------------------------- |
| `admin`             | Admin  | Full access to all admin features             |
| `warehouse_manager` | Admin  | Subset of admin features (inventory, reports) |
| `client`            | Client | Order placement, catalog, ledger, profile     |

---

## 6. Component Library

### UI Primitives (21 components in `src/components/ui/`)

| Component       | File                  |
| --------------- | --------------------- |
| Avatar          | `avatar.tsx`          |
| Badge           | `badge.tsx`           |
| Button          | `button.tsx`          |
| Card            | `card.tsx`            |
| Command         | `command.tsx`         |
| Dialog          | `dialog.tsx`          |
| Dropdown Menu   | `dropdown-menu.tsx`   |
| Input           | `input.tsx`           |
| Label           | `label.tsx`           |
| Optimized Image | `optimized-image.tsx` |
| Popover         | `popover.tsx`         |
| Radio Group     | `radio-group.tsx`     |
| Select          | `select.tsx`          |
| Separator       | `separator.tsx`       |
| Sheet           | `sheet.tsx`           |
| Skeleton        | `skeleton.tsx`        |
| Sonner          | `sonner.tsx`          |
| Step Indicator  | `step-indicator.tsx`  |
| Table           | `table.tsx`           |
| Tabs            | `tabs.tsx`            |
| Textarea        | `textarea.tsx`        |

### Feature Components

**Authentication (`src/components/auth/`)**

- `auth-shell.tsx` -- Auth page wrapper
- `register/` -- 6-step registration wizard
  - `register-schema.ts` -- Zod validation schema
  - `step-account-type.tsx`
  - `step-credentials.tsx`
  - `step-documents.tsx`
  - `step-profile-details.tsx`
  - `step-review.tsx`

**Orders (`src/components/orders/wizard/`)**

- `order-schema.ts` -- Zod validation schema
- `step-source.tsx`
- `step-service-type.tsx`
- `step-products.tsx`
- `step-po-payment.tsx`
- `step-review.tsx`

**Landing Page (`src/components/landing/`)**

- `navbar.tsx` -- Navigation bar
- `stats.tsx` -- Statistics display

**Shared Components (root of `src/components/`)**

- `avatar-upload.tsx` -- Avatar upload with preview
- `bottom-navbar.tsx` -- Mobile bottom navigation
- `count-up.tsx` -- Animated number counter
- `global-search.tsx` -- Command palette search (cmdk)
- `real-time-clock.tsx` -- Live clock display
- `scroll-reveal.tsx` -- Scroll-triggered reveal animations
- `theme-provider.tsx` -- next-themes wrapper
- `theme-toggle.tsx` -- Dark/light mode toggle

### Co-located Page Components

Several pages have dedicated `components/` directories for page-specific client components:

| Page                    | Components                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `/admin/dashboard`      | `dashboard-client.tsx`                                                                            |
| `/admin/inventory`      | `shipments-tab`, `po-list-tab`, `dr-list-tab`, `reports-tab`, `ledger-entry-dialog`               |
| `/admin/orders`         | `new-requests-tab`, `fulfillment-tab`, `tracking-tab`, `order-history-tab`, `product-catalog-tab` |
| `/client/catalog`       | `catalog-client.tsx`                                                                              |
| `/client/contact-admin` | `contact-client.tsx`                                                                              |
| `/client/ledger`        | `ledger-client.tsx`, `ledger-client.test.tsx`                                                     |
| `/client/orders`        | `orders-client.tsx`                                                                               |
| `/client/profile`       | `profile-client.tsx`                                                                              |

---

## 7. Data Layer

### Prisma Schema (14 Models)

| Model             | Table               | Purpose                                                                                      |
| ----------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `Profile`         | `profiles`          | User profiles (admin, client, warehouse_manager roles; KYC status; notification preferences) |
| `Product`         | `products`          | Cement products (name, bag type, price tiers: per-bag, port, warehouse)                      |
| `Shipment`        | `shipments`         | Incoming shipment batches (JB/SB quantities, good/damaged stock tracking)                    |
| `ShipmentLedger`  | `shipment_ledger`   | Detailed shipment transaction ledger (PO/DR numbers, driver info, payments)                  |
| `DeliveryReceipt` | `delivery_receipts` | Delivery receipts linked to shipments and orders                                             |
| `Order`           | `orders`            | Client orders (status workflow, payment method, tracking, split delivery support)            |
| `OrderItem`       | `order_items`       | Line items per order (requested/approved/dispatched quantities)                              |
| `CustomerBalance` | `customer_balances` | Remaining balances for partial deliveries                                                    |
| `PurchaseOrder`   | `purchase_orders`   | Purchase orders (linked to clients, shipments, orders)                                       |
| `WarehouseReport` | `warehouse_reports` | Daily warehouse inventory reports (JB/SB received/dispatched/returned/waste)                 |
| `AdminSetting`    | `admin_settings`    | Key-value admin settings store                                                               |
| `ActivityLog`     | `activity_log`      | Audit trail for all entity actions                                                           |
| `OrderReturn`     | `order_returns`     | Return requests with reasons                                                                 |
| `Notification`    | `notifications`     | User notifications with severity levels                                                      |

### Supabase Infrastructure

**Schema:** `supabase/schema.sql` (570 lines) -- Full SQL schema with:

- Table definitions
- RLS (Row Level Security) policies
- Triggers (auto-create profile on signup)
- Functions
- Indexes
- Storage bucket setup

**Migrations (6 files in `supabase/migrations/`):**

| Date       | Migration                                   |
| ---------- | ------------------------------------------- |
| 2026-05-14 | `add_pending_final_confirmation_status`     |
| 2026-05-15 | `fix_storage_permissions_and_client_orders` |
| 2026-05-20 | `add_notification_target_role`              |
| 2026-05-22 | `add_return_reason`                         |
| 2026-05-26 | `add_sales_profit_tracking`                 |
| 2026-06-03 | `add_delivery_receipt_id_to_ledger`         |

**Standalone Migrations:**

- `migration_avatars_bucket.sql` -- Avatar storage bucket
- `migration_po_dr_automation.sql` -- PO/DR automation

### Server Actions

**Admin Actions (`src/lib/actions/admin-actions.ts` -- 1858 lines)**

- Dashboard KPIs
- Products CRUD
- Order lifecycle (approve/reject/dispatch/track)
- Shipments CRUD
- Shipment ledger CRUD
- Purchase orders
- Delivery receipts
- Warehouse reports (daily report generation/save/submit/auto-submit)
- Customer balances
- Profile management (roles, manual client creation)
- Settings (admin settings, cost config)
- KYC verification (approve/reject)
- Order returns
- Notifications
- Audit log
- Financial reports (sales/profit)

**Client Actions (`src/lib/actions/client-actions.ts` -- 617 lines)**

- Dashboard KPIs
- Recent orders
- Order submission (with split delivery support)
- Draft orders (save/delete)
- Payment submission
- Order returns
- Balances/ledger
- Redelivery requests
- Notifications (fetch/mark read)
- Profile/notification preferences
- TIN updates
- Contact info

**Notification Actions (`src/lib/actions/notification-actions.ts`)**

- `createRoleNotification()` -- Broadcasts to all users with a given role
- `createRoleNotificationAdmin()` -- Same but bypasses RLS via service-role key
- `createUserNotification()` -- Sends to a specific user

### Database Entities (15 tables)

`profiles`, `products`, `shipments`, `shipment_ledger`, `delivery_receipts`, `orders`, `order_items`, `customer_balances`, `purchase_orders`, `warehouse_reports`, `admin_settings`, `activity_log`, `order_returns`, `notifications`, `email_verifications`

---

## 8. Authentication & Security

### Auth Provider: Supabase Auth

| Flow                | Implementation                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Sign-up**         | `supabase.auth.signUp()` in register page; profile inserted to DB; user signed out pending KYC |
| **Login**           | `supabase.auth.signInWithPassword()` in login page                                             |
| **Sign-out**        | `supabase.auth.signOut()` in admin and client layouts                                          |
| **Session refresh** | `supabase.auth.getUser()` on every request via proxy                                           |

### OTP Email Verification

1. **`/api/auth/send-otp`** -- Generates 6-digit OTP, stores in `email_verifications`, sends via Resend
2. **`/api/auth/verify-otp`** -- Validates OTP, marks as used
3. **Rate limiting:** 60-second cooldown between sends
4. **Expiry:** 10 minutes

### Route Protection (Proxy)

`src/proxy.ts` acts as the middleware layer:

- Refreshes Supabase session on every request
- Protects `/admin/*` -- requires `admin` or `warehouse_manager` role
- Protects `/client/*` -- requires `client` role; redirects unverified KYC users from restricted paths
- Redirects authenticated users away from `/login`, `/register`, `/pending`
- Fetches fresh profile from DB for accurate `role` and `kyc_status`

### KYC (Know Your Client) Flow

1. New clients start with `kyc_status: "pending_verification"`
2. Admin can approve (`approveKyc`) or reject (`rejectKyc`)
3. Rejected users are permanently blocked from re-registration
4. KYC status checked in middleware and in `ClientKycContext` (real-time updates)
5. Unverified clients see pending-KYC screen for restricted features

### Row Level Security (RLS)

- Supabase RLS policies defined in `supabase/schema.sql`
- Server actions use service-role client for admin operations
- Client-facing queries use RLS-scoped client

---

## 9. State Management

### Zustand Store (`src/lib/store/app-store.ts`)

**`useAppStore`** -- Global UI state:

- `sidebarOpen` (boolean) -- Sidebar visibility
- `toggleSidebar()` / `setSidebarOpen()` -- Sidebar controls
- `currentUser` -- User object (id, email, full_name, role, kyc_status)
- `setCurrentUser()` -- User setter

### React Context (`src/lib/context/client-kyc-context.tsx`)

**`ClientKycContext`** / **`ClientKycProvider`** -- KYC state management:

- Fetches `kyc_status` from `profiles` table on mount
- Subscribes to real-time Postgres changes for live KYC status updates
- Exports `useClientKyc()` and `useIsKycVerified()` hooks
- KYC statuses: `pending_verification`, `verified`, `rejected`

### Session Storage (`src/lib/hooks/use-persisted-form.ts`)

**`usePersistedForm<T>(key, initial)`** -- Form state persistence:

- Persists to `sessionStorage` with debounced writes (300ms)
- Strips `File` objects before serialization
- Returns `[state, update, clear]` tuple
- Used in multi-step wizards (registration, order placement)

---

## 10. Utilities & Services

### Core Utilities

| Utility                   | File                            | Purpose                                        |
| ------------------------- | ------------------------------- | ---------------------------------------------- |
| `cn()`                    | `src/lib/utils.ts`              | Tailwind class merging (clsx + tailwind-merge) |
| `formatCurrency()`        | `src/lib/client-portal-data.ts` | PHP currency formatting                        |
| `getProductById()`        | `src/lib/client-portal-data.ts` | Product lookup                                 |
| `getIndividualBagCount()` | `src/lib/client-portal-data.ts` | Bag count calculation                          |
| `getSourceUnitPrice()`    | `src/lib/client-portal-data.ts` | Price lookup by source                         |
| `getOrderSubtotal()`      | `src/lib/client-portal-data.ts` | Order total calculation                        |

### Report Generators (`src/lib/report-generators/`)

| Generator | File             | Output                                                                             |
| --------- | ---------------- | ---------------------------------------------------------------------------------- |
| PDF       | `report-pdf.ts`  | Branded PDF (OBBO blue/yellow theme) with 3 table sections                         |
| Excel     | `report-xlsx.ts` | 3-sheet workbook (Physical Inventory, Customer Movement, Customer Obligations)     |
| Types     | `types.ts`       | Shared interfaces: `PhysicalData`, `DispatchRow`, `BalanceRow`, `ReportExportData` |

### Email Service (`src/lib/resend.ts`)

- Uses Resend API
- Exports `sendOtpEmail(email, code)` -- Styled HTML OTP email
- From address: `OBBO iManage <noreply@jeffdev.studio>`

### PO Utilities (`src/lib/actions/po-utils.ts`)

- `generateGlobalNextPoNumber()` -- Scans `orders` and `purchase_orders` tables for highest `PO-YYYY-NNN` number, returns next sequential

### Supabase Client Wrappers (`src/lib/supabase/`)

| Client  | File        | Purpose                                 |
| ------- | ----------- | --------------------------------------- |
| Server  | `server.ts` | Server-side client with cookie sessions |
| Browser | `client.ts` | Browser-side client                     |
| Admin   | `admin.ts`  | Service-role client (bypasses RLS)      |

---

## 11. Configuration Files

| File                 | Purpose                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `next.config.ts`     | Turbopack enabled, Supabase image remote patterns, Serwist PWA wrapper                   |
| `tsconfig.json`      | ES2017 target, bundler module resolution, `@/*` path alias, strict mode                  |
| `postcss.config.mjs` | Tailwind CSS v4 PostCSS plugin                                                           |
| `eslint.config.mjs`  | Flat config with next/core-web-vitals + typescript                                       |
| `vitest.config.ts`   | jsdom environment, React plugin, `@/` path alias                                         |
| `vitest.setup.ts`    | jest-dom/vitest matchers                                                                 |
| `prisma.config.ts`   | Prisma schema path, migrations path, DATABASE_URL                                        |
| `components.json`    | shadcn/ui: base-nova style, RSC enabled, lucide icons, neutral base color, CSS variables |

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] },
    "strict": true
  }
}
```

### shadcn/ui Configuration

```json
{
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

---

## 12. Scripts & Tooling

### npm Scripts

| Script                | Command                                                                          | Purpose                         |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| `dev`                 | `next dev`                                                                       | Development server              |
| `build`               | `next build`                                                                     | Production build                |
| `start`               | `next start`                                                                     | Production server               |
| `lint`                | `eslint`                                                                         | Lint codebase                   |
| `test`                | `vitest run`                                                                     | Run tests once                  |
| `test:watch`          | `vitest`                                                                         | Run tests in watch mode         |
| `admin:create`        | `node scripts/create-admin.mjs`                                                  | Create admin user               |
| `seed:all`            | `node scripts/seed-mock-data.mjs && seed-shipments.mjs && seed-transactions.mjs` | Seed all mock data              |
| `prisma:generate`     | `prisma generate`                                                                | Generate Prisma client          |
| `prisma:migrate:prod` | `prisma migrate deploy`                                                          | Deploy migrations to production |
| `prisma:db:push`      | `prisma db push --no-erase`                                                      | Push schema to DB               |
| `seed:historical`     | `node scripts/seed-historical-po-dr.mjs`                                         | Seed historical PO/DR data      |

### Utility Scripts (`scripts/` -- 15 files)

**User Creation:**

- `create-admin.mjs` -- Create admin user
- `create-warehouse-manager.mjs` -- Create warehouse manager user

**Data Seeding:**

- `seed-mock-data.mjs` -- Seed mock data
- `seed-shipments.mjs` -- Seed shipments
- `seed-transactions.mjs` -- Seed transactions
- `seed-historical-po-dr.mjs` -- Seed historical PO/DR data
- `seed-maria.mjs` -- Seed Maria's data
- `seed-fresh.mjs` -- Fresh seed

**SQL Scripts:**

- Various `.sql` files for storage buckets, notification triggers, cascade deletes, etc.

### Scratch Scripts (`scratch/` -- 4 files)

- Ad-hoc utility scripts for development

---

## 13. Testing

### Framework

| Component         | Technology                       |
| ----------------- | -------------------------------- |
| Test Runner       | Vitest ^4.1.6                    |
| Environment       | jsdom                            |
| Component Testing | @testing-library/react ^16.3.2   |
| DOM Assertions    | @testing-library/jest-dom ^6.9.1 |
| React Plugin      | @vitejs/plugin-react ^6.0.2      |

### Current Test Coverage

| Test File                                                 | Tests                   |
| --------------------------------------------------------- | ----------------------- |
| `src/lib/actions/client-actions.test.ts`                  | Client server actions   |
| `src/app/client/ledger/components/ledger-client.test.tsx` | Ledger client component |

**Total:** 2 test files

### Configuration

- `vitest.config.ts` -- jsdom environment, React plugin, `@/` path alias
- `vitest.setup.ts` -- jest-dom/vitest matchers

---

## 14. Design System & Agents

### Clean Industrial Design System

**Palette:**

- **Primary:** Industrial Blue
- **Accent:** Construction Yellow
- **Neutrals:** Slate scale
- **Font:** Inter preferred

**Rules:**

- Back buttons required on auth/landing pages with `ArrowLeft` icon
- Active states must use Industrial Blue
- Cards with subtle 1px borders, 8-12px radius, `shadow-sm` max
- Mobile-first responsive design
- `overflow-x-auto` on tables
- Sticky topbars

**Color System:** oklch-based with light/dark mode support

### `.agents/` Directory (18 files)

**Rules (`rules/`):**

- `design-system.md` -- Clean Industrial design system rules (always-on trigger for `**/*.{tsx,css}`)

**Migrations (`migrations/` -- 17 SQL files):**

| #   | Migration                         |
| --- | --------------------------------- |
| 002 | OTP and storage setup             |
| 003 | Admin schema evolution            |
| 004 | Product images storage            |
| 005 | Warehouse manager role            |
| 006 | Report submission                 |
| 007 | Shipment damaged breakdown        |
| 008 | Products unique constraint        |
| 009 | Order returns                     |
| 010 | PO automation structure           |
| 011 | Client balance RLS                |
| 012 | Split delivery breakdown          |
| 013 | Total purchase column             |
| 014 | FK on_delete consistency          |
| 015 | Cleanup delivery receipts columns |
| 016 | Return tracking statuses          |
| 017 | Delivery receipt ID on ledger     |

**Reports (`reports/`):**

- `system-audit-2026-05-18.md` -- Comprehensive 30-issue audit covering:
  - **CRITICAL (6):** Dark mode breakages
  - **HIGH (2):** Accessibility violations
  - **MEDIUM (13):** Dark mode issues, missing focus rings, dead CSS classes
  - **LOW (8):** Minor cosmetic issues, touch target sizes

### `.github/` Directory (6 files)

**Instructions (`instructions/`):**

- `clean-industrial.instructions.md` -- Auto-applied frontend instructions for `**/*.{tsx,css}` files

**Prompts (`prompts/`):**

- `optimize-page-performance.prompt.md` -- Performance optimization prompt

**Skills (`skills/` -- 4 skills):**

| Skill                         | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `obbo-clean-industrial-ui`    | UI implementation following OBBO visual system |
| `obbo-design-system-audit`    | Design-system compliance review                |
| `obbo-page-load-optimization` | Page load speed, hydration, bundle size        |
| `obbo-inp-optimization`       | INP and click latency optimization             |

---

## 15. Key Observations

### Architecture Decisions

1. **Standalone Application** -- Despite being in a `Monorepo/` parent directory, `obbo-imanage` is a standalone Next.js application with no workspace configuration.

2. **Dual-Portal Architecture** -- Completely separate admin and client portals with independent layouts, navigation, and access control, unified by shared root layout and component library.

3. **Three User Roles** -- `admin`, `warehouse_manager`, and `client` with distinct navigation trees and permissions enforced at the proxy/middleware level.

4. **KYC-Gated Client Features** -- Unverified clients are restricted from placing orders and viewing ledgers; they see a pending-KYC page instead.

5. **Real-time Throughout** -- Supabase Realtime subscriptions power live notifications, badge counts, and data updates in both portals.

6. **PWA-Ready** -- Full service worker setup with Serwist, web manifest, and Apple web app meta tags.

### Technical Patterns

7. **Server Actions as Data Layer** -- Primary data access via `"use server"` directives rather than API routes. Only 3 API routes exist (OTP + KYC document proxy).

8. **Prisma for Types Only** -- Despite Prisma being configured, runtime data access uses Supabase JS client directly. Prisma is used primarily for type generation and schema documentation.

9. **Proxy as Middleware** -- `src/proxy.ts` replaces the traditional `middleware.ts` pattern, handling session refresh and route protection.

10. **Multi-Step Wizards** -- Both registration (5 steps) and order placement (5 steps) use Zod schemas for step-level validation with `usePersistedForm` for session storage persistence.

### Development Maturity

11. **Formalized Design System** -- "Clean Industrial" theme with oklch color tokens, light/dark mode, custom animations, documented rules, and a prior audit report identifying 30 issues.

12. **AI-Assisted Development** -- The presence of `.agents/` rules, 17 migration files, skills, and audit reports indicates iterative development with AI-assisted workflows.

13. **Limited Test Coverage** -- Only 2 test files exist despite Vitest being configured. This is an area for improvement.

14. **No Loading/Error States** -- No `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`, or `default.tsx` files exist anywhere in the app directory.

15. **Large Server Actions File** -- `admin-actions.ts` at 1858 lines is the largest file in the project and could benefit from decomposition.

---

_Report generated for OBBO iManage v0.1.0 -- June 6, 2026_
