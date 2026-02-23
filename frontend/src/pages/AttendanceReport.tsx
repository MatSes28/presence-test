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
}

interface Report {
  session: SessionInfo;
  attendance: AttendanceRow[];
}

export default function AttendanceReport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    api
      .get<Report>(`/api/attendance/reports/session/${sessionId}`)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (!report) return <p className={styles.muted}>Report not found.</p>;

  const { session, attendance } = report;

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
      </div>

      <section className={styles.section}>
        <h2>Recorded attendance ({attendance.length})</h2>
        {attendance.length === 0 ? (
          <p className={styles.muted}>No attendance recorded yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Time</th>
                  <th>Distance (cm)</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td>{a.full_name}</td>
                    <td>{a.email}</td>
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
