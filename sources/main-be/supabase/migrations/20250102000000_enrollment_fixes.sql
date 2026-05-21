-- Migration: full schema + enrollment backend fixes

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student', 'applicant', 'admin')),
  email text UNIQUE,
  full_name text,
  campus text,
  contact_number text,
  address text,
  date_of_birth date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_number text UNIQUE,
  first_name text,
  last_name text,
  middle_name text,
  campus text,
  college text,
  program text,
  year_level int,
  status text DEFAULT 'regular',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  units int NOT NULL DEFAULT 3,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subject_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  term text NOT NULL,
  school_year text NOT NULL,
  section text NOT NULL,
  schedule text,
  room text,
  instructor text,
  slots_total int DEFAULT 40,
  slots_taken int DEFAULT 0,
  campus text,
  is_open boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year text NOT NULL,
  term text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'paid', 'cancelled')),
  total_units int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enrollment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.subject_offerings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (enrollment_id, offering_id)
);

CREATE TABLE IF NOT EXISTS public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  school_year text NOT NULL,
  term text NOT NULL,
  final_grade numeric(4,2),
  remarks text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_name text,
  file_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ─── Add updated_at if table already existed without it ───────────────────────

ALTER TABLE public.subject_offerings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ─── Trigger: auto-update updated_at on subject_offerings ────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'subject_offerings_updated_at'
      AND tgrelid = 'public.subject_offerings'::regclass
  ) THEN
    CREATE TRIGGER subject_offerings_updated_at
      BEFORE UPDATE ON public.subject_offerings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END; $$;

-- students
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='students' AND policyname='students_select_own') THEN
    CREATE POLICY students_select_own ON public.students FOR SELECT USING (user_id = auth.uid());
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='students' AND policyname='students_update_own') THEN
    CREATE POLICY students_update_own ON public.students FOR UPDATE USING (user_id = auth.uid());
  END IF;
END; $$;

-- subjects (public read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subjects' AND policyname='subjects_public_read') THEN
    CREATE POLICY subjects_public_read ON public.subjects FOR SELECT USING (true);
  END IF;
END; $$;

-- subject_offerings (public read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subject_offerings' AND policyname='subject_offerings_public_read') THEN
    CREATE POLICY subject_offerings_public_read ON public.subject_offerings FOR SELECT USING (true);
  END IF;
END; $$;

-- enrollments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enrollments' AND policyname='enrollments_select_own') THEN
    CREATE POLICY enrollments_select_own ON public.enrollments FOR SELECT USING (
      student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    );
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enrollments' AND policyname='enrollments_insert_own') THEN
    CREATE POLICY enrollments_insert_own ON public.enrollments FOR INSERT WITH CHECK (
      student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    );
  END IF;
END; $$;

-- enrollment_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enrollment_items' AND policyname='enrollment_items_select_own') THEN
    CREATE POLICY enrollment_items_select_own ON public.enrollment_items FOR SELECT USING (
      enrollment_id IN (
        SELECT e.id FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id
        WHERE s.user_id = auth.uid()
      )
    );
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enrollment_items' AND policyname='enrollment_items_insert_own') THEN
    CREATE POLICY enrollment_items_insert_own ON public.enrollment_items FOR INSERT WITH CHECK (
      enrollment_id IN (
        SELECT e.id FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id
        WHERE s.user_id = auth.uid()
      )
    );
  END IF;
END; $$;

-- grades
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='grades' AND policyname='grades_select_own') THEN
    CREATE POLICY grades_select_own ON public.grades FOR SELECT USING (
      student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    );
  END IF;
END; $$;

-- documents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents_select_own') THEN
    CREATE POLICY documents_select_own ON public.documents FOR SELECT USING (profile_id = auth.uid());
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents_insert_own') THEN
    CREATE POLICY documents_insert_own ON public.documents FOR INSERT WITH CHECK (profile_id = auth.uid());
  END IF;
END; $$;

-- notifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select_own') THEN
    CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING (profile_id = auth.uid());
  END IF;
END; $$;

-- ─── Auth trigger: create profile on signup ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

-- ─── enroll_student RPC ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enroll_student(
  p_student_id   uuid,
  p_school_year  text,
  p_term         text,
  p_offering_ids uuid[]
)
RETURNS TABLE (
  enrollment_id  uuid,
  status         text,
  error_code     text,
  error_message  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
  v_offering      record;
  v_offering_id   uuid;
BEGIN
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'EMPTY_CART'::text, 'No offerings provided.'::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = p_student_id
      AND school_year = p_school_year
      AND term = p_term
      AND status <> 'cancelled'
  ) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'ALREADY_ENROLLED'::text,
      'An active enrollment already exists for this term.'::text;
    RETURN;
  END IF;

  PERFORM id
  FROM public.subject_offerings
  WHERE id = ANY(p_offering_ids)
  ORDER BY id
  FOR UPDATE;

  FOR v_offering IN
    SELECT id, slots_taken, slots_total
    FROM public.subject_offerings
    WHERE id = ANY(p_offering_ids)
  LOOP
    IF v_offering.slots_taken >= v_offering.slots_total THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, 'OFFERING_FULL'::text,
        ('Offering ' || v_offering.id || ' is full.')::text;
      RETURN;
    END IF;
  END LOOP;

  INSERT INTO public.enrollments (student_id, school_year, term, status, total_units)
  VALUES (
    p_student_id, p_school_year, p_term, 'submitted',
    (
      SELECT COALESCE(SUM(s.units), 0)
      FROM public.subject_offerings so
      JOIN public.subjects s ON s.id = so.subject_id
      WHERE so.id = ANY(p_offering_ids)
    )
  )
  RETURNING id INTO v_enrollment_id;

  FOREACH v_offering_id IN ARRAY p_offering_ids LOOP
    INSERT INTO public.enrollment_items (enrollment_id, offering_id)
    VALUES (v_enrollment_id, v_offering_id);

    UPDATE public.subject_offerings
    SET slots_taken = slots_taken + 1
    WHERE id = v_offering_id;
  END LOOP;

  RETURN QUERY SELECT v_enrollment_id, 'submitted'::text, NULL::text, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_student(uuid, text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_student(uuid, text, text, uuid[]) TO authenticated;

-- ─── Note ─────────────────────────────────────────────────────────────────────
-- To enable Realtime slot updates, add subject_offerings to the supabase_realtime
-- publication in the Supabase dashboard under Database > Replication.
