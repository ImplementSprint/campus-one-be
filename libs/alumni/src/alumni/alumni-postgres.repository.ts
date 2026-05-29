import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CardApplicationDto } from './dto/card-application.dto';
import { RegisterAlumniDto } from './dto/register-alumni.dto';
import { RequestRecordDto } from './dto/request-record.dto';
import {
  IAlumni,
  IAlumniCardApplication,
  IAlumniRecordRequest,
  PaymentStatus,
} from './interfaces/alumni.interface';

type QueryResult<T = any> = { rows: T[]; rowCount?: number };
type Queryable = { query<T = any>(text: string, values?: unknown[]): Promise<QueryResult<T>> };

export class PostgresAlumniRepository {
  private pool?: Queryable;

  constructor(private readonly queryable?: Queryable) {}

  async registerAlumni(dto: RegisterAlumniDto): Promise<IAlumni> {
    const logId = randomUUID();
    const fullName = [dto.first_name, dto.middle_name, dto.last_name].filter(Boolean).join(' ');
    const result = await this.query<IAlumni>(
      `
        insert into alumni_registration_logs (
          log_id,
          institution_id,
          actor_uuid,
          full_name,
          email,
          graduation_year,
          program,
          academic_unit,
          is_legacy_registration,
          student_id,
          proof_reference,
          document_url,
          tenant_id,
          action_type,
          status_code,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $2, 'alumni.registration.submitted.v1', 100, now())
        returning *
      `,
      [
        logId,
        dto.tenant_id,
        dto.actor_uuid,
        fullName,
        dto.email,
        dto.graduation_year,
        dto.program,
        dto.academic_unit,
        dto.is_legacy_registration ?? false,
        dto.student_id ?? null,
        dto.proof_reference ?? null,
        dto.document_url ?? null,
      ],
    );

    const row = this.expectRow(result, 'Unable to create alumni registration');
    await this.query(
      `
        insert into alumni_accounts (
          institution_id,
          email,
          name,
          student_number,
          graduation_year,
          program,
          academic_unit,
          phone_number,
          password_hash,
          is_active,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, '', true, now())
        on conflict (institution_id, email) do update
          set name = excluded.name,
              student_number = excluded.student_number,
              graduation_year = excluded.graduation_year,
              program = excluded.program,
              academic_unit = excluded.academic_unit,
              phone_number = excluded.phone_number,
              is_active = true
        returning *
      `,
      [
        dto.tenant_id,
        dto.email,
        fullName,
        dto.student_id ?? null,
        dto.graduation_year,
        dto.program,
        dto.academic_unit,
        dto.phone ?? null,
      ],
    );
    await this.recordEvent(dto.tenant_id, dto.actor_uuid, 'alumni.registration.submitted', logId, {
      email: dto.email,
      graduationYear: dto.graduation_year,
      program: dto.program,
    });

    return mapRegistration(row);
  }

  async getAlumniProfile(actorUuid: string): Promise<IAlumni> {
    const result = await this.query<IAlumni>(
      `
        select *
        from alumni_registration_logs
        where actor_uuid = $1
          and action_type = 'alumni.registration.submitted.v1'
        order by created_at desc
        limit 1
      `,
      [actorUuid],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException(`No alumni registration found for actor_uuid: ${actorUuid}`);
    return mapRegistration(row);
  }

  async getAllRegistrations(institutionId: string): Promise<IAlumni[]> {
    const result = await this.query<IAlumni>(
      `
        select *
        from alumni_registration_logs
        where institution_id = $1
        order by created_at desc
      `,
      [institutionId],
    );
    return result.rows.map(mapRegistration);
  }

  async requestRecord(dto: RequestRecordDto, feeAmount: number): Promise<IAlumniRecordRequest> {
    const logId = randomUUID();
    const result = await this.query<IAlumniRecordRequest>(
      `
        insert into alumni_record_requests (
          log_id,
          institution_id,
          actor_uuid,
          document_type,
          fee_amount,
          notes,
          delivery_method,
          number_of_copies,
          tenant_id,
          action_type,
          status_code,
          payment_status,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $2, 'alumni.record.requested.v1', 100, 'pending', now())
        returning *
      `,
      [
        logId,
        dto.tenant_id,
        dto.actor_uuid,
        dto.document_type,
        feeAmount,
        dto.notes ?? null,
        dto.delivery_method ?? null,
        dto.number_of_copies ?? 1,
      ],
    );
    const row = this.expectRow(result, 'Unable to create alumni record request');
    await this.recordEvent(dto.tenant_id, dto.actor_uuid, 'alumni.record.requested', logId, {
      documentType: dto.document_type,
      feeAmount,
      numberOfCopies: dto.number_of_copies ?? 1,
    });
    return mapRecordRequest(row);
  }

  async getRecordRequests(actorUuid: string): Promise<IAlumniRecordRequest[]> {
    const result = await this.query<IAlumniRecordRequest>(
      `
        select *
        from alumni_record_requests
        where actor_uuid = $1
        order by created_at desc
      `,
      [actorUuid],
    );
    return result.rows.map(mapRecordRequest);
  }

  async getAllRecordRequests(institutionId: string): Promise<IAlumniRecordRequest[]> {
    const result = await this.query<IAlumniRecordRequest>(
      `
        select *
        from alumni_record_requests
        where institution_id = $1
        order by created_at desc
      `,
      [institutionId],
    );
    return result.rows.map(mapRecordRequest);
  }

  async updateRecordStatus(
    institutionId: string,
    logId: string,
    statusCode: number,
    paymentStatus?: PaymentStatus | 'pending' | 'paid',
  ): Promise<IAlumniRecordRequest> {
    const result = await this.query<IAlumniRecordRequest>(
      `
        update alumni_record_requests
        set status_code = $1,
            payment_status = coalesce($2, payment_status)
        where log_id = $3
          and institution_id = $4
        returning *
      `,
      [statusCode, paymentStatus ?? null, logId, institutionId],
    );
    const row = this.expectRow(result, 'Alumni record request not found');
    await this.recordEvent(institutionId, row.actor_uuid, 'alumni.record.status_updated', logId, {
      statusCode,
      paymentStatus: paymentStatus ?? row.payment_status,
    });
    return mapRecordRequest(row);
  }

  async applyForCard(dto: CardApplicationDto): Promise<IAlumniCardApplication> {
    const logId = randomUUID();
    const result = await this.query<IAlumniCardApplication>(
      `
        insert into alumni_card_applications (
          log_id,
          institution_id,
          actor_uuid,
          application_type,
          delivery_method,
          id_photo_url,
          tenant_id,
          action_type,
          status_code,
          payment_status,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $2, 'card_application', 200, 'pending', now())
        returning *
      `,
      [
        logId,
        dto.tenant_id,
        dto.actor_uuid,
        dto.application_type,
        dto.delivery_method,
        dto.id_photo_url ?? null,
      ],
    );
    const row = this.expectRow(result, 'Unable to create alumni card application');
    await this.recordEvent(dto.tenant_id, dto.actor_uuid, 'alumni.card.requested', logId, {
      applicationType: dto.application_type,
      deliveryMethod: dto.delivery_method,
    });
    return mapCardApplication(row);
  }

  async getCardApplications(actorUuid: string): Promise<IAlumniCardApplication[]> {
    const result = await this.query<IAlumniCardApplication>(
      `
        select *
        from alumni_card_applications
        where actor_uuid = $1
        order by created_at desc
      `,
      [actorUuid],
    );
    return result.rows.map(mapCardApplication);
  }

  async getAllCardApplications(institutionId: string): Promise<IAlumniCardApplication[]> {
    const result = await this.query<IAlumniCardApplication>(
      `
        select *
        from alumni_card_applications
        where institution_id = $1
        order by created_at desc
      `,
      [institutionId],
    );
    return result.rows.map(mapCardApplication);
  }

  async updateCardApplicationStatus(
    institutionId: string,
    logId: string,
    statusCode: number,
    paymentStatus?: PaymentStatus | 'pending' | 'paid',
  ): Promise<IAlumniCardApplication> {
    const result = await this.query<IAlumniCardApplication>(
      `
        update alumni_card_applications
        set status_code = $1,
            payment_status = coalesce($2, payment_status),
            card_serial = case when $1 >= 300 then coalesce(card_serial, $5) else card_serial end
        where log_id = $3
          and institution_id = $4
        returning *
      `,
      [statusCode, paymentStatus ?? null, logId, institutionId, `CARD-${String(logId).slice(0, 8).toUpperCase()}`],
    );
    const row = this.expectRow(result, 'Alumni card application not found');
    await this.recordEvent(institutionId, row.actor_uuid, 'alumni.card.status_updated', logId, {
      statusCode,
      paymentStatus: paymentStatus ?? row.payment_status,
    });
    return mapCardApplication(row);
  }

  async getCommunicationLog(actorUuid: string) {
    const [registration, records, cards] = await Promise.all([
      this.query<Record<string, unknown>>(
        `
          select *
          from alumni_registration_logs
          where actor_uuid = $1
          order by created_at desc
        `,
        [actorUuid],
      ),
      this.query<Record<string, unknown>>(
        `
          select *
          from alumni_record_requests
          where actor_uuid = $1
          order by created_at desc
        `,
        [actorUuid],
      ),
      this.query<Record<string, unknown>>(
        `
          select *
          from alumni_card_applications
          where actor_uuid = $1
          order by created_at desc
        `,
        [actorUuid],
      ),
    ]);

    return [
      ...registration.rows.map((item) => ({ ...item, source: 'registration' })),
      ...records.rows.map((item) => ({ ...item, source: 'record_request' })),
      ...cards.rows.map((item) => ({ ...item, source: 'card_application' })),
    ];
  }

  async logGraduationEvent(payload: {
    actor_uuid: string;
    tenant_id: string;
    full_name: string;
    email: string;
    program: string;
    graduation_year: number;
  }): Promise<void> {
    const logId = randomUUID();
    await this.query(
      `
        insert into alumni_registration_logs (
          log_id,
          institution_id,
          actor_uuid,
          action_type,
          status_code,
          tenant_id,
          full_name,
          email,
          graduation_year,
          program,
          academic_unit,
          is_legacy_registration,
          created_at
        )
        values ($1, $2, $3, 'alumni.graduation.verified.v1', 100, $2, $4, $5, $6, $7, '', false, now())
      `,
      [
        logId,
        payload.tenant_id,
        payload.actor_uuid,
        payload.full_name,
        payload.email,
        payload.graduation_year,
        payload.program,
      ],
    );
    await this.recordEvent(payload.tenant_id, payload.actor_uuid, 'alumni.graduation.verified', logId, {
      email: payload.email,
      program: payload.program,
    });
  }

  private async recordEvent(
    institutionId: string,
    actorUuid: string,
    eventType: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.query(
      `
        insert into alumni_activity_events (
          institution_id,
          actor_uuid,
          event_type,
          target_id,
          metadata,
          created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, now())
      `,
      [institutionId, actorUuid, eventType, targetId, metadata],
    );
  }

  private expectRow<T>(result: QueryResult<T>, message: string): T {
    const row = result.rows[0];
    if (!row) throw new InternalServerErrorException(message);
    return row;
  }

  private async query<T = any>(text: string, values?: unknown[]) {
    return this.getQueryable().query<T>(text, values);
  }

  private getQueryable() {
    if (this.queryable) return this.queryable;
    if (!this.pool) {
      const connectionString = process.env.ALUMNI_DATABASE_URL;
      if (!connectionString?.trim()) throw new Error('ALUMNI_DATABASE_URL must be configured.');
      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString });
    }
    return this.pool;
  }
}

function mapRegistration(row: any): IAlumni {
  return { ...row, tenant_id: row.tenant_id ?? row.institution_id };
}

function mapRecordRequest(row: any): IAlumniRecordRequest {
  return { ...row, tenant_id: row.tenant_id ?? row.institution_id };
}

function mapCardApplication(row: any): IAlumniCardApplication {
  return { ...row, tenant_id: row.tenant_id ?? row.institution_id };
}
