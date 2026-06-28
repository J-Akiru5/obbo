import pg from 'pg';
import dns from 'dns';
const { Client } = pg;

const regions = [
  'me-central-1', // UAE
  'af-south-1', // Cape Town
  'eu-north-1', // Stockholm
  'ap-south-2', // Hyderabad
  'eu-central-2', // Zurich
  'ap-northeast-3', // Osaka
];

const username = 'postgres.xjfbrjyvinljseqbbika';
const database = 'postgres';
const port = 6543;

async function checkRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  console.log(`Checking region ${region} (${host})...`);

  return new Promise((resolve) => {
    dns.lookup(host, async (err, _address) => {
      if (err) {
        resolve(null);
        return;
      }

      const client = new Client({
        host,
        user: username,
        password: 'dummy-password-test',
        database,
        port,
        ssl: { rejectUnauthorized: false },
      });

      try {
        await client.connect();
        console.log(`Wow, connected to ${region} with dummy password?`);
        await client.end();
        resolve(region);
      } catch (connErr) {
        if (connErr.message.includes('password authentication failed')) {
          console.log(`📍 Found region! Tenant exists in ${region}.`);
          resolve(region);
        } else {
          console.log(`  Tenant not in ${region}: ${connErr.message}`);
          resolve(null);
        }
      }
    });
  });
}

async function run() {
  for (const region of regions) {
    const found = await checkRegion(region);
    if (found) {
      console.log(`SUCCESS: Tenant belongs to ${found}`);
      process.exit(0);
    }
  }
  console.log('Finished checking all remaining regions. No match found.');
}

run();
