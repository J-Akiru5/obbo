-- Add selling_price_per_bag snapshot column to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selling_price_per_bag numeric(10, 2);

-- Backfill existing items with the product's current price_per_bag
UPDATE public.order_items oi
SET selling_price_per_bag = p.price_per_bag
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.selling_price_per_bag IS NULL;
