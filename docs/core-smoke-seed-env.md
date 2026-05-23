# Core Smoke Seed Environment

`npm run smoke:core` always runs fast validation checks. It also runs live DB-backed happy-path checks when these values are present. If the values are blank and `DATABASE_URL` is available, the smoke runner tries to discover usable IDs from the database first.

```text
CORE_SMOKE_PROFESSOR_ID=<professor id with an active class assignment>
CORE_SMOKE_CLASS_ID=<class assignment id owned by CORE_SMOKE_PROFESSOR_ID>
CORE_SMOKE_ALUMNI_ACTOR_UUID=<alumni actor_uuid with record request access>
CORE_SMOKE_NOTIFICATION_PROFILE_ID=<profile_id with zero or more notifications>
```

Seed requirements:

- The professor id and class id must pass the professor/class ownership query.
- The professor smoke uses a locally signed Campus One professor token for route authorization.
- The alumni actor UUID must be valid for `GET /api/alumni/records/:actor_uuid`.
- The notification profile id may have no notifications; the smoke only proves the DB-backed list route.
- Leave any value blank to skip only that live DB case.
- Explicit `CORE_SMOKE_*` values override auto-discovered values.
- Without `DATABASE_URL` or explicit values, the live DB cases are skipped and the validation smoke still runs.

Useful command:

```powershell
npm run smoke:core
```
