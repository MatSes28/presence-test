import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket, type AttendanceEvent } from '../hooks/useWebSocket';
import { api } from '../api/client';
import styles from './Dashboard.module.css';

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
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [liveEvents, setLiveEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const handleAttendance = useCallback((e: AttendanceEvent) => {
    setLiveEvents((prev) => [e, ...prev].slice(0, 20));
  }, []);

  useWebSocket(handleAttendance);

  useEffect(() => {
    api
      .get<SessionRow[]>('/api/sessions')
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const activeSessions = sessions.filter((s) => s.status === 'active');

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.h1}>Dashboard</h1>
      <p className={styles.muted}>Welcome, {user?.full_name}. Monitor classroom engagement here.</p>

      <section className={styles.section}>
        <h2>Active sessions</h2>
        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : activeSessions.length === 0 ? (
          <p className={styles.muted}>No active sessions. Start one from the Sessions page.</p>
        ) : (
          <ul className={styles.sessionList}>
            {activeSessions.map((s) => (
              <li key={s.id} className={styles.sessionCard}>
                <div>
                  <strong>{s.subject}</strong> — {s.room}
                </div>
                <div className={styles.meta}>
                  {s.faculty_name} · Started {new Date(s.started_at).toLocaleString()}
                </div>
                <Link to={`/attendance/${s.id}`} className={styles.link}>
                  View attendance →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Live attendance feed</h2>
        <p className={styles.muted}>Real-time check-ins from RFID + proximity validation.</p>
        {liveEvents.length === 0 ? (
          <p className={styles.muted}>No recent events. Tap a card at the entry to record.</p>
        ) : (
          <ul className={styles.liveList}>
            {liveEvents.map((e, i) => (
              <li key={`${e.userId}-${e.recorded_at}-${i}`} className={styles.liveItem}>
                <span className={styles.badge}>Present</span>
                <strong>{e.full_name}</strong>
                <span className={styles.time}>
                  {new Date(e.recorded_at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Recent sessions</h2>
        {loading ? null : (
          <ul className={styles.sessionList}>
            {sessions.slice(0, 5).map((s) => (
              <li key={s.id} className={styles.sessionCard}>
                <div>
                  <strong>{s.subject}</strong> — {s.room}
                  <span className={s.status === 'active' ? styles.activeBadge : ''}>
                    {s.status}
                  </span>
                </div>
                <Link to={`/attendance/${s.id}`} className={styles.link}>
                  View report →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
