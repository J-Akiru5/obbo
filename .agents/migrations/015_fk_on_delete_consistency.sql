-- Migration 015: Add missing ON DELETE clauses for FK consistency
-- Run this in Supabase SQL Editor
--
-- Several foreign key references lack ON DELETE behavior,
-- causing potential orphaned rows when parent records are deleted.

DO $$
DECLARE
    constraint_name text;
BEGIN
    -- 1. orders.client_id: add ON DELETE SET NULL (matches purchase_orders.client_id)
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'orders' AND con.contype = 'f'
    AND EXISTS (
        SELECT 1 FROM pg_attribute att
        WHERE att.attrelid = rel.oid AND att.attname = 'client_id'
        AND att.attnum = ANY(con.conkey)
    );
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || constraint_name;
        EXECUTE 'ALTER TABLE public.orders ADD CONSTRAINT ' || constraint_name ||
            ' FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL';
    END IF;

    -- 2. order_items.product_id: add ON DELETE SET NULL
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'order_items' AND con.contype = 'f'
    AND EXISTS (
        SELECT 1 FROM pg_attribute att
        WHERE att.attrelid = rel.oid AND att.attname = 'product_id'
        AND att.attnum = ANY(con.conkey)
    );
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.order_items DROP CONSTRAINT ' || constraint_name;
        EXECUTE 'ALTER TABLE public.order_items ADD CONSTRAINT ' || constraint_name ||
            ' FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL';
    END IF;

    -- 3. customer_balances.client_id: add ON DELETE CASCADE
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'customer_balances' AND con.contype = 'f'
    AND EXISTS (
        SELECT 1 FROM pg_attribute att
        WHERE att.attrelid = rel.oid AND att.attname = 'client_id'
        AND att.attnum = ANY(con.conkey)
    );
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.customer_balances DROP CONSTRAINT ' || constraint_name;
        EXECUTE 'ALTER TABLE public.customer_balances ADD CONSTRAINT ' || constraint_name ||
            ' FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE';
    END IF;

    -- 4. customer_balances.order_id: add ON DELETE CASCADE
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'customer_balances' AND con.contype = 'f'
    AND EXISTS (
        SELECT 1 FROM pg_attribute att
        WHERE att.attrelid = rel.oid AND att.attname = 'order_id'
        AND att.attnum = ANY(con.conkey)
    );
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.customer_balances DROP CONSTRAINT ' || constraint_name;
        EXECUTE 'ALTER TABLE public.customer_balances ADD CONSTRAINT ' || constraint_name ||
            ' FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE';
    END IF;

    -- 5. customer_balances.product_id: add ON DELETE SET NULL
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'customer_balances' AND con.contype = 'f'
    AND EXISTS (
        SELECT 1 FROM pg_attribute att
        WHERE att.attrelid = rel.oid AND att.attname = 'product_id'
        AND att.attnum = ANY(con.conkey)
    );
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.customer_balances DROP CONSTRAINT ' || constraint_name;
        EXECUTE 'ALTER TABLE public.customer_balances ADD CONSTRAINT ' || constraint_name ||
            ' FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL';
    END IF;

    -- 6. order_returns.client_id: add ON DELETE SET NULL
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'order_returns' AND con.contype = 'f'
    AND EXISTS (
        SELECT 1 FROM pg_attribute att
        WHERE att.attrelid = rel.oid AND att.attname = 'client_id'
        AND att.attnum = ANY(con.conkey)
    );
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.order_returns DROP CONSTRAINT ' || constraint_name;
        EXECUTE 'ALTER TABLE public.order_returns ADD CONSTRAINT ' || constraint_name ||
            ' FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL';
    END IF;

    -- 7. delivery_receipts.client_id: ensure ON DELETE SET NULL (migration 005 may not have it)
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'delivery_receipts' AND con.contype = 'f'
    AND EXISTS (
        SELECT 1 FROM pg_attribute att
        WHERE att.attrelid = rel.oid AND att.attname = 'client_id'
        AND att.attnum = ANY(con.conkey)
    );
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.delivery_receipts DROP CONSTRAINT ' || constraint_name;
        EXECUTE 'ALTER TABLE public.delivery_receipts ADD CONSTRAINT ' || constraint_name ||
            ' FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL';
    END IF;
END $$;
