-- Migration: customer_balances fulfilled-state support.
--
-- Why:
--   1. `customer_balances` never had an `updated_at` column, yet
--      balance-actions.ts has always written one on both the manual Adjust
--      action and the redelivery-fulfilment helper. PostgREST rejects the
--      whole PATCH with PGRST204 ("Could not find the 'updated_at' column"),
--      so balance rows never changed and the caller's console.error was the
--      only trace.
--   2. The original table definition (supabase/schema.sql) enforces
--      CHECK (remaining_qty > 0). A redelivery that fully covers a pending
--      balance must record `remaining_qty = 0` + `status = 'fulfilled'`,
--      which that check rejects. The result was a fulfilled obligation that
--      stayed 'pending' forever in the Customer Obligation Report and the
--      Client Portal Balance Ledger.
--
-- This migration:
--   * adds updated_at (backfilled to now() for existing rows);
--   * relaxes the remaining_qty check to `>= 0` (a pending row still always
--     has bags remaining; a fulfilled row legitimately has zero).
--
-- Run in: Supabase Dashboard -> SQL Editor. Idempotent — safe to re-run.

alter table public.customer_balances
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  v_constraint text;
begin
  -- Drop every CHECK constraint on this table whose definition references
  -- remaining_qty. Constraint names vary across environments (the original
  -- come from schema.sql as customer_balances_remaining_qty_check), so find
  -- them by definition rather than by guessed name.
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'customer_balances'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%remaining_qty%'
  loop
    execute format('alter table public.customer_balances drop constraint %I', v_constraint);
  end loop;

  alter table public.customer_balances
    add constraint customer_balances_remaining_qty_check check (remaining_qty >= 0);
end $$;
