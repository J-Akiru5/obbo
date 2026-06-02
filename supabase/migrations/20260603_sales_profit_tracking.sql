-- ============================================================
-- Sales & Profit Tracking Migration
-- Adds financial columns to shipment_ledger and seeds cost config.
-- ============================================================

-- Add profit columns to shipment_ledger
ALTER TABLE public.shipment_ledger
  ADD COLUMN IF NOT EXISTS total_sales            numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit           numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_profit             numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price_per_bag  numeric(10, 2),
  ADD COLUMN IF NOT EXISTS landed_cost_per_bag    numeric(10, 2),
  ADD COLUMN IF NOT EXISTS local_expenses_per_bag numeric(10, 2);

-- Seed default cost configuration
INSERT INTO public.admin_settings (key, value)
VALUES ('cost_config', '{"landed_cost_per_bag": 147.64, "local_expenses_per_bag": 20.00}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Backfill existing entries using current cost config and amount field
UPDATE public.shipment_ledger
SET
  total_sales = COALESCE(amount, 0),
  selling_price_per_bag = CASE
    WHEN (jb * 25 + sb * 50) > 0 THEN ROUND(COALESCE(amount, 0) / (jb * 25 + sb * 50), 2)
    ELSE 0
  END,
  landed_cost_per_bag = 147.64,
  local_expenses_per_bag = 20.00,
  gross_profit = ROUND(COALESCE(amount, 0) - ((jb * 25 + sb * 50) * 147.64), 2),
  net_profit = ROUND(COALESCE(amount, 0) - ((jb * 25 + sb * 50) * (147.64 + 20.00)), 2)
WHERE (total_sales IS NULL OR total_sales = 0)
  AND (jb > 0 OR sb > 0);
