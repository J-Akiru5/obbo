-- Migration 016: Add return statuses to tracking_status CHECK constraint
-- Run this in Supabase SQL Editor
--
-- Adds 'returned_good' and 'returned_waste' to the tracking_status enum
-- for the autonomous warehouse returns flow via Tracking tab.

-- Drop the old constraint and recreate with new values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_tracking_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_tracking_status_check
    CHECK (tracking_status IN (
        'pending_dispatch',
        'in_transit',
        'delivered',
        'bags_returned',
        'returned_good',
        'returned_waste'
    ));
