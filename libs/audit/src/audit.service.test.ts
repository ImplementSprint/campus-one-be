import 'reflect-metadata';
import { equal } from 'node:assert/strict';
import { AuditService } from './audit.service';

async function run() {
  const calls: any[] = [];
  const service = new AuditService() as any;
  service.db = {
    from(table: string) {
      equal(table, 'audit_events');
      return {
        insert(payload: any) {
          calls.push(payload);
          return { error: null };
        },
      };
    },
  };

  const result = await service.record({
    action: 'alumni.card.status_updated',
    actor: 'admin@example.edu',
    tenantId: 'school-a',
    target: 'card-1',
    metadata: { status_code: 300 },
  });

  equal(result.recorded, true);
  equal(calls.length, 1);
  equal(calls[0].institution_id, 'school-a');
  equal(calls[0].action, 'alumni.card.status_updated');
  equal(calls[0].actor_email, 'admin@example.edu');
  equal(calls[0].metadata.target, 'card-1');
  equal(calls[0].metadata.status_code, 300);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
