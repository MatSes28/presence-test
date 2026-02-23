import { pool } from '../db/pool.js';

export type AuditAction =
  | 'auth_login'
  | 'auth_logout'
  | 'attendance_report_view'
  | 'attendance_export_csv'
  | 'user_create'
  | 'user_bulk_import'
  | 'user_delete'
  | 'schedule_create'
  | 'session_start'
  | 'session_end'
  | 'iot_device_create'
  | 'iot_device_update'
  | 'iot_device_delete';

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/** Log an audit event. Non-blocking; failures are logged to console only. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, actor_email, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress ?? null,
      ]
    );
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}

/** Get client IP from request (respects X-Forwarded-For when behind proxy). */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedStr) {
    const first = String(forwardedStr).split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers['x-real-ip'];
  const realStr = Array.isArray(real) ? real[0] : real;
  if (realStr) return String(realStr);
  return req.socket?.remoteAddress ?? null;
}
