CREATE UNIQUE INDEX IF NOT EXISTS academic_student_accounts_institution_applicant_key
  ON academic_student_accounts (institution_id, applicant_id);
