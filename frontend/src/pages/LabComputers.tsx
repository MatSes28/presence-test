import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select } from '../components/ui/select';
import styles from './Schedules.module.css';

interface Computer {
  id: string;
  name: string;
  room: string | null;
  is_active: boolean;
  created_at: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
}

interface UserOption {
  id: string;
  full_name: string;
  role: string;
}

export default function LabComputers() {
  const { user } = useAuth();
  const [computers, setComputers] = useState<Computer[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [assignUserId, setAssignUserId] = useState<Record<string, string>>({});

  useEffect(() => {
    setError(null);
    Promise.all([
      api.get<Computer[]>('/api/computers'),
      api.get<UserOption[]>('/api/users'),
    ])
      .then(([comp, u]) => {
        setComputers(comp);
        setUsers(u.filter((x) => x.role === 'student'));
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || user?.role !== 'admin') return;
    try {
      await api.post('/api/computers', { name: newName.trim(), room: newRoom.trim() || undefined });
      const data = await api.get<Computer[]>('/api/computers');
      setComputers(data);
      setNewName('');
      setNewRoom('');
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleAssign(computerId: string, userId: string) {
    try {
      await api.post(`/api/computers/${computerId}/assign`, { user_id: userId });
      const data = await api.get<Computer[]>('/api/computers');
      setComputers(data);
      setAssignUserId((prev) => ({ ...prev, [computerId]: '' }));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleRelease(computerId: string) {
    try {
      await api.post(`/api/computers/${computerId}/release`);
      const data = await api.get<Computer[]>('/api/computers');
      setComputers(data);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this computer?')) return;
    try {
      await api.delete(`/api/computers/${id}`);
      setComputers((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (loading) return <p className="text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Lab computers</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Manage lab computers and assign students.</p>
      </div>
      {error && (
        <div className={styles.errorBanner} role="alert">{error}</div>
      )}
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Add computer</CardTitle>
            <CardDescription>Register a lab computer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
              <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required className="min-w-[140px]" />
              <Input placeholder="Room (optional)" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} className="min-w-[120px]" />
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Computers</CardTitle>
          <CardDescription>Assign or release students. Faculty and admin can assign.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Room</th>
                  <th>Assigned to</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {computers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.room ?? '—'}</td>
                    <td>{c.assigned_user_name ?? '—'}</td>
                    <td>
                      {c.assigned_user_id ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleRelease(c.id)}>Release</Button>
                      ) : (
                        <>
                          <Select
                            value={assignUserId[c.id] ?? ''}
                            onChange={(e) => setAssignUserId((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            className="min-w-[140px] mr-2"
                          >
                            <option value="">Select student</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>{u.full_name}</option>
                            ))}
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!assignUserId[c.id]}
                            onClick={() => assignUserId[c.id] && handleAssign(c.id, assignUserId[c.id])}
                          >
                            Assign
                          </Button>
                        </>
                      )}
                      {user?.role === 'admin' && (
                        <Button type="button" variant="secondary" size="sm" className="ml-2" onClick={() => handleDelete(c.id)}>Delete</Button>
                      )}
                    </td>
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
