import type { MedicalService } from './models';
import type { CurrentUser } from '../../shared/auth/authApi';
import { createMedicalTransport } from '../../shared/services/medicalTransport';
import { ApiError, requestApi } from '../../shared/auth/authApi';

export function createMedicalService(accessToken: string, onApiError?: (error: unknown) => boolean, options: { baseUrl?: string; fetcher?: typeof fetch; actor?: CurrentUser } = {}): MedicalService {
  const fetcher = options.fetcher ?? createMedicalTransport(options.actor);
  if (!accessToken.trim()) throw new Error('A signed-in session is required for medical requests.');
  async function request<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
    try {
      const data = await requestApi<T>(path, {
        method, headers: { Accept: 'application/json' },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
      }, { token: accessToken, baseUrl: options.baseUrl, fetcher });
      if (data == null) throw new ApiError(200, 'INVALID_RESPONSE', 'The server returned no medical data.');
      return data;
    } catch (error) {
      onApiError?.(error);
      throw error;
    }
  }
  const positiveId = (id: number) => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('A valid numeric ID is required.');
    return id;
  };
  const pageQuery = (page: number) => `?page=${Math.max(0, Math.trunc(page))}&size=20`;
  const cases = '/api/medical/cases';
  return {
    listCases: (page = 0) => request(cases + pageQuery(page)),
    getCase: (id) => request(`${cases}/${positiveId(id)}`),
    createCase: (input) => request(cases, 'POST', input),
    addExamination: (id, input) => request(`${cases}/${positiveId(id)}/examinations`, 'POST', input),
    addInjury: (id, input) => request(`${cases}/${positiveId(id)}/injuries`, 'POST', input),
    saveTreatment: (id, input) => request(`${cases}/${positiveId(id)}/treatment-plan`, 'PUT', input),
    listCaseTasks: (id, page = 0) => request(`${cases}/${positiveId(id)}/treatment-tasks` + pageQuery(page)),
    addReexamination: (id, input) => request(`${cases}/${positiveId(id)}/re-examinations`, 'POST', input),
    closeCase: (id) => request(`${cases}/${positiveId(id)}/close`, 'POST'),
    listIncidents: (page = 0) => request('/api/incidents' + pageQuery(page)),
    getIncident: (id) => request(`/api/incidents/${positiveId(id)}`),
    reviewIncident: (id, action, medicalCaseId) => request(`/api/incidents/${positiveId(id)}/review`, 'POST', action === 'LINK_CASE' ? { action, medicalCaseId: positiveId(medicalCaseId ?? 0) } : { action }),
    getAvailability: (horseId) => request(`/api/horses/${positiveId(horseId)}/training-availability`),
    listRestrictions: (page = 0) => request('/api/medical/restrictions' + pageQuery(page)),
    getHerdHealth: () => request('/api/medical/herd-health'),
  };
}
