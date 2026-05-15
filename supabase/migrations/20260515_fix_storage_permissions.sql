-- Storage migration to ensure public accessibility for product images and order attachments

-- 1. Ensure buckets exist and are public
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('order-attachments', 'order-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Read Access for product-images" ON storage.objects;
    DROP POLICY IF EXISTS "Public Read Access for order-attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Public Read Access for avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated Upload for order-attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated Upload for product-images" ON storage.objects;
    DROP POLICY IF EXISTS "Admin Full Access for all buckets" ON storage.objects;
END $$;

-- 3. Create Public Read Access Policies
CREATE POLICY "Public Read Access for product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Public Read Access for order-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-attachments');

CREATE POLICY "Public Read Access for avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 4. Create Upload Policies for Authenticated Users
CREATE POLICY "Authenticated Upload for order-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-attachments');

CREATE POLICY "Authenticated Upload for product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- 5. Admin Full Access (Optional but recommended for management)
-- Note: This assumes service_role or specific admin roles if defined at DB level
-- For now, we allow authenticated users to manage their own if we want, 
-- but usually admins manage product images.
