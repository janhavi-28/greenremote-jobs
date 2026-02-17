-- Add columns that the app expects; safe to run if columns already exist.
-- Run in Supabase SQL Editor if you get "column does not exist" (42703) on /jobs.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'experience_level') THEN
    ALTER TABLE public.jobs ADD COLUMN experience_level text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'publication_date') THEN
    ALTER TABLE public.jobs ADD COLUMN publication_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'category') THEN
    ALTER TABLE public.jobs ADD COLUMN category text;
  END IF;
END $$;
