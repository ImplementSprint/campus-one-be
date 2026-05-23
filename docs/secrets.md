# Backend Secrets And Environment

This repo owns backend-only runtime secrets. Do not copy backend service-role values into frontend or mobile repositories.

## GitHub Repository

```text
https://github.com/ImplementSprint/campus-one-be
```

## Required GitHub Secrets

| Name | Used By | Notes |
|---|---|---|
| `SUPABASE_URL` | Backend runtime and deployment provider | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend runtime only | Keep backend-only. Never expose to browser or mobile builds. |
| `SUPABASE_ANON_KEY` | Backend runtime | Safe public key, but keep configured centrally for backend runtime. |
| `ALLOWED_ORIGINS` | Backend CORS | Preferred comma-separated CORS allowlist. Sandbox example: `https://itsandbox.site,https://app.itsandbox.site,https://*.itsandbox.site`. |
| `APP_BASE_DOMAIN` | Tenant routing and URL generation | Sandbox value: `itsandbox.site`. |
| `SCHOOL_PORTAL_BASE_DOMAIN` | School portal subdomains | Sandbox value: `itsandbox.site`. |
| `PUBLIC_LMS_URL` | Public platform URL generation | Sandbox value: `https://itsandbox.site`. |

Legacy origin variables are still read as local-development fallback values, but new deployments should prefer `ALLOWED_ORIGINS`:

| Name | Notes |
|---|---|
| `WEB_LMS_ORIGIN` | Legacy fallback for public platform web origin. |
| `WEB_SCHOOL_ORIGIN` | Legacy fallback for school portal web origin. |
| `MOBILE_DEV_ORIGIN` | Legacy fallback for local Expo/mobile development. |

## Suggested Repository Variables

| Name | Example |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `API_DOMAIN` | `api.itsandbox.site` |

## Runtime Validation

The gateway validates runtime configuration during startup. Startup fails if any required Supabase backend value is missing, empty, or still set to a placeholder:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The shared Supabase clients no longer fall back to placeholder credentials outside test/smoke scripts. Tests and gateway smoke provide deterministic dummy values through `package.json` scripts; do not use those dummy values in real environments.

## CLI Setup Template

Run these after the real values are available:

```powershell
gh secret set SUPABASE_URL --repo ImplementSprint/campus-one-be
gh secret set SUPABASE_SERVICE_ROLE_KEY --repo ImplementSprint/campus-one-be
gh secret set SUPABASE_ANON_KEY --repo ImplementSprint/campus-one-be
gh secret set ALLOWED_ORIGINS --repo ImplementSprint/campus-one-be
gh secret set APP_BASE_DOMAIN --repo ImplementSprint/campus-one-be
gh secret set SCHOOL_PORTAL_BASE_DOMAIN --repo ImplementSprint/campus-one-be
gh secret set PUBLIC_LMS_URL --repo ImplementSprint/campus-one-be

gh variable set NODE_ENV --body production --repo ImplementSprint/campus-one-be
gh variable set PORT --body 4000 --repo ImplementSprint/campus-one-be
gh variable set API_DOMAIN --body api.itsandbox.site --repo ImplementSprint/campus-one-be
```

## Verification

```powershell
npm ci
npm run verify
```
