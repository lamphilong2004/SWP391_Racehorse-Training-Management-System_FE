import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, authApi, isInactiveAccountError, type AuthApi, type CurrentUser } from './authApi';
import { authSession, type StoredAuthSession } from './authSession';
import { isRoleCode } from './roles';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';

interface AuthState {
  status: AuthStatus;
  user: CurrentUser | null;
  expiresAt: number | null;
  message: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
  handleApiError: (error: unknown) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isCurrentUser(value: CurrentUser): boolean {
  return (
    value.accountStatus === 'ACTIVE' &&
    Array.isArray(value.roles) &&
    value.roles.length > 0 &&
    value.roles.every((role) => isRoleCode(role))
  );
}

function sessionExpiredMessage() {
  return 'Your session expired. Sign in again to continue.';
}

function inactiveAccountMessage() {
  return 'Your account is deactivated. Sign in again to continue.';
}

export function AuthProvider({ children, api = authApi }: { children: ReactNode; api?: AuthApi }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    expiresAt: null,
    message: null,
  });

  const clearLocalSession = useCallback((message: string | null = null) => {
    authSession.clear();
    setState({ status: 'anonymous', user: null, expiresAt: null, message });
  }, []);

  const handleApiError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      clearLocalSession(sessionExpiredMessage());
      return true;
    }
    if (isInactiveAccountError(error)) {
      clearLocalSession(inactiveAccountMessage());
      return true;
    }
    return false;
  }, [clearLocalSession]);

  const restore = useCallback(async () => {
    const stored: StoredAuthSession | null = authSession.read();
    if (!stored) {
      setState({ status: 'anonymous', user: null, expiresAt: null, message: null });
      return;
    }
    if (stored.expiresAt <= Date.now()) {
      clearLocalSession(sessionExpiredMessage());
      return;
    }

    setState({ status: 'loading', user: null, expiresAt: stored.expiresAt, message: null });
    try {
      const user = await api.currentUser(stored.accessToken, () => clearLocalSession(sessionExpiredMessage()));
      if (!isCurrentUser(user)) throw new Error('The current-user response does not match the approved auth contract.');
      setState({ status: 'authenticated', user, expiresAt: stored.expiresAt, message: null });
    } catch (error) {
      if (handleApiError(error)) return;
      setState({
        status: 'error',
        user: null,
        expiresAt: stored.expiresAt,
        message: error instanceof Error ? error.message : 'Could not restore your session.',
      });
    }
  }, [api, clearLocalSession, handleApiError]);

  useEffect(() => {
    void Promise.resolve().then(restore);
  }, [restore]);

  useEffect(() => {
    if (state.status !== 'authenticated' || state.expiresAt === null) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const expireWhenDue = () => {
      const remaining = state.expiresAt! - Date.now();
      if (remaining <= 0) clearLocalSession(sessionExpiredMessage());
      else timer = setTimeout(expireWhenDue, Math.min(remaining, 2_147_000_000));
    };
    timer = setTimeout(expireWhenDue, Math.max(0, state.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [state.status, state.expiresAt, clearLocalSession]);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const response = await api.login({ email, password });
      if (
        !response.accessToken ||
        response.tokenType !== 'Bearer' ||
        !Number.isFinite(response.expiresIn) ||
        response.expiresIn <= 0 ||
        !isCurrentUser(response.user)
      ) {
        throw new ApiError(200, 'INVALID_RESPONSE', 'The sign-in response does not match the approved auth contract.');
      }
      const stored = authSession.save(response.accessToken, response.expiresIn, remember);
      setState({ status: 'authenticated', user: response.user, expiresAt: stored.expiresAt, message: null });
    },
    [api],
  );

  const logout = useCallback(async () => {
    const stored = authSession.read();
    let message: string | null = null;
    try {
      if (stored) await api.logout(stored.accessToken);
    } catch {
      message = 'Signed out on this device. Server sign-out and audit were not confirmed.';
    } finally {
      clearLocalSession(message);
    }
  }, [api, clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, restore, handleApiError }),
    [state, login, logout, restore, handleApiError],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
