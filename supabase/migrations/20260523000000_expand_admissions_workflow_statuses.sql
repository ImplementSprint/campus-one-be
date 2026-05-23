ALTER TYPE public.admission_status ADD VALUE IF NOT EXISTS 'Missing Requirements';
ALTER TYPE public.admission_status ADD VALUE IF NOT EXISTS 'For Exam';
ALTER TYPE public.admission_status ADD VALUE IF NOT EXISTS 'For Interview';
ALTER TYPE public.admission_status ADD VALUE IF NOT EXISTS 'Accepted';
ALTER TYPE public.admission_status ADD VALUE IF NOT EXISTS 'Rejected';
ALTER TYPE public.admission_status ADD VALUE IF NOT EXISTS 'Waitlisted';
