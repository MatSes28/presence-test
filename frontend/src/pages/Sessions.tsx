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
  start_time: string;
  end_time: string;
  day_of_week: number;
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
      onError: (e: unknown) => {
        const err = e as { message?: string; response?: { data?: { message?: string } } };
        const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to start session';
        alert(msg);
      },
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

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selectedScheduleData = schedList.find((s) => s.id === selectedSchedule);
  const now = new Date();
  const todayDay = now.getDay();
  const ONE_MINUTE_MS = 60 * 1000;
  // Manual start only for today's schedule, and only when scheduled start has passed by at least 1 minute (recovery). Otherwise system is fully time-based/automatic.
  const cannotStartManually = (() => {
    if (!selectedScheduleData) return true;
    if (selectedScheduleData.day_of_week !== todayDay) return true; // not today — sessions auto-create for the schedule's day only
    const [h, m] = String(selectedScheduleData.start_time).split(':').map(Number);
    const startToday = new Date(now);
    startToday.setHours(h ?? 0, m ?? 0, 0, 0);
    const startMs = startToday.getTime();
    const nowMs = now.getTime();
    if (startMs > nowMs) return true; // future — will auto-start
    if (nowMs - startMs < ONE_MINUTE_MS) return true; // at or within 1 min of start — auto-start handles it
    return false;
  })();
  const formatTime = (timeStr: string) => {
    const [h, m] = String(timeStr).split(':').map(Number);
    const h12 = (h ?? 0) % 12 || 12;
    const ampm = (h ?? 0) < 12 ? 'AM' : 'PM';
    return `${h12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Class sessions</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Sessions start and end automatically at the scheduled times. Manual start is only for starting early when the scheduled time has already passed and no session exists yet.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start a session manually</CardTitle>
          <CardDescription>Only use this when a class should have started already (same day) and no session is active yet. Sessions normally start automatically at their scheduled time.</CardDescription>
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
                  {s.subject} — {s.room} ({DAYS[s.day_of_week]} {formatTime(s.start_time)})
                </option>
              ))}
            </Select>
            <Button
              type="button"
              onClick={startSession}
              disabled={startMutation.isPending || !selectedSchedule || cannotStartManually}
            >
              {startMutation.isPending ? 'Starting…' : 'Start session'}
            </Button>
          </div>
          {cannotStartManually && selectedScheduleData && (
            <p className="mt-3 text-sm text-[var(--warning)]" role="alert">
              {selectedScheduleData.day_of_week === todayDay
                ? `This class is at ${formatTime(selectedScheduleData.start_time)}. It will start automatically at that time. Manual start is only for recovery after the scheduled time has passed (and no session exists).`
                : `This schedule is for ${DAYS[selectedScheduleData.day_of_week]}. Sessions start automatically on that day; manual start is only for today's schedule (recovery).`}
            </p>
          )}
        </CardContent>
      </Card>

      {scheduled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scheduled (upcoming)</CardTitle>
            <CardDescription>These sessions will start automatically at the time shown. The server checks every minute.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {scheduled.slice(0, 10).map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <strong>{s.subject}</strong> — {s.room}
                  <span className="text-xs text-[var(--text-muted)]">
                    Auto-starts at {new Date(s.started_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {s.faculty_name}
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
