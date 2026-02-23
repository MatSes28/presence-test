import { Resend } from 'resend';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';

function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  return new Resend(env.RESEND_API_KEY);
}

/** Log a notification and send via Resend when RESEND_API_KEY and EMAIL_FROM are set. */
export async function notifyGuardian(params: {
  userId: string;
  sessionId?: string;
  recipientEmail: string;
  studentName: string;
  kind?: string;
}): Promise<void> {
  const { userId, sessionId, recipientEmail, studentName, kind = 'attendance' } = params;
  const payload = { studentName, sessionId, at: new Date().toISOString() };
  let status: 'sent' | 'failed' = 'sent';
  const resend = getResendClient();
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: recipientEmail,
        subject: `Attendance: ${studentName}`,
        html: `<p>${studentName} was recorded as present${sessionId ? ` for session ${sessionId}` : ''} at ${payload.at}.</p>`,
      });
      if (error) {
        status = 'failed';
        console.error('[notifyGuardian] Resend error:', error);
      }
    } catch (err) {
      status = 'failed';
      console.error('[notifyGuardian] Resend send failed:', err);
    }
  }
  await pool.query(
    `INSERT INTO email_notifications (user_id, session_id, kind, recipient, status, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [userId, sessionId ?? null, kind, recipientEmail, status, JSON.stringify(payload)]
  );
}

/** Send password reset email with link (token in URL). Uses Resend when RESEND_API_KEY and EMAIL_FROM are set. */
export async function sendPasswordResetEmail(params: {
  email: string;
  fullName: string;
  resetLink: string;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.email,
      subject: 'Reset your password',
      html: `<p>Hi ${params.fullName},</p><p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${params.resetLink}">${params.resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    });
    return !error;
  } catch (err) {
    console.error('[sendPasswordResetEmail]', err);
    return false;
  }
}

/** Load guardian_email for a user (student). */
export async function getGuardianEmail(userId: string): Promise<string | null> {
  const r = await pool.query(
    'SELECT guardian_email FROM users WHERE id = $1 AND role = $2',
    [userId, 'student']
  );
  const email = r.rows[0]?.guardian_email;
  return email && String(email).trim() ? String(email).trim() : null;
}

/** Send behavior/attendance alert to guardian (at-risk student). Uses Resend when configured. */
export async function sendBehaviorAlertEmail(params: {
  recipientEmail: string;
  studentName: string;
  attendanceRate: number;
  level: string;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.recipientEmail,
      subject: `Attendance notice: ${params.studentName}`,
      html: `<p>This is an automated notice about ${params.studentName}'s attendance.</p>
        <p>Current attendance rate: <strong>${params.attendanceRate.toFixed(1)}%</strong> (level: ${params.level}).</p>
        <p>Please check with the school for support and next steps.</p>`,
    });
    return !error;
  } catch (err) {
    console.error('[sendBehaviorAlertEmail]', err);
    return false;
  }
}

/** Record a behavior alert in email_notifications (for cooldown and audit). */
export async function recordBehaviorAlert(params: {
  userId: string;
  recipientEmail: string;
  status: 'sent' | 'failed';
  payload: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO email_notifications (user_id, session_id, kind, recipient, status, payload)
     VALUES ($1, NULL, 'behavior_alert', $2, $3, $4::jsonb)`,
    [params.userId, params.recipientEmail, params.status, JSON.stringify(params.payload)]
  );
}
