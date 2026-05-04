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
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON_KEY || !SERVICE_KEY) {
    console.error('❌ Missing required environment variables.');
    console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,');
    console.error('   and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local file.');
    process.exit(1);
}

// Client for creating Auth users
const supabaseAuth = createClient(URL_, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// Admin Client to bypass RLS for seeding orders & verifying users
const supabaseAdmin = createClient(URL_, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
    { email: 'retailer@obbo-test.com', password: 'Password@123', name: 'Retailer Alpha', type: 'individual' },
    { email: 'builder@obbo-test.com', password: 'Password@123', name: 'Builder Corp', type: 'company', company: 'Builder Corp' },
    { email: 'contractor@obbo-test.com', password: 'Password@123', name: 'ContructIt Inc', type: 'company', company: 'ContructIt Inc' },
];

async function seedAccount(account) {
    console.log(`\n🌱 Seeding test persona: ${account.name} (${account.email})`);

    const { data, error: signUpErr } = await supabaseAuth.auth.signUp({
        email: account.email,
        password: account.password,
        options: {
            data: {
                full_name: account.name,
                role: 'client',
                kyc_status: 'verified', // We try setting it here, but trigger forces 'pending_verification' usually
                account_type: account.type,
                company_name: account.company || '',
                phone: '+63 917 000 0000',
            },
        },
    });

    if (signUpErr && !signUpErr.message.includes('already registered')) {
        console.error('❌ signUp failed:', signUpErr.message);
        return null;
    }

    // Get the user ID bypassing login if we can
    const { data: { users }, error: fetchErr } = await supabaseAdmin.auth.admin.listUsers();
    const user = users.find(u => u.email === account.email);
    const uid = user ? user.id : data?.user?.id;

    if (!uid) {
        console.error('❌ Could not retrieve user ID.');
        return null;
    }
    console.log(`✅ Auth user identified. UUID: ${uid}`);

    // Update profile via Admin to bypass RLS and set kyc_status='verified'
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
        id: uid,
        email: account.email,
        full_name: account.name,
        phone: '+63 917 000 0000',
        role: 'client',
        kyc_status: 'verified',
        account_type: account.type,
        company_name: account.company || null,
        kyc_documents: [],
        updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (profileErr) {
        console.error('❌ Could not set profile kyc_status:', profileErr.message);
        return null;
    } else {
        console.log('✅ Profile upserted (kyc_status: verified).');
    }

    return uid;
}

async function main() {
    // Admin fetches products, ignoring RLS
    const { data: products } = await supabaseAdmin.from('products').select('*').eq('is_active', true);
    let activeProducts = products;

    if (!activeProducts || activeProducts.length === 0) {
        console.log('⚠️ No active products found — seeding default products...');
        const newProducts = [
            { name: 'Portland Cement Type I', description: 'General-purpose cement', bag_type: 'SB', price_per_bag: 250, is_active: true },
            { name: 'Portland Cement Type I (Jumbo)', description: 'Jumbo bags', bag_type: 'JB', price_per_bag: 5800, is_active: true }
        ];
        const { data: inserted, error: pErr } = await supabaseAdmin.from('products').insert(newProducts).select('*');
        if (pErr) {
            console.error('❌ Failed to seed products:', pErr.message);
            return;
        }
        activeProducts = inserted;
    }

    const p1 = activeProducts[0];
    const p2 = activeProducts.length > 1 ? activeProducts[1] : activeProducts[0];

    for (const acc of ACCOUNTS) {
        const uid = await seedAccount(acc);
        if (!uid) continue;

        const orders = [
            { status: 'completed', total: p1.price_per_bag * 100, payment_method: 'cash', days: 30, is_split_delivery: false },
            { status: 'dispatched', total: p1.price_per_bag * 50, payment_method: 'check', days: 5, check_number: 'CHK-12345', is_split_delivery: true, deliver_now_qty: 25 },
            { status: 'partially_approved', total: p1.price_per_bag * 200, payment_method: 'cash', days: 2, is_split_delivery: true, deliver_now_qty: 100 },
            { status: 'pending', total: p2.price_per_bag * 30, payment_method: 'cash', days: 1, is_split_delivery: false },
            { status: 'rejected', total: p1.price_per_bag * 10, payment_method: 'cash', days: 10, is_split_delivery: false },
            { status: 'awaiting_check', total: p2.price_per_bag * 150, payment_method: 'check', days: 0, is_split_delivery: false },
        ];

        for (const o of orders) {
            const ts = new Date(Date.now() - o.days * 86400000).toISOString();

            const { data: order, error: oErr } = await supabaseAdmin.from('orders').insert({
                client_id: uid,
                status: o.status,
                total_amount: o.total,
                payment_method: o.payment_method,
                check_number: o.check_number,
                is_split_delivery: o.is_split_delivery,
                deliver_now_qty: o.deliver_now_qty || 0,
                created_at: ts,
                updated_at: ts,
            }).select('id').single();

            if (oErr) { console.warn(`⚠️ Order (${o.status}):`, oErr.message); continue; }

            const items = [];
            let requested = Math.floor(o.total / p1.price_per_bag);
            let product = p1;
            if (o.status === 'pending' || o.status === 'awaiting_check') {
                requested = Math.floor(o.total / p2.price_per_bag);
                product = p2;
            }

            let approved = 0, dispatched = 0;
            if (o.status === 'completed') { approved = requested; dispatched = requested; }
            else if (o.status === 'dispatched') { approved = requested; dispatched = o.deliver_now_qty || requested; }
            else if (o.status === 'partially_approved') { approved = Math.floor(requested / 2); }

            items.push({
                product_id: product.id,
                bag_type: product.bag_type,
                requested_qty: requested,
                approved_qty: approved,
                dispatched_qty: dispatched,
                order_id: order.id
            });

            await supabaseAdmin.from('order_items').insert(items);
            console.log(`✅ Order: ${o.status.padEnd(18)} ₱${o.total.toLocaleString()}`);
        }
    }
    
    console.log('\n─────────────────────────────────────────────────');
    console.log('🎉 Done! Seeded multiple accounts and orders.');
    for (const acc of ACCOUNTS) {
        console.log(`   ${acc.email} / ${acc.password}`);
    }
    console.log('─────────────────────────────────────────────────\n');
}

main().catch(e => { console.error(e); process.exit(1); });
