import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const MARIA_EMAIL    = 'maria.santos@obbo-test.com';
const MARIA_PASSWORD = 'Maria@1234';
const MARIA_NAME     = 'Maria Santos';

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

const URL_     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !ANON_KEY) {
    console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(URL_, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    console.log(`\n🌱  Seeding test persona: ${MARIA_NAME}`);

    // ── 1. Sign up (same as real registration, bypasses OTP) ────────────────
    const { data, error: signUpErr } = await supabase.auth.signUp({
        email: MARIA_EMAIL,
        password: MARIA_PASSWORD,
        options: {
            data: {
                full_name:    MARIA_NAME,
                role:         'client',
                kyc_status:   'pending_verification',   // trigger will set this
                account_type: 'individual',
                phone:        '+63 917 123 4567',
            },
        },
    });

    if (signUpErr && !signUpErr.message.includes('already registered')) {
        console.error('❌  signUp failed:', signUpErr.message);
        process.exit(1);
    }

    const userId = data?.user?.id;
    if (!userId) {
        console.log('ℹ️   User already exists in auth — fetching existing profile...');
    } else {
        console.log(`✅  Auth user created. UUID: ${userId}`);
    }

    // ── 2. Sign in to get the session, then update profile ──────────────────
    const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({
        email: MARIA_EMAIL,
        password: MARIA_PASSWORD,
    });

    if (signInErr) {
        console.error('❌  Could not sign in as Maria to get session:', signInErr.message);
        console.error('    If the account requires email confirmation, you must disable');
        console.error('    "Confirm email" in Supabase Auth settings → Authentication → Email.');
        process.exit(1);
    }

    const uid = session.user.id;
    console.log(`✅  Signed in as Maria. UUID: ${uid}`);

    // ── 3. Upsert profile (force kyc_status = verified) ─────────────────────
    //    This requires RLS to allow self-update OR run via service role.
    //    We try via anon first; if it fails, instruct the user to run SQL.
    const { error: profileErr } = await supabase.from('profiles').upsert({
        id:           uid,
        email:        MARIA_EMAIL,
        full_name:    MARIA_NAME,
        phone:        '+63 917 123 4567',
        role:         'client',
        kyc_status:   'verified',
        kyc_documents: [],
        updated_at:   new Date().toISOString(),
    }, { onConflict: 'id' });

    if (profileErr) {
        console.warn('⚠️   Could not set kyc_status=verified via anon key (expected due to RLS).');
        console.warn('    Run this in your Supabase SQL Editor to approve Maria manually:');
        console.warn(`\n    UPDATE public.profiles SET kyc_status='verified' WHERE email='${MARIA_EMAIL}';\n`);
    } else {
        console.log('✅  Profile upserted (kyc_status: verified).');
    }

    // ── 4. Seed orders ───────────────────────────────────────────────────────
    const { data: products } = await supabase.from('products').select('id, bag_type').eq('is_active', true).limit(2);

    if (!products || products.length === 0) {
        console.warn('⚠️   No active products found — skipping order seed.');
        summarize(uid);
        return;
    }

    const p1 = products[0].id;
    const p2 = (products[1] ?? products[0]).id;

    const orders = [
        { status: 'completed',  total: 12500, payment_method: 'cash',  days: 45, check_number: null,          notes: 'Q1 operations restock.' },
        { status: 'dispatched', total: 8750,  payment_method: 'check', days: 20, check_number: 'CHK-2024-089', notes: 'Replenishment.' },
        { status: 'approved',   total: 5000,  payment_method: 'cash',  days: 7,  check_number: null,          notes: 'Urgent restock.' },
        { status: 'pending',    total: 17500, payment_method: 'check', days: 1,  check_number: 'CHK-2024-102', notes: null },
    ];

    for (const o of orders) {
        const ts = new Date(Date.now() - o.days * 86400000).toISOString();

        const { data: order, error: oErr } = await supabase.from('orders').insert({
            client_id:      uid,
            status:         o.status,
            total_amount:   o.total,
            payment_method: o.payment_method,
            check_number:   o.check_number,
            notes:          o.notes,
            created_at:     ts,
            updated_at:     ts,
        }).select('id').single();

        if (oErr) { console.warn(`⚠️   Order (${o.status}):`, oErr.message); continue; }

        const items =
            o.status === 'completed'  ? [{ product_id: p1, bag_type: 'SB', requested_qty: 50, approved_qty: 50, dispatched_qty: 50 }] :
            o.status === 'dispatched' ? [{ product_id: p2, bag_type: 'JB', requested_qty: 35, approved_qty: 35, dispatched_qty: 35 }] :
            o.status === 'approved'   ? [{ product_id: p1, bag_type: 'SB', requested_qty: 25, approved_qty: 20, dispatched_qty: 0  }] :
            [
                { product_id: p1, bag_type: 'SB', requested_qty: 40, approved_qty: 0, dispatched_qty: 0 },
                { product_id: p2, bag_type: 'JB', requested_qty: 30, approved_qty: 0, dispatched_qty: 0 },
            ];

        await supabase.from('order_items').insert(items.map(i => ({ ...i, order_id: order.id })));

        if (o.status === 'approved') {
            await supabase.from('customer_balances').insert({
                client_id: uid, order_id: order.id, product_id: p1,
                bag_type: 'SB', remaining_qty: 5, status: 'pending', created_at: ts,
            });
        }

        await supabase.from('activity_log').insert({
            actor_id: uid, action: 'order_placed', entity_type: 'order',
            entity_id: order.id, metadata: { total: o.total }, created_at: ts,
        });

        console.log(`✅  Order: ${o.status.padEnd(12)} ₱${o.total.toLocaleString()}`);
    }

    await supabase.auth.signOut();
    summarize(uid);
}

function summarize(uid) {
    console.log('\n─────────────────────────────────────────────────');
    console.log('🎉  Done! Login credentials for Maria Santos:');
    console.log(`    Email:    ${MARIA_EMAIL}`);
    console.log(`    Password: ${MARIA_PASSWORD}`);
    if (uid) console.log(`    UUID:     ${uid}`);
    console.log('─────────────────────────────────────────────────\n');
}

main().catch(e => { console.error(e); process.exit(1); });
