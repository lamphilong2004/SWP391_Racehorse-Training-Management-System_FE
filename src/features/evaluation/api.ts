import { ApiError, requestApi } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import type { EvaluationRequest, PerformancePoint, SessionResult, SessionResultView } from './models';

export interface EvaluationApi {
  result(id: number, signal?: AbortSignal): Promise<SessionResultView>;
  submit(id: number, input: EvaluationRequest): Promise<SessionResult>;
  performance(horseId: number, dates?: { from?: string; to?: string }, signal?: AbortSignal): Promise<PerformancePoint[]>;
}

/** Reuses CORE-008 request/envelope/base URL and its existing session store. No runtime fixtures. */
export function createEvaluationApi(options: { fetcher?: typeof fetch; baseUrl?: string } = {}): EvaluationApi {
  const request = <T>(path: string, init: RequestInit = {}) => {
    const session = authSession.read();
    if (!session || session.expiresAt <= Date.now()) return Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'Your session expired. Sign in again to continue.'));
    return requestApi<T>(path, init, { ...options, token: session.accessToken });
  };
  return {
    result: (id, signal) => request(`/api/training-sessions/${id}/result`, { signal }),
    submit: (id, input) => request(`/api/training-sessions/${id}/evaluation`, { method: 'POST', body: JSON.stringify(input) }),
    performance: (id, dates = {}, signal) => {
      const query = new URLSearchParams();
      if (dates.from) query.set('from', dates.from);
      if (dates.to) query.set('to', dates.to);
      // A non-list body is a contract mismatch: surface it as an error state instead of crashing the history view.
      return request<PerformancePoint[]>(`/api/horses/${id}/performance${query.size ? `?${query}` : ''}`, { signal }).then((rows) => {
        if (!Array.isArray(rows)) throw new ApiError(200, 'INVALID_RESPONSE', 'Performance history does not match the approved contract. Reload to retry.');
        return rows;
      });
    },
  };
}
export const evaluationApi = createEvaluationApi();
