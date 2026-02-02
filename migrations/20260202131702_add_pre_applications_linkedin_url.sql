-- Add linkedin_url column to pre_applications table for standardization
-- This migration maintains backward compatibility by keeping the linkedin column
-- and backfilling linkedin_url from linkedin where needed.
-- This is a compatibility bridge during migration to linkedin_url as the canonical field.

-- Add linkedin_url column if it doesn't exist
ALTER TABLE public.pre_applications
ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Backfill: linkedin_url = linkedin where linkedin_url is null or empty
UPDATE public.pre_applications
SET linkedin_url = linkedin
WHERE (linkedin_url IS NULL OR linkedin_url = '')
  AND linkedin IS NOT NULL
  AND linkedin != '';

-- Note: We do NOT drop the linkedin column yet to maintain backward compatibility.
-- The linkedin column will be kept during the migration period.
