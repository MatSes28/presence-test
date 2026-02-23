# CLIRDEC:PRESENCE — Operations runbook

World-class university deployment: procedures for migrations, backups, restore, audit, and incidents.

---

## Prerequisites

- `DATABASE_URL` (PostgreSQL connection string)
- `npm run db:migrate` and `node scripts/db-backup.js` run from project root (backend env available)

---

## 1. Database migrations

**When:** After deploying new code that includes schema changes (new `schema-*.sql` or changes in `backend/src/db/`).

**Steps:**

1. Ensure `DATABASE_URL` points to the target database.
2. From project root:
   ```bash
   npm run db:migrate
   ```
3. Migrations run in order: `schema.sql`, `schema-guardian-email.sql`, `schema-v2.sql`, `schema-iot-health.sql`, `schema-audit.sql`. Each is idempotent where possible (`IF NOT EXISTS`).
4. On failure: fix the cause (e.g. conflicting schema), then re-run. Do not re-run blindly after manual fixes.

---

## 2. Backups

**When:** Daily (or per policy). Use managed PostgreSQL backups (Railway, AWS RDS, etc.) when available.

**Manual backup (pg_dump):**

```bash
export DATABASE_URL="postgresql://..."
node scripts/db-backup.js > backup-$(date +%Y%m%d-%H%M%S).sql
# or compressed:
node scripts/db-backup.js | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

**Cron example (daily at 2 AM):**

```bash
0 2 * * * cd /path/to/presence-test && DATABASE_URL="..." node scripts/db-backup.js | gzip > /backups/clirdec-$(date +\%Y\%m\%d).sql.gz
```

---

## 3. Restore from backup

**When:** After data loss or to clone to a different environment.

**Steps:**

1. Stop the application (avoid writes during restore).
2. Create a fresh database or truncate tables (destructive). For full replace:
   ```bash
   psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```
3. Restore:
   ```bash
   gunzip -c backup-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"
   # or uncompressed:
   psql "$DATABASE_URL" < backup-YYYYMMDD-HHMMSS.sql
   ```
4. Re-run migrations if the backup was from an older schema:
   ```bash
   npm run db:migrate
   ```
5. Start the application and verify health (`GET /health`).

---

## 4. Audit log inspection

**When:** Security review, compliance, or incident investigation.

**Table:** `audit_log`

**Useful queries (run via `psql` or admin tool):**

```sql
-- Recent auth events
SELECT * FROM audit_log WHERE action IN ('auth_login', 'auth_logout') ORDER BY created_at DESC LIMIT 100;

-- Actions by a user
SELECT * FROM audit_log WHERE actor_email = 'admin@example.com' ORDER BY created_at DESC;

-- CSV export / report view events
SELECT * FROM audit_log WHERE action LIKE '%export%' OR action LIKE '%report%' ORDER BY created_at DESC;

-- Failed or sensitive actions (extend as needed)
SELECT * FROM audit_log WHERE resource_type = 'user' ORDER BY created_at DESC LIMIT 50;
```

**Columns:** `id`, `actor_id`, `actor_email`, `action`, `resource_type`, `resource_id`, `details`, `ip_address`, `created_at`.

---

## 5. Revoking sessions (logout all users)

**When:** Suspected compromise or policy requirement to invalidate all sessions.

**Steps:**

1. **Option A — Rotate JWT secret:** Change `JWT_SECRET` in the environment and restart the app. All existing JWTs become invalid. Users must log in again.
2. **Option B — Clear cookies:** Clients use HTTP-only cookies; server-side you cannot “clear” them. Rotating `JWT_SECRET` (Option A) invalidates those sessions on next request.
3. Restart application after changing `JWT_SECRET`.

---

## 6. Health check

**Endpoint:** `GET /health`

**Expected:** `200` with body `{ "status": "ok", "service": "clirdec-presence" }`. Optional: health includes DB check (see deployment).

**Use:** Load balancer, uptime monitor, container orchestration.

---

## 7. IoT device authentication

**When:** Enforcing device auth for `/api/iot/attendance` (world-class hardening).

1. Set `IOT_REQUIRE_DEVICE_AUTH=1` in production.
2. Ensure every ESP32 (or client) is registered under **IoT Devices** in the app; copy the **API key** (shown once).
3. Devices must send:
   - `device_id` (in body)
   - `X-IoT-API-Key` header **or** `api_key` in body
4. Invalid or missing credentials receive `401`.

---

## 8. Bulk user import (CSV)

**When:** Onboarding many users (e.g. at start of term).

**Endpoint:** `POST /api/users/import` (admin only). Body: `{ "csv": "..." }` (raw CSV string).

**CSV format:** Header row optional. Columns: `email`, `full_name`, `role`, `guardian_email` (optional), `card_uid` (optional), `password` (optional for admin/faculty).

- Duplicate emails are **skipped** (existing users unchanged).
- Students get a placeholder password (no login); admin/faculty need a password in CSV or will be created with a temporary one (they must reset).

**Example:**

```csv
email,full_name,role,guardian_email,card_uid,password
student@example.com,Student One,student,parent@example.com,CARD001,
faculty@example.com,Dr Faculty,faculty,,,SecurePass123
```

---

## 9. User deletion (right to erasure)

**When:** User request or policy (e.g. leave of absence, GDPR).

**Endpoint:** `DELETE /api/users/:id` (admin only). Cannot delete your own account. Faculty with schedules must have schedules reassigned or deleted first. Deleting a user removes their attendance events, RFID link, and related data; audit log retains the deletion event.

---

## 10. Escalation and contacts

- **Application owner:** [Set in your institution]
- **Database/backup owner:** [Set in your institution]
- **Security incidents:** Follow institutional incident response; preserve audit_log and backups.

---

*Update this runbook as procedures change. Keep a copy in version control.*
