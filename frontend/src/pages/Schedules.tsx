import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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
  classroom_name?: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  device_id?: string | null;
  iot_device_id?: string | null;
  iot_device_name?: string | null;
}

interface IotDeviceOption {
  device_id: string;
  name: string | null;
}

interface UserOption {
  id: string;
  full_name: string;
  role: string;
}

interface ClassroomOption {
  id: string;
  name: string;
  capacity: number | null;
}
interface SubjectOption {
  id: string;
  code: string;
  name: string;
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
    classroom_id: '' as string,
    subject_id: '' as string,
    device_id: '' as string,
  });
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [iotDevices, setIotDevices] = useState<IotDeviceOption[]>([]);

  useEffect(() => {
    setError(null);
    Promise.all([
      api.get<ScheduleRow[]>('/api/schedules'),
      api.get<UserOption[]>('/api/users'),
      api.get<ClassroomOption[]>('/api/classrooms').catch(() => []),
      api.get<SubjectOption[]>('/api/subjects').catch(() => []),
      api.get<{ device_id: string; name: string | null }[]>('/api/iot/devices').catch(() => []),
    ])
      .then(([sched, users, classList, subjList, devices]) => {
        setSchedules(sched);
        const facultyList = users.filter((u) => u.role === 'faculty' || u.role === 'admin');
        setFaculty(facultyList);
        setClassrooms(classList);
        setSubjects(subjList);
        setIotDevices(devices || []);
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
    const [sh, sm] = form.start_time.split(':').map(Number);
    const [eh, em] = form.end_time.split(':').map(Number);
    const startMins = (sh ?? 0) * 60 + (sm ?? 0);
    const endMins = (eh ?? 0) * 60 + (em ?? 0);
    if (endMins <= startMins) {
      alert('End time must be after start time.');
      return;
    }
    try {
      await api.post('/api/schedules', {
        ...form,
        classroom_id: form.classroom_id || undefined,
        subject_id: form.subject_id || undefined,
        device_id: form.device_id || undefined,
      });
      const list = await api.get<ScheduleRow[]>('/api/schedules');
      setSchedules(list);
      setForm({ subject: '', room: '', start_time: '08:00', end_time: '09:00', day_of_week: 1, faculty_id: form.faculty_id, classroom_id: '', subject_id: '', device_id: '' });
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (loading) return <p className="text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Schedules</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Class schedule configuration (admin can add).</p>
      </div>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Add schedule</CardTitle>
            <CardDescription>Create a new class slot. Sessions auto-start at start time. Assign an IoT device so taps from that device count for this room.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
              <Input
                placeholder="Subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                required
                className="min-w-[140px]"
              />
              <Input
                placeholder="Room"
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                required
                className="min-w-[140px]"
              />
              <Input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                className="min-w-[100px]"
              />
              <Input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                className="min-w-[100px]"
              />
              <Select
                value={form.day_of_week}
                onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
                className="min-w-[100px]"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </Select>
              <Select
                value={form.faculty_id}
                onChange={(e) => setForm((f) => ({ ...f, faculty_id: e.target.value }))}
                className="min-w-[160px]"
              >
                {faculty.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </Select>
              {classrooms.length > 0 && (
                <Select
                  value={form.classroom_id}
                  onChange={(e) => setForm((f) => ({ ...f, classroom_id: e.target.value }))}
                  className="min-w-[140px]"
                >
                  <option value="">Room (optional)</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
              {subjects.length > 0 && (
                <Select
                  value={form.subject_id}
                  onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))}
                  className="min-w-[160px]"
                >
                  <option value="">Subject (optional)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} – {s.name}</option>
                  ))}
                </Select>
              )}
              {iotDevices.length > 0 && (
                <Select
                  value={form.device_id}
                  onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
                  className="min-w-[180px]"
                >
                  <option value="">IoT device (room)</option>
                  {iotDevices.map((d) => (
                    <option key={d.device_id} value={d.device_id}>{d.name || d.device_id}</option>
                  ))}
                </Select>
              )}
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All schedules</CardTitle>
          <CardDescription>Current class slots by day and time.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Room</th>
                <th>Day</th>
                <th>Time</th>
                <th>Faculty</th>
                {iotDevices.length > 0 && <th>IoT device</th>}
                {(classrooms.length > 0 || subjects.length > 0) && <th>Classroom / Subject</th>}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.subject_name ?? s.subject}</td>
                  <td>{s.classroom_name ?? s.room}</td>
                  <td>{DAYS[s.day_of_week]}</td>
                  <td>{s.start_time} – {s.end_time}</td>
                  <td>{s.faculty_name}</td>
                  {iotDevices.length > 0 && <td>{s.iot_device_name || s.device_id || '—'}</td>}
                  {(classrooms.length > 0 || subjects.length > 0) && (
                    <td>{(s.classroom_name || s.subject_code) ? `${s.classroom_name ?? ''} ${s.subject_code ?? ''}`.trim() : '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
