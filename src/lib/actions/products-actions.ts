'use server';

import { requireAdmin, logActivity } from './admin-helpers';

export async function fetchProducts() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('products').select('*').order('created_at');
  return (data ?? []).filter(
    (product) =>
      product.name?.toLowerCase().includes('portland cement type 1') &&
      (product.bag_type === 'JB' || product.bag_type === 'SB'),
  );
}

export async function updateProduct(
  id: string,
  updates: {
    name?: string;
    description?: string;
    price_per_bag?: number;
    bag_type?: string;
    price_port?: number;
    price_warehouse?: number;
    is_active?: boolean;
    image_url?: string;
  },
) {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase.from('products').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'product_updated', 'product', id, updates);
  return { success: true };
}

export async function createProduct(product: {
  name: string;
  description: string;
  bag_type: string;
  price_per_bag: number;
  price_port: number;
  price_warehouse: number;
  is_active: boolean;
  image_url?: string;
}) {
  const { supabase, userId } = await requireAdmin();
  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'product_created', 'product', data.id, product);
  return data;
}
