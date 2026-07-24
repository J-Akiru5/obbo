/**
 * seed-fresh.mjs — OBBO iManage Combined Wipe + Seed
 * ─────────────────────────────────────────────────────
 * WHAT IT DOES:
 *   1. Wipes ALL transactional data (products, orders, shipments, etc.)
 *   2. Re-seeds exactly 2 Portland Cement Type 1 products (SB + JB)
 *   3. Seeds 2 shipment batches (one per product)
 *   4. Creates representative orders for ALL existing client profiles
 *      referencing the new Portland Cement products
 *   5. Seeds ledger entries and customer balances
 *
 * WHAT IT PRESERVES:
 *   ✅ All auth.users accounts
 *   ✅ All public.profiles rows (admin, client, warehouse_manager)
 *
 * PRICES:
 *   SB → Port ₱235 / Warehouse ₱240
 *   JB → Port ₱5,700 / Warehouse ₱5,800
 *
 * USAGE:
 *   node scripts/seed-fresh.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local ──────────────────────────────────────────────────────────
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
loadEnvFile(path.resolve(__dirname, '../.env'));

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Service-role client bypasses RLS for all operations
const db = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function drNum() {
  return `DR-${Math.floor(Math.random() * 900_000) + 100_000}`;
}
async function wipe(table) {
  const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    // Some tables use text PKs (activity_log entity_id), try a different sentinel
    const { error: e2 } = await db.from(table).delete().gt('created_at', '2000-01-01');
    if (e2) console.warn(`  ⚠️  Could not wipe ${table}: ${e2.message}`);
    else console.log(`  🗑  Wiped ${table}`);
    return;
  }
  console.log(`  🗑  Wiped ${table}`);
}

// ── STEP 1: WIPE ─────────────────────────────────────────────────────────────
async function step1_wipe() {
  console.log('\n━━━ STEP 1 — Wiping transactional data ━━━');
  // Order respects FK constraints (children first)
  const tables = [
    'activity_log',
    'notifications',
    'customer_balances',
    'order_items',
    'purchase_orders',
    'delivery_receipts',
    'shipment_ledger',
    'orders',
    'warehouse_reports',
    'shipments',
    'products',
    'admin_settings',
  ];
  for (const t of tables) await wipe(t);
  console.log('✅ Wipe complete.\n');
}

// ── STEP 2: SEED PRODUCTS ────────────────────────────────────────────────────
async function step2_products() {
  console.log('━━━ STEP 2 — Seeding products ━━━');
  const { data, error } = await db
    .from('products')
    .insert([
      {
        name: 'Portland Cement Type 1',
        description: 'General-purpose Portland cement. 40 kg per bag.',
        bag_type: 'SB',
        price_per_bag: 240,
        price_port: 235,
        price_warehouse: 240,
        is_active: true,
      },
      {
        name: 'Portland Cement Type 1',
        description: 'General-purpose Portland cement. 1-ton jumbo bag.',
        bag_type: 'JB',
        price_per_bag: 5800,
        price_port: 5700,
        price_warehouse: 5800,
        is_active: true,
      },
    ])
    .select();

  if (error) {
    console.error('❌ Products:', error.message);
    process.exit(1);
  }
  const sb = data.find((p) => p.bag_type === 'SB');
  const jb = data.find((p) => p.bag_type === 'JB');
  console.log(`  ✅ Portland Cement Type 1 SB  (id: ${sb.id})`);
  console.log(`  ✅ Portland Cement Type 1 JB  (id: ${jb.id})`);
  return { sb, jb };
}

// ── STEP 3: SEED SHIPMENTS ───────────────────────────────────────────────────
async function step3_shipments(sb, jb) {
  console.log('\n━━━ STEP 3 — Seeding shipments ━━━');
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await db
    .from('shipments')
    .insert([
      {
        batch_name: 'BATCH-2026-SB-001',
        product_id: sb.id,
        bag_type: 'SB',
        initial_quantity: 5000,
        good_stock: 5000,
        damaged_stock: 0,
        total_jb: 0,
        total_sb: 5000,
        remaining_jb: 0,
        remaining_sb: 5000, // will be updated after orders
        arrival_date: today,
        notes: 'Initial SB stock. Portland Cement Type 1.',
      },
      {
        batch_name: 'BATCH-2026-JB-001',
        product_id: jb.id,
        bag_type: 'JB',
        initial_quantity: 500,
        good_stock: 500,
        damaged_stock: 0,
        total_jb: 500,
        total_sb: 0,
        remaining_jb: 500, // will be updated after orders
        remaining_sb: 0,
        arrival_date: today,
        notes: 'Initial JB stock. Portland Cement Type 1.',
      },
    ])
    .select();

  if (error) {
    console.error('❌ Shipments:', error.message);
    process.exit(1);
  }
  const sbBatch = data.find((s) => s.bag_type === 'SB');
  const jbBatch = data.find((s) => s.bag_type === 'JB');
  console.log(`  ✅ ${sbBatch.batch_name} (5 000 SB bags)`);
  console.log(`  ✅ ${jbBatch.batch_name} (500 JB bags)`);
  return { sbBatch, jbBatch };
}

// ── STEP 4: SEED ORDERS ──────────────────────────────────────────────────────
async function step4_orders(sb, jb, sbBatch, jbBatch) {
  console.log('\n━━━ STEP 4 — Seeding orders for existing clients ━━━');

  const { data: clients, error: cErr } = await db
    .from('profiles')
    .select('id, full_name, email, company_name')
    .eq('role', 'client');

  if (cErr) {
    console.error('❌ Fetch clients:', cErr.message);
    process.exit(1);
  }
  if (!clients || clients.length === 0) {
    console.warn('  ⚠️  No clients found. Skipping order seed.');
    return { dispatchedSB: 0, dispatchedJB: 0 };
  }

  console.log(`  Found ${clients.length} client(s).`);

  let totalDispatchedSB = 0;
  let totalDispatchedJB = 0;

  for (const client of clients) {
    const label = client.company_name || client.full_name;
    console.log(`\n  👤 ${label} (${client.email})`);

    // Define the orders for this client
    const orderDefs = [
      // completed — SB — cash
      {
        status: 'completed',
        product: sb,
        batch: sbBatch,
        qty: 100,
        approved: 100,
        dispatched: 100,
        payment_method: 'cash',
        days: 30,
        source: 'port',
        service_type: 'deliver',
        tracking_status: 'delivered',
        notes: 'Q1 restock order.',
        isSplit: false,
      },
      // dispatched — JB — check
      {
        status: 'dispatched',
        product: jb,
        batch: jbBatch,
        qty: 20,
        approved: 20,
        dispatched: 20,
        payment_method: 'check',
        days: 5,
        source: 'warehouse',
        service_type: 'pickup',
        tracking_status: 'in_transit',
        check_number: `CHK-${Math.floor(Math.random() * 90000) + 10000}`,
        notes: 'Bulk jumbo bag pickup.',
        isSplit: false,
      },
      // partially_approved — SB — cash (split delivery)
      {
        status: 'partially_approved',
        product: sb,
        batch: sbBatch,
        qty: 200,
        approved: 100,
        dispatched: 0,
        payment_method: 'cash',
        days: 3,
        source: 'port',
        service_type: 'deliver',
        tracking_status: 'pending_dispatch',
        notes: 'Split delivery — 100 bags now, 100 bags pending.',
        isSplit: true,
        deliverNow: 100,
      },
      // pending — SB — cash
      {
        status: 'pending',
        product: sb,
        batch: null,
        qty: 50,
        approved: 0,
        dispatched: 0,
        payment_method: 'cash',
        days: 1,
        source: 'port',
        service_type: 'deliver',
        tracking_status: 'pending_dispatch',
        notes: null,
        isSplit: false,
      },
      // rejected — JB — cash
      {
        status: 'rejected',
        product: jb,
        batch: null,
        qty: 10,
        approved: 0,
        dispatched: 0,
        payment_method: 'cash',
        days: 10,
        source: 'warehouse',
        service_type: 'pickup',
        tracking_status: 'pending_dispatch',
        rejection_reason: 'Stock unavailable at requested date.',
        notes: null,
        isSplit: false,
      },
      // awaiting_check — SB — check
      {
        status: 'awaiting_check',
        product: sb,
        batch: null,
        qty: 150,
        approved: 150,
        dispatched: 0,
        payment_method: 'check',
        days: 0,
        source: 'port',
        service_type: 'deliver',
        tracking_status: 'pending_dispatch',
        check_number: `CHK-${Math.floor(Math.random() * 90000) + 10000}`,
        notes: 'Awaiting check clearance.',
        isSplit: false,
      },
    ];

    for (const o of orderDefs) {
      const ts = daysAgo(o.days);
      const totalAmount = o.product.price_per_bag * o.qty;

      // Insert order
      const { data: order, error: oErr } = await db
        .from('orders')
        .insert({
          client_id: client.id,
          status: o.status,
          total_amount: totalAmount,
          payment_method: o.payment_method,
          check_number: o.check_number || null,
          notes: o.notes,
          source: o.source,
          service_type: o.service_type,
          shipping_fee: o.service_type === 'deliver' ? 500 : 0,
          tracking_status: o.tracking_status,
          rejection_reason: o.rejection_reason || null,
          shipment_id: o.batch?.id || null,
          is_split_delivery: o.isSplit,
          deliver_now_qty: o.deliverNow || 0,
          order_type: 'new',
          dr_number: o.dispatched > 0 ? drNum() : null,
          created_at: ts,
          updated_at: ts,
        })
        .select('id')
        .single();

      if (oErr) {
        console.warn(`    ⚠️ Order (${o.status}): ${oErr.message}`);
        continue;
      }

      // Insert order item
      const { error: iErr } = await db.from('order_items').insert({
        order_id: order.id,
        product_id: o.product.id,
        bag_type: o.product.bag_type,
        requested_qty: o.qty,
        approved_qty: o.approved,
        dispatched_qty: o.dispatched,
      });
      if (iErr) console.warn(`    ⚠️ OrderItem: ${iErr.message}`);

      // Customer balance for partially_approved split
      if (o.status === 'partially_approved' && o.isSplit) {
        const remaining = o.qty - o.approved;
        const { error: bErr } = await db.from('customer_balances').insert({
          client_id: client.id,
          order_id: order.id,
          product_id: o.product.id,
          bag_type: o.product.bag_type,
          remaining_qty: remaining,
          status: 'pending',
          created_at: ts,
        });
        if (bErr) console.warn(`    ⚠️ Balance: ${bErr.message}`);
        else console.log(`    + Balance: ${remaining} ${o.product.bag_type} bags pending`);
      }

      // Activity log entry
      await db.from('activity_log').insert({
        actor_id: client.id,
        action: 'order_placed',
        entity_type: 'order',
        entity_id: order.id,
        metadata: { status: o.status, total: totalAmount, qty: o.qty },
        created_at: ts,
      });

      console.log(
        `    ✅ ${o.status.padEnd(20)} ${o.product.bag_type} × ${o.qty} bags — ₱${totalAmount.toLocaleString()}`,
      );

      // Track actual dispatched quantities
      if (o.product.bag_type === 'SB') totalDispatchedSB += o.dispatched;
      if (o.product.bag_type === 'JB') totalDispatchedJB += o.dispatched;
    }
  }

  return { totalDispatchedSB, totalDispatchedJB };
}

// ── STEP 5: SEED SHIPMENT LEDGER ─────────────────────────────────────────────
async function step5_ledger(sbBatch, jbBatch, totalDispatchedSB, totalDispatchedJB) {
  console.log('\n━━━ STEP 5 — Seeding shipment ledger ━━━');
  const today = new Date().toISOString().split('T')[0];

  const entries = [
    // SB Batch — opening + dispatches
    {
      shipment_id: sbBatch.id,
      date: today,
      po_number: 'PO-INIT-SB-001',
      client_name: 'OBBO Supplier',
      jb: 0,
      sb: 5000,
      bags_returned: 0,
      notes: 'Initial SB inventory received.',
    },
    {
      shipment_id: sbBatch.id,
      date: today,
      dr_number: drNum(),
      client_name: 'Metro Hardware',
      jb: 0,
      sb: -Math.min(totalDispatchedSB, 500),
      bags_returned: 0,
      notes: 'Dispatched to clients.',
    },
    // JB Batch — opening + dispatches
    {
      shipment_id: jbBatch.id,
      date: today,
      po_number: 'PO-INIT-JB-001',
      client_name: 'OBBO Supplier',
      jb: 500,
      sb: 0,
      bags_returned: 0,
      notes: 'Initial JB inventory received.',
    },
    {
      shipment_id: jbBatch.id,
      date: today,
      dr_number: drNum(),
      client_name: 'City Build Corp',
      jb: -Math.min(totalDispatchedJB, 50),
      sb: 0,
      bags_returned: 0,
      notes: 'Dispatched to clients.',
    },
  ];

  for (const e of entries) {
    const { error } = await db.from('shipment_ledger').insert(e);
    if (error) console.warn(`  ⚠️ Ledger entry: ${error.message}`);
    else console.log(`  ✅ Ledger: ${e.shipment_id === sbBatch.id ? 'SB' : 'JB'} — ${e.notes}`);
  }
}

// ── STEP 6: UPDATE REMAINING STOCK ──────────────────────────────────────────
async function step6_updateStock(sbBatch, jbBatch, totalDispatchedSB, totalDispatchedJB) {
  console.log('\n━━━ STEP 6 — Updating remaining stock ━━━');

  const newRemainingSB = Math.max(0, 5000 - totalDispatchedSB);
  const newRemainingJB = Math.max(0, 500 - totalDispatchedJB);

  const { error: e1 } = await db
    .from('shipments')
    .update({ remaining_sb: newRemainingSB, good_stock: newRemainingSB })
    .eq('id', sbBatch.id);

  const { error: e2 } = await db
    .from('shipments')
    .update({ remaining_jb: newRemainingJB, good_stock: newRemainingJB })
    .eq('id', jbBatch.id);

  if (e1) console.warn(`  ⚠️ SB stock update: ${e1.message}`);
  else console.log(`  ✅ SB remaining: ${newRemainingSB} / 5000`);

  if (e2) console.warn(`  ⚠️ JB stock update: ${e2.message}`);
  else console.log(`  ✅ JB remaining: ${newRemainingJB} / 500`);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   OBBO iManage — Fresh Seed Script            ║');
  console.log('║   Preserves all user accounts & profiles      ║');
  console.log('╚═══════════════════════════════════════════════╝');

  await step1_wipe();
  const { sb, jb } = await step2_products();
  const { sbBatch, jbBatch } = await step3_shipments(sb, jb);
  const { totalDispatchedSB, totalDispatchedJB } = await step4_orders(sb, jb, sbBatch, jbBatch);
  await step5_ledger(sbBatch, jbBatch, totalDispatchedSB, totalDispatchedJB);
  await step6_updateStock(sbBatch, jbBatch, totalDispatchedSB, totalDispatchedJB);

  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   ✅  Done! Summary                           ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║   Products  :  2 (SB + JB, Portland Cement 1) ║`);
  console.log(
    `║   SB Batch  :  5,000 bags  (${5000 - totalDispatchedSB} remaining)`.padEnd(49) + '║',
  );
  console.log(
    `║   JB Batch  :  500 bags    (${500 - totalDispatchedJB} remaining)`.padEnd(49) + '║',
  );
  console.log('║   Prices    :  SB ₱235 port / ₱240 warehouse  ║');
  console.log('║              JB ₱5,700 port / ₱5,800 warehouse ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
  console.log('Next: Visit /admin/products to verify the catalog.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
