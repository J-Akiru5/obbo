-- ═══════════════════════════════════════════════════════════════
-- OBBO iManage — Schema Migration: Shipment Ledger + PO/DR Automation
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════

-- ── SHIPMENT LEDGER: New columns ─────────────────────────────
ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS driver_name       text;
ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS plate_number      text;
ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS destination       text;
ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS service_type      text;
ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS payment_method    text;
ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS check_number      text;
ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS amount            numeric(14, 2);
ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS bag_returned_type text;

-- ── PURCHASE ORDERS: Payment columns ─────────────────────────
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS check_number text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS check_amount numeric(12, 2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS cash_amount  numeric(12, 2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS photo_url    text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL;

-- ── DELIVERY RECEIPTS: Destination + order link ──────────────
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS destination text;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS order_id    uuid REFERENCES public.orders(id) ON DELETE SET NULL;
