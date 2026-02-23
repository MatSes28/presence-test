import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './Schedules.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ScheduleRow {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  faculty_id: string;
  faculty_name: string;
}

interface UserOption {
  id: string;
  full_name: string;
  role: string;
}

export default function Schedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [faculty, setFaculty] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    subject: '',
    room: '',
    start_time: '08:00',
    end_time: '09:00',
    day_of_week: 1,
    faculty_id: '',
  });

  useEffect(() => {
    setError(null);
    Promise.all([
      api.get<ScheduleRow[]>('/api/schedules'),
      api.get<UserOption[]>('/api/users'),
    ])
      .then(([sched, users]) => {
        setSchedules(sched);
        const facultyList = users.filter((u) => u.role === 'faculty' || u.role === 'admin');
        setFaculty(facultyList);
        if (facultyList.length && !form.faculty_id) setForm((f) => ({ ...f, faculty_id: facultyList[0].id }));
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Request failed';
        setError(msg.includes('fetch') || msg.includes('Failed') ? 'Cannot reach server. Start the app with: npm run dev (backend must run on port 3001).' : msg);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (user?.role !== 'admin') return;
    try {
      await api.post('/api/schedules', form);
      const list = await api.get<ScheduleRow[]>('/api/schedules');
      setSchedules(list);
      setForm({ subject: '', room: '', start_time: '08:00', end_time: '09:00', day_of_week: 1, faculty_id: form.faculty_id });
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Schedules</h1>
      <p className={styles.muted}>Class schedule configuration (admin can add).</p>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {user?.role === 'admin' && (
        <section className={styles.section}>
          <h2>Add schedule</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              placeholder="Subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
              className={styles.input}
            />
            <input
              placeholder="Room"
              value={form.room}
              onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              required
              className={styles.input}
            />
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className={styles.input}
            />
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              className={styles.input}
            />
            <select
              value={form.day_of_week}
              onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
              className={styles.select}
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
            <select
              value={form.faculty_id}
              onChange={(e) => setForm((f) => ({ ...f, faculty_id: e.target.value }))}
              className={styles.select}
            >
              {faculty.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
            <button type="submit" className={styles.button}>Add</button>
          </form>
        </section>
      )}

      <section className={styles.section}>
        <h2>All schedules</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Room</th>
                <th>Day</th>
                <th>Time</th>
                <th>Faculty</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.subject}</td>
                  <td>{s.room}</td>
                  <td>{DAYS[s.day_of_week]}</td>
                  <td>{s.start_time} – {s.end_time}</td>
                  <td>{s.faculty_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
