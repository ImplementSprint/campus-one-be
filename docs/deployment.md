# Deployment

## Runtime

Primary service:

```text
api.campusone.com -> apps/gateway
```

Local service:

```text
http://localhost:4000
```

## Required Environment

```text
PORT
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
WEB_LMS_ORIGIN
WEB_SCHOOL_ORIGIN
```

The service role key belongs only in backend runtime environments.

## Build And Start

```powershell
npm ci
npm test
npm run build
npm start
```

## Tenant Domain Flow

```text
campusone.com              -> web-lms
{schoolSlug}.campusone.com -> web-school
api.campusone.com          -> backend gateway
```

Backend resolves tenant context from school headers, subdomain host, and later authenticated session metadata.
