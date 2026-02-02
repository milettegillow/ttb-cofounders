-- Deprecate the applications table by renaming it
-- This table is no longer used in the codebase
-- All application queue operations now use pre_applications
-- All approved user records now use profiles

-- Rename applications to applications_deprecated
-- Do not drop yet - keep for data migration/reference if needed
ALTER TABLE IF EXISTS public.applications
RENAME TO applications_deprecated;

-- Add a comment explaining the deprecation
COMMENT ON TABLE public.applications_deprecated IS 
'DEPRECATED: This table is no longer used. Application queue is in pre_applications. Approved user records are in profiles.';
