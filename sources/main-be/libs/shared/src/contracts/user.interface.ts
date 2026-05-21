import { UserRole } from './enums';

export interface IUser {
  user_id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  full_name: string;
  created_at: Date;
}

export interface IStudent extends IUser {
  student_id: string;
  graduation_year?: number;
}
