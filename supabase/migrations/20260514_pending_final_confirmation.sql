-- Migration: Add pending_final_confirmation to orders status

-- Drop the existing constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
CHECK (status in ('pending', 'approved', 'partially_approved', 'awaiting_check', 'pending_final_confirmation', 'dispatched', 'completed', 'rejected'));
