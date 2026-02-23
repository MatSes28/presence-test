import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import styles from './Users.module.css';

interface StudentRow {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  card_uid: string | null;
}

export default function Users() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; full_name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [rfidForm, setRfidForm] = useState({ user_id: '', card_uid: '' });
  const [createForm, setCreateForm] = useState({ email: '', password: '', full_name: '', role: 'student' as 'student' | 'faculty' });
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api
      .get<StudentRow[]>('/api/users/students')
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
    if (isAdmin) {
      api.get<{ id: string; email: string; full_name: string; role: string }[]>('/api/users')
        .then(setAllUsers)
        .catch(() => setAllUsers([]));
    }
  }, [isAdmin]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.email || !createForm.password || !createForm.full_name) return;
    setCreating(true);
    try {
      await api.post('/api/users', {
        email: createForm.email,
        password: createForm.password,
        full_name: createForm.full_name,
        role: createForm.role,
      });
      setCreateForm({ email: '', password: '', full_name: '', role: 'student' });
      const list = await api.get<StudentRow[]>('/api/users/students');
      setStudents(list);
      if (isAdmin) {
        const users = await api.get<{ id: string; email: string; full_name: string; role: string }[]>('/api/users');
        setAllUsers(users);
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function linkRfid(e: React.FormEvent) {
    e.preventDefault();
    if (!rfidForm.user_id || !rfidForm.card_uid) return;
    setAdding(true);
    try {
      await api.post('/api/users/rfid', rfidForm);
      const list = await api.get<StudentRow[]>('/api/users/students');
      setStudents(list);
      setRfidForm((f) => ({ ...f, card_uid: '' }));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <p className="text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users & RFID</h1>
      <p className="text-[var(--text-muted)] text-sm">Students and their linked RFID cards for attendance.</p>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Create user (Admin)</CardTitle>
            <CardDescription>Add a new student or faculty account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createUser} className="flex flex-wrap gap-3 items-end">
              <Input
                type="email"
                placeholder="Email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="min-w-[200px]"
              />
              <Input
                type="password"
                placeholder="Password (min 6)"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
                className="min-w-[160px]"
              />
              <Input
                placeholder="Full name"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                required
                className="min-w-[160px]"
              />
              <Select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as 'student' | 'faculty' }))}
                className="min-w-[120px]"
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </Select>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create user'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Link RFID to student</CardTitle>
          <CardDescription>Associate a card UID with a student for attendance.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={linkRfid} className="flex flex-wrap gap-3 items-end">
            <Select
              value={rfidForm.user_id}
              onChange={(e) => setRfidForm((f) => ({ ...f, user_id: e.target.value }))}
              required
              className="min-w-[220px]"
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>
              ))}
            </Select>
            <Input
              placeholder="Card UID (from reader)"
              value={rfidForm.card_uid}
              onChange={(e) => setRfidForm((f) => ({ ...f, card_uid: e.target.value }))}
              required
              className="min-w-[180px]"
            />
            <Button type="submit" disabled={adding}>
              {adding ? 'Linking…' : 'Link card'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>Students and their linked RFID cards.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>RFID UID</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.full_name}</td>
                  <td>{s.email}</td>
                  <td>
                    {s.card_uid ? (
                      <code className={styles.code}>{s.card_uid}</code>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      {isAdmin && allUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All users (Admin)</CardTitle>
            <CardDescription>All accounts in the system.</CardDescription>
          </CardHeader>
          <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td><span className={styles.roleBadge}>{u.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
