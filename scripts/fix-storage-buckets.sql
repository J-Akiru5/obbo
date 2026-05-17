-- ============================================================
-- OBBO iManage: Storage Bucket & Policy Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create "order-attachments" bucket (public: true allows getPublicUrl to work)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'order-attachments',
    'order-attachments',
    true,
    10485760,  -- 10 MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

-- 2. Create "product-images" bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    5242880,   -- 5 MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Create "avatars" bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    2097152,   -- 2 MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- ============================================================
-- CLEANUP: Drop existing policies (idempotent)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload order attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can read order attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own order attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own order attachments" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- ============================================================
-- RLS POLICIES: order-attachments
-- ============================================================

CREATE POLICY "Authenticated users can upload order attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-attachments');

CREATE POLICY "Public can read order attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'order-attachments');

CREATE POLICY "Users can update their own order attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'order-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own order attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- RLS POLICIES: product-images
-- ============================================================

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Public can read product images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images');

-- ============================================================
-- RLS POLICIES: avatars
-- ============================================================

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Verify configuration
-- ============================================================
SELECT id, name, public, file_size_limit FROM storage.buckets 
WHERE id IN ('order-attachments', 'product-images', 'avatars');
