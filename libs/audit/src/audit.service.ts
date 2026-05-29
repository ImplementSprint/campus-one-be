import { Injectable, Logger } from '@nestjs/common';
import { supabase } from '@campus-one/database/supabase';
import { redactLogError } from '../../observability/src/log-redaction';

export type AuditEventInput = {
  action: string;
  actor: string;
  tenantId?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly db = supabase.schema('public');

  async record(input: AuditEventInput) {
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.target ? { target: input.target } : {}),
    };

    const { error } = await this.db
      .from('audit_events')
      .insert({
        institution_id: input.tenantId ?? null,
        action: input.action,
        actor_email: input.actor,
        metadata,
        created_at: new Date().toISOString(),
    });

    if (error) {
      this.logger.warn(`audit event skipped: ${redactLogError(error)}`);
      return { recorded: false, error: error.message };
    }

    return { recorded: true };
  }

  async list(limit = 100) {
    const boundedLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
    const { data, error } = await this.db
      .from('audit_events')
      .select('id, institution_id, action, actor_email, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(boundedLimit);

    if (error) {
      this.logger.warn(`audit event list failed: ${redactLogError(error)}`);
      throw new Error(error.message);
    }

    return data ?? [];
  }
}
