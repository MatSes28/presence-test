import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type UserRole = 'admin' | 'faculty' | 'student';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'clirdec_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);

  const setUser = useCallback((u: User | null) => setUserState(u), []);
  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const { user: u, token: t } = JSON.parse(raw);
          if (u && t) {
            setUserState(u);
            setTokenState(t);
          }
        }
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUserState(data.user);
            setTokenState('cookie');
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, []);

  useEffect(() => {
    if (user && token) localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user, token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setUserState(data.user);
    setTokenState(data.token || 'cookie');
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUserState(null);
      setTokenState(null);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    login,
    logout,
    setUser,
    setToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
