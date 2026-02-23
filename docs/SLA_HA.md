# SLA and high availability

Guidance for target availability and running CLIRDEC:PRESENCE in a high-availability setup.

---

## Target availability (SLA)

- **Department / pilot:** Single instance is often sufficient; target **99%** uptime (e.g. ~7.5 hours downtime/year).
- **Campus-wide:** Use managed DB, health checks, and automated backups; target **99.5%** (~44 hours/year) or **99.9%** (~8.7 hours/year).
- **World-class / 24/7:** Document a formal SLA (e.g. 99.9% or 99.95%); use multiple app instances behind a load balancer and managed PostgreSQL with failover.

Document your chosen target in operations and in runbooks (e.g. [RUNBOOK.md](RUNBOOK.md)).

---

## High availability (HA)

### Single instance (current)

- One Node.js process; one PostgreSQL database.
- **Downtime:** Deploys, restarts, and DB maintenance cause brief unavailability.
- **Suitable for:** Department or pilot.

### Multi-instance (recommended for campus-wide+)

1. **Load balancer:** Put two or more app instances behind a load balancer (e.g. Railway replicas, AWS ALB, nginx).
2. **Stateless app:** The app is stateless; sessions are JWT in HTTP-only cookies. No in-memory session store, so any instance can serve any request.
3. **Sticky sessions (optional):** If you use WebSockets (live attendance feed), consider sticky sessions so the same client hits the same instance, or use a shared Redis adapter for Socket.IO if you switch to it later.
4. **Database:** Use a **managed PostgreSQL** with failover (e.g. Railway, AWS RDS Multi-AZ, Supabase). Avoid a single self-hosted DB for HA.
5. **Migrations:** Run `npm run db:migrate` once (from a single process or CI) before or after rolling out new app code; avoid concurrent migration runs.

### Read replicas (optional, future)

- For very high read load, add read replicas and direct read-only queries to a replica. This requires code changes to use a separate read pool; not implemented in the current codebase.

---

## Health and monitoring

- **Health endpoint:** `GET /health` returns `{ status, service, database }`; returns **503** when the database is down.
- **Use:** Configure your load balancer or orchestrator to use `/health` for liveness/readiness. Set up alerting on 5xx or repeated health failures.
- **Logging:** Use structured logging (see `backend/src/lib/logger.ts`) and ship logs to your monitoring stack (e.g. Datadog, Grafana, CloudWatch).

---

## Summary

- Define a **target SLA** (e.g. 99.5%) and document it.
- For **HA:** Multiple app instances behind a load balancer + managed PostgreSQL with failover.
- Use **GET /health** for probes and alerting; keep backups and runbooks up to date.
