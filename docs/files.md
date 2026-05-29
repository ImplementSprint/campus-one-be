# Campus One File Storage Boundary

Phase 11B introduces a backend-owned file storage wrapper in `libs/files`.

## Bucket Catalog

| Key | Bucket | Purpose |
|---|---|---|
| `applicantDocuments` | `applicant-documents` | Applicant requirements and admissions documents. |
| `schoolBranding` | `school-branding` | School logo and branding assets. |
| `alumniDocuments` | `alumni-documents` | Alumni proof files and fulfillment artifacts. |
| `paymentReceipts` | `payment-receipts` | Manual payment receipts and provider receipts. |
| `generatedRecords` | `generated-records` | Generated PDF records, certificates, and permits. |

## Rules

- Storage paths are tenant scoped: `<tenant>/<owner-type>/<owner-id>/<timestamp>-<safe-file-name>`.
- Uploads must pass through `BackendFileStorageService` so bucket, content type, file size, tenant id, owner id, and path rules are checked before adapter calls.
- Signed upload and download URLs are created through the storage adapter. Download URL creation rejects mismatched tenant context.
- The Supabase adapter is a compatibility bridge. The wrapper is the stable backend boundary for a later shared file service.

## Current Wiring

- Admissions document upload now uses the wrapper for `applicant-documents`.
- `X-Institution-Id` is the preferred tenant source for the admissions upload route; `institution_id` and `tenant_id` in the body remain compatibility inputs.

## Open Work

- Add a durable file metadata table/repository.
- Move alumni proof files, school branding, payment receipts, and generated records through the wrapper.
- Remove protected frontend/mobile direct storage uploads after backend endpoints exist for each workflow.
