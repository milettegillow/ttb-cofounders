-- Create profile_photos table for storing user profile photo metadata
CREATE TABLE IF NOT EXISTS public.profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  public_url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure a user can't have duplicate paths
  UNIQUE (user_id, path)
);

-- Ensure only ONE primary photo per user
CREATE UNIQUE INDEX IF NOT EXISTS profile_photos_one_primary_per_user
ON public.profile_photos (user_id)
WHERE is_primary = true;

-- Index to speed up reads (ordered by creation date, newest first)
CREATE INDEX IF NOT EXISTS profile_photos_user_created_idx
ON public.profile_photos (user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all photos (for Discover/Matches)
CREATE POLICY "read_photos"
ON public.profile_photos
FOR SELECT
TO authenticated
USING (true);

-- Policy: Users can only manage their own photos
CREATE POLICY "manage_own_photos"
ON public.profile_photos
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
