import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ApiError, requestApi } from '../auth/authApi';
import { authSession, type StoredAuthSession } from '../auth/authSession';
import type { FlowRequest } from '../../features/main-flows/api';

interface NotificationsState {
  unreadCount: number | undefined;
  pending: boolean;
  error: string | undefined;
  revision: number;
  request: FlowRequest;
  refresh: () => Promise<void>;
  markRead: (id?: number) => Promise<void>;
}
const NotificationsContext = createContext<NotificationsState | null>(null);

/** One server-backed count for the header, center and drawer, scoped to the canonical auth session. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, user, expiresAt, handleApiError } = useAuth();
  const { accessToken, expiresAt: storedExpiry } = authSession.read() ?? {};
  const session = useMemo(() => status === 'authenticated' && user?.accountStatus === 'ACTIVE' && accessToken
    && storedExpiry === expiresAt ? { accessToken, expiresAt: storedExpiry } : null,
  [status, user?.accountStatus, accessToken, storedExpiry, expiresAt]);
  // Remount the state AND consumers on account/login changes. Never render another session's count or list.
  return session && user
    ? <SessionNotifications key={`${user.id}:${session.expiresAt}`} session={session} handleApiError={handleApiError}>{children}</SessionNotifications>
    : <NotificationsContext.Provider value={null}>{children}</NotificationsContext.Provider>;
}

function countOf(value: unknown): number {
  const unread = (value as { unread?: unknown } | null)?.unread;
  if (typeof unread !== 'number' || !Number.isSafeInteger(unread) || unread < 0)
    throw new ApiError(200, 'INVALID_RESPONSE', 'The server returned an invalid unread count.');
  return unread;
}

function SessionNotifications({ session, handleApiError, children }: {
  session: StoredAuthSession; handleApiError: (error: unknown) => boolean; children: ReactNode;
}) {
  const [state, setState] = useState<{ source?: StoredAuthSession; unreadCount?: number; pending: boolean; error?: string }>({ pending: true });
  const [revision, setRevision] = useState(0);
  const requests = useRef(new Set<AbortController>());
  const countRequest = useRef<AbortController | null>(null);
  const generation = useRef(0), writing = useRef(false);
  const invalidateCount = useCallback(() => { ++generation.current; countRequest.current?.abort(); }, []);
  const isCurrent = useCallback(() => {
    const current = authSession.read();
    return current?.accessToken === session.accessToken && current.expiresAt === session.expiresAt && current.expiresAt > Date.now();
  }, [session]);

  const request = useCallback<FlowRequest>(async <T,>(path: string, init: RequestInit = {}) => {
    if (!isCurrent()) throw new Error('Notification session changed.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    init.signal?.addEventListener('abort', abort, { once: true });
    requests.current.add(controller);
    try {
      const result = await requestApi<T>(path, { ...init, signal: controller.signal }, { token: session.accessToken });
      if (controller.signal.aborted || !isCurrent()) throw new Error('Notification session changed.');
      return result;
    } catch (error) {
      // A late 401/inactive response from the old account must not sign out its replacement.
      if (!controller.signal.aborted && isCurrent()) handleApiError(error);
      throw error;
    } finally {
      init.signal?.removeEventListener('abort', abort);
      requests.current.delete(controller);
    }
  }, [session, isCurrent, handleApiError]);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    countRequest.current?.abort();
    const controller = new AbortController();
    countRequest.current = controller;
    if (!isCurrent()) return;
    setState({ source: session, pending: true });
    try {
      const result = await request<unknown>('/api/notifications/unread-count', { signal: controller.signal });
      const unreadCount = countOf(result);
      if (!controller.signal.aborted && current === generation.current && isCurrent()) setState({ source: session, unreadCount, pending: false });
    } catch {
      if (!controller.signal.aborted && current === generation.current && isCurrent())
        setState({ source: session, pending: false, error: 'Unread count unavailable. Retry notifications.' });
    }
  }, [request, isCurrent, session]);

  const markRead = useCallback(async (id?: number) => {
    if (id !== undefined && (!Number.isSafeInteger(id) || id < 1)) throw new Error('Invalid notification ID.');
    if (writing.current) throw new Error('A notification update is already in progress.');
    writing.current = true;
    // Invalidate earlier reads before the write; their responses must not restore an old badge.
    invalidateCount(); setState({ source: session, pending: true });
    try {
      const result = await request<{ id?: number; readAt?: string }>(id === undefined ? '/api/notifications/read-all' : `/api/notifications/${id}/read`,
        { method: id === undefined ? 'POST' : 'PATCH' });
      if (id === undefined) countOf(result);
      else if (result?.id !== id || typeof result.readAt !== 'string' || !Number.isFinite(Date.parse(result.readAt)))
        throw new ApiError(200, 'INVALID_RESPONSE', 'The server did not confirm this notification as read.');
      if (isCurrent()) setRevision((value) => value + 1);
    } finally {
      writing.current = false;
      // Re-read the authoritative count after either outcome; never decrement locally or invent zero.
      if (isCurrent()) await refresh();
    }
  }, [request, refresh, isCurrent, invalidateCount, session]);

  useEffect(() => {
    const pending = requests.current;
    let active = true;
    void Promise.resolve().then(() => { if (active) return refresh(); });
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      active = false; invalidateCount();
      pending.forEach((controller) => controller.abort());
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [refresh, invalidateCount]);

  const value = useMemo(() => ({ unreadCount: state.source === session ? state.unreadCount : undefined,
    error: state.source === session ? state.error : undefined, pending: state.source !== session || state.pending,
    revision, request, refresh, markRead }), [state, session, revision, request, refresh, markRead]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

// Optional for standalone v1 shell/gallery consumers; authenticated app roots install the provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() { return useContext(NotificationsContext); }
