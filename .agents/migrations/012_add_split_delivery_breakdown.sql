-- Migration 012: Add split delivery breakdown columns to orders
-- Run this in Supabase SQL Editor
--
-- The orders table is missing deliver_now_jb and deliver_now_sb columns
-- that are actively used by client-actions.ts, admin-actions.ts, and UI components.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deliver_now_jb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deliver_now_sb INTEGER NOT NULL DEFAULT 0;

-- Add CHECK constraints to ensure non-negative values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'orders_deliver_now_jb_check'
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_deliver_now_jb_check CHECK (deliver_now_jb >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'orders_deliver_now_sb_check'
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_deliver_now_sb_check CHECK (deliver_now_sb >= 0);
    END IF;
END $$;
