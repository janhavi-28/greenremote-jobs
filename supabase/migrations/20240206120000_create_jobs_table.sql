-- Jobs table for GreenRemote job board
-- Run in Supabase: SQL Editor, or via Supabase CLI (supabase db push)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  company text NOT NULL,
  location text NOT NULL DEFAULT '',
  category text,
  description text,
  publication_date timestamptz,
  apply_url text NOT NULL,
  experience_level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint on apply_url to avoid duplicate listings from multiple sources
CREATE UNIQUE INDEX IF NOT EXISTS jobs_apply_url_key ON public.jobs (apply_url);

-- Indexes for filters and sorting (used by /jobs and API)
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON public.jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_location_idx ON public.jobs USING gin (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_category_idx ON public.jobs USING gin (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_experience_level_idx ON public.jobs (experience_level);
CREATE INDEX IF NOT EXISTS jobs_title_gin ON public.jobs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_company_gin ON public.jobs USING gin (company gin_trgm_ops);

-- RLS: allow public read, restrict write to service role (handled by your API)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on jobs"
  ON public.jobs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access on jobs"
  ON public.jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.jobs IS 'Job listings from Remotive, ArbeitNow, and manual posts';
