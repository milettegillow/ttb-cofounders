-- Storage policies for profile-photos bucket
-- These policies ensure users can only upload/update/delete their own photos
-- and can read all photos (for displaying on cards)

-- Policy 1: Allow authenticated users to INSERT (upload) files only to their own user_id folder
CREATE POLICY IF NOT EXISTS "Users can upload photos to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' AND
  name LIKE auth.uid()::text || '/%'
);

-- Policy 2: Allow authenticated users to UPDATE files only in their own user_id folder
CREATE POLICY IF NOT EXISTS "Users can update their own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  name LIKE auth.uid()::text || '/%'
)
WITH CHECK (
  bucket_id = 'profile-photos' AND
  name LIKE auth.uid()::text || '/%'
);

-- Policy 3: Allow authenticated users to DELETE files only in their own user_id folder
CREATE POLICY IF NOT EXISTS "Users can delete their own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  name LIKE auth.uid()::text || '/%'
);

-- Policy 4: Allow authenticated users to SELECT (read) all photos in profile-photos bucket
CREATE POLICY IF NOT EXISTS "Authenticated users can read all profile photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');
