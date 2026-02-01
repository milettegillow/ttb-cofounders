-- Add new profile fields to support updated profile model
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS domain_expertise text,
  ADD COLUMN IF NOT EXISTS technical_expertise text,
  ADD COLUMN IF NOT EXISTS skills_background text,
  ADD COLUMN IF NOT EXISTS interests_building text,
  ADD COLUMN IF NOT EXISTS links text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS availability text;
