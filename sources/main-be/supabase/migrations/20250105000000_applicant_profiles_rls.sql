-- Allow authenticated users to read applicant_profiles by their own email
-- This is needed because applicant_profiles.id != auth.uid()
-- The link is through email

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'applicant_profiles'
      AND policyname = 'own_profile_select_by_email'
  ) THEN
    CREATE POLICY own_profile_select_by_email
      ON public.applicant_profiles
      FOR SELECT
      TO authenticated
      USING (
        email = (
          SELECT email FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
END; $$;
