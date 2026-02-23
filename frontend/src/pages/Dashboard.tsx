import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useWebSocket, type AttendanceEvent } from '../hooks/useWebSocket';
import { queryKeys, fetchSessions, fetchAtRisk } from '../api/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

interface SessionRow {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
  started_at: string;
  status: string;
  faculty_name: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [liveEvents, setLiveEvents] = useState<AttendanceEvent[]>([]);
  const { data: sessions = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.sessions,
    queryFn: fetchSessions,
  });
  const { data: atRiskData } = useQuery({
    queryKey: queryKeys.atRisk,
    queryFn: fetchAtRisk,
  });

  const handleAttendance = useCallback((e: AttendanceEvent) => {
    setLiveEvents((prev) => [e, ...prev].slice(0, 20));
  }, []);

  useWebSocket(handleAttendance);

  const activeSessions = (sessions as SessionRow[]).filter((s) => s.status === 'active');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Welcome, {user?.full_name}. Monitor classroom engagement here.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Sessions currently open for attendance.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-[var(--text-muted)]">Loading…</p>
          ) : activeSessions.length === 0 ? (
            <p className="text-[var(--text-muted)]">No active sessions. Start one from the Sessions page.</p>
          ) : (
            <ul className="space-y-2">
              {activeSessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <div>
                    <strong>{s.subject}</strong> — {s.room}
                    <div className="text-sm text-[var(--text-muted)]">{s.faculty_name} · Started {new Date(s.started_at).toLocaleString()}</div>
                  </div>
                  <Link to={`/attendance/${s.id}`} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
                    View attendance →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live attendance feed</CardTitle>
          <CardDescription>Real-time check-ins from RFID + proximity validation.</CardDescription>
        </CardHeader>
        <CardContent>
          {liveEvents.length === 0 ? (
            <p className="text-[var(--text-muted)]">No recent events. Tap a card at the entry to record.</p>
          ) : (
            <ul className="space-y-2">
              {liveEvents.map((e, i) => (
                <li key={`${e.userId}-${e.recorded_at}-${i}`} className="flex items-center gap-3 p-2 rounded border border-[var(--border)]">
                  <span className={`text-xs px-2 py-0.5 rounded ${e.attendanceStatus === 'late' ? 'bg-[var(--warning)]/20 text-[var(--warning)]' : 'bg-[var(--success)]/20 text-[var(--success)]'}`}>
                    {e.attendanceStatus === 'late' ? 'Late' : 'Present'}
                  </span>
                  <strong>{e.full_name}</strong>
                  <span className="text-sm text-[var(--text-muted)] ml-auto">{new Date(e.recorded_at).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {atRiskData && atRiskData.atRisk.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>At risk (attendance &lt; {atRiskData.config.criticalBelow}%)</CardTitle>
            <CardDescription>Students with critical attendance level.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {atRiskData.atRisk.map((s) => (
                <li key={s.userId} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)]">
                  <strong>{s.full_name}</strong>
                  <span className="text-sm text-[var(--text-muted)]">{s.email}</span>
                  <span className="ml-auto font-mono text-[var(--error)]">{s.attendanceRate.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>Latest class sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? null : (
            <ul className="space-y-2">
              {sessions.slice(0, 5).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <div>
                    <strong>{s.subject}</strong> — {s.room}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${s.status === 'active' ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--text-muted)]/20'}`}>{s.status}</span>
                  </div>
                  <Link to={`/attendance/${s.id}`} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
                    View report →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
