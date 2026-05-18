-- Add target_role column to notifications for role-broadcast support
alter table public.notifications
  add column target_role text check (target_role in ('admin', 'warehouse_manager', 'client'));

-- Enable realtime for notifications table
do $$
begin
  if exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime' and c.relname = 'notifications' and n.nspname = 'public'
  ) then
    alter publication supabase_realtime drop table public.notifications;
  end if;
end $$;

alter publication supabase_realtime add table public.notifications;
