# Phase 14 Route Security

## Verified Slices

- `GET /api/profile/:userId` and `PUT /api/profile/:userId` reject anonymous access before calling the profile service. Anonymous requests are identified by a missing `x-user-id` header and return `401 Unauthorized`.
- `GET /api/tenant/current` rejects unresolved `unknown` tenant context instead of returning a fallback tenant.
- `npm run security:routes` now exercises the MVP route-security matrix for anonymous profile access, unresolved tenant-current rejection, professor anonymous/wrong-role rejection, professor/grade identity-boundary validation, alumni admin anonymous/wrong-role/wrong-tenant rejection, audit and academic-audit anonymous/wrong-role rejection, alumni document/card fulfillment payload validation, and notification target validation.
- Runtime role enforcement is enabled for alumni admin fulfillment routes, audit events, professor routes, professor grade routes, student grade routes, and enrollment routes using a signed Campus One bearer token plus matching `X-User-Id`/`X-User-Role` headers.
- Server-side Campus One JWT signature verification is enabled for protected route authorization through `JWT_ACCESS_TOKEN_SECRET`; spoofed or invalid bearer tokens are rejected before role checks.
- Web-school direct login now stores backend-issued Campus One access tokens instead of Supabase Auth tokens for protected backend API calls.
- Protected route authorization rejects mismatched `X-Institution-Id` when the signed token carries an `activeInstitutionId` claim.

## Verification

```powershell
npm test
npm run build
npm run security:routes
```
