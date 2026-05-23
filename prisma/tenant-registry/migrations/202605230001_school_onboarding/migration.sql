CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL UNIQUE REFERENCES public.institution_profiles (id) ON DELETE CASCADE,
  current_step TEXT NOT NULL DEFAULT 'registration_submitted',
  progress INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT onboarding_progress_range_check CHECK (progress >= 0 AND progress <= 100)
);

CREATE TABLE IF NOT EXISTS public.school_owner_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institution_profiles (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT school_owner_invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'expired', 'revoked')
  )
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institution_profiles (id) ON DELETE SET NULL,
  actor_user_id UUID,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS school_owner_invitations_institution_idx
  ON public.school_owner_invitations (institution_id);

CREATE INDEX IF NOT EXISTS school_owner_invitations_email_idx
  ON public.school_owner_invitations (email);

CREATE INDEX IF NOT EXISTS audit_events_institution_idx
  ON public.audit_events (institution_id);

CREATE INDEX IF NOT EXISTS audit_events_event_type_idx
  ON public.audit_events (event_type);

CREATE OR REPLACE FUNCTION public.onboarding_records_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_progress_set_updated_at ON public.onboarding_progress;
CREATE TRIGGER onboarding_progress_set_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE PROCEDURE public.onboarding_records_set_updated_at();

DROP TRIGGER IF EXISTS school_owner_invitations_set_updated_at ON public.school_owner_invitations;
CREATE TRIGGER school_owner_invitations_set_updated_at
  BEFORE UPDATE ON public.school_owner_invitations
  FOR EACH ROW EXECUTE PROCEDURE public.onboarding_records_set_updated_at();
