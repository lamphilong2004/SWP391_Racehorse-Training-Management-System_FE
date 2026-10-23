import { ApiError, requestApi } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import type { IssueInput, IssueResult, MetricInput, RiderFeedback, RiderFeedbackInput, RiderResult, RiderSession } from './types';
export interface RiderHistory { items: RiderSession[]; page: number; size: number; totalItems: number; totalPages: number }
export interface RiderApi {
  assignments(status?: string): Promise<RiderSession[]>;
  history(page?: number): Promise<RiderHistory>;
  session(id: number): Promise<RiderSession>;
  result(id: number): Promise<RiderResult>;
  start(id: number): Promise<RiderSession>;
  complete(id: number): Promise<RiderSession>;
  issue(id: number, input: IssueInput): Promise<IssueResult>;
  feedback(id: number, input: RiderFeedbackInput): Promise<RiderFeedback>;
  metric(id: number, input: MetricInput): Promise<{ sampleId: number; realtimeState: 'NORMAL' | 'WARNING' | 'CRITICAL'; alertId?: number | null }>;
}
export function createRiderApi(options: { fetcher?: typeof fetch; baseUrl?: string; handleApiError?: (error: unknown) => boolean } = {}): RiderApi {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      const session = authSession.read();
      if (!session || session.expiresAt <= Date.now()) throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
      return await requestApi<T>(path, init, { ...options, token: session.accessToken });
    } catch (error) { options.handleApiError?.(error); throw error; }
  }
  const post = <T>(id: number, action: string, body: unknown = {}) => request<T>(`/api/training-sessions/${id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
  return {
    assignments: (status) => request(`/api/work-rider/assignments${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    history: (page = 0) => request(`/api/work-rider/history?page=${page}&size=20`),
    session: (id) => request(`/api/training-sessions/${id}`),
    result: (id) => request(`/api/training-sessions/${id}/result`),
    start: (id) => post(id, 'start'), complete: (id) => post(id, 'complete'),
    issue: (id, body) => post(id, 'report-issue', body),
    feedback: (id, body) => post(id, 'rider-feedback', body),
    metric: (id, body) => post(id, 'metrics', body),
  };
}
