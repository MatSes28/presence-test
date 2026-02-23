import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-iso-3 bg-[var(--bg)]">
      <Card className="relative w-full max-w-md border-[var(--border)] shadow-[var(--shadow-lg)]">
        <CardHeader className="pb-iso-2 p-iso-3">
          <CardTitle className="text-xl font-mono tracking-wide text-[var(--accent)] text-center">
            Reset password
          </CardTitle>
          <CardDescription className="text-center text-[var(--text-secondary)]">
            Enter your email and we&apos;ll send a reset link (admin/faculty only).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-iso-3 pt-iso-2">
          {sent ? (
            <p className="text-[var(--text)] text-center">
              If an account exists for that email, you will receive a reset link shortly. Check your inbox and spam folder.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-iso-2">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-[var(--text)] mb-iso-1">
                  Email address
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full min-h-touch"
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--error)]" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={loading} className="w-full min-h-touch">
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
          <p className="text-center text-sm mt-iso-3">
            <Link to="/login" className="text-[var(--accent)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
