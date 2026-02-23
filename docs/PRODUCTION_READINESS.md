# Production readiness: real-world deployment at a world-class university

This document assesses how ready **CLIRDEC:PRESENCE** is for production use with **real data** at a **world-class university** scale and expectations. It is an honest gap analysis, not a certification.

---

## Executive summary

| Level | Verdict |
|-------|--------|
| **Department / pilot (single college, hundreds of students)** | **Ready** with the checklist below (env, backups, monitoring). |
| **Campus-wide (thousands of students, many faculty)** | **Ready** with bulk import, runbook, backups, retention, and IoT device auth. |
| **World-class university (tens of thousands, 24/7, strict SLAs)** | **Partially ready** — automated tests and health+DB in place; add HA, SSO, and institutional runbooks as needed. |

---

## What is already in place (ready for real data)

### Security and compliance

- **Authentication:** JWT + HTTP-only cookies; role-based access (admin, faculty); students do not log in (RFID only).
- **Cryptography:** Passwords and IoT API keys hashed (bcrypt); no plaintext secrets in DB.
- **Audit logging:** `audit_log` records auth, user/session/schedule/IoT changes, report views, CSV export; actor, action, resource, IP.
- **Privacy:** Public privacy notice; CORS and HTTPS options; ISO-oriented controls (see [ISO_ALIGNMENT.md](ISO_ALIGNMENT.md)).
- **Input validation:** Zod on API inputs; parameterized SQL (no raw concatenation).
- **Rate limiting:** API and auth endpoints; Helmet headers.

### Core functionality

- **Attendance:** RFID + proximity validation, session-based recording, present/late, duplicate handling, guardian notifications (Resend).
- **Sessions and schedules:** Auto session creation (cron), faculty-scoped sessions, start/end with audit.
- **Reporting:** Attendance reports, CSV export, real-time dashboard, discrepancy/behavior endpoints.
- **IoT:** Device registry, `last_seen_at`, WebSocket + REST for ESP32 over WiFi.

### Deployment and operations

- **Health check:** `GET /health` for load balancers and monitoring.
- **Deployment:** Railway (and similar) flow documented; env vars for DB, JWT, CORS, HTTPS, cron, email.
- **Migrations:** Sequential SQL migrations; single `npm run db:migrate` command; optional tables (classrooms, subjects) via `schema-optional-tables.sql` (included in `db:migrate`).
- **CI:** GitHub Actions workflow runs backend unit tests and E2E (Playwright) on push/PR; uses PostgreSQL service and optional `SEED_ADMIN=1` for test user.

### UI and UX

- **Accessibility:** ISO 9241–aligned spacing, labels, focus order, touch targets, ARIA where needed (see [ISO_UI.md](ISO_UI.md)).
- **Consistency:** Design tokens, Shadcn-style components, sidebar layout.
- **Dashboard filters:** Date range (today / week / all) and room/subject search for sessions.
- **Password reset:** Forgot-password flow for admin/faculty (email link to `/reset-password?token=...`); requires `PASSWORD_RESET_APP_URL`, Resend, and `EMAIL_FROM`.
- **Student “my attendance”:** Public `/my-attendance?token=...` page for students to view their own attendance via a time-limited link (admin-generated).
- **API docs:** `GET /api-docs` serves Swagger UI; spec at `GET /api-docs/spec.json`.

---

## Gaps for real-world deployment (by priority)

### High priority (before going live with real data)

| Gap | Impact | Status |
|-----|--------|--------|
| **No automated tests** | Regressions, risky deployments | **Addressed:** Vitest unit tests for bulk import CSV parsing and auth validation; run with `npm run test` in backend. |
| **No automated DB backups** | Data loss on failure | **Addressed:** `npm run db:backup` script (pg_dump); [RUNBOOK.md](RUNBOOK.md) documents backup and restore. Use managed PostgreSQL backups in production. |
| **Secrets in env only** | Risk if env is leaked | Use a secrets manager (e.g. Railway vars, AWS Secrets Manager) and ensure JWT_SECRET is strong (≥32 chars); app already warns in production. |
| **IoT attendance unauthenticated** | Devices can spoof attendance | **Addressed:** Set `IOT_REQUIRE_DEVICE_AUTH=1`; devices must send `device_id` and `X-IoT-API-Key` (or `api_key` in body). |

### Medium priority (campus-wide / world-class)

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **No bulk import** | Manual entry for hundreds/thousands of users/cards/schedules | **Addressed:** `POST /api/users/import` (admin) accepts CSV; idempotent (skips existing emails). |
| **No SSO / LDAP** | Faculty/admins must use local passwords | See [SSO_OIDC.md](SSO_OIDC.md) for integration guide; not implemented in-code. |
| **Single instance** | No HA; downtime on deploy or crash | Run behind a load balancer; multiple app instances; consider sticky sessions or stateless JWT-only if cookies are not used across instances. |
| **No structured runbook** | Slow incident response | **Addressed:** [RUNBOOK.md](RUNBOOK.md) covers migrations, backup/restore, audit, session revoke, bulk import, user deletion. |
| **Data retention and deletion** | Privacy/GDPR and institutional policy | Define retention period; add purge/archive jobs and/or “right to erasure” (delete user + related data) with audit. |
| **Limited observability** | Hard to debug and tune | **Addressed:** `GET /health` includes DB check (503 when down); optional structured logger in `backend/src/lib/logger.ts`. |

### Lower priority (institutional polish)

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **No automated session creation by schedule** | Only “today”; no multi-day or custom rules | Extend cron or add rules to create sessions for multiple days or by schedule template. |
| **No formal SLA** | No committed uptime | Define target availability (e.g. 99.5%) and document in ops; use managed DB + health checks. |
| **Single DB** | No read replicas | For very high read load, add read replicas and separate read paths (future). |
| **No student portal** | Students only use RFID | **Addressed:** Student “my attendance” page at `/my-attendance?token=...` (admin generates link per student). |

---

## Checklist before going live with real data

Use this as a pre-launch list for a **department or pilot** deployment.

- [ ] **Environment:** `NODE_ENV=production`, strong `JWT_SECRET` (≥32 chars), `CORS_ORIGIN` set to frontend URL(s), `REQUIRE_HTTPS=1` if behind HTTPS.
- [ ] **Database:** `DATABASE_URL` from a managed PostgreSQL service; run `npm run db:migrate` once after deploy.
- [ ] **Backups:** Automated daily (or better) backups and a tested restore procedure.
- [ ] **Email:** `RESEND_API_KEY` and `EMAIL_FROM` set if guardian notifications are required.
- [ ] **First admin:** Create via `POST /api/auth/register` (or a one-off script) and then use the app.
- [ ] **IoT (if used):** Register devices in the app; consider enforcing device auth on `/api/iot/attendance`.
- [ ] **Monitoring:** At least health checks (e.g. `GET /health`) and alerting on failure; optional logging/APM.
- [ ] **Documentation:** Share README and ARCHITECTURE with ops; [RUNBOOK.md](RUNBOOK.md) covers migrate, backup, restore, audit, password reset, API docs; **SEED_ADMIN** is for CI only—do not use in production.

---

## Summary

- **Real data:** The system is **suitable for real data** in a department or pilot: data model, validation, audit, and security controls are in place.
- **Deployment:** It can be **deployed to production** (e.g. Railway) with the checklist above and managed DB + backups.
- **World-class university:** For **institution-wide, 24/7, high-expectation** use, plan for: **automated tests**, **backups and runbooks**, **optional SSO and bulk import**, **IoT device auth**, and over time **HA and retention/deletion policy**.

Treat this as a living document: update as you add tests, backups, SSO, or runbooks to reflect the current readiness level.
