-- Migration: prerequisite for dispatch_order_v2 — unique constraint on
-- delivery_receipts.dr_number.
--
-- dispatch_order_v2 (supabase/migrations/20260720_dispatch_order_rpc.sql,
-- NOT modified by this migration — see that file) does:
--   insert into public.delivery_receipts (...) values (...)
--   on conflict (dr_number) do update set ...
--
-- ON CONFLICT (dr_number) requires a unique constraint or unique index on
-- dr_number to even be valid SQL at execution time. No migration in this
-- repo (.agents/migrations/ or supabase/migrations/) ever added one —
-- schema.sql's `dr_number text not null unique` only takes effect inside
-- its `create table if not exists` block, which is a no-op on a database
-- where delivery_receipts already exists (it does — DR creation/update has
-- been working via delivery-receipt-actions.ts's row-by-row writes all
-- along, which never needed ON CONFLICT). Without this constraint,
-- dispatch_order_v2 fails at runtime with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- even after the function itself is created successfully — CREATE FUNCTION
-- does not validate the function body against live schema, only first
-- invocation does.
--
-- Uses the same safe, idempotent, duplicate-checking pattern the team
-- already used for purchase_orders.po_number in
-- .agents/migrations/010_ensure_po_automation_structure.sql: if a unique
-- constraint already exists, this is a no-op. If duplicate dr_numbers
-- exist in the live data, this raises a NOTICE and skips adding the
-- constraint rather than failing outright — dispatch_order_v2 would still
-- fail for THOSE specific duplicate dr_number values until they're
-- resolved, but this migration itself always completes safely.
--
-- Run in: Supabase Dashboard → SQL Editor. Run this BEFORE (or together
-- with, order doesn't matter for creation — only before first real
-- dispatch) 20260720_dispatch_order_rpc.sql.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'delivery_receipts_dr_number_key'
           OR conname = 'delivery_receipts_dr_number_unique'
    ) THEN
        -- A plain (non-constraint) unique index also satisfies ON CONFLICT —
        -- check pg_index directly, not just pg_constraint, before assuming
        -- there's truly nothing usable.
        IF NOT EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class c ON i.indexrelid = c.oid
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE c.relnamespace = 'public'::regnamespace
              AND i.indrelid = 'public.delivery_receipts'::regclass
              AND i.indisunique
              AND a.attname = 'dr_number'
        ) THEN
            IF EXISTS (
                SELECT dr_number FROM public.delivery_receipts
                WHERE dr_number IS NOT NULL
                GROUP BY dr_number HAVING COUNT(*) > 1
            ) THEN
                RAISE NOTICE 'WARNING: Duplicate dr_number values found in delivery_receipts. '
                    'Cannot add unique constraint until duplicates are resolved — '
                    'dispatch_order_v2 will fail for orders whose dr_number collides '
                    'with an existing duplicate until this is fixed.';
            ELSE
                ALTER TABLE public.delivery_receipts
                    ADD CONSTRAINT delivery_receipts_dr_number_unique UNIQUE (dr_number);
            END IF;
        END IF;
    END IF;
END $$;
