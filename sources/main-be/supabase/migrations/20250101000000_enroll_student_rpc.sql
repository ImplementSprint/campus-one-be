-- Migration: add enroll_student RPC
-- File: supabase/migrations/20250101000000_enroll_student_rpc.sql

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
  -- Guard: reject empty offering list
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'EMPTY_CART'::text, 'No offerings provided.'::text;
    RETURN;
  END IF;

  -- Guard: reject duplicate active enrollment
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

  -- Acquire row-level locks on all targeted offerings (prevents concurrent over-enrollment)
  PERFORM id
  FROM public.subject_offerings
  WHERE id = ANY(p_offering_ids)
  ORDER BY id  -- consistent ordering prevents deadlocks
  FOR UPDATE;

  -- Slot availability check (after lock is held)
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

  -- Create enrollment record
  INSERT INTO public.enrollments (student_id, school_year, term, status, total_units)
  VALUES (
    p_student_id,
    p_school_year,
    p_term,
    'submitted',
    (
      SELECT COALESCE(SUM(s.units), 0)
      FROM public.subject_offerings so
      JOIN public.subjects s ON s.id = so.subject_id
      WHERE so.id = ANY(p_offering_ids)
    )
  )
  RETURNING id INTO v_enrollment_id;

  -- Insert enrollment items and increment slots
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

-- RLS: allow authenticated users to call this function
-- (SECURITY DEFINER means the function runs as the owner, bypassing RLS on writes)
REVOKE ALL ON FUNCTION public.enroll_student(uuid, text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_student(uuid, text, text, uuid[]) TO authenticated;
