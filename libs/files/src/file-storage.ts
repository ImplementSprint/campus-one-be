import { BadRequestException, ForbiddenException } from '@nestjs/common';

export const FILE_BUCKETS = {
  applicantDocuments: 'applicant-documents',
  schoolBranding: 'school-branding',
  alumniDocuments: 'alumni-documents',
  paymentReceipts: 'payment-receipts',
  generatedRecords: 'generated-records',
} as const;

export type FileBucketKey = keyof typeof FILE_BUCKETS;
export type FileOwnerType = 'applicant' | 'school' | 'alumni' | 'payment' | 'record';

export type ManagedFileMetadata = {
  bucket: (typeof FILE_BUCKETS)[FileBucketKey];
  bucketKey: FileBucketKey;
  path: string;
  tenantId: string;
  ownerType: FileOwnerType;
  ownerId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageUrl?: string;
};

export type FileStorageAdapter = {
  upload(input: {
    bucket: string;
    path: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ storageUrl?: string }>;
  createSignedUploadUrl(input: {
    bucket: string;
    path: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<{ signedUrl: string; fields?: Record<string, string> }>;
  createSignedDownloadUrl(input: {
    bucket: string;
    path: string;
  }): Promise<{ signedUrl: string }>;
};

type FilePolicy = {
  maxBytes: number;
  contentTypes: readonly string[];
};

const FILE_POLICIES: Record<FileBucketKey, FilePolicy> = {
  applicantDocuments: {
    maxBytes: 10 * 1024 * 1024,
    contentTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  schoolBranding: {
    maxBytes: 2 * 1024 * 1024,
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  alumniDocuments: {
    maxBytes: 10 * 1024 * 1024,
    contentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  paymentReceipts: {
    maxBytes: 5 * 1024 * 1024,
    contentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  generatedRecords: {
    maxBytes: 20 * 1024 * 1024,
    contentTypes: ['application/pdf'],
  },
};

export class BackendFileStorageService {
  constructor(
    private readonly adapter: FileStorageAdapter,
    private readonly options: { now?: () => Date } = {},
  ) {}

  async uploadBase64(input: {
    bucket: FileBucketKey;
    tenantId: string;
    ownerType: FileOwnerType;
    ownerId: string;
    fileName: string;
    contentType: string;
    fileBase64: string;
  }): Promise<ManagedFileMetadata> {
    const body = Buffer.from(input.fileBase64, 'base64');
    const metadata = this.buildMetadata({ ...input, sizeBytes: body.length });
    const result = await this.adapter.upload({
      bucket: metadata.bucket,
      path: metadata.path,
      body,
      contentType: metadata.contentType,
    });
    return { ...metadata, storageUrl: result.storageUrl };
  }

  async createSignedUploadUrl(input: {
    bucket: FileBucketKey;
    tenantId: string;
    ownerType: FileOwnerType;
    ownerId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }) {
    const metadata = this.buildMetadata(input);
    const result = await this.adapter.createSignedUploadUrl({
      bucket: metadata.bucket,
      path: metadata.path,
      contentType: metadata.contentType,
      sizeBytes: metadata.sizeBytes,
    });
    return { ...metadata, ...result };
  }

  async createSignedDownloadUrl(input: {
    metadata: ManagedFileMetadata;
    requesterTenantId: string;
  }) {
    this.assertTenantAccess(input.metadata, input.requesterTenantId);
    const result = await this.adapter.createSignedDownloadUrl({
      bucket: input.metadata.bucket,
      path: input.metadata.path,
    });
    return { ...input.metadata, ...result };
  }

  assertTenantAccess(metadata: ManagedFileMetadata, requesterTenantId: string) {
    if (!hasText(requesterTenantId) || metadata.tenantId !== requesterTenantId) {
      throw new ForbiddenException('tenant access denied for file');
    }
  }

  private buildMetadata(input: {
    bucket: FileBucketKey;
    tenantId: string;
    ownerType: FileOwnerType;
    ownerId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }): ManagedFileMetadata {
    if (!(input.bucket in FILE_BUCKETS)) throw new BadRequestException('unsupported file bucket');
    if (!hasText(input.tenantId)) throw new BadRequestException('tenant id is required');
    if (!hasText(input.ownerId)) throw new BadRequestException('file owner id is required');
    if (!hasText(input.fileName)) throw new BadRequestException('file name is required');
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) {
      throw new BadRequestException('file size is required');
    }

    const policy = FILE_POLICIES[input.bucket];
    if (!policy.contentTypes.includes(input.contentType)) {
      throw new BadRequestException(`unsupported content type for ${input.bucket}`);
    }
    if (input.sizeBytes > policy.maxBytes) {
      throw new BadRequestException(`file exceeds maximum size for ${input.bucket}`);
    }

    const safeName = sanitizeFileName(input.fileName);
    return {
      bucket: FILE_BUCKETS[input.bucket],
      bucketKey: input.bucket,
      path: [
        encodePathSegment(input.tenantId),
        encodePathSegment(input.ownerType),
        encodePathSegment(input.ownerId),
        `${formatTimestamp(this.now())}-${safeName}`,
      ].join('/'),
      tenantId: input.tenantId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    };
  }

  private now() {
    return this.options.now?.() ?? new Date();
  }
}

export function createSupabaseFileStorageService(client: any) {
  return new BackendFileStorageService({
    async upload(input) {
      const { data, error } = await client.storage
        .from(input.bucket)
        .upload(input.path, input.body, {
          upsert: false,
          contentType: input.contentType,
        });
      if (error) throw new BadRequestException(error.message);
      return { storageUrl: `storage://${input.bucket}/${data?.path ?? input.path}` };
    },
    async createSignedUploadUrl(input) {
      const bucket = client.storage.from(input.bucket);
      if (typeof bucket.createSignedUploadUrl !== 'function') {
        throw new BadRequestException('signed upload URLs are not supported by the storage adapter');
      }
      const { data, error } = await bucket.createSignedUploadUrl(input.path);
      if (error) throw new BadRequestException(error.message);
      return { signedUrl: data.signedUrl, fields: data.token ? { token: data.token } : undefined };
    },
    async createSignedDownloadUrl(input) {
      const { data, error } = await client.storage.from(input.bucket).createSignedUrl(input.path, 5 * 60);
      if (error) throw new BadRequestException(error.message);
      return { signedUrl: data.signedUrl };
    },
  });
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'file';
}

function encodePathSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function formatTimestamp(date: Date) {
  const iso = date.toISOString();
  return iso.replace(/[-:.TZ]/g, '').slice(0, 17);
}
