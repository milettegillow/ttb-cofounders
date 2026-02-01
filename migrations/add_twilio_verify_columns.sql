-- Add columns for Twilio Verify SMS OTP
-- This migration adds whatsapp_e164 (normalized phone number) and whatsapp_verify_sent_at (cooldown tracking)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_e164 text,
  ADD COLUMN IF NOT EXISTS whatsapp_verify_sent_at timestamptz;

-- Ensure existing verification columns exist (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at timestamptz;

-- Note: whatsapp_number may still exist from previous implementation
-- Both whatsapp_number and whatsapp_e164 can coexist during migration
