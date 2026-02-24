# Go-live checklist

Use this to confirm you’re done before (and after) deploying to production.

---

## Railway deploy (Part B)

- [ ] Railway project created; repo connected (or deploy from CLI).
- [ ] PostgreSQL service added; `DATABASE_URL` from its Variables (or linked).
- [ ] Web service Variables set:
  - [ ] `DATABASE_URL` (from Postgres)
  - [ ] `JWT_SECRET` (strong, ≥32 chars)
  - [ ] `NODE_ENV=production`
- [ ] Build: `npm run build` | Start: `npm run start` (or root directory = repo root).
- [ ] First deploy completed; service is running.
- [ ] **Migrations run once** in Railway shell: `npm run db:migrate`
- [ ] First admin created (replace `YOUR-APP-URL` with your Railway URL):
  ```bash
  curl -X POST https://YOUR-APP-URL/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@school.com\",\"password\":\"YOUR_SECURE_PASSWORD\",\"full_name\":\"Admin\",\"role\":\"admin\"}"
  ```
- [ ] Logged in at `https://YOUR-APP-URL` with that admin.

---

## Production / real data

- [ ] **Env:** `NODE_ENV=production`, strong `JWT_SECRET` (≥32 chars), **not** the dev value.
- [ ] **CORS:** `CORS_ORIGIN` set to your frontend URL(s), e.g. `https://your-app.railway.app`
- [ ] **HTTPS:** `REQUIRE_HTTPS=1` if the app is behind HTTPS.
- [ ] **Backups:** Automated DB backups and a tested restore (see [docs/RUNBOOK.md](docs/RUNBOOK.md)).
- [ ] **Email (optional):** `RESEND_API_KEY`, `EMAIL_FROM`, `PASSWORD_RESET_APP_URL` if using guardian/password-reset email.
- [ ] **Monitoring:** At least `GET /health` (and alerting on failure).
- [ ] **Preflight:** Run `npm run preflight` (use `PREFLIGHT_STRICT=1` in CI to fail on weak/missing secrets).

---

## Optional / extending

- [ ] **Classrooms/Subjects:** Run `schema-optional-tables.sql` if you want those tables (migrations may already include them).
- [ ] **SSO:** Follow [docs/SSO_OIDC.md](docs/SSO_OIDC.md) if you want OIDC login.
- [ ] **IoT hardening:** Set `IOT_REQUIRE_DEVICE_AUTH=1`; register devices in the app if using ESP32/IoT.
- [ ] **Operations:** Use [docs/RUNBOOK.md](docs/RUNBOOK.md) for migrate, backup/restore, audit, password reset.

---

## Quick self-check

- Can you open your app URL and log in as admin? **Yes →** deploy and first admin are done.
- Did you run `npm run db:migrate` once in Railway after first deploy? **Yes →** DB is ready.
- Are production env vars set (no dev `.env` in production)? **Yes →** config is ready.
- Run `npm run preflight` with production env (or `PREFLIGHT_STRICT=1` in CI). **Pass →** you’re in good shape.

If all of the above are true, you’re done with the core go-live steps.
