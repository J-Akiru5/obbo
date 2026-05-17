-- Migration 013: Add total_purchase column to customer_balances
-- Run this in Supabase SQL Editor
--
-- The customer_balances table is missing the total_purchase column
-- that is actively used by admin-actions.ts (dispatchOrder insert),
-- ledger-client.tsx, admin reports, and client pages.

ALTER TABLE public.customer_balances ADD COLUMN IF NOT EXISTS total_purchase INTEGER NOT NULL DEFAULT 0;

-- Add CHECK constraint to ensure non-negative values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'customer_balances_total_purchase_check'
    ) THEN
        ALTER TABLE public.customer_balances ADD CONSTRAINT customer_balances_total_purchase_check CHECK (total_purchase >= 0);
    END IF;
END $$;
