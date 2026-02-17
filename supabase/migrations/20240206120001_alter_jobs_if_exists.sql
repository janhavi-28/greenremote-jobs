-- Run this ONLY if you already have a jobs table and need to add columns / unique constraint.
-- Run in Supabase SQL Editor. Skip if you created the table with 20240206120000_create_jobs_table.sql.

-- Add missing columns (ignore errors if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'category') THEN
    ALTER TABLE public.jobs ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'description') THEN
    ALTER TABLE public.jobs ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'publication_date') THEN
    ALTER TABLE public.jobs ADD COLUMN publication_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'experience_level') THEN
    ALTER TABLE public.jobs ADD COLUMN experience_level text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'created_at') THEN
    ALTER TABLE public.jobs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Ensure apply_url unique constraint (drop first if you had a different name)
DROP INDEX IF EXISTS public.jobs_apply_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_apply_url_key ON public.jobs (apply_url);

-- Indexes for filters/sort (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON public.jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_experience_level_idx ON public.jobs (experience_level);
