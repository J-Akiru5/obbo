/**
 * wipe-transactional-data.mjs — Fresh reset for order/dispatch/profit testing.
 *
 * KEEPS INTACT:
 *   ✅ Profiles (auth.users + public.profiles)
 *   ✅ Products (public.products)
 *   ✅ Admin settings / cost config (public.admin_settings)
 *
 * WIPES:
 *   🗑  Activity log, notifications, customer balances, order items,
 *      order returns, orders, shipment ledger, delivery receipts,
 *      purchase orders, warehouse reports, shipments
 *
 * USAGE:
 *   node scripts/wipe-transactional-data.mjs          # dry run — shows counts
 *   node scripts/wipe-transactional-data.mjs --yes    # execute wipe
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

// Ordered by FK constraints — children before parents
const TABLES = [
  'activity_log',
  'notifications',
  'customer_balances',
  'order_items',
  'order_returns',
  'purchase_orders',
  'delivery_receipts',
  'shipment_ledger',
  'orders',
  'warehouse_reports',
  'shipments',
];

async function count(table) {
  const { count: c, error } = await db.from(table).select('*', { count: 'exact', head: true });
  if (error) return `error: ${error.message}`;
  return c;
}

async function wipe(table) {
  const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    const { error: e2 } = await db.from(table).delete().gt('created_at', '2000-01-01');
    if (e2) {
      console.warn(`  ⚠  ${table}: ${e2.message}`);
      return;
    }
  }
  console.log(`  🗑  ${table}`);
}

async function main() {
  console.log(
    DRY_RUN ? '━━━ DRY RUN (add --yes to execute) ━━━\n' : '━━━ WIPE TRANSACTIONAL DATA ━━━\n',
  );

  // Show what will be kept
  console.log('📦 PRESERVING:');
  for (const t of ['profiles', 'products', 'admin_settings']) {
    const c = await count(t);
    console.log(`  ✅ ${t}: ${c} row(s)`);
  }

  // Show what will be deleted
  console.log('\n📊 TABLES TO WIPE:');
  let total = 0;
  for (const t of TABLES) {
    const c = await count(t);
    if (typeof c === 'number') total += c;
    console.log(`  ${t}: ${c} row(s)`);
  }

  if (DRY_RUN) {
    console.log(`\n💡 Total rows that would be deleted: ${total}`);
    console.log('   Run with --yes to execute.\n');
    return;
  }

  if (total === 0) {
    console.log('\n✅ Nothing to wipe — all tables are already empty.\n');
    return;
  }

  console.log(`\n🗑  Deleting ${total} rows across ${TABLES.length} tables...\n`);
  for (const t of TABLES) {
    await wipe(t);
  }
  console.log('\n✅ Wipe complete.\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
