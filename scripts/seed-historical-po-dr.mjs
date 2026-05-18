/**
 * seed-historical-po-dr.mjs — Seeder for Historical PO and DR Transactions
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES:
 *   1. Seeds historical client accounts if none are present in profiles
 *   2. Seeds 2 Portland Cement Type 1 products (SB + JB) if missing
 *   3. Seeds 2 historical shipment batches for last month (April 2026)
 *   4. Generates a diverse set of orders with dates between 15 and 45 days ago
 *      covering all states (completed, dispatched, approved, split-deliveries,
 *      awaiting check, pending, rejected)
 *   5. Generates corresponding linked Purchase Orders (PO) and Delivery Receipts (DR)
 *   6. Decrements shipment remaining stock dynamically to reflect the dispatches
 *
 * USAGE:
 *   node scripts/seed-historical-po-dr.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// ── Load Environment Variables ──────────────────────────────────────────────
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
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Bypasses RLS to seed safely
const db = createClient(URL_, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function randomDateLastMonth(minDays = 15, maxDays = 45) {
    const days = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
    return new Date(Date.now() - days * 86_400_000).toISOString();
}

function dateAfter(isoString, daysToAdd) {
    const date = new Date(isoString);
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString();
}

function generatePoNum() {
    return `PO-HIST-${Math.floor(Math.random() * 900000) + 100000}`;
}

function generateDrNum() {
    return `DR-HIST-${Math.floor(Math.random() * 900000) + 100000}`;
}

// ── STEP 1: VERIFY PRODUCTS ──────────────────────────────────────────────────
async function ensureProducts() {
    console.log('🔍 Checking existing products...');
    const { data: existing, error } = await db.from('products').select('*');
    if (error) {
        console.error('❌ Failed to fetch products:', error.message);
        process.exit(1);
    }

    let sb = existing.find(p => p.bag_type === 'SB');
    let jb = existing.find(p => p.bag_type === 'JB');

    if (!sb || !jb) {
        console.log('🌱 Products missing. Inserting canonical Portland Cement Type 1...');
        const newProducts = [];
        if (!sb) {
            newProducts.push({
                name: 'Portland Cement Type 1',
                description: 'General-purpose Portland cement. 40 kg per bag.',
                bag_type: 'SB',
                price_per_bag: 240,
                price_port: 235,
                price_warehouse: 240,
                is_active: true,
            });
        }
        if (!jb) {
            newProducts.push({
                name: 'Portland Cement Type 1',
                description: 'General-purpose Portland cement. 1-ton jumbo bag.',
                bag_type: 'JB',
                price_per_bag: 5800,
                price_port: 5700,
                price_warehouse: 5800,
                is_active: true,
            });
        }

        const { data: inserted, error: pErr } = await db.from('products').insert(newProducts).select();
        if (pErr) {
            console.error('❌ Failed to insert products:', pErr.message);
            process.exit(1);
        }

        if (!sb) sb = inserted.find(p => p.bag_type === 'SB');
        if (!jb) jb = inserted.find(p => p.bag_type === 'JB');
    }

    console.log(`✅ SB Product: ${sb.name} (ID: ${sb.id})`);
    console.log(`✅ JB Product: ${jb.name} (ID: ${jb.id})`);
    return { sb, jb };
}

// ── STEP 2: VERIFY OR CREATE CLIENT PERSONAS ────────────────────────────────
async function ensureClients() {
    console.log('🔍 Checking existing client profiles...');
    const { data: existing, error } = await db.from('profiles').select('*').eq('role', 'client');
    if (error) {
        console.error('❌ Failed to fetch profiles:', error.message);
        process.exit(1);
    }

    if (existing && existing.length > 0) {
        console.log(`✅ Found ${existing.length} existing clients to generate transaction history.`);
        return existing;
    }

    console.log('🌱 No client profiles found. Creating mock customer personas...');

    // We will register a few user emails in Supabase Auth if needed, but since we are seeding
    // transactional tables directly bypassing RLS, we can define direct client profile UUIDs
    // which represent verified accounts. We'll use static consistent UUIDs so they map cleanly.
    const mockClients = [
        {
            id: '1a111111-1111-1111-1111-111111111111',
            email: 'retailer.alpha@obbo-test.com',
            full_name: 'Retailer Alpha',
            company_name: 'Alpha Hardware Inc',
            phone: '+63 917 111 2233',
            account_type: 'company',
            kyc_status: 'verified',
            role: 'client',
        },
        {
            id: '2b222222-2222-2222-2222-222222222222',
            email: 'builder.corp@obbo-test.com',
            full_name: 'Builder Corp',
            company_name: 'Builder Corp',
            phone: '+63 917 444 5566',
            account_type: 'company',
            kyc_status: 'verified',
            role: 'client',
        },
        {
            id: '3c333333-3333-3333-3333-333333333333',
            email: 'metro.hardware@obbo-test.com',
            full_name: 'Metro Hardware',
            company_name: 'Metro Hardware',
            phone: '+63 917 777 8899',
            account_type: 'company',
            kyc_status: 'verified',
            role: 'client',
        }
    ];

    // First ensure they exist in auth.users by inserting directly if we can, 
    // or just insert the profile rows since transactional DB relies on public.profiles.
    // For RLS and relational integrity with auth.users, let's create actual auth users!
    // Since we are running via service role, let's register them!
    const verifiedClients = [];
    for (const c of mockClients) {
        // Try admin creating user
        const { data: authUser, error: authErr } = await db.auth.admin.createUser({
            email: c.email,
            password: 'Password@1234',
            email_confirm: true,
            user_metadata: {
                full_name: c.full_name,
                role: 'client',
                kyc_status: 'verified',
                account_type: c.account_type,
                company_name: c.company_name
            }
        });

        let profileId = c.id;
        if (authErr) {
            if (authErr.message.includes('already registered') || authErr.message.includes('already exists')) {
                // Fetch the existing user ID
                const { data: usersData } = await db.auth.admin.listUsers();
                const matched = usersData?.users?.find(u => u.email === c.email);
                if (matched) profileId = matched.id;
            } else {
                console.warn(`  ⚠️ Could not register auth user ${c.email}: ${authErr.message}`);
                // Fallback to inserting profile with static UUID
                profileId = c.id;
            }
        } else {
            profileId = authUser.user.id;
        }

        // Upsert profile
        const { data: prof, error: pErr } = await db.from('profiles').upsert({
            id: profileId,
            email: c.email,
            full_name: c.full_name,
            company_name: c.company_name,
            phone: c.phone,
            account_type: c.account_type,
            kyc_status: 'verified',
            role: 'client',
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' }).select();

        if (pErr) {
            console.error(`❌ Profile upsert failure for ${c.email}:`, pErr.message);
        } else {
            console.log(`  ✅ Profile upserted: ${c.full_name} (${c.email})`);
            verifiedClients.push(prof[0]);
        }
    }

    return verifiedClients;
}

// ── STEP 3: SEED HISTORICAL SHIPMENTS ────────────────────────────────────────
async function ensureShipments(sb, jb) {
    console.log('🔍 Checking historical shipments...');
    const { data: existing } = await db.from('shipments').select('*');
    
    let sbBatch = existing?.find(s => s.batch_name === 'BATCH-2026-SB-APR');
    let jbBatch = existing?.find(s => s.batch_name === 'BATCH-2026-JB-APR');

    const aprilArrival = '2026-04-01';

    if (!sbBatch || !jbBatch) {
        console.log('🌱 Historical April shipment batches missing. Seeding...');
        const newShipments = [];
        if (!sbBatch) {
            newShipments.push({
                batch_name: 'BATCH-2026-SB-APR',
                product_id: sb.id,
                bag_type: 'SB',
                initial_quantity: 8000,
                good_stock: 8000,
                damaged_stock: 0,
                total_jb: 0,
                total_sb: 8000,
                remaining_jb: 0,
                remaining_sb: 8000,
                arrival_date: aprilArrival,
                notes: 'Historical April SB stock.',
            });
        }
        if (!jbBatch) {
            newShipments.push({
                batch_name: 'BATCH-2026-JB-APR',
                product_id: jb.id,
                bag_type: 'JB',
                initial_quantity: 800,
                good_stock: 800,
                damaged_stock: 0,
                total_jb: 800,
                total_sb: 0,
                remaining_jb: 800,
                remaining_sb: 0,
                arrival_date: aprilArrival,
                notes: 'Historical April JB stock.',
            });
        }

        const { data: inserted, error: sErr } = await db.from('shipments').insert(newShipments).select();
        if (sErr) {
            console.error('❌ Failed to insert shipments:', sErr.message);
            process.exit(1);
        }

        if (!sbBatch) sbBatch = inserted.find(s => s.batch_name === 'BATCH-2026-SB-APR');
        if (!jbBatch) jbBatch = inserted.find(s => s.batch_name === 'BATCH-2026-JB-APR');
    }

    console.log(`✅ SB Shipment: ${sbBatch.batch_name} (Initial: 8,000 SB)`);
    console.log(`✅ JB Shipment: ${jbBatch.batch_name} (Initial: 800 JB)`);
    return { sbBatch, jbBatch };
}

// ── STEP 4: SEED HISTORICAL TRANSACTIONS ──────────────────────────────────────
async function seedHistoricalTransactions(sb, jb, sbBatch, jbBatch, clients) {
    console.log('\n💳 Seeding Historical Transactions (POs, Orders, Items, DRs) from last month...\n');

    let totalDispatchedSB = 0;
    let totalDispatchedJB = 0;

    for (const client of clients) {
        const clientLabel = client.company_name || client.full_name;
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`👤 Customer: ${clientLabel} (${client.email})`);

        // Generate 7 unique orders of all kinds with dates spread across last month
        const ordersList = [
            // 1. Fully Completed Cash Order (SB, 250 bags)
            {
                status: 'completed',
                product: sb,
                batch: sbBatch,
                qty: 250,
                approved: 250,
                dispatched: 250,
                payment_method: 'cash',
                source: 'port',
                service_type: 'deliver',
                tracking_status: 'delivered',
                notes: 'Completed warehouse-direct delivery.',
                po_status: 'completed',
                has_dr: true,
                driver: 'Juan Dela Cruz',
                plate: 'ABC-1234'
            },
            // 2. Fully Completed Check Order (JB, 40 bags)
            {
                status: 'completed',
                product: jb,
                batch: jbBatch,
                qty: 40,
                approved: 40,
                dispatched: 40,
                payment_method: 'check',
                check_number: `CHK-${Math.floor(Math.random() * 9000) + 1000}`,
                source: 'warehouse',
                service_type: 'pickup',
                tracking_status: 'delivered',
                notes: 'Jumbo bags pick up. Completed payment clearance.',
                po_status: 'completed',
                has_dr: true,
                driver: 'Manuel Santos',
                plate: 'XYZ-9876'
            },
            // 3. Dispatched Check Order (SB, 180 bags)
            {
                status: 'dispatched',
                product: sb,
                batch: sbBatch,
                qty: 180,
                approved: 180,
                dispatched: 180,
                payment_method: 'check',
                check_number: `CHK-${Math.floor(Math.random() * 9000) + 1000}`,
                source: 'warehouse',
                service_type: 'deliver',
                tracking_status: 'in_transit',
                notes: 'Dispatched to secondary warehouse branch.',
                po_status: 'approved',
                has_dr: true,
                driver: 'Pedro Garcia',
                plate: 'GHI-4567'
            },
            // 4. Partially Approved Split Delivery (SB, 600 bags total, 300 approved, 200 deliver now)
            {
                status: 'partially_approved',
                product: sb,
                batch: sbBatch,
                qty: 600,
                approved: 300,
                dispatched: 200,
                payment_method: 'cash',
                source: 'port',
                service_type: 'deliver',
                tracking_status: 'pending_dispatch',
                notes: 'Split delivery order. Dispatching 200 bags, remaining added to ledger balance.',
                is_split: true,
                deliver_now_qty: 200,
                po_status: 'approved',
                has_dr: true,
                driver: 'Jose Rizal',
                plate: 'MNO-5678'
            },
            // 5. Awaiting Check Order (JB, 20 bags)
            {
                status: 'awaiting_check',
                product: jb,
                batch: null,
                qty: 20,
                approved: 0,
                dispatched: 0,
                payment_method: 'check',
                check_number: `CHK-${Math.floor(Math.random() * 9000) + 1000}`,
                source: 'warehouse',
                service_type: 'pickup',
                tracking_status: 'pending_dispatch',
                notes: 'Awaiting check verification prior to approval.',
                po_status: 'pending'
            },
            // 6. Pending Order (SB, 120 bags)
            {
                status: 'pending',
                product: sb,
                batch: null,
                qty: 120,
                approved: 0,
                dispatched: 0,
                payment_method: 'cash',
                source: 'port',
                service_type: 'deliver',
                tracking_status: 'pending_dispatch',
                notes: 'Manual PO request submitted. Pending confirmation.',
                po_status: 'pending'
            },
            // 7. Rejected Order (SB, 400 bags)
            {
                status: 'rejected',
                product: sb,
                batch: null,
                qty: 400,
                approved: 0,
                dispatched: 0,
                payment_method: 'cash',
                source: 'port',
                service_type: 'deliver',
                tracking_status: 'pending_dispatch',
                notes: 'Rejected due to credit line assessment.',
                rejection_reason: 'Exceeded maximum credit limits for client profile.',
                po_status: 'rejected'
            }
        ];

        for (const o of ordersList) {
            const date = randomDateLastMonth(15, 45); // Spread across April 2026
            const totalAmount = o.product.price_per_bag * o.qty;
            const poNum = generatePoNum();

            // Insert into public.orders
            const { data: order, error: oErr } = await db.from('orders').insert({
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
                is_split_delivery: o.is_split || false,
                deliver_now_qty: o.deliver_now_qty || 0,
                order_type: 'new',
                po_number: poNum,
                created_at: date,
                updated_at: date,
            }).select('id').single();

            if (oErr) {
                console.warn(`  ⚠️ Order (${o.status}) insertion failed: ${oErr.message}`);
                continue;
            }

            // Insert into order_items
            const { error: iErr } = await db.from('order_items').insert({
                order_id: order.id,
                product_id: o.product.id,
                bag_type: o.product.bag_type,
                requested_qty: o.qty,
                approved_qty: o.approved,
                dispatched_qty: o.dispatched,
            });
            if (iErr) console.warn(`  ⚠️ OrderItem insertion failed: ${iErr.message}`);

            // Insert Purchase Order (PO)
            const poData = {
                date: date.split('T')[0],
                po_number: poNum,
                client_id: client.id,
                client_name: clientLabel,
                jb: o.product.bag_type === 'JB' ? o.qty : 0,
                sb: o.product.bag_type === 'SB' ? o.qty : 0,
                status: o.po_status,
                source: o.source,
                service_type: o.service_type,
                shipment_id: o.batch?.id || null,
                order_id: order.id,
                photo_url: `https://xjfbrjyvinljseqbbika.supabase.co/storage/v1/object/public/purchase-orders/po-sample.jpg`,
                created_at: date,
                updated_at: date,
            };

            if (o.payment_method === 'check') {
                poData.check_number = o.check_number;
                poData.check_amount = totalAmount;
            } else {
                poData.cash_amount = totalAmount;
            }

            const { error: poErr } = await db.from('purchase_orders').insert(poData);
            if (poErr) console.warn(`  ⚠️ PurchaseOrder insertion failed: ${poErr.message}`);

            // Insert Customer Balance for partially approved split deliveries
            if (o.status === 'partially_approved' && o.is_split) {
                const remaining = o.qty - o.approved;
                const { error: cbErr } = await db.from('customer_balances').insert({
                    client_id: client.id,
                    order_id: order.id,
                    product_id: o.product.id,
                    bag_type: o.product.bag_type,
                    remaining_qty: remaining,
                    status: 'pending',
                    created_at: date,
                });
                if (cbErr) console.warn(`  ⚠️ CustomerBalance insertion failed: ${cbErr.message}`);
                else console.log(`    + Split balance created: ${remaining} bags remaining`);
            }

            // Insert Delivery Receipt (DR)
            if (o.has_dr) {
                const drNum = generateDrNum();
                const drDate = dateAfter(date, 1); // Delivered 1 day later

                // Link order back with its DR details
                await db.from('orders').update({
                    dr_number: drNum,
                    dr_image_url: `https://xjfbrjyvinljseqbbika.supabase.co/storage/v1/object/public/delivery-receipts/dr-sample.jpg`
                }).eq('id', order.id);

                const { error: drErr } = await db.from('delivery_receipts').insert({
                    shipment_id: o.batch.id,
                    dr_number: drNum,
                    quantity: o.dispatched,
                    bag_type: o.product.bag_type,
                    received_date: drDate.split('T')[0],
                    po_number: poNum,
                    client_name: clientLabel,
                    client_id: client.id,
                    jb: o.product.bag_type === 'JB' ? o.dispatched : 0,
                    sb: o.product.bag_type === 'SB' ? o.dispatched : 0,
                    driver: o.driver,
                    plate_number: o.plate,
                    shipping_fee: o.service_type === 'deliver' ? 500 : 0,
                    dr_image_url: `https://xjfbrjyvinljseqbbika.supabase.co/storage/v1/object/public/delivery-receipts/dr-sample.jpg`,
                    destination: 'Warehouse Branch',
                    order_id: order.id,
                    created_at: date,
                });

                if (drErr) console.warn(`  ⚠️ DeliveryReceipt insertion failed: ${drErr.message}`);
                else console.log(`    + DR generated: ${drNum} for ${o.dispatched} bags`);
            }

            // Add activity log
            await db.from('activity_log').insert({
                actor_id: client.id,
                action: 'order_placed',
                entity_type: 'order',
                entity_id: order.id,
                metadata: { status: o.status, po_number: poNum, total: totalAmount },
                created_at: date,
            });

            console.log(`  ✅ Order: [${o.status.toUpperCase()}] PO: ${poNum} | ${o.product.bag_type} x ${o.qty} bags — ₱${totalAmount.toLocaleString()}`);

            // Sum up total dispatched
            if (o.product.bag_type === 'SB') totalDispatchedSB += o.dispatched;
            if (o.product.bag_type === 'JB') totalDispatchedJB += o.dispatched;
        }
    }

    return { totalDispatchedSB, totalDispatchedJB };
}

// ── STEP 5: SEED LEDGER & SYNC STOCK ──────────────────────────────────────────
async function updateStockAndLedger(sbBatch, jbBatch, totalDispatchedSB, totalDispatchedJB) {
    console.log('\n━━━ STEP 5 — Updating remaining stock and ledger ━━━');
    const ledgerDate = '2026-04-15'; // Middle of April 2026

    // 1. Drop a dispatch transaction in shipment_ledger for April dispatches
    if (totalDispatchedSB > 0) {
        const { error: lErr1 } = await db.from('shipment_ledger').insert({
            shipment_id: sbBatch.id,
            date: ledgerDate,
            dr_number: 'DR-HIST-DISP-SB',
            client_name: 'Historical Dispatches',
            jb: 0,
            sb: -totalDispatchedSB,
            notes: `Total SB bags dispatched during April 2026 operations.`,
        });
        if (lErr1) console.warn(`  ⚠️ SB ledger entry failed: ${lErr1.message}`);
    }

    if (totalDispatchedJB > 0) {
        const { error: lErr2 } = await db.from('shipment_ledger').insert({
            shipment_id: jbBatch.id,
            date: ledgerDate,
            dr_number: 'DR-HIST-DISP-JB',
            client_name: 'Historical Dispatches',
            jb: -totalDispatchedJB,
            sb: 0,
            notes: `Total JB bags dispatched during April 2026 operations.`,
        });
        if (lErr2) console.warn(`  ⚠️ JB ledger entry failed: ${lErr2.message}`);
    }

    // 2. Reduce the shipment stock numbers
    const newRemainingSB = Math.max(0, 8000 - totalDispatchedSB);
    const newRemainingJB = Math.max(0, 800 - totalDispatchedJB);

    const { error: e1 } = await db.from('shipments')
        .update({ remaining_sb: newRemainingSB, good_stock: newRemainingSB })
        .eq('id', sbBatch.id);

    const { error: e2 } = await db.from('shipments')
        .update({ remaining_jb: newRemainingJB, good_stock: newRemainingJB })
        .eq('id', jbBatch.id);

    if (e1) console.warn(`  ⚠️ SB stock update: ${e1.message}`);
    else console.log(`  ✅ SB Shipment Remaining: ${newRemainingSB} / 8000`);

    if (e2) console.warn(`  ⚠️ JB stock update: ${e2.message}`);
    else console.log(`  ✅ JB Shipment Remaining: ${newRemainingJB} / 800`);
}

// ── MAIN FUNCTION ────────────────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('╔═════════════════════════════════════════════════════════╗');
    console.log('║   OBBO iManage — Historical PO & DR Seeder Script       ║');
    console.log('║   Generating transactions from last month (April 2026)  ║');
    console.log('╚═════════════════════════════════════════════════════════╝');
    console.log('');

    const { sb, jb } = await ensureProducts();
    const clients = await ensureClients();
    const { sbBatch, jbBatch } = await ensureShipments(sb, jb);

    const { totalDispatchedSB, totalDispatchedJB } = await seedHistoricalTransactions(
        sb,
        jb,
        sbBatch,
        jbBatch,
        clients
    );

    await updateStockAndLedger(sbBatch, jbBatch, totalDispatchedSB, totalDispatchedJB);

    console.log('');
    console.log('╔═════════════════════════════════════════════════════════╗');
    console.log('║   🎉 Seeding Successful! Summary                        ║');
    console.log('╠═════════════════════════════════════════════════════════╣');
    console.log(`║   Mock Clients Generated/Used  : ${clients.length}`.padEnd(57) + '║');
    console.log(`║   April SB Dispatched          : ${totalDispatchedSB} bags`.padEnd(57) + '║');
    console.log(`║   April JB Dispatched          : ${totalDispatchedJB} bags`.padEnd(57) + '║');
    console.log('║                                                         ║');
    console.log('║   Verify results in:                                    ║');
    console.log('║   - Admin Dashboard / Orders Tab                        ║');
    console.log('║   - Admin Inventory / Shipments & PO tabs               ║');
    console.log('╚═════════════════════════════════════════════════════════╝');
    console.log('');
}

main().catch(e => {
    console.error('❌ Seeder script failed:', e);
    process.exit(1);
});
