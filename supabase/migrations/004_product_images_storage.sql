-- ============================================================
-- OBBO iManage — Migration 004: Product Images Storage
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create the product-images storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    TRUE,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = TRUE, 
    file_size_limit = 5242880, 
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- RLS is already enabled by default in Supabase for storage.objects

-- Product images read policy (publicly readable by everyone, including unauthenticated)
DROP POLICY IF EXISTS "product_images_read_all" ON storage.objects;
CREATE POLICY "product_images_read_all"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');

-- Product images upload/update/delete policy (Admin only)
DROP POLICY IF EXISTS "product_images_admin_write" ON storage.objects;
CREATE POLICY "product_images_admin_write"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'product-images' 
        AND auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    )
    WITH CHECK (
        bucket_id = 'product-images' 
        AND auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    );
