import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import styles from './Schedules.module.css';

interface Subject {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

export default function Subjects() {
  const { user } = useAuth();
  const [list, setList] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    setError(null);
    api.get<Subject[]>('/api/subjects').then(setList).catch((err) => setError((err as Error).message)).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim() || user?.role !== 'admin') return;
    try {
      await api.post('/api/subjects', { code: code.trim(), name: name.trim() });
      const data = await api.get<Subject[]>('/api/subjects');
      setList(data);
      setCode('');
      setName('');
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this subject?')) return;
    try {
      await api.delete(`/api/subjects/${id}`);
      setList((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (loading) return <p className="text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Subjects</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Manage subjects. Link them to schedules when creating a schedule.</p>
      </div>
      {error && (
        <div className={styles.errorBanner} role="alert">{error}</div>
      )}
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Add subject</CardTitle>
            <CardDescription>Create a new subject (code and name).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
              <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required className="min-w-[100px]" />
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className="min-w-[180px]" />
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>All subjects</CardTitle>
          <CardDescription>Subjects available for schedules.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  {user?.role === 'admin' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>{s.code}</td>
                    <td>{s.name}</td>
                    {user?.role === 'admin' && (
                      <td>
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleDelete(s.id)}>Delete</Button>
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
