-- ═══════════════════════════════════════════════════════════════
-- OBBO iManage — Schema Migration: PO/DR Automation Columns
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (idempotent)
-- ═══════════════════════════════════════════════════════════════

-- Add payment columns to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS check_number text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS check_amount numeric(12, 2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS cash_amount  numeric(12, 2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS photo_url    text;

-- Add destination and order_id to delivery_receipts
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS destination text;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
