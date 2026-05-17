-- Add target_role column to notifications for role-broadcast support
alter table public.notifications
  add column target_role text check (target_role in ('admin', 'warehouse_manager', 'client'));

-- Enable realtime for notifications table
alter publication supabase_realtime add table public.notifications;
