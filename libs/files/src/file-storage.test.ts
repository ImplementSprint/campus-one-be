import { deepEqual, equal, ok, rejects } from 'node:assert/strict';
import {
  BackendFileStorageService,
  FILE_BUCKETS,
  type FileStorageAdapter,
} from './file-storage';

class FakeStorageAdapter implements FileStorageAdapter {
  uploads: Array<{ bucket: string; path: string; contentType: string; sizeBytes: number }> = [];

  async upload(input: { bucket: string; path: string; body: Buffer; contentType: string }) {
    this.uploads.push({
      bucket: input.bucket,
      path: input.path,
      contentType: input.contentType,
      sizeBytes: input.body.length,
    });
    return { storageUrl: `storage://${input.bucket}/${input.path}` };
  }

  async createSignedUploadUrl(input: { bucket: string; path: string }) {
    return { signedUrl: `https://files.example/upload/${input.bucket}/${input.path}` };
  }

  async createSignedDownloadUrl(input: { bucket: string; path: string }) {
    return { signedUrl: `https://files.example/download/${input.bucket}/${input.path}` };
  }
}

async function run() {
  deepEqual(FILE_BUCKETS, {
    applicantDocuments: 'applicant-documents',
    schoolBranding: 'school-branding',
    alumniDocuments: 'alumni-documents',
    paymentReceipts: 'payment-receipts',
    generatedRecords: 'generated-records',
  });

  const adapter = new FakeStorageAdapter();
  const storage = new BackendFileStorageService(adapter, {
    now: () => new Date('2026-05-25T12:00:00.000Z'),
  });

  const upload = await storage.uploadBase64({
    bucket: 'applicantDocuments',
    tenantId: 'school-1',
    ownerType: 'applicant',
    ownerId: 'app-123',
    fileName: 'Transcript final.pdf',
    contentType: 'application/pdf',
    fileBase64: Buffer.from('pdf bytes').toString('base64'),
  });

  equal(upload.bucket, 'applicant-documents');
  equal(upload.path, 'school-1/applicant/app-123/20260525120000000-transcript-final.pdf');
  equal(upload.fileName, 'Transcript final.pdf');
  equal(upload.storageUrl, 'storage://applicant-documents/school-1/applicant/app-123/20260525120000000-transcript-final.pdf');
  deepEqual(adapter.uploads, [
    {
      bucket: 'applicant-documents',
      path: 'school-1/applicant/app-123/20260525120000000-transcript-final.pdf',
      contentType: 'application/pdf',
      sizeBytes: Buffer.byteLength('pdf bytes'),
    },
  ]);

  const signedUpload = await storage.createSignedUploadUrl({
    bucket: 'paymentReceipts',
    tenantId: 'school-1',
    ownerType: 'payment',
    ownerId: 'payment-123',
    fileName: 'receipt.JPG',
    contentType: 'image/jpeg',
    sizeBytes: 128,
  });
  equal(signedUpload.path, 'school-1/payment/payment-123/20260525120000000-receipt.jpg');
  ok(signedUpload.signedUrl.includes('/upload/payment-receipts/'));

  const signedDownload = await storage.createSignedDownloadUrl({
    metadata: upload,
    requesterTenantId: 'school-1',
  });
  ok(signedDownload.signedUrl.includes('/download/applicant-documents/'));

  await rejects(
    () =>
      storage.createSignedDownloadUrl({
        metadata: upload,
        requesterTenantId: 'other-school',
      }),
    /tenant access denied/,
  );

  await rejects(
    () =>
      storage.createSignedUploadUrl({
        bucket: 'schoolBranding',
        tenantId: 'school-1',
        ownerType: 'school',
        ownerId: 'school-1',
        fileName: 'brand.svg',
        contentType: 'image/svg+xml',
        sizeBytes: 512,
      }),
    /unsupported content type/,
  );

  await rejects(
    () =>
      storage.createSignedUploadUrl({
        bucket: 'applicantDocuments',
        tenantId: 'school-1',
        ownerType: 'applicant',
        ownerId: 'app-123',
        fileName: 'large.pdf',
        contentType: 'application/pdf',
        sizeBytes: 25 * 1024 * 1024,
      }),
    /exceeds maximum size/,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
