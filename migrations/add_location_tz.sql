-- Add location_tz column to replace location + timezone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_tz text;

-- Migrate existing data: combine location and timezone into location_tz
-- If location exists, use it (it may already contain timezone)
UPDATE public.profiles
SET location_tz = location
WHERE location_tz IS NULL AND location IS NOT NULL;

-- Note: We keep location and timezone columns for now for backward compatibility
-- They can be dropped later if needed
