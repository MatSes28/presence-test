import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);

  if (token) {
    navigate('/', { replace: true });
    return null;
  }

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    fetch('/api/auth/config', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { ssoEnabled?: boolean }) => setSsoEnabled(!!d.ssoEnabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'sso_no_user') setError('Your account is not registered. Contact an administrator.');
    else if (err === 'invalid_callback') setError('Invalid sign-in attempt. Please try again.');
    else if (err === 'sso_not_configured') setError('SSO is not configured.');
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-iso-3 bg-[var(--bg)]">
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg)] via-[var(--bg-elevated)] to-[var(--bg)] opacity-80" aria-hidden />
      <Card className="relative w-full max-w-md border-[var(--border)] shadow-[var(--shadow-lg)]">
        <CardHeader className="pb-iso-2 p-iso-3">
          <CardTitle id="login-title" className="text-xl font-mono tracking-wide text-[var(--accent)] text-center">
            CLIRDEC:PRESENCE
          </CardTitle>
          <CardDescription className="text-center text-[var(--text-secondary)]">
            Attendance monitoring & classroom engagement — Central Luzon State University · DIT · College of Engineering (BSIT)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-iso-3 pt-iso-2">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-iso-2"
            aria-labelledby="login-title"
            aria-describedby={error ? 'login-error' : undefined}
          >
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-[var(--text)] mb-iso-1">
                Email address
              </label>
              <Input
                id="login-email"
                ref={emailRef}
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                aria-required="true"
                aria-invalid={!!error}
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[var(--text)] mb-iso-1">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={!!error}
              />
            </div>
            {error && (
              <p id="login-error" className="text-sm text-[var(--error)]" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full min-h-touch"
              aria-busy={loading}
              aria-label={loading ? 'Signing in' : 'Sign in'}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            {ssoEnabled && (
              <p className="text-center text-sm text-[var(--text-secondary)]">
                <a href="/api/auth/oidc" className="text-[var(--accent)] hover:underline">Sign in with SSO</a>
              </p>
            )}
            <p className="text-center text-sm text-[var(--text-muted)] mt-iso-1">
              <Link to="/forgot-password" className="text-[var(--accent)] hover:underline">Forgot password?</Link>
            </p>
            <p className="text-center text-xs text-[var(--text-muted)] mt-iso-1">
              <Link to="/privacy" className="text-[var(--accent)] hover:underline inline-flex items-center justify-center py-iso-1 min-h-touch">
                Privacy notice
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
