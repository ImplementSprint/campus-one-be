import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { BillingController } from './billing.controller';

let requestedStudentId: string | undefined;
let manualPaymentPayload: unknown;
let receiptRequest: unknown;

const service = {
  async getStudentBalance(studentId: string) {
    requestedStudentId = studentId;
    return {
      studentId,
      currency: 'PHP',
      totalAssessed: 25000,
      totalPaid: 10000,
      balanceDue: 15000,
      paymentStatus: 'partial',
      paymentMode: 'manual',
      recentPayments: [],
    };
  },
  async recordManualPayment(studentId: string, payload: unknown) {
    manualPaymentPayload = { studentId, payload };
    return { id: 'payment-1', status: 'pending_reconciliation' };
  },
  async getReceipt(studentId: string, paymentId: string) {
    receiptRequest = { studentId, paymentId };
    return { id: paymentId, studentId, receiptNumber: 'OR-0001' };
  },
  async getReconciliationQueue() {
    return { payments: [{ id: 'payment-1', status: 'pending_reconciliation' }] };
  },
};

async function expectBadRequest(operation: () => Promise<unknown>, expectedMessage: string) {
  await rejects(operation, (error: unknown) => {
    return (
      error instanceof BadRequestException &&
      error.getStatus() === 400 &&
      error.message === expectedMessage
    );
  });
}

async function run() {
  equal(Reflect.getMetadata(PATH_METADATA, BillingController), 'billing');
  equal(Reflect.getMetadata(PATH_METADATA, BillingController.prototype.getStudentBalance), 'student/:studentId/balance');
  equal(Reflect.getMetadata(METHOD_METADATA, BillingController.prototype.getStudentBalance), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, BillingController.prototype.recordManualPayment), 'student/:studentId/manual-payments');
  equal(Reflect.getMetadata(METHOD_METADATA, BillingController.prototype.recordManualPayment), RequestMethod.POST);
  equal(Reflect.getMetadata(PATH_METADATA, BillingController.prototype.getReceipt), 'student/:studentId/receipts/:paymentId');
  equal(Reflect.getMetadata(METHOD_METADATA, BillingController.prototype.getReceipt), RequestMethod.GET);
  equal(Reflect.getMetadata(PATH_METADATA, BillingController.prototype.getReconciliationQueue), 'admin/reconciliation');
  equal(Reflect.getMetadata(METHOD_METADATA, BillingController.prototype.getReconciliationQueue), RequestMethod.GET);

  const controller = new BillingController(service as any);
  const result = await controller.getStudentBalance('student-123');

  equal(requestedStudentId, 'student-123');
  equal(result.currency, 'PHP');
  equal(result.balanceDue, 15000);
  equal(result.paymentStatus, 'partial');
  equal(result.paymentMode, 'manual');

  const manualPayment = await controller.recordManualPayment('student-123', {
    amount: 10000,
    referenceNumber: 'REF-123',
    paidAt: '2026-05-23T00:00:00.000Z',
  });
  equal(manualPayment.status, 'pending_reconciliation');
  equal((manualPaymentPayload as any).studentId, 'student-123');
  equal((manualPaymentPayload as any).payload.referenceNumber, 'REF-123');

  const receipt = await controller.getReceipt('student-123', 'payment-1');
  equal(receipt.receiptNumber, 'OR-0001');
  equal((receiptRequest as any).paymentId, 'payment-1');

  const reconciliation = await controller.getReconciliationQueue();
  equal(reconciliation.payments.length, 1);

  await expectBadRequest(
    () => controller.getStudentBalance(' '),
    'student id is required',
  );
  await expectBadRequest(
    () => controller.recordManualPayment('student-123', { amount: 0, referenceNumber: 'REF-123' }),
    'Manual payment requires amount greater than zero and referenceNumber',
  );
  await expectBadRequest(
    () => controller.recordManualPayment('student-123', { amount: 1000 } as any),
    'Manual payment requires amount greater than zero and referenceNumber',
  );
  await expectBadRequest(
    () => controller.getReceipt('student-123', ' '),
    'payment id is required',
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
