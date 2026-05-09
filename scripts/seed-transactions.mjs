// ⚠️  DEPRECATED — Use `scripts/seed-fresh.mjs` instead.
// seed-fresh.mjs handles transaction seeding as part of its combined flow.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local ─────────────────────────────────────────────────────────
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
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        process.env[key] = value;
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(__dirname, '../.env.local'));
loadEnvFile(path.resolve(__dirname, '../.env'));

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !SERVICE_KEY) {
    console.error('❌ Missing required environment variables.');
    process.exit(1);
}

// Admin Client to bypass RLS
const supabaseAdmin = createClient(URL_, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function seedTransactions() {
    console.log('\n💳 Seeding Comprehensive Transaction Histories...\n');

    // Fetch active products
    const { data: products } = await supabaseAdmin.from('products').select('*').eq('is_active', true);
    if (!products || products.length === 0) {
        console.error('❌ No active products found.');
        return;
    }
    const p1 = products[0];
    const p2 = products.length > 1 ? products[1] : products[0];

    // Fetch clients
    const { data: clients } = await supabaseAdmin.from('profiles').select('id, email, full_name').eq('role', 'client');
    if (!clients || clients.length === 0) {
        console.error('❌ No clients found to associate with transactions. Please run seed-mock-data.mjs first.');
        return;
    }

    const tsNow = new Date().getTime();

    for (const client of clients) {
        console.log(`\n👤 Generating transactions for ${client.full_name} (${client.email})`);

        const orders = [
            // Historical Completed Order
            { status: 'completed', total: p1.price_per_bag * 500, payment_method: 'cash', days: 25, is_split_delivery: true, qty: 500, deliver_now_qty: 500, product: p1 },
            // Dispatched Order (On the way)
            { status: 'dispatched', total: p2.price_per_bag * 100, payment_method: 'check', days: 5, is_split_delivery: false, check_number: 'CHK-999', qty: 100, deliver_now_qty: 100, product: p2 },
            // Partially Approved (Waiting for split delivery schedule)
            { status: 'partially_approved', total: p1.price_per_bag * 1000, payment_method: 'cash', days: 3, is_split_delivery: true, qty: 1000, deliver_now_qty: 200, product: p1 },
            // Pending Order
            { status: 'pending', total: p1.price_per_bag * 250, payment_method: 'check', days: 1, is_split_delivery: false, qty: 250, deliver_now_qty: 250, product: p1 },
            // Rejected Order
            { status: 'rejected', total: p2.price_per_bag * 50, payment_method: 'cash', days: 10, is_split_delivery: false, qty: 50, deliver_now_qty: 50, product: p2 },
        ];

        for (const o of orders) {
            const orderTs = new Date(tsNow - o.days * 86400000).toISOString();

            const { data: order, error: oErr } = await supabaseAdmin.from('orders').insert({
                client_id: client.id,
                status: o.status,
                total_amount: o.total,
                payment_method: o.payment_method,
                check_number: o.check_number || null,
                created_at: orderTs,
                updated_at: orderTs,
            }).select('id').single();

            if (oErr) { 
                console.warn(`⚠️ Order (${o.status}) Error:`, oErr.message); 
                continue; 
            }

            let approved = 0, dispatched = 0;
            if (o.status === 'completed') { approved = o.qty; dispatched = o.qty; }
            else if (o.status === 'dispatched') { approved = o.qty; dispatched = o.deliver_now_qty; }
            else if (o.status === 'partially_approved') { approved = o.deliver_now_qty; }

            // Insert Order Items
            await supabaseAdmin.from('order_items').insert({
                order_id: order.id,
                product_id: o.product.id,
                bag_type: o.product.bag_type,
                requested_qty: o.qty,
                approved_qty: approved,
                dispatched_qty: dispatched,
            });

            // Insert Customer Balances for partially approved split deliveries
            if (o.status === 'partially_approved' && o.is_split_delivery) {
                const remainingQty = o.qty - o.deliver_now_qty;
                await supabaseAdmin.from('customer_balances').insert({
                    client_id: client.id,
                    order_id: order.id,
                    product_id: o.product.id,
                    bag_type: o.product.bag_type,
                    remaining_qty: remainingQty,
                    status: 'pending',
                    created_at: orderTs
                });
                console.log(`   + Customer Balance created: ${remainingQty} remaining`);
            }

            // Generate Delivery Receipt for completed/dispatched
            if (o.status === 'completed' || o.status === 'dispatched') {
                await supabaseAdmin.from('delivery_receipts').insert({
                    shipment_id: 'BATCH-2026-003', // Stub shipment ID, just for mock purposes
                    dr_number: `DR-TX-${Math.floor(Math.random() * 90000) + 10000}`,
                    quantity: dispatched,
                    bag_type: o.product.bag_type,
                    received_date: o.status === 'completed' ? new Date(tsNow - (o.days - 2) * 86400000).toISOString() : new Date().toISOString(),
                    client_id: client.id,
                    client_name: client.full_name,
                    jb: o.product.bag_type === 'JB' ? dispatched : 0,
                    sb: o.product.bag_type === 'SB' ? dispatched : 0,
                    created_at: orderTs
                });
                console.log(`   + Delivery Receipt created for ${dispatched} bags`);
            }

            console.log(`✅ Order: ${o.status.padEnd(18)} ₱${o.total.toLocaleString()} - ${o.qty} bags`);
        }
    }

    console.log('\n🎉 Done seeding comprehensive transaction history!');
}

seedTransactions().catch(e => {
    console.error(e);
    process.exit(1);
});
