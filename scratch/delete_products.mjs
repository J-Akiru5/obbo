
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjfbrjyvinljseqbbika.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZmJyanl2aW5sanNlcWJiaWthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE0MTkzOSwiZXhwIjoyMDkyNzE3OTM5fQ.a-_6w7cFkRrOkEJ9kJ4EqWdo-4VuE-M1LsI2Kvp1Q7c';

const supabase = createClient(supabaseUrl, supabaseKey);

const ids = [
  '7a794eb3-22ce-4bf6-ab72-dd6d10e98388',
  '63dcb49e-1562-4f91-98cd-6b69bca1706e'
];

async function run() {
  console.log('Attempting to delete products:', ids);
  
  const { data, error } = await supabase
    .from('products')
    .delete()
    .in('id', ids)
    .select();

  if (error) {
    console.error('Error during deletion:', error);
  } else {
    console.log('Successfully deleted records:', JSON.stringify(data, null, 2));
  }
}

run();
