import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const isAuthenticated = !!user;

  const loginWithGoogle = useCallback(() => {
    window.location.href = '/api/auth/signin/google';
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Try Auth.js Credentials flow first
    try {
      const csrfRes = await fetch('/api/auth/csrf');
      const { csrfToken } = await csrfRes.json();

      const callbackRes = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          csrfToken,
          email,
          password,
          json: 'true',
        }),
        redirect: 'manual',
      });

      // After successful Auth.js login, fetch session
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();

      if (session?.user?.id) {
        // Fetch full user data from our DB
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const userData = await meRes.json();
          setUser(userData);
          // Clear legacy token if present
          localStorage.removeItem('auth_token');
          setToken(null);
          return;
        }
      }
    } catch {
      // Auth.js failed, try legacy login
    }

    // Legacy JWT login fallback
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al iniciar sesión');
    }
    const data = await res.json();
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    // Try Auth.js signout (clears cookie)
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {}
    // Also clear legacy token
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      setIsAuthLoading(true);

      // 1. Try Auth.js session (cookie-based)
      try {
        const sessionRes = await fetch('/api/auth/session');
        if (!cancelled && sessionRes.ok) {
          const session = await sessionRes.json();
          if (session?.user?.id) {
            const meRes = await fetch('/api/auth/me');
            if (!cancelled && meRes.ok) {
              const userData = await meRes.json();
              setUser(userData);
              setIsAuthLoading(false);
              return;
            }
          }
        }
      } catch {}

      // 2. Fallback: legacy JWT
      if (!token) {
        if (!cancelled) setIsAuthLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          if (res.status === 401) {
            localStorage.removeItem('auth_token');
            setToken(null);
            setUser(null);
          } else if (res.ok) {
            const u = await res.json();
            setUser(u);
          }
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isAuthLoading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
