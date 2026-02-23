import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import styles from './Schedules.module.css';

interface Classroom {
  id: string;
  name: string;
  capacity: number | null;
  created_at: string;
}

export default function Classrooms() {
  const { user } = useAuth();
  const [list, setList] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<string>('');

  useEffect(() => {
    setError(null);
    api.get<Classroom[]>('/api/classrooms').then(setList).catch((err) => setError((err as Error).message)).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || user?.role !== 'admin') return;
    try {
      await api.post('/api/classrooms', { name: name.trim(), capacity: capacity ? parseInt(capacity, 10) : undefined });
      const data = await api.get<Classroom[]>('/api/classrooms');
      setList(data);
      setName('');
      setCapacity('');
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this classroom?')) return;
    try {
      await api.delete(`/api/classrooms/${id}`);
      setList((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (loading) return <p className="text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Classrooms</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Manage rooms. Link them to schedules when creating a schedule.</p>
      </div>
      {error && (
        <div className={styles.errorBanner} role="alert">{error}</div>
      )}
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Add classroom</CardTitle>
            <CardDescription>Create a new room.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className="min-w-[140px]" />
              <Input type="number" min={0} placeholder="Capacity (optional)" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="min-w-[120px]" />
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>All classrooms</CardTitle>
          <CardDescription>Rooms available for schedules.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Capacity</th>
                  {user?.role === 'admin' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.capacity ?? '—'}</td>
                    {user?.role === 'admin' && (
                      <td>
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleDelete(c.id)}>Delete</Button>
                      </td>
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
