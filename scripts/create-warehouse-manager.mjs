import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_EMAIL = 'manager@obbo.com';
const DEFAULT_PASSWORD = 'password123';
const DEFAULT_FULL_NAME = 'Warehouse Manager';

function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) continue;

        const separatorIndex = line.indexOf('=');
        const key = line.slice(0, separatorIndex).trim();
        if (!key || process.env[key] !== undefined) continue;

        let value = line.slice(separatorIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const dryRun = args.has('--dry-run');

    const currentFile = fileURLToPath(import.meta.url);
    const repoRoot = path.resolve(path.dirname(currentFile), '..');
    loadEnvFile(path.join(repoRoot, '.env.local'));

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }

    const email = (process.env.MANAGER_EMAIL || DEFAULT_EMAIL).toLowerCase();
    const password = process.env.MANAGER_PASSWORD || DEFAULT_PASSWORD;
    const fullName = process.env.MANAGER_FULL_NAME || DEFAULT_FULL_NAME;

    if (dryRun) {
        console.log(`[dry-run] Would create or update ${email} as a warehouse manager.`);
        return;
    }

    const supabase = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                role: 'warehouse_manager',
                kyc_status: 'verified',
            },
        },
    });

    if (error) throw error;

    const userId = data.user?.id;
    if (!userId) {
        throw new Error('Supabase did not return a user id for the new warehouse manager account.');
    }

    console.log(`Warehouse manager user ready: ${email}`);
    console.log(`Password set: ${password ? 'yes' : 'no'}`);
    console.log('Profile role: warehouse_manager');
}

main().catch((error) => {
    console.error('Failed to create warehouse manager user:');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
