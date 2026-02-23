import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  const [loading, setLoading] = useState(true);
  const [rfidForm, setRfidForm] = useState({ user_id: '', card_uid: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api
      .get<StudentRow[]>('/api/users/students')
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <p className={styles.muted}>Loading…</p>;

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Users & RFID</h1>
      <p className={styles.muted}>Students and their linked RFID cards for attendance.</p>

      <section className={styles.section}>
        <h2>Link RFID to student</h2>
        <form onSubmit={linkRfid} className={styles.form}>
          <select
            value={rfidForm.user_id}
            onChange={(e) => setRfidForm((f) => ({ ...f, user_id: e.target.value }))}
            required
            className={styles.select}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>
            ))}
          </select>
          <input
            placeholder="Card UID (from reader)"
            value={rfidForm.card_uid}
            onChange={(e) => setRfidForm((f) => ({ ...f, card_uid: e.target.value }))}
            required
            className={styles.input}
          />
          <button type="submit" disabled={adding} className={styles.button}>
            {adding ? 'Linking…' : 'Link card'}
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h2>Students</h2>
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
      </section>
    </div>
  );
}
