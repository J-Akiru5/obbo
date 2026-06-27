import pg from 'pg';
const { Client } = pg;

const host = 'aws-0-ap-southeast-1.pooler.supabase.com';
const username = 'postgres.xjfbrjyvinljseqbbika';
const database = 'postgres';
const port = 5432; // Session Mode

async function run() {
    console.log(`Checking pooler host ${host} on port ${port} (Session Mode)...`);
    const client = new Client({
        host,
        user: username,
        password: 'dummy-password-test',
        database,
        port,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log(`Connected with dummy password?`);
        await client.end();
    } catch (err) {
        if (err.message.includes('password authentication failed')) {
            console.log(`📍 FOUND TENANT! The tenant exists in this region/port combination.`);
        } else {
            console.log(`Failed: ${err.message}`);
        }
    }
}

run();
