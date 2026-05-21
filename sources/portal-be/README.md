# Campus Portal — Backend

NestJS monorepo with multiple microservices. Each service runs on its own port.

---

## Prerequisites

- Node.js 18+
- npm 9+
- A running Supabase project

---

## Setup

```bash
npm install
```

Create a `.env` file in this folder:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=4000
ALUMNI_PORT=4003
STUDENT_PORT=4004
```

> Get the `SUPABASE_SERVICE_ROLE_KEY` from your Supabase dashboard under **Settings → API → service_role secret**.

---

## Run All Services

```bash
npm run dev
```

This starts all 5 services simultaneously using `concurrently`:

| Service | Port | Health Check |
|---------|------|-------------|
| Main | 4000 | http://localhost:4000/api/health |
| Enrollment | 4001 | http://localhost:4001/api/enrollment/offerings |
| Application | 4002 | http://localhost:4002/api/application/health |
| Alumni | 4003 | http://localhost:4003/api/v1/alumni/health |
| Student | 4004 | http://localhost:4004/api/v1/student/health |

---

## Run Individual Services

```bash
npm run dev:main         # Main app only (port 4000)
npm run dev:alumni       # Alumni service only (port 4003)
npm run dev:student      # Student service only (port 4004)
npm run dev:enrollment   # Enrollment service only (port 4001)
npm run dev:application  # Application service only (port 4002)
```

---

## Check Running Ports

Run this in your terminal to verify all services are up:

```bash
netstat -ano | findstr ":400"
```

Or open the health endpoints in your browser (listed in the table above).

---

## Services & Endpoints

### Main (port 4000)
- `GET /api/health`
- `POST /api/auth/signin`
- `GET /api/dashboard/:userId`
- `GET /api/grades/:userId`
- `GET /api/enrollment/offerings`
- `POST /api/enrollment/submit`
- `GET /api/subjects`
- `GET /api/profile/:userId`

### Student (port 4004)
- `GET /api/v1/student/health`
- `GET /api/v1/student/stats`
- `GET /api/v1/student`
- `GET /api/v1/student/:id`
- `PATCH /api/v1/student/:id/status`
- `PATCH /api/v1/student/:id`

### Alumni (port 4003)
- `GET /api/v1/alumni/health`
- `POST /api/v1/alumni/register`
- `GET /api/v1/alumni/profile/:actor_uuid`
- `POST /api/v1/alumni/records/request`
- `GET /api/v1/alumni/records/:actor_uuid`

### Application (port 4002)
- `GET /api/application/health`
- `GET /api/application`

### Enrollment (port 4001)
- `GET /api/enrollment/offerings`
- `POST /api/enrollment/submit`
- `GET /api/enrollment/status/:studentId`
- `GET /api/enrollment/history/:studentId`

---

## Tech Stack

- **Framework:** NestJS 10
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL via @supabase/supabase-js)
- **Event Bus:** Kafka (optional — alumni service degrades gracefully without it)
- **Process Manager:** concurrently
