-- Add WhatsApp verification columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_verify_code text,
  ADD COLUMN IF NOT EXISTS whatsapp_verify_expires_at timestamptz;
