-- Migration: Add return_reason to shipment_ledger for waste/damage tracking
-- 'return'  → bags go back to physical stock (current behavior)
-- 'waste'   → bags written off as waste (counted in waste_jb/sb in reports)
-- 'damage'  → bags written off as damaged (counted in waste_jb/sb in reports)

ALTER TABLE public.shipment_ledger ADD COLUMN IF NOT EXISTS return_reason text
  DEFAULT 'return'
  CHECK (return_reason IN ('return', 'waste', 'damage'));
