-- Migration script to support Shipment Batch deletion with cascading
-- Run this in your Supabase SQL Editor

-- 1. Ensure shipment_ledger deletes entries when the parent shipment is deleted
ALTER TABLE shipment_ledger
DROP CONSTRAINT IF EXISTS shipment_ledger_shipment_id_fkey,
ADD CONSTRAINT shipment_ledger_shipment_id_fkey
FOREIGN KEY (shipment_id)
REFERENCES shipments(id)
ON DELETE CASCADE;

-- 2. Update orders to set shipment_id to NULL if the shipment is deleted
-- This prevents the deletion from failing if orders are already linked to it.
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_shipment_id_fkey,
ADD CONSTRAINT orders_shipment_id_fkey
FOREIGN KEY (shipment_id)
REFERENCES shipments(id)
ON DELETE SET NULL;
