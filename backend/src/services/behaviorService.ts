import { pool } from '../db/pool.js';

/** Attendance rate = (Present + 0.5 * Late) / TotalSessions * 100. */
export async function getBehaviorConfig(): Promise<{
  gracePeriodMinutes: number;
  lateCutoffPct: number;
  thresholdExcellentMin: number;
  thresholdGoodMin: number;
  thresholdWarningMin: number;
  criticalBelow: number;
  alertCooldownDays: number;
}> {
  const rows = await pool.query('SELECT key, value FROM behavior_config');
  const map: Record<string, number> = {};
  for (const r of rows.rows) {
    const v = r.value;
    map[r.key] = typeof v === 'number' ? v : parseInt(String(v), 10) || 0;
  }
  return {
    gracePeriodMinutes: map.grace_period_minutes ?? 10,
    lateCutoffPct: map.late_cutoff_pct ?? 60,
    thresholdExcellentMin: map.threshold_excellent_min ?? 90,
    thresholdGoodMin: map.threshold_good_min ?? 80,
    thresholdWarningMin: map.threshold_warning_min ?? 70,
    criticalBelow: map.critical_below ?? 70,
    alertCooldownDays: map.alert_cooldown_days ?? 7,
  };
}

export type BehaviorLevel = 'excellent' | 'good' | 'warning' | 'critical';

export function getLevelFromRate(rate: number, config: Awaited<ReturnType<typeof getBehaviorConfig>>): BehaviorLevel {
  if (rate >= config.thresholdExcellentMin) return 'excellent';
  if (rate >= config.thresholdGoodMin) return 'good';
  if (rate >= config.thresholdWarningMin) return 'warning';
  return 'critical';
}

/** Per-student attendance summary over sessions (for a subject/schedule or all). */
export async function getStudentAttendanceSummary(
  userId: string,
  options?: { scheduleId?: string; from?: string; to?: string }
): Promise<{
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendanceRate: number;
  level: BehaviorLevel;
}> {
  const config = await getBehaviorConfig();
  const from = options?.from ?? new Date(0).toISOString();
  const to = options?.to ?? new Date().toISOString();

  const sessionsQuery = options?.scheduleId
    ? `SELECT cs.id FROM class_sessions cs
       WHERE cs.schedule_id = $1 AND cs.started_at BETWEEN $2 AND $3`
    : `SELECT cs.id FROM class_sessions cs
       JOIN schedules s ON s.id = cs.schedule_id
       WHERE cs.started_at BETWEEN $1 AND $2`;
  const sessionParams = options?.scheduleId ? [options.scheduleId, from, to] : [from, to];
  const sessions = await pool.query(sessionsQuery, sessionParams);
  const totalSessions = sessions.rows.length;
  if (totalSessions === 0) {
    return {
      totalSessions: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      attendanceRate: 100,
      level: 'excellent',
    };
  }

  const sessionIds = sessions.rows.map((r: { id: string }) => r.id);
  const events = await pool.query(
    `SELECT attendance_status FROM attendance_events WHERE user_id = $1 AND session_id = ANY($2::uuid[])`,
    [userId, sessionIds]
  );
  let presentCount = 0;
  let lateCount = 0;
  for (const e of events.rows) {
    if (e.attendance_status === 'late') lateCount++;
    else if (e.attendance_status === 'present') presentCount++;
    // 'absent' or other: count as absent for rate
  }
  const absentCount = totalSessions - presentCount - lateCount;
  const attendanceRate = totalSessions === 0 ? 100 : ((presentCount + 0.5 * lateCount) / totalSessions) * 100;
  const level = getLevelFromRate(attendanceRate, config);

  return {
    totalSessions,
    presentCount,
    lateCount,
    absentCount,
    attendanceRate: Math.round(attendanceRate * 100) / 100,
    level,
  };
}

/** Check if we should send alert (critical + 7-day cooldown). */
export async function shouldSendBehaviorAlert(userId: string): Promise<boolean> {
  const config = await getBehaviorConfig();
  const summary = await getStudentAttendanceSummary(userId);
  if (summary.level !== 'critical') return false;
  const recent = await pool.query(
    `SELECT 1 FROM email_notifications
     WHERE user_id = $1 AND kind = 'behavior_alert' AND sent_at > NOW() - INTERVAL '1 day' * $2`,
    [userId, config.alertCooldownDays]
  );
  return recent.rows.length === 0;
}

/** Get list of at-risk (critical) student IDs with summary for sending alerts. */
export async function getAtRiskStudentsForAlerts(): Promise<
  Array<{ userId: string; full_name: string; attendanceRate: number; level: string }>
> {
  const students = await pool.query(
    `SELECT id, full_name FROM users WHERE role = 'student' ORDER BY full_name`
  );
  const result: Array<{ userId: string; full_name: string; attendanceRate: number; level: string }> = [];
  for (const s of students.rows) {
    const summary = await getStudentAttendanceSummary(s.id);
    if (summary.level === 'critical' && summary.totalSessions >= 1) {
      result.push({
        userId: s.id,
        full_name: s.full_name,
        attendanceRate: summary.attendanceRate,
        level: summary.level,
      });
    }
  }
  return result;
}
