export enum DocumentType {
  TOR = 'TOR',
  DIPLOMA = 'DIPLOMA',
  GOOD_MORAL = 'GOOD_MORAL',
  CERTIFICATE = 'CERTIFICATE',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
}

/** Mirrors alumni.reg_activity_logs */
export interface IAlumni {
  log_id: string;
  created_at: Date;
  actor_uuid: string;
  action_type: string;
  status_code: number;
  tenant_id: string;
  full_name: string;
  email: string;
  graduation_year: number;
  program: string;
  academic_unit: string;
  is_legacy_registration: boolean;
  document_url?: string;
  student_id?: string;
  proof_reference?: string;
}

/** Mirrors alumni.record_requests */
export interface IAlumniRecordRequest {
  log_id: string;
  created_at: Date;
  actor_uuid: string;
  action_type: string;
  status_code: number;
  tenant_id: string;
  document_type: DocumentType;
  fee_amount: number;
  payment_status: PaymentStatus;
  notes?: string;
  delivery_method?: string;
  number_of_copies?: number;
}

/** Mirrors alumni.card_applications */
export interface IAlumniCardApplication {
  log_id: string;
  created_at: Date;
  actor_uuid: string;
  action_type: string;
  status_code: number;
  tenant_id: string;
  application_type: 'new' | 'replacement';
  delivery_method: 'pickup' | 'delivery';
  id_photo_url?: string;
  payment_status: PaymentStatus;
}

/** Mirrors alumni.accounts */
export interface IAlumniAccount {
  id?: string;
  email: string;
  password_hash: string;
  name: string;
  student_number?: string;
  graduation_year?: number;
  program?: string;
  academic_unit?: string;
  phone_number?: string;
  is_active: boolean;
  created_at?: Date;
  last_login?: Date;
}
