-- Migration 010: Ensure purchase_orders has proper structure for PO automation
-- Run this in Supabase SQL Editor

-- 1. Ensure all required columns exist on purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS check_number text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS check_amount numeric(12, 2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS cash_amount  numeric(12, 2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS photo_url    text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS source       text;

-- 2. Add CHECK constraints for data integrity (idempotent via DO block)
DO $$
BEGIN
    -- source constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'purchase_orders_source_check'
    ) THEN
        ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_source_check
            CHECK (source IN ('port', 'warehouse'));
    END IF;

    -- service_type constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'purchase_orders_service_type_check'
    ) THEN
        ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_service_type_check
            CHECK (service_type IN ('pickup', 'deliver'));
    END IF;
END $$;

-- 3. Ensure unique constraint on po_number (critical for upsert and PO-DR linking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'purchase_orders_po_number_key' OR conname = 'purchase_orders_po_number_unique'
    ) THEN
        -- Check if a non-unique index exists on po_number first
        IF EXISTS (
            SELECT 1 FROM pg_index i
            JOIN pg_class c ON i.indexrelid = c.oid
            WHERE c.relname LIKE '%po_number%' AND c.relname LIKE '%purchase_orders%'
        ) THEN
            -- Drop non-unique index and recreate as unique
            EXECUTE 'DROP INDEX IF EXISTS ' || (
                SELECT c.relname FROM pg_index i
                JOIN pg_class c ON i.indexrelid = c.oid
                WHERE c.relname LIKE '%po_number%' AND c.relname LIKE '%purchase_orders%'
                LIMIT 1
            );
        END IF;
        
        -- Check for duplicate po_numbers before adding unique constraint
        IF EXISTS (
            SELECT po_number, COUNT(*) FROM public.purchase_orders
            GROUP BY po_number HAVING COUNT(*) > 1
        ) THEN
            RAISE NOTICE 'WARNING: Duplicate po_number values found in purchase_orders. Cannot add unique constraint until duplicates are resolved.';
        ELSE
            ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_po_number_unique UNIQUE (po_number);
        END IF;
    END IF;
END $$;

-- 4. Ensure service_type CHECK constraint in orders matches (for data consistency)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'orders_service_type_check'
    ) THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_service_type_check
            CHECK (service_type IN ('pickup', 'deliver'));
    END IF;
END $$;

-- 5. Update RLS policy to include warehouse manager
DO $$
BEGIN
    DROP POLICY IF EXISTS "purchase_orders: admin all" ON public.purchase_orders;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'purchase_orders: admin/manager all'
        AND tablename = 'purchase_orders'
    ) THEN
        CREATE POLICY "purchase_orders: admin/manager all"
            ON public.purchase_orders FOR ALL
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    ELSE
        CREATE POLICY "purchase_orders: admin all"
            ON public.purchase_orders FOR ALL
            USING (public.is_admin());
    END IF;
END $$;
