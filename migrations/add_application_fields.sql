-- Add new fields to applications table
-- Run this migration if the columns don't already exist

ALTER TABLE applications
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS linkedin TEXT,
ADD COLUMN IF NOT EXISTS stem_background TEXT;

-- Note: The old columns (name, why_cofounder, what_building) can be kept for backward compatibility
-- or removed if no longer needed
