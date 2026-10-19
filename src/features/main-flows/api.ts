import { useMemo } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError, requestApi } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';

export type FlowRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
export function idOf(value: string | number | undefined): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Choose a valid record to continue.');
  return id;
}
export function useFlowRequest(): FlowRequest {
  const { handleApiError } = useAuth();
  return useMemo(() => async <T,>(path: string, init?: RequestInit): Promise<T> => {
    try {
      const session = authSession.read();
      if (!session || session.expiresAt <= Date.now()) throw new ApiError(401, 'UNAUTHORIZED', 'Your session expired. Sign in again.');
      return await requestApi<T>(path, init, { token: session.accessToken });
    } catch (error) { handleApiError(error); throw error; }
  }, [handleApiError]);
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return [error.message, ...error.details.map((detail) => detail.message)].join(' ');
  return error instanceof Error ? error.message : 'The server could not complete this request.';
}
export function jsonBody(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}
