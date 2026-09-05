# Obbo iManage

**The all-in-one distribution platform built for cement distributors and construction supply businesses.**

Stop juggling spreadsheets, paper receipts, and messaging apps. Obbo centralizes your orders, inventory, deliveries, billing, and client management into one platform your entire team can access.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_It_Now-brightgreen)](#)
[![License](https://img.shields.io/badge/License-Proprietary-blue)](#license)

---

![Dashboard](docs/images/dashboard.png)

---

## Overview

Obbo iManage is a cloud-based distribution management platform designed specifically for **cement distribution operations** in the Philippines. It handles the full lifecycle of your business — from the moment a client places an order, through warehouse dispatch and delivery tracking, all the way to billing, returns, and financial reporting.

Whether you distribute from port or warehouse, handle pickups or deliveries, manage cash or check payments — Obbo gives you a single source of truth for your entire operation.

### Who It's For

- **Cement distributors** managing high-volume orders across multiple shipments
- **Construction companies** that need reliable, trackable cement supply
- **Warehouse managers** overseeing daily dispatch operations
- **Business owners** who want real-time visibility into inventory, revenue, and profits
- **Operations teams** tired of chasing paper trails and manual reconciliations

---

## The Problem We Solve

Cement distribution is a complex, high-stakes operation. Orders come in through calls and messages. Inventory is tracked on paper. Deliveries are confirmed by phone. Reconciliation happens days later — if at all.

This leads to:

- **Lost orders** buried in chat threads
- **Inventory blind spots** causing stockouts or overstocking
- **Delivery disputes** with no digital trail
- **Manual billing errors** eating into margins
- **No real-time visibility** into what's happening across your operation

Obbo eliminates these problems by digitizing every step of the distribution workflow.

---

## Key Business Features

### Client Registration & KYC Verification

Clients register online with a structured onboarding process. Upload valid IDs and business permits. Admins review and approve or reject applications — only verified clients can place orders.

### Product Catalog

Manage your cement product lineup with dual pricing — **port prices** for pickup orders and **warehouse prices** for delivery orders. Currently supports Portland Cement Type 1 in Jumbo Bag (JB) and Sling Bag (SB) variants.

### Order Management

Clients place orders through a guided 5-step wizard: choose source, select service type, pick products, submit PO and payment details, then review. Admins approve orders fully, partially, or reject with reasons.

### Split Delivery

Not ready to receive the full order? Clients can request **split delivery** — receive part now and keep the remainder as a balance for future re-delivery.

### Dispatch & Delivery Tracking

Warehouse managers assign shipment batches, enter delivery receipt details, and dispatch orders. Every dispatch automatically deducts stock, creates a ledger entry, generates a PO record, and calculates profit. Track orders from `pending_dispatch` through `in_transit` to `delivered`.

### Inventory Management

Track incoming shipment batches with JB/SB totals, damaged vs. good stock, and remaining quantities. Every shipment has a detailed financial ledger recording every dispatch and return.

### Customer Balance Ledger

Clients see exactly what they've purchased, what's been delivered, and what's remaining. Request re-delivery directly from the balance ledger — the system handles the rest.

### Returns & Waste Tracking

Clients request returns for delivered orders. Admins approve or reject returns, categorizing them as returnable, waste, or damage. Profit calculations adjust automatically based on return reason.

### Financial Reporting

Real-time profit calculations per dispatch using configurable landed cost and local expenses. Generate sales and profit reports by date range. Export daily warehouse reports as PDF or Excel.

### Warehouse Daily Reports

Warehouse managers save and submit daily inventory reports showing opening stock, receipts, dispatches, returns, waste, and closing stock. Reports auto-submit at end-of-day if not manually submitted.

### Notifications

Real-time, role-based notifications. Warehouse managers get alerted for new orders. Clients get notified on order approvals, dispatches, and KYC status changes. In-app bell icon with unread count.

### Audit Trail

Every significant action is logged with the actor, action type, entity, and metadata. Full accountability across your operation.

---

## End-to-End Workflow

Here's how an order flows through Obbo from start to finish:

```
Client Registration → KYC Verification → Order Placement → Admin Review
        ↓                                                           ↓
   Pending until                                          ┌────────┴────────┐
   admin approves                                     Approved        Rejected
        ↓                                                  ↓               ↓
  Client Can Order                               Dispatch Setup     Client Notified
        ↓                                                  ↓
  Submits Order ──→ Source (Port/Warehouse)              ↓
                       ↓                          Assign Shipment Batch
                 Service Type (Pickup/Delivery)            ↓
                       ↓                          Enter DR Details
                 Select Products                        ↓
                       ↓                          Stock Deducted
                 Upload PO & Payment                    ↓
                       ↓                          Ledger Entry Created
                 Review & Submit                       ↓
                       ↓                          Profit Calculated
                 Order Created                         ↓
                       ↓                          Client Notified
                 Admin/WM Reviews                      ↓
                       ↓                          Order Status Updated
              ┌────────┴────────┐                       ↓
          Approved         Rejected              Delivery Tracking
              ↓                 ↓                      ↓
     Dispatch Workflow    Client Notified      In Transit → Delivered
              ↓                                      ↓
     Stock Deducted                          Returns (if any)
     Profit Calculated                              ↓
     PO Auto-Generated                       Admin Approves/Rejects
              ↓                                      ↓
     Client Balance Updated                   Balance Adjusted
              ↓                                      ↓
     Re-delivery Available                    Financial Reconciliation
```

---

## User Roles

### Admin

Full access to everything. Manages products, clients, orders, inventory, reports, and system settings. Approves KYC applications, creates manual client accounts, configures cost settings, and views profit reports. The business owner's command center.

### Warehouse Manager

The operational backbone. Manages daily dispatch operations, approves and fulfills orders, tracks shipments, creates purchase orders and delivery receipts, submits daily warehouse reports, and handles return approvals. Has visibility into orders, inventory, and client management — but not cost configuration or profit settings.

### Client

The customer portal. Browses the product catalog, places orders with split delivery options, tracks order status, manages their balance ledger, requests re-delivery, submits return requests, and receives real-time notifications. Access is gated by KYC verification — unverified clients see limited functionality until approved.

---

## Modules

### Dashboard

- **Admin Dashboard**: KPIs (stock levels, pending orders, pending KYC, active clients, today's revenue/profit), stock charts, daily financials, recent activity feed
- **Client Dashboard**: Pending orders, active shipments, remaining bag balances, recent order history

### Order Management

- 5-step order wizard with source, service type, product selection, PO/payment, and review
- Admin order management with tabs: New Requests, Fulfillment, Tracking, History
- Partial approval with automatic customer balance creation
- Split delivery support
- Draft order saving and resumption
- Redelivery orders linked to original PO numbers

### Inventory

- Shipment batch creation and management
- Purchase order (PO) records
- Delivery receipt (DR) records
- Shipment ledger with per-dispatch financial tracking
- Cost configuration (landed cost per bag, local expenses per bag)
- Returns processing

### Client Management

- Client directory with profile details
- KYC document review and approval/rejection workflow
- Role assignment (admin, warehouse_manager, client)
- Manual client creation for admin-only accounts

### Reports

- Daily warehouse reports (save, submit, auto-submit)
- Customer movement reports
- Customer obligation reports
- Sales & profit reports with date-range filtering
- PDF and Excel export capabilities

### Settings

- System cost configuration
- Contact information management
- Activity log and audit trail

### Notifications

- Role-based bulk notifications
- User-specific notifications
- Real-time delivery via Supabase Realtime
- Configurable notification preferences per client

---

## Benefits

### Less Paperwork

Every order, delivery receipt, purchase order, and financial entry lives digitally. No more lost receipts or illegible handwriting.

### Better Inventory Visibility

Real-time stock levels across all shipment batches. Know exactly how much JB and SB stock you have — good, damaged, and remaining — at any moment.

### Faster Project Coordination

Clients place orders online. Warehouse managers fulfill them in real time. Everyone sees the same information. No more phone tag.

### Reduced Delivery Mistakes

Every dispatch is tracked with DR numbers, driver details, plate numbers, and destinations. Digital trail eliminates disputes.

### Improved Financial Tracking

Automatic profit calculation on every dispatch. Configurable cost models. Date-range financial reports. Know your margins in real time.

### Better Accountability

Full audit trail of every action. Know who did what, when, and why. Role-based access ensures everyone sees only what they should.

### Streamlined Client Onboarding

Digital KYC verification with document upload. Admins review and approve in minutes, not days.

### Automated Workflows

Dispatch automatically deducts stock, creates ledger entries, generates POs, and calculates profit. One action triggers the entire downstream process.

---

## Screenshots

### Admin Dashboard

![Admin Dashboard](docs/images/admin-dashboard.png)

### Client Portal

![Client Portal](docs/images/client-portal.png)

### Order Management

![Order Management](docs/images/order-management.png)

### Inventory Management

![Inventory](docs/images/inventory.png)

### Warehouse Reports

![Warehouse Reports](docs/images/warehouse-reports.png)

### Client Order Wizard

![Order Wizard](docs/images/order-wizard.png)

---

## Technology Stack

| Layer               | Technology                                           |
| ------------------- | ---------------------------------------------------- |
| **Framework**       | Next.js 16 (App Router)                              |
| **UI Library**      | React 19                                             |
| **Language**        | TypeScript                                           |
| **Styling**         | Tailwind CSS v4                                      |
| **UI Components**   | shadcn/ui                                            |
| **Database**        | PostgreSQL (via Supabase)                            |
| **Authentication**  | Supabase Auth (email/password with OTP verification) |
| **ORM**             | Prisma                                               |
| **Server State**    | React Server Actions                                 |
| **Client State**    | Zustand                                              |
| **Email Service**   | Resend                                               |
| **File Storage**    | Supabase Storage                                     |
| **Real-time**       | Supabase Realtime                                    |
| **PDF Generation**  | jsPDF + jsPDF-AutoTable                              |
| **Excel Export**    | SheetJS (xlsx)                                       |
| **Form Validation** | Zod + React Hook Form                                |
| **Animations**      | Motion (Framer Motion)                               |
| **Charts**          | Recharts                                             |
| **PWA**             | Serwist (Service Worker)                             |
| **Testing**         | Vitest + Playwright (E2E)                            |
| **Code Quality**    | ESLint + Prettier + Husky + Commitlint               |

### Architecture

- **Server Actions** for all data mutations — no exposed REST API for business logic
- **Row-Level Security (RLS)** at the database level — clients can only access their own data
- **Atomic database transactions** for dispatch operations — stock deduction, ledger creation, and order updates happen as a single unit
- **Role-based middleware** route protection — automatic redirects based on authentication and role status
- **Real-time subscriptions** for live notification delivery

---

## Local Development

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or pnpm
- A [Supabase](https://supabase.com) project (free tier works)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/obbo.git
   cd obbo
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy the example environment file and fill in your Supabase credentials:

   ```bash
   cp .env.example .env.local
   ```

   Required variables:
   - `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` — Your Supabase service role key (server-side only)
   - `RESEND_API_KEY` — Your Resend API key for email OTP delivery

4. **Set up the database**

   Run the SQL schema against your Supabase database:

   ```bash
   # Via Supabase SQL Editor or psql
   psql -f supabase/schema.sql
   ```

5. **Run the development server**

   ```bash
   npm run dev
   ```

6. **Open in browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Creating an Admin Account

```bash
npm run admin:create
```

This script creates an admin user directly in Supabase Auth with verified KYC status.

### Seeding Demo Data

```bash
npm run seed:all
```

This populates the database with mock products, clients, shipments, and transactions for testing.

---

## Roadmap

Based on the current architecture and business model, planned enhancements include:

- **Multi-product expansion** — Support for additional cement types and construction materials beyond Portland Cement Type 1
- **Mobile-optimized experience** — Progressive Web App improvements for warehouse staff using tablets on-site
- **Advanced reporting** — Trend analysis, forecast dashboards, and period-over-period comparisons
- **Client self-service portal improvements** — Order history export, payment history, and statement generation
- **Driver management** — Dedicated driver profiles with delivery performance tracking
- **Route optimization** — Delivery route planning and tracking integration
- **SMS notifications** — Complement in-app notifications with SMS delivery alerts
- **Multi-warehouse support** — Manage inventory across multiple warehouse locations
- **API integrations** — Connect with accounting software, ERP systems, and logistics providers
- **Role-based dashboards** — Customizable dashboard widgets for different user roles

---

## License

Proprietary. All rights reserved.

This software is owned by Obbo. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without prior written consent.

---

<p align="center">
  Built for the Philippine cement distribution industry
</p>
