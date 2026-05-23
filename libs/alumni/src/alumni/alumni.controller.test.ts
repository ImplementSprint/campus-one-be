import 'reflect-metadata';
import { equal, rejects } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AlumniController } from './alumni.controller';
import { RequestRecordDto } from './dto/request-record.dto';
import { DocumentType } from './interfaces/alumni.interface';

let serviceCalls = 0;
let requestedRecordPayload: unknown;
let calculatedFee: { documentType: DocumentType; copies?: number } | undefined;
let statusUpdate: { logId: string; statusCode: number; paymentStatus?: string } | undefined;
let cardStatusUpdate: { logId: string; statusCode: number; paymentStatus?: string } | undefined;
process.env.CAMPUS_ONE_AUTH_SECRET = 'test-secret-with-enough-length';

function signTestToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.CAMPUS_ONE_AUTH_SECRET ?? '').update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

const authArgs = [`Bearer ${signTestToken({ sub: 'admin-1', role: 'alumni_admin', activeInstitutionId: 'school-a' })}`, 'alumni_admin', 'admin-1', 'school-a'] as const;

const service = {
  async requestRecord(payload: unknown) {
    serviceCalls += 1;
    requestedRecordPayload = payload;
    return { success: true, action: 'record-requested' };
  },
  calculateRecordFee(documentType: DocumentType, copies?: number) {
    serviceCalls += 1;
    calculatedFee = { documentType, copies };
    return { document_type: documentType, number_of_copies: copies ?? 1, total_amount: 150, payment_mode: 'manual' };
  },
  async updateRecordStatus(logId: string, statusCode: number, paymentStatus?: string) {
    serviceCalls += 1;
    statusUpdate = { logId, statusCode, paymentStatus };
    return { success: true, status_code: statusCode, payment_status: paymentStatus, notification: { type: 'alumni_request_status_updated' } };
  },
  async getAllCardApplications() {
    serviceCalls += 1;
    return [{ log_id: 'card-log-123' }];
  },
  async updateCardApplicationStatus(logId: string, statusCode: number, paymentStatus?: string) {
    serviceCalls += 1;
    cardStatusUpdate = { logId, statusCode, paymentStatus };
    return { success: true, status_code: statusCode, payment_status: paymentStatus, notification: { type: 'alumni_card_status_updated' } };
  },
  async getCommunicationLog(actorUuid: string) {
    serviceCalls += 1;
    return [{ actor_uuid: actorUuid, action_type: 'alumni.record.requested.v1' }];
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
  const controllerPath = Reflect.getMetadata(PATH_METADATA, AlumniController);
  const requestRecordPath = Reflect.getMetadata(PATH_METADATA, AlumniController.prototype.requestRecord);
  const requestRecordMethod = Reflect.getMetadata(METHOD_METADATA, AlumniController.prototype.requestRecord);
  const feePath = Reflect.getMetadata(PATH_METADATA, AlumniController.prototype.calculateRecordFee);
  const feeMethod = Reflect.getMetadata(METHOD_METADATA, AlumniController.prototype.calculateRecordFee);
  const communicationLogPath = Reflect.getMetadata(PATH_METADATA, AlumniController.prototype.getCommunicationLog);
  const communicationLogMethod = Reflect.getMetadata(METHOD_METADATA, AlumniController.prototype.getCommunicationLog);
  const adminUpdatePath = Reflect.getMetadata(PATH_METADATA, AlumniController.prototype.adminUpdateRequest);
  const adminUpdateMethod = Reflect.getMetadata(METHOD_METADATA, AlumniController.prototype.adminUpdateRequest);
  const adminCardRequestsPath = Reflect.getMetadata(PATH_METADATA, AlumniController.prototype.adminCardRequests);
  const adminCardRequestsMethod = Reflect.getMetadata(METHOD_METADATA, AlumniController.prototype.adminCardRequests);
  const adminUpdateCardPath = Reflect.getMetadata(PATH_METADATA, AlumniController.prototype.adminUpdateCardRequest);
  const adminUpdateCardMethod = Reflect.getMetadata(METHOD_METADATA, AlumniController.prototype.adminUpdateCardRequest);

  equal(controllerPath, 'alumni');
  equal(requestRecordPath, 'records/request');
  equal(requestRecordMethod, RequestMethod.POST);
  equal(feePath, 'records/fee/:document_type');
  equal(feeMethod, RequestMethod.GET);
  equal(communicationLogPath, 'communication-log/:actor_uuid');
  equal(communicationLogMethod, RequestMethod.GET);
  equal(adminUpdatePath, 'admin/requests/:log_id');
  equal(adminUpdateMethod, RequestMethod.PATCH);
  equal(adminCardRequestsPath, 'admin/card-requests');
  equal(adminCardRequestsMethod, RequestMethod.GET);
  equal(adminUpdateCardPath, 'admin/card-requests/:log_id');
  equal(adminUpdateCardMethod, RequestMethod.PATCH);

  const controller = new AlumniController(service as any);
  const validRecordPayload: RequestRecordDto = {
    actor_uuid: '0e8221b1-1433-4de9-875f-63665313987a',
    tenant_id: 'school-a',
    document_type: DocumentType.TOR,
    delivery_method: 'pickup',
    number_of_copies: 1,
  };

  const recordResult = await controller.requestRecord(validRecordPayload);
  equal((recordResult as any).action, 'record-requested');
  equal(requestedRecordPayload, validRecordPayload);

  const feeResult = await controller.calculateRecordFee(DocumentType.TOR, '2');
  equal((feeResult as any).total_amount, 150);
  equal(calculatedFee?.documentType, DocumentType.TOR);
  equal(calculatedFee?.copies, 2);

  const communicationLog = await controller.getCommunicationLog('0e8221b1-1433-4de9-875f-63665313987a');
  equal((communicationLog as any[]).length, 1);
  equal((communicationLog as any[])[0].action_type, 'alumni.record.requested.v1');

  const statusResult = await controller.adminUpdateRequest('record-log-123', { status_code: 200, payment_status: 'paid' }, ...authArgs);
  equal((statusResult as any).status_code, 200);
  equal((statusResult as any).payment_status, 'paid');
  equal((statusResult as any).notification.type, 'alumni_request_status_updated');
  equal(statusUpdate?.logId, 'record-log-123');
  equal(statusUpdate?.statusCode, 200);
  equal(statusUpdate?.paymentStatus, 'paid');

  const cardList = await controller.adminCardRequests(...authArgs);
  equal((cardList as any[]).length, 1);

  const cardStatusResult = await controller.adminUpdateCardRequest('card-log-123', { status_code: 300, payment_status: 'paid' }, ...authArgs);
  equal((cardStatusResult as any).status_code, 300);
  equal((cardStatusResult as any).payment_status, 'paid');
  equal((cardStatusResult as any).notification.type, 'alumni_card_status_updated');
  equal(cardStatusUpdate?.logId, 'card-log-123');
  equal(cardStatusUpdate?.statusCode, 300);
  equal(cardStatusUpdate?.paymentStatus, 'paid');

  await expectBadRequest(
    () => (controller.requestRecord as any)({
      actor_uuid: '0e8221b1-1433-4de9-875f-63665313987a',
      tenant_id: 'school-a',
      document_type: 'TRANSCRIPT',
    }),
    'Invalid document request payload',
  );
  await expectBadRequest(
    async () => (controller.calculateRecordFee as any)('TRANSCRIPT', '1'),
    'Invalid document type',
  );
  await expectBadRequest(
    async () => (controller.calculateRecordFee as any)(DocumentType.TOR, '0'),
    'Invalid copy count',
  );
  await expectBadRequest(
    () => (controller.requestRecord as any)({
      actor_uuid: '0e8221b1-1433-4de9-875f-63665313987a',
      tenant_id: 'school-a',
      document_type: DocumentType.DIPLOMA,
      number_of_copies: 0,
    }),
    'Invalid document request payload',
  );
  await expectBadRequest(
    () => (controller.adminUpdateRequest as any)('record-log-123', { status_code: 'approved' }, ...authArgs),
    'Invalid request status payload',
  );
  await expectBadRequest(
    () => (controller.adminUpdateRequest as any)('record-log-123', {}, ...authArgs),
    'Invalid request status payload',
  );
  await expectBadRequest(
    () => (controller.adminUpdateRequest as any)('record-log-123', { status_code: 200, payment_status: 'settled' }, ...authArgs),
    'Invalid request status payload',
  );
  await expectBadRequest(
    () => (controller.adminUpdateCardRequest as any)('card-log-123', { status_code: 300, payment_status: 'settled' }, ...authArgs),
    'Invalid request status payload',
  );

  equal(serviceCalls, 6);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
