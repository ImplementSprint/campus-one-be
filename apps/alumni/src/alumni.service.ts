import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getSupabaseClient } from './config/supabase.config';
import { RegisterAlumniDto } from './dto/register-alumni.dto';
import { RequestRecordDto } from './dto/request-record.dto';
import { CardApplicationDto } from './dto/card-application.dto';
import {
  DocumentType,
  IAlumni,
  IAlumniCardApplication,
  IAlumniRecordRequest,
  PaymentStatus,
} from './interfaces/alumni.interface';

/**
 * All tables live in the `alumni` Supabase schema.
 * The Supabase JS client targets `public` by default — we use .schema() to override.
 */
const SCHEMA = 'alumni';
const TABLE_REG_LOGS    = 'reg_activity_logs';  // alumni.reg_activity_logs
const TABLE_RECORDS     = 'record_requests';      // alumni.record_requests
const TABLE_CARDS       = 'card_applications';    // alumni.card_applications
const TABLE_ACCOUNTS    = 'accounts';             // alumni.accounts

/** Fee schedule per document type (in PHP) */
const FEE_MAP: Record<DocumentType, number> = {
  [DocumentType.TOR]: 150,
  [DocumentType.DIPLOMA]: 200,
  [DocumentType.GOOD_MORAL]: 100,
  [DocumentType.CERTIFICATE]: 100,
};

@Injectable()
export class AlumniService {
  private readonly logger = new Logger(AlumniService.name);

  /**
   * POST /alumni/register
   * Handles both paths:
   * - Internal: student ID lookup (is_legacy_registration = false)
   * - Legacy: manual verification (is_legacy_registration = true)
   *
   * Event: alumni.registration.submitted.v1
   * Rule: Writes to log table FIRST. No FK. actor_uuid is plain text.
   */
  async registerAlumni(dto: RegisterAlumniDto): Promise<IAlumni> {
    const supabase = getSupabaseClient();
    const log_id = randomUUID();
    const full_name = [dto.first_name, dto.middle_name, dto.last_name]
      .filter(Boolean)
      .join(' ');

    const payload: IAlumni = {
      log_id,
      created_at: new Date(),
      actor_uuid: dto.actor_uuid,
      action_type: 'alumni.registration.submitted.v1',
      status_code: 100,
      tenant_id: dto.tenant_id,
      full_name,
      email: dto.email,
      graduation_year: dto.graduation_year,
      program: dto.program,
      academic_unit: dto.academic_unit,
      is_legacy_registration: dto.is_legacy_registration ?? false,
      student_id: dto.student_id,
      proof_reference: dto.proof_reference,
      document_url: dto.document_url,
    };

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_REG_LOGS)
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error('registerAlumni failed', error.message);
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(
      `Alumni registered — log_id: ${log_id}, actor_uuid: ${dto.actor_uuid}`,
    );

    // Write to accounts table AFTER log (log-first rule)
    const { error: accountError } = await supabase
      .schema(SCHEMA)
      .from(TABLE_ACCOUNTS)
      .upsert(
        {
          email: dto.email,
          password_hash: '',
          name: full_name,
          student_number: dto.student_id ?? null,
          graduation_year: dto.graduation_year,
          program: dto.program,
          academic_unit: dto.academic_unit,
          phone_number: dto.phone ?? null,
          is_active: true,
        },
        { onConflict: 'email', ignoreDuplicates: false },
      );

    if (accountError) {
      this.logger.warn(
        `alumni account upsert failed (log already written) — ${accountError.message}`,
      );
    }

    return data as IAlumni;
  }

  /**
   * GET /alumni/profile/:actor_uuid
   * Returns latest registration log for the given alumni.
   * No join, no FK — pure UUID lookup.
   */
  async getAlumniProfile(actor_uuid: string): Promise<IAlumni> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_REG_LOGS)
      .select('*')
      .eq('actor_uuid', actor_uuid)
      .eq('action_type', 'alumni.registration.submitted.v1')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new NotFoundException(
        `No alumni registration found for actor_uuid: ${actor_uuid}`,
      );
    }

    return data as IAlumni;
  }

  /**
   * POST /alumni/records/request
   * Creates a document request (TOR, Diploma, Good Moral, Certificate).
   * Automatically calculates fee. Payment status starts as PENDING.
   *
   * Event: alumni.record.requested.v1
   */
  async requestRecord(dto: RequestRecordDto): Promise<IAlumniRecordRequest> {
    const supabase = getSupabaseClient();
    const log_id = randomUUID();

    const payload: IAlumniRecordRequest = {
      log_id,
      created_at: new Date(),
      actor_uuid: dto.actor_uuid,
      action_type: 'alumni.record.requested.v1',
      status_code: 100,
      tenant_id: dto.tenant_id,
      document_type: dto.document_type,
      fee_amount: FEE_MAP[dto.document_type],
      payment_status: PaymentStatus.PENDING,
      notes: dto.notes,
      delivery_method: dto.delivery_method,
      number_of_copies: dto.number_of_copies,
    };

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_RECORDS)
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error('requestRecord failed', error.message);
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(
      `Record requested — doc: ${dto.document_type}, actor_uuid: ${dto.actor_uuid}`,
    );

    return data as IAlumniRecordRequest;
  }

  /**
   * GET /alumni/records/:actor_uuid
   * Returns all document requests for an alumni, newest first.
   */
  async getRecordRequests(actor_uuid: string): Promise<IAlumniRecordRequest[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_RECORDS)
      .select('*')
      .eq('actor_uuid', actor_uuid)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('getRecordRequests failed', error.message);
      throw new InternalServerErrorException(error.message);
    }

    return (data ?? []) as IAlumniRecordRequest[];
  }

  /**
   * POST /alumni/card-request
   * Submits an ID card application.
   */
  async applyForCard(dto: CardApplicationDto): Promise<IAlumniCardApplication> {
    const supabase = getSupabaseClient();
    const log_id = randomUUID();

    const payload: IAlumniCardApplication = {
      log_id,
      created_at: new Date(),
      actor_uuid: dto.actor_uuid,
      action_type: 'card_application',
      status_code: 200,
      tenant_id: dto.tenant_id,
      application_type: dto.application_type,
      delivery_method: dto.delivery_method,
      id_photo_url: dto.id_photo_url,
      payment_status: PaymentStatus.PENDING,
    };

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_CARDS)
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error('applyForCard failed', error.message);
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(`Card application submitted — actor_uuid: ${dto.actor_uuid}`);
    return data as IAlumniCardApplication;
  }

  /**
   * GET /alumni/card-request/:actor_uuid
   * Returns all card applications for the given alumnus.
   */
  async getCardApplications(actor_uuid: string): Promise<IAlumniCardApplication[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_CARDS)
      .select('*')
      .eq('actor_uuid', actor_uuid)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('getCardApplications failed', error.message);
      throw new InternalServerErrorException(error.message);
    }

    return (data ?? []) as IAlumniCardApplication[];
  }

  // ─── Admin endpoints (read all, not scoped to one user) ─────────────────────

  /** GET /alumni/admin/registry — all registration logs */
  async getAllRegistrations(): Promise<IAlumni[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_REG_LOGS)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as IAlumni[];
  }

  /** GET /alumni/admin/requests — all document requests */
  async getAllRecordRequests(): Promise<IAlumniRecordRequest[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_RECORDS)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as IAlumniRecordRequest[];
  }

  /** PATCH /alumni/admin/requests/:log_id — update status_code of a request */
  async updateRecordStatus(log_id: string, status_code: number): Promise<IAlumniRecordRequest> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_RECORDS)
      .update({ status_code })
      .eq('log_id', log_id)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as IAlumniRecordRequest;
  }

  /**
   * Called by GraduationListener when a graduation.verified.v1 Kafka event fires.
   * Logs the graduation event — marks the student as an official alumnus.
   */
  async logGraduationEvent(payload: {
    actor_uuid: string;
    tenant_id: string;
    full_name: string;
    email: string;
    program: string;
    graduation_year: number;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    const log_id = randomUUID();

    const { error } = await supabase
      .schema(SCHEMA)
      .from(TABLE_REG_LOGS)
      .insert({
        log_id,
        created_at: new Date(),
        actor_uuid: payload.actor_uuid,
        action_type: 'alumni.graduation.verified.v1',
        status_code: 100,
        tenant_id: payload.tenant_id,
        full_name: payload.full_name,
        email: payload.email,
        graduation_year: payload.graduation_year,
        program: payload.program,
        academic_unit: '',
        is_legacy_registration: false,
      });

    if (error) {
      this.logger.error('logGraduationEvent failed', error.message);
      return;
    }

    this.logger.log(`Graduation logged — actor_uuid: ${payload.actor_uuid}`);

    const { error: accountError } = await supabase
      .schema(SCHEMA)
      .from(TABLE_ACCOUNTS)
      .upsert(
        {
          email: payload.email,
          password_hash: '',
          name: payload.full_name,
          graduation_year: payload.graduation_year,
          program: payload.program,
          is_active: true,
        },
        { onConflict: 'email', ignoreDuplicates: false },
      );

    if (accountError) {
      this.logger.warn(
        `graduation account upsert failed (log already written) — ${accountError.message}`,
      );
    }
  }
}
