-- Migration 014: Clean up delivery_receipts column name conflicts
-- Run this in Supabase SQL Editor
--
-- Migration 005 introduced driver_name, driver_plate_number, source,
-- service_type, dispatch_notes, created_by, updated_at columns that
-- conflict with schema.sql's canonical driver, plate_number columns.
-- TypeScript types and all code use driver and plate_number.
--
-- This migration drops the redundant migration-005 columns if they exist.

-- Drop conflicting columns from migration 005 (safe — not referenced by TypeScript/code)
ALTER TABLE public.delivery_receipts DROP COLUMN IF EXISTS driver_name;
ALTER TABLE public.delivery_receipts DROP COLUMN IF EXISTS driver_plate_number;
ALTER TABLE public.delivery_receipts DROP COLUMN IF EXISTS source;
ALTER TABLE public.delivery_receipts DROP COLUMN IF EXISTS service_type;
ALTER TABLE public.delivery_receipts DROP COLUMN IF EXISTS dispatch_notes;
ALTER TABLE public.delivery_receipts DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.delivery_receipts DROP COLUMN IF EXISTS updated_at;

-- Ensure canonical columns exist (from schema.sql)
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS driver text;
ALTER TABLE public.delivery_receipts ADD COLUMN IF NOT EXISTS plate_number text;
