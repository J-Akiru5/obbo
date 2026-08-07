/**
 * audit-order-totals.mjs — READ-ONLY audit for the P0-B pricing bug.
 *
 * The bug: order totals were calculated as (jbQty × price) + (sbQty × price),
 * treating JB/SB unit counts as individual-bag counts. Prices are per
 * INDIVIDUAL 40kg bag (1 JB = 25 bags, 1 SB = 50 bags), so every affected
 * order was undercharged by roughly 25–50x, and that wrong total flowed into
 * shipment_ledger.total_sales/gross_profit/net_profit at dispatch time.
 *
 * This script recomputes what every order SHOULD have been charged —
 *   Σ requested_qty × bag_equivalent × selling_price_per_bag   (per order item)
 * using the per-item selling_price_per_bag stored at order time — and reports
 * the delta. It writes NOTHING to the database.
 *
 * Notes on scope:
 *   - Redelivery orders are skipped (total_amount is 0 by design — bags were
 *     already paid for on the original order).
 *   - Draft orders are audited but reported separately: no money has moved.
 *   - Orders with an explicit admin-entered cash/check amount may appear as
 *     "mismatched" even when intentional — review those rows manually.
 *
 * USAGE:
 *   node scripts/audit-order-totals.mjs
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

const BAG_EQUIVALENT = { JB: 25, SB: 50 };
const EPSILON = 0.01;
const PAGE = 1000;

const peso = (n) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function fetchAllOrders() {
  // Prefer the order-time price snapshot; fall back to the product's CURRENT
  // price_per_bag when migration 20260629_order_items_price_snapshot.sql has
  // not been applied to the target database yet (the column won't exist).
  const snapshotSelect =
    'id, po_number, source, status, order_type, payment_method, total_amount, shipment_id, created_at, ' +
    'items:order_items(bag_type, requested_qty, selling_price_per_bag, product:products(price_per_bag))';
  const fallbackSelect =
    'id, po_number, source, status, order_type, payment_method, total_amount, shipment_id, created_at, ' +
    'items:order_items(bag_type, requested_qty, product:products(price_per_bag))';

  let usingSnapshot = true;
  const rows = [];
  let from = 0;
  for (;;) {
    let q = db
      .from('orders')
      .select(usingSnapshot ? snapshotSelect : fallbackSelect)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    let { data, error } = await q;
    if (error && /selling_price_per_bag.*does not exist/.test(error.message)) {
      if (!usingSnapshot) throw new Error(`Failed to fetch orders: ${error.message}`);
      usingSnapshot = false;
      q = db
        .from('orders')
        .select(fallbackSelect)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);
      ({ data, error } = await q);
    }
    if (error) throw new Error(`Failed to fetch orders: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return { rows, usingSnapshot };
    from += PAGE;
  }
}

async function main() {
  console.log('━━━ ORDER TOTALS AUDIT (read-only, P0-B pricing bug) ━━━\n');

  const { rows: orders, usingSnapshot } = await fetchAllOrders();
  console.log(`Scanned ${orders.length} order(s).`);
  if (!usingSnapshot) {
    console.log(
      '⚠  order_items.selling_price_per_bag is missing (migration not applied) — ' +
        "using each product's CURRENT price_per_bag instead of the order-time snapshot.\n",
    );
  }
  console.log('');

  const mismatches = [];
  let skippedRedelivery = 0;
  let unauditableNoItems = 0;
  let unauditableNoPrice = 0;
  let audited = 0;

  for (const order of orders) {
    if (order.order_type === 'redelivery') {
      skippedRedelivery += 1;
      continue;
    }
    const items = order.items ?? [];
    if (items.length === 0) {
      unauditableNoItems += 1;
      continue;
    }
    if (items.some((i) => i.selling_price_per_bag == null && i.product?.price_per_bag == null)) {
      unauditableNoPrice += 1;
      continue;
    }

    audited += 1;
    const expected = items.reduce(
      (sum, i) =>
        sum +
        i.requested_qty *
          (BAG_EQUIVALENT[i.bag_type] ?? 1) *
          (i.selling_price_per_bag != null ? i.selling_price_per_bag : i.product?.price_per_bag),
      0,
    );
    const stored = Number(order.total_amount) || 0;
    const delta = expected - stored;
    if (Math.abs(delta) >= EPSILON) {
      mismatches.push({ order, stored, expected, delta });
    }
  }

  const real = mismatches.filter((m) => m.order.order_type !== 'draft');
  const drafts = mismatches.filter((m) => m.order.order_type === 'draft');
  const undercharged = real.filter((m) => m.delta > 0);
  const overcharged = real.filter((m) => m.delta < 0);
  const sum = (rows) => rows.reduce((s, m) => s + m.delta, 0);

  if (mismatches.length === 0) {
    console.log('✅ Every auditable order total matches the bag-corrected calculation.\n');
  } else {
    console.log('📋 MISMATCHED ORDERS (expected − stored = delta):');
    for (const m of mismatches) {
      const o = m.order;
      const date = (o.created_at || '').slice(0, 10) || '????-??-??';
      console.log(
        `  ${date}  ${(o.po_number || o.id.slice(0, 8)).padEnd(14)}  ${o.order_type.padEnd(7)}  ` +
          `${o.status.padEnd(18)}  ${(o.source || '?').padEnd(9)}  ` +
          `stored ${peso(m.stored).padStart(16)}  expected ${peso(m.expected).padStart(16)}  ` +
          `delta ${peso(m.delta).padStart(16)}`,
      );
    }
    console.log('');
  }

  // Ledger impact: dispatched orders pushed their wrong total into
  // shipment_ledger via their shipment. Count those rows for visibility.
  const affectedShipmentIds = [...new Set(real.map((m) => m.order.shipment_id).filter(Boolean))];
  let affectedLedgerRows = 0;
  if (affectedShipmentIds.length > 0) {
    const { count, error } = await db
      .from('shipment_ledger')
      .select('*', { count: 'exact', head: true })
      .in('shipment_id', affectedShipmentIds);
    if (error) {
      console.warn(`  ⚠  Could not count shipment_ledger rows: ${error.message}`);
    } else {
      affectedLedgerRows = count ?? 0;
    }
  }

  console.log('📊 SUMMARY:');
  console.log(`  Orders audited:            ${audited}`);
  console.log(`  Skipped (redelivery):      ${skippedRedelivery}`);
  console.log(`  Unauditable (no items):    ${unauditableNoItems}`);
  console.log(`  Unauditable (no price):    ${unauditableNoPrice}`);
  console.log(`  Mismatched (real orders):  ${real.length}`);
  console.log(`  Mismatched (drafts):       ${drafts.length} (informational — no money moved)`);
  console.log(
    `  Undercharged:              ${undercharged.length} order(s), ${peso(sum(undercharged))} not collected`,
  );
  console.log(
    `  Overcharged:               ${overcharged.length} order(s), ${peso(-sum(overcharged))} over-collected`,
  );
  console.log(`  Net revenue impact:        ${peso(sum(real))}`);
  if (affectedShipmentIds.length > 0) {
    console.log(
      `  Ledger rows to review:     ${affectedLedgerRows} shipment_ledger row(s) across ${affectedShipmentIds.length} shipment(s) derive from these totals`,
    );
  }
  console.log(
    '\n💡 Read-only by design: review the rows above, then decide on corrections manually.\n',
  );
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
