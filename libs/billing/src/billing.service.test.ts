import { deepEqual, equal } from 'node:assert/strict';
import { BillingService } from './billing.service';

function createInsertResult(data: Record<string, unknown>) {
  const chain: any = {
    insert(payload: unknown) {
      chain.payload = payload;
      return chain;
    },
    select() {
      return chain;
    },
    single() {
      return Promise.resolve({ data, error: null });
    },
    payload: undefined,
  };
  return chain;
}

async function run() {
  const service = new BillingService() as any;
  const eventCalls: unknown[] = [];
  let insertPayload: unknown;

  service.eventPublisher = {
    publish(input: unknown) {
      eventCalls.push(input);
      return Promise.resolve({ envelope: input, published: true });
    },
  };
  service.db = {
    from(table: string) {
      equal(table, 'student_payments');
      const result = createInsertResult({
        id: 'payment-1',
        student_id: 'student-1',
        amount: 1500,
        status: 'pending_reconciliation',
        paid_at: '2026-05-25T11:00:00.000Z',
        reference_number: 'PAY-123',
      });
      const originalInsert = result.insert;
      result.insert = (payload: unknown) => {
        insertPayload = payload;
        return originalInsert(payload);
      };
      return result;
    },
  };

  const payment = await service.recordManualPayment('student-1', {
    amount: 1500,
    referenceNumber: 'PAY-123',
    paidAt: '2026-05-25T11:00:00.000Z',
    notes: 'Registrar encoded payment',
  });

  equal(payment.id, 'payment-1');
  deepEqual(insertPayload, {
    student_id: 'student-1',
    amount: 1500,
    reference_number: 'PAY-123',
    paid_at: '2026-05-25T11:00:00.000Z',
    notes: 'Registrar encoded payment',
    status: 'pending_reconciliation',
    payment_mode: 'manual',
  });
  deepEqual(eventCalls, [
    {
      eventType: 'payment.received',
      tenantId: null,
      actorId: 'student-1',
      payload: {
        paymentId: 'payment-1',
        studentId: 'student-1',
        amount: 1500,
        status: 'pending_reconciliation',
        referenceNumber: 'PAY-123',
        paymentMode: 'manual',
      },
    },
  ]);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
