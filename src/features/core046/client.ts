import type { GroomTreatmentTask, Incident, IncidentCreateRequest, Page } from './contract';

const configuredBase = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export class Core046Client {
  constructor(private readonly token: string, private readonly base = configuredBase) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.base.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    });
    const envelope: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof envelope === 'object' && envelope !== null && 'error' in envelope ? envelope.error : null;
      const message = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message : `Request failed (${response.status}).`;
      throw new ApiError(message, response.status);
    }
    if (typeof envelope !== 'object' || envelope === null || !('success' in envelope) || envelope.success !== true || !('data' in envelope)) {
      throw new ApiError('Unexpected API response.', response.status);
    }
    return envelope.data as T;
  }

  getMe(): Promise<{ id: number; fullName: string; roles: string[]; accountStatus: string }> { return this.request('/api/auth/me'); }
  listTreatmentTasks(page = 0): Promise<Page<GroomTreatmentTask>> { return this.request(`/api/groom/treatment-tasks?page=${page}&size=100`); }
  completeTreatmentTask(id: number): Promise<GroomTreatmentTask> {
    return this.request(`/api/groom/treatment-tasks/${id}/complete`, { method: 'POST', body: '{}' });
  }
  listIncidents(page = 0): Promise<Page<Incident>> { return this.request(`/api/incidents?page=${page}&size=100`); }
  getIncident(id: number): Promise<Incident> { return this.request(`/api/incidents/${id}`); }
  async reportIncident(request: IncidentCreateRequest): Promise<Incident> {
    const incident = await this.request<Incident>('/api/incidents', { method: 'POST', body: JSON.stringify(request) });
    if (!incident || !Number.isSafeInteger(incident.id) || incident.id < 1 || typeof incident.incidentCode !== 'string' || !incident.incidentCode.trim()) {
      throw new ApiError('Unexpected incident response.', 201);
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
