import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!token) {
      setError('Missing reset link. Request a new one from the login page.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed. Link may be expired.');
    } finally {
      setLoading(false);
    }
  }

  if (!token && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-iso-3 bg-[var(--bg)]">
        <Card className="relative w-full max-w-md border-[var(--border)]">
          <CardContent className="p-iso-3">
            <p className="text-[var(--text)]">Missing or invalid reset link. Use &quot;Forgot password?&quot; on the login page to get a new one.</p>
            <p className="mt-iso-3">
              <Link to="/login" className="text-[var(--accent)] hover:underline">Back to sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-iso-3 bg-[var(--bg)]">
      <Card className="relative w-full max-w-md border-[var(--border)] shadow-[var(--shadow-lg)]">
        <CardHeader className="pb-iso-2 p-iso-3">
          <CardTitle className="text-xl font-mono text-[var(--accent)] text-center">
            Set new password
          </CardTitle>
          <CardDescription className="text-center text-[var(--text-secondary)]">
            {done ? 'You can now sign in with your new password.' : 'Enter your new password below.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-iso-3 pt-iso-2">
          {done ? (
            <div className="text-center">
              <Link to="/login">
                <Button className="min-h-touch">Sign in</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-iso-2">
              <div>
                <label htmlFor="reset-password" className="block text-sm font-medium text-[var(--text)] mb-iso-1">
                  New password
                </label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full min-h-touch"
                />
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-sm font-medium text-[var(--text)] mb-iso-1">
                  Confirm password
                </label>
                <Input
                  id="reset-confirm"
                  type="password"
                  placeholder="Confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full min-h-touch"
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--error)]" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={loading} className="w-full min-h-touch">
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
          {!done && (
            <p className="text-center text-sm mt-iso-3">
              <Link to="/login" className="text-[var(--accent)] hover:underline">Back to sign in</Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
