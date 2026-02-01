-- Add is_live column to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false;
