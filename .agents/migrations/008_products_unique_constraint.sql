-- Add unique constraint on (name, bag_type) to prevent duplicate products
-- This also fixes the seed's ON CONFLICT clause which previously had no constraint to conflict against
alter table public.products drop constraint if exists products_name_bag_type_key;
alter table public.products add constraint products_name_bag_type_key unique (name, bag_type);
