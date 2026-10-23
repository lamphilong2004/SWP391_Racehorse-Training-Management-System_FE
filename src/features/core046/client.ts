import type { GroomTreatmentTask, Incident, IncidentCreateRequest, Page } from './contract';
import { ApiError as SharedApiError, requestApi } from '../../shared/auth/authApi';

const configuredBase = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export class Core046Client {
  constructor(private readonly token: string, private readonly base = configuredBase, private readonly handleApiError?: (error: unknown) => boolean) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      const data = await requestApi<T>(path, init, { token: this.token, baseUrl: this.base });
      if (data == null) throw new ApiError('Phản hồi từ máy chủ không như mong đợi.', 200);
      return data;
    }
    catch (error) {
      this.handleApiError?.(error);
      if (error instanceof SharedApiError) throw new ApiError(error.message, error.status);
      throw error;
    }
  }

  getMe(): Promise<{ id: number; fullName: string; roles: string[]; accountStatus: string }> { return this.request('/api/auth/me'); }
  listTreatmentTasks(page = 0): Promise<Page<GroomTreatmentTask>> { return this.request(`/api/groom/treatment-tasks?page=${page}&size=100`); }
  completeTreatmentTask(id: number): Promise<GroomTreatmentTask> {
    return this.request(`/api/groom/treatment-tasks/${positiveId(id)}/complete`, { method: 'POST', body: '{}' });
  }
  listIncidents(page = 0): Promise<Page<Incident>> { return this.request(`/api/incidents?page=${page}&size=100`); }
  getIncident(id: number): Promise<Incident> { return this.request(`/api/incidents/${positiveId(id)}`); }
  async reportIncident(request: IncidentCreateRequest): Promise<Incident> {
    const incident = await this.request<Incident>('/api/incidents', { method: 'POST', body: JSON.stringify(request) });
    if (!incident || !Number.isSafeInteger(incident.id) || incident.id < 1 || typeof incident.incidentCode !== 'string' || !incident.incidentCode.trim()) {
      throw new ApiError('Dữ liệu sự cố trả về không hợp lệ.', 201);
    }
    return incident;
  }
}

function positiveId(id: number): number {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Cần một mã số dương.');
  return id;
}

/** API has pagination only, so collect server-scoped pages before local Figma filters. */
export async function collectPages<T>(load: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const first = await load(0);
  if (!Array.isArray(first.items) || first.page !== 0 || first.size < 1 || first.totalElements < 0) throw new Error('Dữ liệu phân trang không hợp lệ.');
  const items = [...first.items];
  const pages = Math.ceil(first.totalElements / first.size);
  for (let page = 1; page < pages; page++) {
    const next = await load(page);
    if (!Array.isArray(next.items) || next.page !== page || next.size !== first.size || next.totalElements !== first.totalElements) throw new Error('Dữ liệu đã thay đổi; hãy tải lại để thử lại.');
    items.push(...next.items);
  }
  if (items.length !== first.totalElements) throw new Error('Dữ liệu phân trang chưa đầy đủ; hãy tải lại để thử lại.');
  return items;
}
