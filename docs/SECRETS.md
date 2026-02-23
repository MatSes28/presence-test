# Secrets management (production)

For world-class and ISO-oriented deployments, avoid storing secrets only in environment variables. This document describes options and best practices.

---

## Current state

- **JWT_SECRET**, **DATABASE_URL**, **RESEND_API_KEY**, and other secrets are read from `process.env`.
- In production, the app warns if `JWT_SECRET` is missing, default, or shorter than 32 characters.
- Env vars are suitable for small teams and platforms (e.g. Railway Variables); they are not ideal for strict compliance or multi-environment rotation.

---

## Recommendations

### 1. Use your platform’s secret store

- **Railway:** Use [Variables](https://docs.railway.app/develop/variables) and mark sensitive ones as secret (they are not shown in UI after set). Prefer linking a PostgreSQL service for `DATABASE_URL` instead of pasting the URL.
- **AWS:** Use [Secrets Manager](https://aws.amazon.com/secrets-manager/) or **SSM Parameter Store**; inject at deploy time or fetch at startup.
- **Vercel / Netlify:** Use built-in environment secrets; avoid committing `.env` files.

### 2. Rotate secrets

- Change **JWT_SECRET** periodically (e.g. yearly); all existing sessions will be invalidated unless you support multiple valid secrets during a transition.
- Rotate **DATABASE_URL** (password) in the database and update the app’s config; restart or reload.
- Rotate **RESEND_API_KEY** in the Resend dashboard and update the app.

### 3. Never commit secrets

- Keep `.env` in `.gitignore`; use `.env.example` with placeholder names only (no real values).
- In CI/CD, inject secrets from the pipeline or a vault; do not log or echo them.

### 4. Optional: fetch secrets at startup

For stricter setups, the app can load secrets from a vault (e.g. AWS Secrets Manager, HashiCorp Vault) before starting the server: fetch, set `process.env`, then require the rest of the app. This requires custom startup code and network access to the vault from the app’s runtime.

---

## Summary

- Prefer the **platform’s secret store** (Railway Variables, AWS Secrets Manager, etc.) over plain env files in production.
- **Rotate** JWT and DB credentials on a schedule; document the procedure in your runbook.
- See [RUNBOOK.md](RUNBOOK.md) for revoking sessions (e.g. by rotating JWT_SECRET).
