#!/usr/bin/env node

/**
 * Wipe customer_balances ONLY, to normalize after the unit-mismatch fix.
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

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function wipeCustomerBalances({ dryRun }) {
  console.log('🗑️  customer_balances normalization\n');

  const existing = await prisma.customerBalance.findMany({
    select: {
      id: true,
      clientId: true,
      orderId: true,
      bagType: true,
      totalPurchase: true,
      remainingQty: true,
      status: true,
    },
  });

  if (existing.length === 0) {
    console.log('✅ customer_balances is already empty. Nothing to do.\n');
    return;
  }

  const pending = existing.filter((b) => b.status === 'pending' && Number(b.remainingQty) > 0);

  console.log(`Found ${existing.length} balance row(s), ${pending.length} currently pending.\n`);

  if (pending.length > 0) {
    console.log('⚠️  These clients currently show a pending balance that will be DELETED:');
    const byClient = new Map();
    for (const b of pending) {
      const key = b.clientId;
      byClient.set(key, (byClient.get(key) || 0) + 1);
    }
    for (const [clientId, count] of byClient) {
      console.log(`  • client ${clientId}: ${count} pending balance row(s)`);
    }
    console.log('');
  }

  if (dryRun) {
    console.log('Dry run only — no rows deleted. Run with --yes to actually clear the table.\n');
    return;
  }

  const result = await prisma.customerBalance.deleteMany({});
  console.log(`✅ Deleted ${result.count} customer_balances row(s).`);
  console.log('   New balances will be created correctly (in individual bags) going forward.\n');
}

const confirm = process.argv[2] === '--yes';

if (!confirm) {
  console.log('⚠️  WARNING: This will DELETE every row in customer_balances, including any');
  console.log('   client currently owed a pending redelivery.\n');
  console.log('✅ PRESERVED: orders, order_items, shipments, shipment_ledger, profiles,');
  console.log('   products, admin_settings — nothing else is touched.\n');
  await wipeCustomerBalances({ dryRun: true });
  console.log('Run with --yes flag to confirm:');
  console.log('  node scripts/wipe-customer-balances.mjs --yes\n');
  process.exit(0);
}

try {
  await wipeCustomerBalances({ dryRun: false });
} catch (error) {
  console.error('❌ Error during wipe:', error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
