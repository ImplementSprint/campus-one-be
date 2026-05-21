-- Migration: curriculum table for program-based auto-enrollment

CREATE TABLE IF NOT EXISTS public.curriculum (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program     text NOT NULL,
  year_level  int  NOT NULL,
  term        text NOT NULL,
  subject_id  uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (program, year_level, term, subject_id)
);

ALTER TABLE public.curriculum ENABLE ROW LEVEL SECURITY;

-- Public read so the app can fetch curriculum without auth issues
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'curriculum' AND policyname = 'curriculum_public_read'
  ) THEN
    CREATE POLICY curriculum_public_read ON public.curriculum FOR SELECT USING (true);
  END IF;
END; $$;

-- Admin insert/update (service role bypasses RLS, but add policy for completeness)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'curriculum' AND policyname = 'curriculum_admin_all'
  ) THEN
    CREATE POLICY curriculum_admin_all ON public.curriculum
      USING (auth.jwt() ->> 'role' = 'admin')
      WITH CHECK (auth.jwt() ->> 'role' = 'admin');
  END IF;
END; $$;

-- Ensure students table has program and year_level columns (already in schema but guard anyway)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'program') THEN
      ALTER TABLE public.students ADD COLUMN program text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'year_level') THEN
      ALTER TABLE public.students ADD COLUMN year_level int;
    END IF;
  END IF;
END;
$$;
