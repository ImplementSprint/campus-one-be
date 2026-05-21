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
| `WEB_LMS_ORIGIN` | Backend CORS and tenant routing | Production value should be `https://campusone.com`. |
| `WEB_SCHOOL_ORIGIN` | Backend CORS and tenant routing | Production value should cover the school portal domain strategy. |

## Suggested Repository Variables

| Name | Example |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `API_DOMAIN` | `api.campusone.com` |

## CLI Setup Template

Run these after the real values are available:

```powershell
gh secret set SUPABASE_URL --repo ImplementSprint/campus-one-be
gh secret set SUPABASE_SERVICE_ROLE_KEY --repo ImplementSprint/campus-one-be
gh secret set SUPABASE_ANON_KEY --repo ImplementSprint/campus-one-be
gh secret set WEB_LMS_ORIGIN --repo ImplementSprint/campus-one-be
gh secret set WEB_SCHOOL_ORIGIN --repo ImplementSprint/campus-one-be

gh variable set NODE_ENV --body production --repo ImplementSprint/campus-one-be
gh variable set PORT --body 4000 --repo ImplementSprint/campus-one-be
gh variable set API_DOMAIN --body api.campusone.com --repo ImplementSprint/campus-one-be
```

## Verification

```powershell
npm ci
npm run verify
```
