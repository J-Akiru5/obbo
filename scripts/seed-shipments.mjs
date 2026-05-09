// ⚠️  DEPRECATED — Use `scripts/seed-fresh.mjs` instead.
// seed-fresh.mjs handles shipment seeding as part of its combined flow.

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

async function seedShipmentsAndLedger() {
    console.log('\n🚢 Seeding Shipments, Ledger Entries, and Transactions...\n');

    // Fetch active products
    const { data: products } = await supabaseAdmin.from('products').select('*').eq('is_active', true);
    if (!products || products.length === 0) {
        console.error('❌ No active products found to associate with shipments.');
        return;
    }

    const typeI_SB = products.find(p => p.bag_type === 'SB');
    const typeI_JB = products.find(p => p.bag_type === 'JB');

    const tsNow = new Date().toISOString();
    const shipments = [];
    const clientNames = ['Retailer Alpha', 'Builder Corp', 'ContructIt Inc', 'Metro Hardware', 'City Build'];
    
    // Generate 10 shipments over the past 30 days
    for (let i = 1; i <= 10; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const arrivalDate = new Date(Date.now() - daysAgo * 86400000).toISOString();
        const isSB = Math.random() > 0.5;
        const initialQty = isSB ? 5000 : 1000;
        const damaged = Math.floor(Math.random() * (isSB ? 50 : 10));
        const good = initialQty - damaged;

        shipments.push({
            batch_name: `BATCH-2026-${String(i).padStart(3, '0')}`,
            product_id: isSB ? (typeI_SB?.id || products[0].id) : (typeI_JB?.id || products[0].id),
            bag_type: isSB ? 'SB' : 'JB',
            initial_quantity: initialQty,
            good_stock: good,
            damaged_stock: damaged,
            total_jb: isSB ? 0 : initialQty,
            total_sb: isSB ? initialQty : 0,
            remaining_jb: isSB ? 0 : good, // Starting with good stock, ledger will subtract
            remaining_sb: isSB ? good : 0,
            arrival_date: arrivalDate,
            notes: `Batch ${i} from primary supplier.`,
            created_at: arrivalDate
        });
    }

    const insertedShipments = [];
    for (const shipment of shipments) {
        const { data, error } = await supabaseAdmin.from('shipments').insert(shipment).select().single();
        if (error) {
            console.error(`❌ Error inserting shipment ${shipment.batch_name}:`, error.message);
        } else {
            console.log(`✅ Inserted Shipment: ${data.batch_name}`);
            insertedShipments.push(data);
        }
    }

    if (insertedShipments.length === 0) return;

    console.log('\n📝 Seeding Shipment Ledger Entries...\n');
    
    for (const shipment of insertedShipments) {
        const arrivalTs = new Date(shipment.arrival_date);
        
        const entries = [
            {
                shipment_id: shipment.id,
                date: shipment.arrival_date,
                dr_number: null,
                po_number: `PO-INIT-${shipment.batch_name}`,
                client_name: 'OBBO Supplier',
                jb: shipment.total_jb,
                sb: shipment.total_sb,
                bags_returned: 0,
                notes: 'Received initial inventory',
            }
        ];

        // Simulate 2-4 dispatches for each shipment
        const numDispatches = Math.floor(Math.random() * 3) + 2;
        let remainingJb = shipment.total_jb;
        let remainingSb = shipment.total_sb;

        for (let j = 0; j < numDispatches; j++) {
            const dispatchDaysAfter = Math.floor(Math.random() * 5) + 1;
            const dispatchDate = new Date(arrivalTs.getTime() + dispatchDaysAfter * 86400000).toISOString();
            
            const dispatchQty = shipment.bag_type === 'JB' 
                ? Math.floor(Math.random() * 200) + 10 
                : Math.floor(Math.random() * 500) + 50;

            const actualDispatchJb = shipment.bag_type === 'JB' ? Math.min(dispatchQty, remainingJb) : 0;
            const actualDispatchSb = shipment.bag_type === 'SB' ? Math.min(dispatchQty, remainingSb) : 0;

            if (actualDispatchJb === 0 && actualDispatchSb === 0) break;

            remainingJb -= actualDispatchJb;
            remainingSb -= actualDispatchSb;

            entries.push({
                shipment_id: shipment.id,
                date: dispatchDate,
                dr_number: `DR-OUT-${Math.floor(Math.random() * 100000)}`,
                po_number: null,
                client_name: clientNames[Math.floor(Math.random() * clientNames.length)],
                jb: -actualDispatchJb,
                sb: -actualDispatchSb,
                bags_returned: 0,
                notes: 'Dispatch to client',
            });
        }

        for (const entry of entries) {
            const { error } = await supabaseAdmin.from('shipment_ledger').insert(entry);
            if (error) {
                console.error(`❌ Error inserting ledger entry for ${shipment.batch_name}:`, error.message);
            } else {
                console.log(`✅ Added Ledger Entry for ${shipment.batch_name} (JB: ${entry.jb}, SB: ${entry.sb})`);
            }
        }
        
        // Update remaining stock on shipment
        await supabaseAdmin.from('shipments').update({
            remaining_jb: remainingJb,
            remaining_sb: remainingSb
        }).eq('id', shipment.id);
    }

    console.log('\n🎉 Done seeding Shipments and Ledger!');
}

seedShipmentsAndLedger().catch(e => {
    console.error(e);
    process.exit(1);
});
