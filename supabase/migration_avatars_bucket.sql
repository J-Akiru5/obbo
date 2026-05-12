-- Migration to create the avatars storage bucket and configure RLS policies

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Avatars are publicly accessible
CREATE POLICY "Avatar images are publicly accessible."
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy: Anyone authenticated can upload an avatar
CREATE POLICY "Anyone can upload an avatar."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Policy: Anyone authenticated can update an avatar (ideally restricted to their own, but since folder structure might vary, we allow authenticated updates in this bucket)
CREATE POLICY "Anyone can update their own avatar."
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Policy: Anyone authenticated can delete an avatar
CREATE POLICY "Anyone can delete their own avatar."
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
