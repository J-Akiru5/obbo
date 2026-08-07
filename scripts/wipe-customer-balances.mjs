/**
 * wipe-customer-balances.mjs — Clear customer_balances ONLY, to normalize
 * after the unit-mismatch fix.
 *
 * WHY THIS EXISTS: customer_balances.remaining_qty (and total_purchase) were
 * previously written in JB/SB UNITS by approveOrder and dispatchOrder, but
 * the balance page and redelivery flow always treated the stored number as
 * INDIVIDUAL bags (labeling it "individual bags" and dividing by 25/50 when
 * converting back to units). Every row created before the fix landed is
 * denominated in the WRONG unit. Rather than guess at a backfill conversion
 * for rows that may already reflect partial redeliveries against the old
 * (wrong) numbers, this clears the table so every row going forward is
 * created fresh, in the correct unit, by the fixed approveOrder/dispatchOrder.
 *
 * SAFE for: normalizing customer_balances after deploying the unit fix.
 * DOES NOT TOUCH: orders, order_items, shipments, shipment_ledger, profiles,
 *                  products, admin_settings — nothing else in the system.
 *
 * IMPORTANT: any client with a currently pending balance loses visibility
 * into what they're owed until a new partial-approval or split-dispatch
 * recreates it correctly. If any clients have real outstanding balances
 * right now, reconcile with them manually (or note it down) BEFORE running
 * this with --yes — this script does not attempt to preserve or migrate
 * that information, by design (see header above).
 *
 * Usage:
 *   node scripts/wipe-customer-balances.mjs            # dry run — shows what would be deleted
 *   node scripts/wipe-customer-balances.mjs --yes       # actually deletes
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const sep = line.indexOf('=');
    const key = line.slice(0, sep).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    process.env[key] = value;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(__dirname, '../.env.local'));

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = !process.argv.includes('--yes');
const PAGE = 1000;

async function fetchBalances() {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await db
      .from('customer_balances')
      .select('id, client_id, bag_type, remaining_qty, total_purchase, status, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to fetch customer_balances: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
    from += PAGE;
  }
}

async function main() {
  console.log('🗑️  customer_balances normalization\n');

  const existing = await fetchBalances();

  if (existing.length === 0) {
    console.log('✅ customer_balances is already empty. Nothing to do.\n');
    return;
  }

  const pending = existing.filter((b) => b.status === 'pending' && Number(b.remaining_qty) > 0);

  console.log(`Found ${existing.length} balance row(s), ${pending.length} currently pending.\n`);

  if (pending.length > 0) {
    console.log('⚠️  These clients currently show a pending balance that will be DELETED:');
    const byClient = new Map();
    for (const b of pending) {
      byClient.set(b.client_id, (byClient.get(b.client_id) || 0) + 1);
    }
    for (const [clientId, count] of byClient) {
      console.log(`  • client ${clientId}: ${count} pending balance row(s)`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('Dry run only — no rows deleted. Run with --yes to actually clear the table.\n');
    return;
  }

  const { error } = await db
    .from('customer_balances')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    const { error: e2 } = await db
      .from('customer_balances')
      .delete()
      .gt('created_at', '2000-01-01');
    if (e2) throw new Error(`Failed to delete customer_balances: ${e2.message}`);
  }

  console.log(`✅ Deleted ${existing.length} customer_balances row(s).`);
  console.log('   New balances will be created correctly (in individual bags) going forward.\n');
}

if (!process.argv.includes('--yes')) {
  console.log('⚠️  WARNING: This will DELETE every row in customer_balances, including any');
  console.log('   client currently owed a pending redelivery.\n');
  console.log('✅ PRESERVED: orders, order_items, shipments, shipment_ledger, profiles,');
  console.log('   products, admin_settings — nothing else is touched.\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
