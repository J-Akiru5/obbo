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
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Accounts to keep (emails in lowercase)
const ALLOWED_EMAILS = new Set([
  'admin@obbo.com',
  'manager@obbo.com',
  'jeffmartinez@isufst.edu.ph',
  'roxanne.agub@wvsu.edu.ph',
  'agubroxanne@gmail.com',
]);

async function wipe(table) {
  console.log(`Wiping table: ${table}...`);
  const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    // Fallback for tables that don't have uuid PK or need a different deletion trigger
    const { error: e2 } = await db.from(table).delete().gt('created_at', '2000-01-01');
    if (e2) {
      console.warn(`  ⚠️ Could not wipe ${table}: ${e2.message}`);
    } else {
      console.log(`  🗑 Wiped ${table} (fallback)`);
    }
    return;
  }
  console.log(`  🗑 Wiped ${table}`);
}

async function main() {
  console.log('━━━ STARTING DATABASE CLEANUP ━━━\n');

  // 1. Wipe all transaction history tables (child tables first)
  const tables = [
    'activity_log',
    'notifications',
    'customer_balances',
    'order_items',
    'order_returns',
    'orders',
    'shipment_ledger',
    'delivery_receipts',
    'purchase_orders',
    'warehouse_reports',
    'shipments',
  ];

  for (const table of tables) {
    await wipe(table);
  }

  console.log('\n━━━ CLEANING UP RESIDUAL ACCOUNTS ━━━');

  // 2. Fetch all users from Supabase Auth
  const {
    data: { users },
    error: listError,
  } = await db.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Failed to list users:', listError);
    process.exit(1);
  }

  let deletedCount = 0;
  for (const user of users) {
    const email = user.email?.toLowerCase();
    if (!email) continue;

    if (ALLOWED_EMAILS.has(email)) {
      console.log(`  ✅ Keeping account: ${email}`);
    } else {
      console.log(`  ❌ Deleting account: ${email} (ID: ${user.id})...`);
      const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`  ⚠️ Failed to delete ${email}:`, deleteError.message);
      } else {
        console.log(`  🗑 Deleted ${email}`);
        deletedCount++;
      }
    }
  }

  console.log(`\n━━━ CLEANUP COMPLETED ━━━`);
  console.log(`Total residual accounts deleted: ${deletedCount}`);
}

main().catch((err) => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
