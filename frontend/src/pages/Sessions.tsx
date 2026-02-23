import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import styles from './Sessions.module.css';

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
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<SessionRow[]>('/api/sessions'),
      api.get<ScheduleOption[]>('/api/schedules'),
    ])
      .then(([sess, sched]) => {
        setSessions(sess);
        setSchedules(sched);
        if (sched.length && !selectedSchedule) setSelectedSchedule(sched[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function startSession() {
    if (!selectedSchedule) return;
    setStarting(true);
    try {
      await api.post('/api/sessions/start', { schedule_id: selectedSchedule });
      const list = await api.get<SessionRow[]>('/api/sessions');
      setSessions(list);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function endSession(sessionId: string) {
    try {
      await api.post('/api/sessions/end', { session_id: sessionId });
      const list = await api.get<SessionRow[]>('/api/sessions');
      setSessions(list);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  const active = sessions.filter((s) => s.status === 'active');

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Class sessions</h1>
      <p className={styles.muted}>Start and end sessions for attendance recording.</p>

      <section className={styles.section}>
        <h2>Start a session</h2>
        <div className={styles.formRow}>
          <select
            value={selectedSchedule}
            onChange={(e) => setSelectedSchedule(e.target.value)}
            className={styles.select}
          >
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject} — {s.room}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={startSession}
            disabled={starting || !selectedSchedule}
            className={styles.button}
          >
            {starting ? 'Starting…' : 'Start session'}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Active sessions</h2>
        {active.length === 0 ? (
          <p className={styles.muted}>No active sessions.</p>
        ) : (
          <ul className={styles.list}>
            {active.map((s) => (
              <li key={s.id} className={styles.card}>
                <div>
                  <strong>{s.subject}</strong> — {s.room}
                </div>
                <div className={styles.meta}>{s.faculty_name} · Started {new Date(s.started_at).toLocaleString()}</div>
                <div className={styles.actions}>
                  <Link to={`/attendance/${s.id}`} className={styles.link}>View attendance</Link>
                  <button type="button" onClick={() => endSession(s.id)} className={styles.endBtn}>
                    End session
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Recent sessions</h2>
        <ul className={styles.list}>
          {sessions.slice(0, 15).map((s) => (
            <li key={s.id} className={styles.card}>
              <div>
                <strong>{s.subject}</strong> — {s.room}
                <span className={s.status === 'active' ? styles.badgeActive : styles.badgeEnded}>
                  {s.status}
                </span>
              </div>
              <div className={styles.meta}>
                {new Date(s.started_at).toLocaleString()}
                {s.ended_at && ` – ${new Date(s.ended_at).toLocaleString()}`}
              </div>
              <Link to={`/attendance/${s.id}`} className={styles.link}>View report</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
