# API Contracts

The backend repository is the source of truth for Campus One route shape, tenant routing, DTOs, and database-backed behavior.

## Public School Lookup

Used by the LMS and mobile app before tenant login.

```http
GET /api/schools?search={query}
GET /api/schools/{slug}
```

Response:

```ts
type PublicSchool = {
  schoolId: string;
  schoolSlug: string;
  displayName: string;
  schoolType?: string | null;
  status?: string | null;
};
```

Only approved `institution_profiles` are returned.

## Tenant Headers

Tenant-scoped web and mobile requests must resolve to an institution before reading or writing tenant data.

```http
X-School-Slug: san-beda
X-Institution-Id: institution-uuid
```

Resolution order:

1. `X-School-Slug` or `X-Institution-Id`
2. subdomain host such as `san-beda.campusone.com`
3. authenticated active institution
4. platform/global context for public LMS routes only

## Contract Sync Rule

Backend owns `libs/contracts/src/index.ts`.

Generate the frontend/mobile-safe artifact with:

```powershell
npm run contracts:generate
```

This writes:

```text
contract-artifacts/shared-contracts.ts
contract-artifacts/contracts-manifest.json
```

CI verifies the artifact with:

```powershell
npm run contracts:check
```

Frontend and mobile sync from `contract-artifacts/`; they must not import backend runtime code.

Breaking contract changes require:

1. Backend commit that changes the contract and tests.
2. Frontend/mobile commits that consume the new contract.
3. A release note or PR link tying the dependent commits together.
