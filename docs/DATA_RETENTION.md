# Data retention and deletion policy

This document defines recommended retention and purge behavior for CLIRDEC:PRESENCE. Adjust to your institution’s policy.

---

## Current behavior

### Audit log

- **Retention:** `audit_log` entries are purged when older than **AUDIT_RETENTION_DAYS** (default **365**).
- **Schedule:** A cron job runs daily at 3:00 AM and deletes rows where `created_at < NOW() - AUDIT_RETENTION_DAYS`.
- **Disable:** Set `AUDIT_RETENTION_DAYS=0` to disable automatic purge (retain indefinitely).

### User deletion (right to erasure)

- **Endpoint:** `DELETE /api/users/:id` (admin only).
- **Effect:** Removes the user and related data (attendance events, RFID links, email notification records). Audit log retains the deletion event (actor, action, resource).

### Email notifications

- **Table:** `email_notifications` stores sent records (guardian, behavior alerts, password reset).
- **Retention:** No automatic purge. Add a retention policy or periodic cleanup if required (e.g. delete older than 1 year).

---

## Recommended policy (institutional)

1. **Audit log:** Keep at least 1 year (or per compliance); use `AUDIT_RETENTION_DAYS` to enforce.
2. **Attendance events:** Retain per academic policy (e.g. 7 years); no automatic purge in app today.
3. **Backups:** Retain backups per institutional policy; see [RUNBOOK.md](RUNBOOK.md) for backup/restore.
4. **User deletion:** Document who may request deletion and SLA; use `DELETE /api/users/:id` and confirm in audit.

---

## Optional: purge old attendance or email notifications

To add retention for other tables (e.g. `attendance_events` or `email_notifications`), you can:

- Add a cron job that runs a SQL `DELETE` with a date threshold, or
- Use a one-off script and run it periodically (e.g. monthly).

Example (run manually or from a script):

```sql
-- Example: delete email_notifications older than 2 years
DELETE FROM email_notifications WHERE sent_at < NOW() - INTERVAL '2 years';
```

Keep retention rules in this document and in your runbook.
