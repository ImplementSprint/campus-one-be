-- Migration: auto-create student row from profiles for existing users
-- and add trigger for future signups

-- 1. Backfill: create a students row for every profile that doesn't have one yet
INSERT INTO public.students (user_id, first_name, last_name, status)
SELECT
  p.id,
  SPLIT_PART(COALESCE(p.full_name, ''), ' ', 1),
  CASE
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(COALESCE(p.full_name, ''), ' '), 1) > 1
    THEN ARRAY_TO_STRING(
      (STRING_TO_ARRAY(COALESCE(p.full_name, ''), ' '))[2:],
      ' '
    )
    ELSE NULL
  END,
  'irregular'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.students s WHERE s.user_id = p.id
)
AND p.role = 'student';

-- 2. Function: auto-create student row when a new profile is inserted with role=student
CREATE OR REPLACE FUNCTION public.handle_new_student_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO public.students (user_id, first_name, last_name, status)
    VALUES (
      NEW.id,
      SPLIT_PART(COALESCE(NEW.full_name, ''), ' ', 1),
      CASE
        WHEN ARRAY_LENGTH(STRING_TO_ARRAY(COALESCE(NEW.full_name, ''), ' '), 1) > 1
        THEN ARRAY_TO_STRING(
          (STRING_TO_ARRAY(COALESCE(NEW.full_name, ''), ' '))[2:],
          ' '
        )
        ELSE NULL
      END,
      'irregular'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_profile_created_create_student'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER on_profile_created_create_student
      AFTER INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_student_profile();
  END IF;
END;
$$;

-- 3. Also allow students insert from the trigger (SECURITY DEFINER handles it,
--    but add a policy for direct inserts just in case)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'students_insert_own'
  ) THEN
    CREATE POLICY students_insert_own ON public.students
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END; $$;
