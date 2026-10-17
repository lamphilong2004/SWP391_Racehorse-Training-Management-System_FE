import type { GroomTreatmentTask, Incident, IncidentCreateRequest, Page } from './contract';
import type { CurrentUser } from '../../shared/auth/authApi';
import { createMedicalTransport } from '../../shared/services/medicalTransport';
import { ApiError, requestApi } from '../../shared/auth/authApi';

export { ApiError };

export class Core046Client {
  private readonly fetcher: typeof fetch;
  constructor(private readonly token: string, private readonly base?: string, private readonly onApiError?: (error: unknown) => boolean, actor?: CurrentUser) {
    this.fetcher = createMedicalTransport(actor);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      const data = await requestApi<T>(path, init, { token: this.token, baseUrl: this.base, fetcher: this.fetcher });
      if (data == null) throw new ApiError(200, 'INVALID_RESPONSE', 'Unexpected API response.');
      return data;
    } catch (error) {
      this.onApiError?.(error);
      throw error;
    }
  }

  getMe(): Promise<{ id: number; fullName: string; roles: string[]; accountStatus: string }> { return requestApi('/api/auth/me', {}, { token: this.token, baseUrl: this.base }); }
  listTreatmentTasks(page = 0): Promise<Page<GroomTreatmentTask>> { return this.request(`/api/groom/treatment-tasks?page=${page}&size=100`); }
  completeTreatmentTask(id: number): Promise<GroomTreatmentTask> {
    return this.request(`/api/groom/treatment-tasks/${id}/complete`, { method: 'POST', body: '{}' });
  }
  listIncidents(page = 0): Promise<Page<Incident>> { return this.request(`/api/incidents?page=${page}&size=100`); }
  getIncident(id: number): Promise<Incident> { return this.request(`/api/incidents/${id}`); }
  async reportIncident(request: IncidentCreateRequest): Promise<Incident> {
    const incident = await this.request<Incident>('/api/incidents', { method: 'POST', body: JSON.stringify(request) });
    if (!incident || !Number.isSafeInteger(incident.id) || incident.id < 1 || typeof incident.incidentCode !== 'string' || !incident.incidentCode.trim()) {
      throw new ApiError(201, 'INVALID_RESPONSE', 'Unexpected incident response.');
    }
    return incident;
  }
}

/** API has pagination only, so collect server-scoped pages before local Figma filters. */
export async function collectPages<T>(load: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const first = await load(0);
  if (!Array.isArray(first.items) || first.page !== 0 || first.size < 1 || first.totalElements < 0) throw new Error('Invalid paged response.');
  const items = [...first.items];
  const pages = Math.ceil(first.totalElements / first.size);
  for (let page = 1; page < pages; page++) {
    const next = await load(page);
    if (!Array.isArray(next.items) || next.page !== page || next.size !== first.size || next.totalElements !== first.totalElements) throw new Error('Paged data changed; reload to retry.');
    items.push(...next.items);
  }
  if (items.length !== first.totalElements) throw new Error('Incomplete paged response; reload to retry.');
  return items;
}
