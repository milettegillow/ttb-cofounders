-- Create reports table for user reporting system
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS reports_reporter_user_id_idx ON public.reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS reports_reported_user_id_idx ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports(status);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own reports (as reporter)
CREATE POLICY IF NOT EXISTS "Users can read their own reports"
ON public.reports
FOR SELECT
TO authenticated
USING (auth.uid() = reporter_user_id);

-- Policy: Users can insert reports (they are the reporter)
CREATE POLICY IF NOT EXISTS "Users can create reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_user_id);

-- Policy: Admins can read all reports (will be handled server-side with supabaseAdmin)
-- Note: RLS policies for admin access are typically bypassed using service role key
