export interface IStudentRecord {
  id: string;
  email: string;
  student_number: string;
  applicant_id: string;
  enrollment_status: 'active' | 'inactive' | 'pending';
  enrolled_at: string;
  password_hash?: string | null;
}

export interface IStudentProfile {
  full_name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  birthdate?: string;
  mobile_number?: string;
  address?: string;
  school_level?: string;
  applicant_type?: string;
  program?: string;
}

export interface IStudentWithProfile extends IStudentRecord {
  applicant_profiles: IStudentProfile | IStudentProfile[] | null;
}

export interface IStudentStats {
  total: number;
  active: number;
  inactive: number;
  pending: number;
}
