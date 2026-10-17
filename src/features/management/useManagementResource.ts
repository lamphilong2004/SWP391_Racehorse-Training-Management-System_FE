import { useEffect, useState } from 'react';
import { ApiError } from '../../shared/auth/authApi';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { ManagementRequest } from './types';

type Resource<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; forbidden: boolean; message: string };

export function useManagementResource<T>(load: (context: ManagementRequest) => Promise<T>, revision: number): Resource<T> {
  const { user, handleApiError } = useAuth();
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  useEffect(() => {
    const abort = new AbortController();
    // Defer the state update to keep StrictMode effects cancellable and prevent stale actor/filter responses.
    void Promise.resolve().then(async () => {
      if (abort.signal.aborted) return;
      setState({ status: 'loading' });
      try {
        const session = authSession.read();
        if (!session || session.expiresAt <= Date.now()) throw new ApiError(401, 'UNAUTHORIZED', 'Session expired.');
        const data = await load({ token: session.accessToken, signal: abort.signal });
        if (!abort.signal.aborted) setState({ status: 'ready', data });
      } catch (error) {
        if (abort.signal.aborted || handleApiError(error)) return;
        const forbidden = error instanceof ApiError && error.status === 403;
        setState({ status: 'error', forbidden, message: forbidden ? 'Your account cannot access this management data.' : error instanceof ApiError && error.status === 400 ? 'The server rejected these filters. Check the values and try again.' : 'Management data could not be loaded. Try again or contact your administrator.' });
      }
    });
    return () => abort.abort();
  }, [load, revision, user?.id, handleApiError]);
  return state;
}
