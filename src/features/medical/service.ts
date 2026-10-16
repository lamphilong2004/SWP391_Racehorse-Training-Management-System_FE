import type { MedicalService } from './models';

type Envelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };
type Fetcher = typeof fetch;

export function createMedicalService(baseUrl: string, accessToken: string, fetcher: Fetcher = fetch): MedicalService {
  if (!accessToken.trim()) throw new Error('A signed-in session is required for medical requests.');
  const base = baseUrl.replace(/\/$/, '');
  async function request<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(base + path, {
        method, credentials: 'omit',
        headers: { Accept: 'application/json', ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${accessToken}` },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
      });
    } catch { throw new Error('Cannot connect to the medical service. Check the API connection and retry.'); }
    const envelope = await response.json().catch(() => null) as Envelope<T> | null;
    if (response.status === 401) throw new Error('Sign in to continue.');
    if (response.status === 403) throw new Error('You do not have access to this record.');
    if (!response.ok || !envelope || envelope.success !== true || envelope.data == null) {
      if (envelope?.success === false && envelope.error?.message) throw new Error(envelope.error.message);
      throw new Error(`Medical request failed (${response.status}): invalid API response.`);
    }
    return envelope.data;
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
