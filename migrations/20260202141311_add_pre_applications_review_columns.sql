-- Add review columns to pre_applications table if they don't exist
-- These columns are used when admins approve/reject applications

ALTER TABLE public.pre_applications
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

-- Add index on reviewed_at for querying reviewed applications
CREATE INDEX IF NOT EXISTS idx_pre_applications_reviewed_at 
ON public.pre_applications(reviewed_at);
