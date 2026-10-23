import { ApiError, requestApi } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { Core046Client, collectPages } from '../core046/client';
import type { Incident, GroomTreatmentTask } from '../core046/contract';
import type { IncidentCreateRequest } from '../../shared/incidents';
import type { Checklist, PrecheckSession, PreSessionCheck } from './types';

export interface PrecheckApi {
  sessions(date: string): Promise<PrecheckSession[]>;
  session(id: number): Promise<PrecheckSession>;
  submit(id: number, checks: Checklist): Promise<PreSessionCheck>;
  reportIncident(request: IncidentCreateRequest): Promise<Incident>;
  treatmentTasks(): Promise<GroomTreatmentTask[]>;
  incidents(): Promise<Incident[]>;
}

export function createPrecheckApi(options: { fetcher?: typeof fetch; baseUrl?: string; handleApiError?: (error: unknown) => boolean } = {}): PrecheckApi {
  function token() {
    const session = authSession.read();
    if (!session || session.expiresAt <= Date.now()) throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
    return session.accessToken;
  }
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    try { return await requestApi<T>(path, init, { ...options, token: token() }); }
    catch (error) { options.handleApiError?.(error); throw error; }
  }
  const client = () => new Core046Client(token(), options.baseUrl, options.handleApiError);
  return {
    sessions: (date) => request(`/api/groom/sessions?date=${encodeURIComponent(date)}`),
    session: (id) => request(`/api/training-sessions/${id}`),
    submit: (id, checks) => request(`/api/training-sessions/${id}/pre-session-check`, { method: 'POST', body: JSON.stringify({ checks }) }),
    reportIncident: (body) => client().reportIncident(body),
    treatmentTasks: () => collectPages((page) => client().listTreatmentTasks(page)),
    incidents: () => collectPages((page) => client().listIncidents(page)),
  };
}
