-- Add photo columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS photo_updated_at timestamptz DEFAULT now();

-- Backfill photo_updated_at for existing rows
UPDATE public.profiles
SET photo_updated_at = now()
WHERE photo_updated_at IS NULL;
