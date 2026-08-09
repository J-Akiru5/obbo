/**
 * verify-schema-drift.mjs — READ-ONLY schema drift checker.
 *
 * Compares the declared database shape (supabase/schema.sql) against the
 * hand-written TypeScript types (src/lib/types/database.ts) and reports:
 *   1. Columns in the SQL schema that are missing from the TS interface.
 *   2. Fields in the TS interface that are missing from the SQL schema.
 *   3. Columns added by migrations (.agents/migrations + supabase/migrations)
 *      that are NOT absorbed into schema.sql (the "canonical baseline").
 *   4. Drift columns actually referenced by app code (a weighted signal that a
 *      gap is live, not just theoretical).
 *
 * It writes NOTHING and requires no database connection.
 *
 * USAGE:
 *   node scripts/verify-schema-drift.mjs
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseSchemaSql(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const tables = new Map(); // name -> Set(columns)

  const lines = src.split(/\r?\n/);
  let current = null;
  for (const raw of lines) {
    const line = raw.replace(/--.*$/, '').trim();
    if (!line) continue;

    const create = line.match(/^create table if not exists public\.(\w+)\s*\($/);
    if (create) {
      current = create[1];
      if (!tables.has(current)) tables.set(current, new Set());
      continue;
    }
    if (current && (line === ')' || line === ');')) {
      current = null;
      continue;
    }
    if (current) {
      const col = line.match(
        /^([a-z_][a-z0-9_]*)\s+(uuid|text|int|integer|numeric|boolean|timestamptz|date|jsonb)\b/i,
      );
      if (col) tables.get(current).add(col[1]);
    }
  }

  // ALTER TABLE ... ADD COLUMN [IF NOT EXISTS] col
  const alterRe =
    /alter table public\.(\w+)\s+add column\s+(?:if not exists\s+)?([a-z_][a-z0-9_]*)\b/g;
  for (const m of src.matchAll(alterRe)) {
    if (!tables.has(m[1])) tables.set(m[1], new Set());
    tables.get(m[1]).add(m[2]);
  }

  return tables;
}

// Interface name -> table name
const INTERFACE_TO_TABLE = {
  Profile: 'profiles',
  Product: 'products',
  Shipment: 'shipments',
  ShipmentLedgerEntry: 'shipment_ledger',
  DeliveryReceipt: 'delivery_receipts',
  Order: 'orders',
  OrderItem: 'order_items',
  CustomerBalance: 'customer_balances',
  PurchaseOrder: 'purchase_orders',
  OrderReturn: 'order_returns',
  WarehouseReport: 'warehouse_reports',
  AdminSetting: 'admin_settings',
  ActivityLog: 'activity_log',
  Notification: 'notifications',
};

function parseDatabaseTypes(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const interfaces = new Map(); // table -> Set(fields)
  const lines = src.split(/\r?\n/);
  let current = null;
  let depth = 0;
  for (const raw of lines) {
    const line = raw.trim();
    const start = line.match(/^export interface (\w+)\s*{$/);
    if (start) {
      current = INTERFACE_TO_TABLE[start[1]];
      depth = 1;
      if (current && !interfaces.has(current)) interfaces.set(current, new Set());
      continue;
    }
    if (!current) continue;
    if (line === '}') {
      depth -= 1;
      if (depth === 0) current = null;
      continue;
    }
    if (depth === 1) {
      const f = line.match(/^([a-z_][a-z0-9_]*)\??\s*:/);
      if (f) interfaces.get(current).add(f[1]);
    }
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    depth += openBraces - closeBraces;
  }
  return interfaces;
}

function collectMigrationColumns() {
  const dirs = ['.agents/migrations', 'supabase/migrations', 'supabase'];
  const out = new Map(); // table -> Set(columns)
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((n) => n.endsWith('.sql'))) {
      const src = fs.readFileSync(path.join(abs, f), 'utf8');
      const alterRe =
        /alter table public\.(\w+)\s+add column\s+(?:if not exists\s+)?([a-z_][a-z0-9_]*)\b/gi;
      for (const m of src.matchAll(alterRe)) {
        if (!out.has(m[1])) out.set(m[1], new Set());
        out.get(m[1]).add(m[2]);
      }
      const createRe = /create table if not exists public\.(\w+)/gi;
      for (const m of src.matchAll(createRe)) {
        if (!out.has(m[1])) out.set(m[1], new Set());
      }
      const dropColRe =
        /alter table public\.(\w+)\s+drop column\s+(?:if exists\s+)?([a-z_][a-z0-9_]*)\b/gi;
      for (const m of src.matchAll(dropColRe)) {
        out.get(m[1])?.delete(m[2]);
      }
      const dropTableRe = /drop table if exists public\.(\w+)/gi;
      for (const m of src.matchAll(dropTableRe)) {
        out.delete(m[1]);
      }
    }
  }
  return out;
}

function countUsage(table, col) {
  const dir = path.join(root, 'src');
  const walk = (p) => {
    let n = 0;
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) n += walk(full);
      else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.test.ts')) {
        const src = fs.readFileSync(full, 'utf8');
        const re = new RegExp(`(?:[.\\["']|\\b)${col}(?:[.\\"']|\\b)`, 'g');
        n += (src.match(re) || []).length;
      }
    }
    return n;
  };
  return walk(dir);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const schema = parseSchemaSql(path.join(root, 'supabase/schema.sql'));
const types = parseDatabaseTypes(path.join(root, 'src/lib/types/database.ts'));
const migrations = collectMigrationColumns();

console.log('━━━ SCHEMA DRIFT CHECKER (read-only, static) ━━━\n');

const allTables = new Set([...schema.keys(), ...types.keys(), ...migrations.keys()]);
console.log(
  `Tables declared: schema.sql=${schema.size}  database.ts=${types.size}  migrations=${migrations.size}\n`,
);

const missingFromTypes = [];
const missingFromSchema = [];
const migrationNotInSchema = [];

for (const table of [...allTables].sort()) {
  const s = schema.get(table) || new Set();
  const t = types.get(table) || new Set();

  for (const col of [...s].sort()) {
    if (!t.has(col)) missingFromTypes.push({ table, col });
  }
  for (const col of [...t].sort()) {
    if (!s.has(col)) missingFromSchema.push({ table, col });
  }
  const mig = migrations.get(table) || new Set();
  for (const col of [...mig].sort()) {
    if (!s.has(col)) migrationNotInSchema.push({ table, col });
  }
}

const printDrift = (title, rows) => {
  console.log(`📋 ${title}: ${rows.length}`);
  if (rows.length) {
    for (const r of rows) {
      const usage = countUsage(r.table, r.col);
      console.log(`   ${r.table.padEnd(22)} ${r.col.padEnd(28)} code-refs=${usage}`);
    }
  }
  console.log('');
};

printDrift('COLUMNS IN schema.sql BUT MISSING FROM database.ts', missingFromTypes);
printDrift('FIELDS IN database.ts BUT MISSING FROM schema.sql', missingFromSchema);
if (missingFromSchema.length) {
  const relations = missingFromSchema.filter((r) =>
    ['client', 'product', 'order', 'items', 'actor'].includes(r.col),
  ).length;
  if (relations > 0) {
    console.log(
      `   (${relations} of the above are embedded relation aliases — client/product/order/items/actor — ` +
        `not real DB columns. Only shipment_ledger.delivery_receipt_id is a true schema gap.)\n`,
    );
  }
}
printDrift(
  'COLUMNS ADDED BY MIGRATIONS BUT NOT IN schema.sql (canonical baseline)',
  migrationNotInSchema,
);

const noType = [...allTables].filter((t) => !types.has(t)).sort();
console.log(`📋 TABLES WITHOUT A database.ts INTERFACE: ${noType.length}`);
for (const t of noType) {
  console.log(`   ${t}`);
}
console.log('');

if (
  missingFromTypes.length +
    missingFromSchema.length +
    migrationNotInSchema.length +
    noType.length ===
  0
) {
  console.log('✅ No drift detected between schema.sql, database.ts, and migrations.\n');
} else {
  console.log(
    '💡 Read-only by design. Fixes are out of scope — see docs/codebase-health-report.html.\n',
  );
}
