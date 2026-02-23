import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { cn } from '../lib/utils';
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
    <div className="space-y-6">
      <Link to="/sessions" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>← Sessions</Link>
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Attendance report</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{session.subject} — {session.room}</CardTitle>
          <CardDescription>
            <span className={`text-xs px-2 py-0.5 rounded ${session.status === 'active' ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--text-muted)]/20'}`}>{session.status}</span>
            {' · '}Started: {new Date(session.started_at).toLocaleString()}
            {session.ended_at && ` · Ended: ${new Date(session.ended_at).toLocaleString()}`}
          </CardDescription>
        </CardHeader>
        {stats && (
          <CardContent className="pt-0">
            <div className="flex gap-4 text-sm">
              <span>Present: <strong>{stats.presentCount}</strong></span>
              <span>Late: <strong>{stats.lateCount}</strong></span>
              <span>Total recorded: <strong>{stats.totalRecorded}</strong></span>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recorded attendance ({attendance.length})</CardTitle>
            <CardDescription>Check-ins for this session.</CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={exportCsv}>Export CSV</Button>
        </CardHeader>
        <CardContent>
        {attendance.length === 0 ? (
          <p className="text-[var(--text-muted)]">No attendance recorded yet.</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
