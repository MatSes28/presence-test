# ISO alignment (informational)

This document is an **informational assessment** of how CLIRDEC:PRESENCE aligns with common ISO standards relevant to an attendance and student-data system. It does **not** constitute a formal compliance claim or certification. ISO certification requires an accredited audit.

---

## Relevant standards

| Standard | Scope | Relevance |
|----------|--------|-----------|
| **ISO/IEC 27001** | Information security management (ISMS) | Access control, cryptography, logging, asset handling |
| **ISO/IEC 29100** | Privacy framework | Handling of personal data (students, faculty, guardians) |
| **ISO 8601** | Date and time format | Timestamps in APIs and storage |

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
| **Access** | Limited by role; no in-app audit log of who accessed what. |
| **Retention** | Not defined in code; policy would be organizational. |
| **Consent / legal basis** | Not implemented in-app; would be policy and possibly UI/consent flows. |

---

## Addressed (implemented)

- **Audit logging:** `audit_log` table and `auditService` log auth (login/logout), attendance report view, CSV export, user create, schedule create, session start/end, IoT device create/update/delete. Actor, action, resource, IP (when available) are recorded.
- **CORS:** In production, set `CORS_ORIGIN` (comma-separated) to restrict allowed origins; unset = allow any (dev).
- **HTTPS:** Set `REQUIRE_HTTPS=1` in production to reject non-HTTPS requests (when behind a proxy that sets `X-Forwarded-Proto`).
- **JWT secret:** On startup in production, a warning is logged if `JWT_SECRET` is missing, default, or &lt; 32 characters.
- **Privacy notice:** Public `/privacy` page describes purpose, data, access, retention, and rights; linked from login and layout.
- **IoT device authentication:** Still optional; device registry and API key hashes exist for future enforcement.

## Remaining gaps (for ISO-oriented improvement)

1. **Secrets management**  
   For higher assurance, use a secrets manager or vault; avoid default values in production (warning only today).

2. **Data retention and deletion**  
   No automated retention or right-to-erasure (e.g. delete user and related data); policy and procedures would need to be defined and implemented.

3. **IoT device authentication**  
   `/api/iot/attendance` does not require device authentication; optional hardening could validate device_id and API key.

---

## Summary

- **ISO 8601:** Met for date/time representation.
- **ISO/IEC 27001:** Partially aligned: access control, hashing, rate limiting, headers, validation, **audit logging**, **CORS config**, **HTTPS check**, **JWT secret warning**. Remaining: secrets manager, optional IoT device auth.
- **ISO/IEC 29100:** Partial: personal data with access control, **privacy notice**. Remaining: retention, deletion procedures.

**Conclusion:** The system implements controls that support ISO 27001 and 29100 objectives, including audit logging and a privacy notice. It does **not** constitute formal certification; that would require an accredited audit.
