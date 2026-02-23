import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys, fetchSessions, fetchSchedules } from '../api/queries';
import { Button, buttonVariants } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { cn } from '../lib/utils';

interface SessionRow {
  id: string;
  schedule_id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  faculty_name: string;
}

interface ScheduleOption {
  id: string;
  subject: string;
  room: string;
  faculty_name?: string;
}

export default function Sessions() {
  const queryClient = useQueryClient();
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const { data: sessions = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.sessions,
    queryFn: fetchSessions,
  });
  const { data: schedules = [] } = useQuery({
    queryKey: queryKeys.schedules,
    queryFn: fetchSchedules,
  });
  const schedList = schedules as ScheduleOption[];
  const sessList = sessions as SessionRow[];
  useEffect(() => {
    if (schedList.length && !selectedSchedule) setSelectedSchedule(schedList[0].id);
  }, [schedList.length]);

  const startMutation = useMutation({
    mutationFn: (schedule_id: string) => api.post('/api/sessions/start', { schedule_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
  const endMutation = useMutation({
    mutationFn: (session_id: string) => api.post('/api/sessions/end', { session_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });

  function startSession() {
    if (!selectedSchedule) return;
    startMutation.mutate(selectedSchedule, {
      onError: (e) => alert((e as Error).message),
    });
  }

  function endSession(sessionId: string) {
    endMutation.mutate(sessionId, {
      onError: (e) => alert((e as Error).message),
    });
  }

  if (loading) return <p className="text-[var(--text-muted)]">Loading…</p>;

  const active = sessList.filter((s) => s.status === 'active');
  const scheduled = sessList.filter((s) => s.status === 'scheduled');
  const statusLabel = (status: string) => (status === 'scheduled' ? 'Scheduled' : status === 'active' ? 'Active' : 'Completed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Class sessions</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Scheduled sessions auto-activate at start time and auto-complete at end time. You can also start or end sessions manually.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start a session</CardTitle>
          <CardDescription>Choose a schedule and start recording attendance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={selectedSchedule}
              onChange={(e) => setSelectedSchedule(e.target.value)}
              className="min-w-[240px]"
            >
              {schedList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject} — {s.room}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              onClick={startSession}
              disabled={startMutation.isPending || !selectedSchedule}
            >
              {startMutation.isPending ? 'Starting…' : 'Start session'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {scheduled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scheduled (upcoming)</CardTitle>
            <CardDescription>These sessions will activate automatically at their start time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {scheduled.slice(0, 10).map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <strong>{s.subject}</strong> — {s.room}
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(s.started_at).toLocaleString()} · {s.faculty_name}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Live sessions: dashboard and ESP32 accept taps now.</CardDescription>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-[var(--text-muted)]">No active sessions.</p>
          ) : (
            <ul className="space-y-2">
              {active.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <div>
                    <strong>{s.subject}</strong> — {s.room}
                    <div className="text-sm text-[var(--text-muted)]">{s.faculty_name} · Started {new Date(s.started_at).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/attendance/${s.id}`} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
                      View attendance
                    </Link>
                    <Button type="button" variant="destructive" size="sm" onClick={() => endSession(s.id)}>
                      End session
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>Latest class sessions and reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {sessList.slice(0, 15).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                <div>
                  <strong>{s.subject}</strong> — {s.room}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${s.status === 'active' ? 'bg-[var(--success)]/20 text-[var(--success)]' : s.status === 'scheduled' ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--text-muted)]/20'}`}>
                    {statusLabel(s.status)}
                  </span>
                  <div className="text-sm text-[var(--text-muted)]">
                    {new Date(s.started_at).toLocaleString()}
                    {s.ended_at && ` – ${new Date(s.ended_at).toLocaleString()}`}
                  </div>
                </div>
                <Link to={`/attendance/${s.id}`} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
                  View report
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
