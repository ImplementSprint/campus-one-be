# Observability

## Log redaction

Use `libs/observability/src/log-redaction.ts` before writing request payloads, provider payloads, metadata, or dynamic error messages to logs.

The helper redacts:

- Auth secrets: authorization headers, JWTs, access tokens, refresh tokens, generic tokens, passwords, password hashes, secrets, and database URL credentials.
- OTP/MFA data: OTPs, one-time passwords, verification codes, and MFA codes.
- PII contact data: email addresses, phone numbers, mobile numbers, and contact phone fields.
- Payment references: payment/provider/PayMongo references, receipt URLs, checkout URLs, and reference numbers.

The helper preserves operational fields that are needed for incident response, including tenant ids, actor UUIDs, correlation ids, request ids, status codes, action names, and payment status values.

Current runtime usage:

- `AuditService` redacts dynamic audit warning messages.
- `NotificationsService` redacts dynamic notification and notification-audit warning messages.
- `StudentService` redacts dynamic student-domain error traces.
- `AlumniService` redacts dynamic alumni-domain error and side-effect warning messages.
- `GraduationListener` redacts dynamic Kafka message-processing errors.

When adding new structured logs, prefer `redactLogMetadata(...)` for objects and `redactLogError(...)` for caught errors.
