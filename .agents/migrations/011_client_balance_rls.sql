-- Migration 011: Allow clients to UPDATE their own customer_balances
-- Run this in Supabase SQL Editor
--
-- Without this, client-side balance deductions in submitRedeliveryRequest fail silently.
-- The main deduction now happens in dispatchOrder (server-side, admin credentials),
-- but this policy allows clients to also update their balances in edge cases.

-- Allow clients to UPDATE their own balances
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'customer_balances: client update own'
        AND tablename = 'customer_balances'
    ) THEN
        CREATE POLICY "customer_balances: client update own"
            ON public.customer_balances
            FOR UPDATE
            USING (client_id = auth.uid())
            WITH CHECK (client_id = auth.uid());
    END IF;
END $$;

-- Also allow clients to INSERT their own balances (e.g., for future client-side creation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'customer_balances: client insert own'
        AND tablename = 'customer_balances'
    ) THEN
        CREATE POLICY "customer_balances: client insert own"
            ON public.customer_balances
            FOR INSERT
            WITH CHECK (client_id = auth.uid());
    END IF;
END $$;
