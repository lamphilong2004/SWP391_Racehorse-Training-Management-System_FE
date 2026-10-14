import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, configureHttp } from '../api/http';
import { AuthContext, type AuthUser, type AuthState } from './authState';

/**
 * DEMO INTEGRATION — the CORE-008 login/session work is not implemented yet; this is the minimum needed for the
 * demo. The JWT is kept in sessionStorage so a browser refresh keeps the session (tab-scoped, cleared on logout).
 * Identity always comes from GET /api/auth/me, never from storage alone.
 */
const STORAGE_KEY = 'racehorse.session';

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: the session lives in memory only */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>(() => (readToken() ? 'loading' : 'anonymous'));

  const clear = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    configureHttp({ token: () => readToken(), onUnauthorized: clear });
  }, [clear]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    api<AuthUser>('/api/auth/me')
      .then((me) => {
        if (!active) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (active) clear();
      });
    return () => {
      active = false;
    };
  }, [token, clear]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<LoginResponse>('/api/auth/login', { body: { email, password } });
    writeToken(result.accessToken);
    setUser(result.user);
    setStatus('authenticated');
    setToken(result.accessToken);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api<void>('/api/auth/logout', { method: 'POST' });
    } catch {
      /* the local session is cleared regardless */
    }
    clear();
  }, [clear]);

  const value = useMemo<AuthState>(() => ({ status, user, token, login, logout }), [status, user, token, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
