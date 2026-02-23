# ISO alignment (informational)

This document is an **informational assessment** of how CLIRDEC:PRESENCE aligns with common ISO standards relevant to an attendance and student-data system. It does **not** constitute a formal compliance claim or certification. ISO certification requires an accredited audit.

---

## Relevant standards

| Standard | Scope | Relevance |
|----------|--------|-----------|
| **ISO/IEC 27001** | Information security management (ISMS) | Access control, cryptography, logging, asset handling |
| **ISO/IEC 29100** | Privacy framework | Handling of personal data (students, faculty, guardians) |
| **ISO 8601** | Date and time format | Timestamps in APIs and storage |
| **ISO 9241-110 / 143 / 171** | Usability and accessibility (UI, forms, dialogue) | Spacing, login/logout behaviour, touch targets — see [ISO_UI.md](ISO_UI.md) |

---

## Current alignment

### ISO 8601 (dates and times)

- **Aligned.** Timestamps use `toISOString()` (e.g. in attendance, notifications, session service). Stored as `TIMESTAMPTZ` in PostgreSQL. API and logs use ISO 8601-style UTC.

### ISO/IEC 27001–oriented controls

| Control area | Current state |
|--------------|----------------|
| **Access control** | Role-based access (admin, faculty, student); JWT + HTTP-only cookie; `requireRoles()` on protected routes. |
| **Cryptography** | Passwords hashed with bcrypt; IoT API keys stored as bcrypt hash; JWT for sessions. No plaintext passwords or API keys in DB. |
| **Communication security** | TLS/HTTPS is deployment responsibility (e.g. Railway, reverse proxy). App sets `secure: true` on cookies in production. |
| **Rate limiting** | `express-rate-limit` on API and stricter limits on auth endpoints to reduce brute force. |
| **Security headers** | Helmet middleware enabled (CSP disabled for compatibility; can be tightened). |
| **Input validation** | Zod schemas on auth, IoT, and other key inputs; parameterized SQL (no raw concatenation). |

### ISO/IEC 29100–oriented (privacy)

| Aspect | Current state |
|--------|----------------|
| **Personal data** | Students, faculty, guardians (email, name, guardian_email); attendance events. |
| **Purpose** | Attendance and classroom engagement; guardian notifications. |
| **Access** | Limited by role; audit_log records auth, user/session/schedule changes, report views, exports. |
| **Retention** | Audit log purged per `AUDIT_RETENTION_DAYS`; organizational policy for other data. |
| **Consent / legal basis** | Not implemented in-app; would be policy and possibly UI/consent flows. |

---

## Addressed (implemented)

- **Audit logging:** `audit_log` table and `auditService` log auth (login/logout), attendance report view, CSV export, user create, schedule create, session start/end, IoT device create/update/delete, user delete, bulk import. Actor, action, resource, IP (when available) are recorded.
- **CORS:** In production, set `CORS_ORIGIN` (comma-separated) to restrict allowed origins; unset = allow any (dev).
- **HTTPS:** Set `REQUIRE_HTTPS=1` in production to reject non-HTTPS requests (when behind a proxy that sets `X-Forwarded-Proto`).
- **JWT secret:** On startup in production, a warning is logged if `JWT_SECRET` is missing, default, or &lt; 32 characters.
- **Privacy notice:** Public `/privacy` page describes purpose, data, access, retention, and rights; linked from login and layout.
- **IoT device authentication:** Set `IOT_REQUIRE_DEVICE_AUTH=1` to require `device_id` and API key on `/api/iot/attendance`; device registry and key hashing are implemented.
- **Data retention:** `AUDIT_RETENTION_DAYS` (default 365) purges old audit_log entries via cron; set to `0` to disable.
- **Right to erasure:** `DELETE /api/users/:id` (admin) removes user and related data (attendance, RFID, etc.) with audit; faculty with schedules must be reassigned first.
- **Secrets:** See [SECRETS.md](SECRETS.md) for guidance on using a secrets manager in production.

## Remaining gaps (for ISO-oriented improvement)

1. **Secrets management**  
   For higher assurance, use a secrets manager or vault (see [SECRETS.md](SECRETS.md)); avoid default values in production (warning only today).

---

## Summary

- **ISO 8601:** Met for date/time representation.
- **ISO/IEC 27001:** Partially aligned: access control, hashing, rate limiting, headers, validation, **audit logging**, **CORS config**, **HTTPS check**, **JWT secret warning**, **IoT device auth** (optional via env), **retention**. Remaining: secrets manager (see SECRETS.md).
- **ISO/IEC 29100:** Partial: personal data with access control, **privacy notice**, **retention** (audit purge), **right to erasure** (user deletion with audit).

**Conclusion:** The system implements controls that support ISO 27001 and 29100 objectives, including audit logging, privacy notice, retention, user deletion, and optional IoT device auth. UI and interaction follow ISO 9241–oriented practices (spacing, login/logout, touch targets) as described in [ISO_UI.md](ISO_UI.md). This does **not** constitute formal certification; that would require an accredited audit.
