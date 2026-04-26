-- ============================================================
-- OBBO iManage — Migration 003: Admin Schema Evolution
-- Run this in Supabase SQL Editor AFTER migration 002
-- ============================================================

-- ── PRODUCTS: Add PORT/WAREHOUSE pricing ────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_port NUMERIC(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_warehouse NUMERIC(12,2);

-- Backfill existing rows
UPDATE public.products SET price_port = price_per_bag, price_warehouse = price_per_bag WHERE price_port IS NULL;

-- ── SHIPMENTS: Redesign to hold both JB and SB ─────────────
-- Drop the NOT NULL + FK constraint on product_id for the new model
-- A shipment batch is now a "folder" that holds JB and SB totals

ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_product_id_fkey;
ALTER TABLE public.shipments ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_bag_type_check;
ALTER TABLE public.shipments ALTER COLUMN bag_type DROP NOT NULL;

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS total_jb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS total_sb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS remaining_jb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS remaining_sb INTEGER NOT NULL DEFAULT 0;

-- Backfill existing shipments
UPDATE public.shipments
SET total_jb = CASE WHEN bag_type = 'JB' THEN initial_quantity ELSE 0 END,
    total_sb = CASE WHEN bag_type = 'SB' THEN initial_quantity ELSE 0 END,
    remaining_jb = CASE WHEN bag_type = 'JB' THEN good_stock ELSE 0 END,
    remaining_sb = CASE WHEN bag_type = 'SB' THEN good_stock ELSE 0 END
WHERE total_jb = 0 AND total_sb = 0;

-- ── SHIPMENT LEDGER ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shipment_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id     UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  dr_number       TEXT,
  po_number       TEXT,
  client_name     TEXT,
  jb              INTEGER NOT NULL DEFAULT 0,
  sb              INTEGER NOT NULL DEFAULT 0,
  bags_returned   INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipment_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipment_ledger: admin all" ON public.shipment_ledger;
CREATE POLICY "shipment_ledger: admin all"
  ON public.shipment_ledger FOR ALL USING (public.is_admin());

-- ── ORDERS: Add dispatch, tracking, PO, and shipping fields ─
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS po_image_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'warehouse';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'pickup';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dr_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dr_image_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS plate_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'pending_dispatch';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bags_returned_jb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bags_returned_sb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES public.shipments(id);

-- Add source/service_type check constraints safely
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_source_check CHECK (source IN ('port', 'warehouse'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_service_type_check CHECK (service_type IN ('pickup', 'deliver'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_tracking_status_check CHECK (tracking_status IN ('pending_dispatch', 'in_transit', 'delivered', 'bags_returned'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── PURCHASE ORDERS (PO List) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  po_number     TEXT NOT NULL,
  client_id     UUID REFERENCES public.profiles(id),
  client_name   TEXT,
  jb            INTEGER NOT NULL DEFAULT 0,
  sb            INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  source        TEXT CHECK (source IN ('port', 'warehouse')),
  service_type  TEXT CHECK (service_type IN ('pickup', 'deliver')),
  shipment_id   UUID REFERENCES public.shipments(id),
  order_id      UUID REFERENCES public.orders(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_orders: admin all" ON public.purchase_orders;
CREATE POLICY "purchase_orders: admin all"
  ON public.purchase_orders FOR ALL USING (public.is_admin());

-- ── DELIVERY RECEIPTS: Extend with new fields ───────────────
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS jb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS sb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS driver TEXT;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS plate_number TEXT;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS dr_image_url TEXT;

-- ── WAREHOUSE REPORTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warehouse_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  yesterday_jb    INTEGER NOT NULL DEFAULT 0,
  yesterday_sb    INTEGER NOT NULL DEFAULT 0,
  received_jb     INTEGER NOT NULL DEFAULT 0,
  received_sb     INTEGER NOT NULL DEFAULT 0,
  dispatched_jb   INTEGER NOT NULL DEFAULT 0,
  dispatched_sb   INTEGER NOT NULL DEFAULT 0,
  returned_jb     INTEGER NOT NULL DEFAULT 0,
  returned_sb     INTEGER NOT NULL DEFAULT 0,
  waste_jb        INTEGER NOT NULL DEFAULT 0,
  waste_sb        INTEGER NOT NULL DEFAULT 0,
  closing_jb      INTEGER NOT NULL DEFAULT 0,
  closing_sb      INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_date)
);

ALTER TABLE public.warehouse_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_reports: admin all" ON public.warehouse_reports;
CREATE POLICY "warehouse_reports: admin all"
  ON public.warehouse_reports FOR ALL USING (public.is_admin());

-- ── ADMIN SETTINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_settings: admin all" ON public.admin_settings;
CREATE POLICY "admin_settings: admin all"
  ON public.admin_settings FOR ALL USING (public.is_admin());

-- Allow clients to READ contact_info setting
DROP POLICY IF EXISTS "admin_settings: client read contact" ON public.admin_settings;
CREATE POLICY "admin_settings: client read contact"
  ON public.admin_settings FOR SELECT USING (key = 'contact_info');

-- ── STORAGE BUCKETS ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 'product-images', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dr-uploads', 'dr-uploads', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for admin uploads
CREATE POLICY "product-images: admin upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "dr-uploads: admin all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'dr-uploads' AND public.is_admin());

CREATE POLICY "order-attachments: admin read all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-attachments' AND public.is_admin());
