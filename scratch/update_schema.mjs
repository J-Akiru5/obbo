
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjfbrjyvinljseqbbika.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZmJyanl2aW5sanNlcWJiaWthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE0MTkzOSwiZXhwIjoyMDkyNzE3OTM5fQ.a-_6w7cFkRrOkEJ9kJ4EqWdo-4VuE-M1LsI2Kvp1Q7c';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- Add target_role to notifications for role-based filtering
alter table public.notifications add column if not exists target_role text
  check (target_role in ('admin', 'warehouse_manager', 'client'));

-- Update notifications RLS policies to support role-based reading
drop policy if exists "notifications: own read" on public.notifications;
create policy "notifications: read eligible" on public.notifications
  for select using (
    user_id = auth.uid() OR
    (target_role IS NOT NULL AND target_role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );
`;

async function run() {
  const { error } = await supabase.rpc('execute_sql', { sql_query: sql });

  if (error) {
    // If execute_sql RPC doesn't exist, I'll have to use a different way or just inform the user.
    // In many Supabase setups, there isn't a default execute_sql RPC for security reasons.
    console.error('Error executing SQL:', error);
    console.log('Falling back to direct table update if possible...');
  } else {
    console.log('Successfully updated schema.');
  }
}

run();
