-- Add split delivery breakdown fields to orders table
ALTER TABLE orders 
ADD COLUMN deliver_now_jb INTEGER DEFAULT 0,
ADD COLUMN deliver_now_sb INTEGER DEFAULT 0;

-- Optional: Migrate existing deliver_now_qty if possible (assuming JB if only one item, etc.)
-- Since deliver_now_qty was individual bags, it's hard to know which bag type it was without checking order_items.
-- But for safety, we just start fresh with these columns.
