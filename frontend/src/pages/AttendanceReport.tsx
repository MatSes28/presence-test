import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import styles from './AttendanceReport.module.css';

interface SessionInfo {
  id: string;
  subject: string;
  room: string;
  started_at: string;
  ended_at: string | null;
  status: string;
}

interface AttendanceRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  recorded_at: string;
  proximity_valid: boolean;
  distance_cm: number | null;
  attendance_status?: string;
}

interface SessionStats {
  presentCount: number;
  lateCount: number;
  totalRecorded: number;
}

interface Report {
  session: SessionInfo;
  attendance: AttendanceRow[];
}

export default function AttendanceReport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      api.get<Report>(`/api/attendance/reports/session/${sessionId}`),
      api.get<SessionStats>(`/api/attendance/session/${sessionId}/stats`).catch(() => null),
    ]).then(([r, s]) => {
      setReport(r);
      setStats(s ?? null);
    }).finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (!report) return <p className={styles.muted}>Report not found.</p>;

  const { session, attendance } = report;

  function exportCsv() {
    const token = (() => {
      try {
        const raw = localStorage.getItem('clirdec_auth');
        return raw ? JSON.parse(raw).token : null;
      } catch {
        return null;
      }
    })();
    if (!token) return;
    fetch(`/api/attendance/reports/session/${sessionId}/export?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Export failed');
        return r.text();
      })
      .then((text) => {
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-${session.subject.replace(/\s+/g, '-')}-${session.room}-${session.id.slice(0, 8)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Export failed'));
  }

  return (
    <div className={styles.page}>
      <Link to="/sessions" className={styles.back}>← Sessions</Link>
      <h1 className={styles.h1}>Attendance report</h1>
      <div className={styles.sessionInfo}>
        <strong>{session.subject}</strong> — {session.room}
        <span className={session.status === 'active' ? styles.badgeActive : styles.badgeEnded}>
          {session.status}
        </span>
        <div className={styles.meta}>
          Started: {new Date(session.started_at).toLocaleString()}
          {session.ended_at && ` · Ended: ${new Date(session.ended_at).toLocaleString()}`}
        </div>
        {stats && (
          <div className={styles.stats}>
            <span>Present: <strong>{stats.presentCount}</strong></span>
            <span>Late: <strong>{stats.lateCount}</strong></span>
            <span>Total recorded: <strong>{stats.totalRecorded}</strong></span>
          </div>
        )}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Recorded attendance ({attendance.length})</h2>
          <button type="button" onClick={exportCsv} className={styles.exportBtn}>
            Export CSV
          </button>
        </div>
        {attendance.length === 0 ? (
          <p className={styles.muted}>No attendance recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Distance (cm)</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td>{a.full_name}</td>
                    <td>{a.email}</td>
                    <td><span className={a.attendance_status === 'late' ? styles.statusLate : styles.statusPresent}>{a.attendance_status === 'late' ? 'Late' : 'Present'}</span></td>
                    <td>{new Date(a.recorded_at).toLocaleTimeString()}</td>
                    <td>{a.distance_cm != null ? a.distance_cm : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
