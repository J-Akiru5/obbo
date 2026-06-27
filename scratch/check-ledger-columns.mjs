import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Load env variables
const content = fs.readFileSync(path.join(repoRoot, '.env.local'), 'utf8');
for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const sep = line.indexOf('=');
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    process.env[key] = value;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Checking columns of shipment_ledger...');
    const { data, error } = await supabase
        .from('shipment_ledger')
        .select('id, gross_profit')
        .limit(1);
    
    if (error) {
        console.log('Error selecting gross_profit:', error.message);
        console.log('Detailed error:', error);
    } else {
        console.log('gross_profit column exists! Sample data:', data);
    }
}

run();
