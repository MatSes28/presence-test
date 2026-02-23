import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Modal } from '../components/ui/modal';
import styles from './Users.module.css';

type CreateRole = 'student' | 'faculty' | 'admin';

interface StudentRow {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  card_uid: string | null;
}

const ROLE_OPTIONS: { value: CreateRole; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'admin', label: 'Administrator' },
];

export default function Users() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; full_name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [rfidForm, setRfidForm] = useState({ user_id: '', card_uid: '' });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as CreateRole,
    gender: '',
    department: 'Information Technology',
  });
  const [createError, setCreateError] = useState('');
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; email?: string; message: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string; full_name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [attendanceLink, setAttendanceLink] = useState<{ url: string; full_name: string } | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const isAdmin = user?.role === 'admin';
  const needsPassword = createForm.role === 'faculty' || createForm.role === 'admin';
  const currentUserId = user?.id;

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
    setCreateError('');
    if (!createForm.full_name?.trim() || !createForm.email?.trim()) {
      setCreateError('Full name and email are required.');
      return;
    }
    if (needsPassword) {
      if (!createForm.password || createForm.password.length < 6) {
        setCreateError('Password must be at least 6 characters.');
        return;
      }
      if (createForm.password !== createForm.confirmPassword) {
        setCreateError('Password and Confirm password do not match.');
        return;
      }
    }
    setCreating(true);
    try {
      const body: { email: string; password?: string; full_name: string; role: string } = {
        email: createForm.email.trim(),
        full_name: createForm.full_name.trim(),
        role: createForm.role,
      };
      if (needsPassword && createForm.password) body.password = createForm.password;
      await api.post('/api/users', body);
      setCreateModalOpen(false);
      setCreateForm({
        full_name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'student',
        gender: '',
        department: 'Information Technology',
      });
      const list = await api.get<StudentRow[]>('/api/users/students');
      setStudents(list);
      if (isAdmin) {
        const users = await api.get<{ id: string; email: string; full_name: string; role: string }[]>('/api/users');
        setAllUsers(users);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    setCreateError('');
    setCreateForm({
      full_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'student',
      gender: '',
      department: 'Information Technology',
    });
  }

  async function submitImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importCsv.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.post<{ created: number; skipped: number; errors: { row: number; email?: string; message: string }[] }>('/api/users/import', { csv: importCsv.trim() });
      setImportResult(result);
      const list = await api.get<StudentRow[]>('/api/users/students');
      setStudents(list);
      if (isAdmin) {
        const users = await api.get<{ id: string; email: string; full_name: string; role: string }[]>('/api/users');
        setAllUsers(users);
      }
    } catch (err) {
      setImportResult({ created: 0, skipped: 0, errors: [{ row: 0, message: err instanceof Error ? err.message : 'Import failed' }] });
    } finally {
      setImporting(false);
    }
  }

  async function getAttendanceLink(studentId: string, fullName: string) {
    setLoadingLink(true);
    try {
      const body = await api.post<{ url: string }>(`/api/users/${studentId}/attendance-link`, {});
      setAttendanceLink({ url: body.url, full_name: fullName });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to get link');
    } finally {
      setLoadingLink(false);
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      const list = await api.get<StudentRow[]>('/api/users/students');
      setStudents(list);
      const users = await api.get<{ id: string; email: string; full_name: string; role: string }[]>('/api/users');
      setAllUsers(users);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">User Management</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Students and their linked RFID cards. Only admins and faculty sign in.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button onClick={() => setCreateModalOpen(true)}>Add New User</Button>
            <Button variant="secondary" onClick={() => { setImportModalOpen(true); setImportCsv(''); setImportResult(null); }}>Import CSV</Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <Modal open={createModalOpen} onClose={closeCreateModal} title="Create New User">
          <form onSubmit={createUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Full Name *</label>
              <Input
                placeholder="Enter full name"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Email *</label>
              <Input
                type="email"
                placeholder="Enter email address"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="w-full"
              />
            </div>
            {needsPassword && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Password *</label>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    required={needsPassword}
                    minLength={6}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Confirm Password *</label>
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    required={needsPassword}
                    minLength={6}
                    className="w-full"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Role *</label>
              <Select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as CreateRole }))}
                className="w-full"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              {createForm.role === 'student' && (
                <p className="text-xs text-[var(--text-muted)] mt-1">Students use RFID only; no password needed.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Gender</label>
              <Select
                value={createForm.gender}
                onChange={(e) => setCreateForm((f) => ({ ...f, gender: e.target.value }))}
                className="w-full"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Department</label>
              <Input
                placeholder="Department"
                value={createForm.department}
                onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value }))}
                className="w-full"
              />
            </div>
            {createError && (
              <p className="text-sm text-[var(--error)]">{createError}</p>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="secondary" onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  creating ||
                  !createForm.full_name?.trim() ||
                  !createForm.email?.trim() ||
                  (needsPassword && (!createForm.password || createForm.password.length < 6 || createForm.password !== createForm.confirmPassword))
                }
              >
                {creating ? 'Creating…' : 'Create User'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {isAdmin && (
        <Modal open={importModalOpen} onClose={() => { setImportModalOpen(false); setImportResult(null); }} title="Bulk import users (CSV)">
          <form onSubmit={submitImport} className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Columns: email, full_name, role, guardian_email (optional), card_uid (optional), password (optional for admin/faculty). Header row optional.
            </p>
            <textarea
              className="w-full min-h-[200px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] font-mono"
              placeholder={'email,full_name,role,guardian_email,card_uid,password\nstudent@example.com,Student One,student,parent@example.com,CARD001,'}
              value={importCsv}
              onChange={(e) => setImportCsv(e.target.value)}
            />
            {importResult && (
              <div className="text-sm">
                <p className="text-[var(--text)]">Created: {importResult.created} · Skipped: {importResult.skipped}</p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-1 text-[var(--error)] list-disc list-inside">
                    {importResult.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>Row {e.row}: {e.message}</li>
                    ))}
                    {importResult.errors.length > 10 && <li>… and {importResult.errors.length - 10} more</li>}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="secondary" onClick={() => setImportModalOpen(false)}>Close</Button>
              <Button type="submit" disabled={importing || !importCsv.trim()}>{importing ? 'Importing…' : 'Import'}</Button>
            </div>
          </form>
        </Modal>
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
                {isAdmin && <th>Actions</th>}
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
                  {isAdmin && (
                    <td>
                      <Button type="button" variant="secondary" size="sm" disabled={loadingLink} onClick={() => getAttendanceLink(s.id, s.full_name)}>
                        Get link
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      {attendanceLink && (
        <Modal open={!!attendanceLink} onClose={() => setAttendanceLink(null)} title="Attendance link">
          <p className="text-sm text-[var(--text-secondary)] mb-2">Share this link with <strong>{attendanceLink.full_name}</strong>. It expires in 7 days.</p>
          <input readOnly className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text)] mb-4" value={attendanceLink.url} />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => { navigator.clipboard?.writeText(attendanceLink.url); setAttendanceLink(null); }}>Copy and close</Button>
            <Button type="button" onClick={() => setAttendanceLink(null)}>Close</Button>
          </div>
        </Modal>
      )}

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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td><span className={styles.roleBadge}>{u.role}</span></td>
                    <td>
                      {u.id !== currentUserId && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget({ id: u.id, email: u.email, full_name: u.full_name })}
                        >
                          Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Delete user">
          <p className="text-[var(--text-secondary)] mb-4">
            Remove <strong>{deleteTarget.full_name}</strong> ({deleteTarget.email})? This will delete their attendance records and cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteUser} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete user'}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
