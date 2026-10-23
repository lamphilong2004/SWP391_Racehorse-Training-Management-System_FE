import type {
  ActivationStatus, HorseDetail, HorseIdentityRequest, Ownership, OwnershipRequest, Page, PedigreeRequest, Photo,
  StableAssignment, StableAssignmentRequest, StableBox, UserSummary,
} from './types';

/** Error raised for a non-2xx envelope ({ success:false, error:{ code, message, details[] } }). */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { field?: string | null; message: string }[];

  constructor(status: number, code: string, message: string, details: { field?: string | null; message: string }[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.message;
  }
}

/**
 * Minimal transport this feature needs. The real implementation (JWT, interceptors, 401 handling) is the shared
 * API client of CORE-008, bound by HorseManagementLayout. Runtime is API-only; errors never select sample data.
 * Implementations return the envelope's `data` and throw {@link ApiRequestError} on failures.
 */
export interface HttpClient {
  request<T>(method: 'GET' | 'POST' | 'PUT', path: string, options?: { body?: unknown; query?: Record<string, string | number | undefined> }): Promise<T>;
}

const checklistIds = ['IDENTITY', 'PEDIGREE', 'OWNER', 'FREE_STABLE_BOX', 'VETERINARIAN_BASELINE', 'HEAD_TRAINER_READINESS_REVIEW'];
function activation(value: ActivationStatus): ActivationStatus {
  const invalid = () => new ApiRequestError(502, 'INVALID_RESPONSE', 'Dữ liệu danh mục kích hoạt không hợp lệ.');
  if (!value || !Number.isSafeInteger(value.horseId) || value.horseId <= 0 || !Array.isArray(value.checklist) || value.checklist.length !== 6) throw invalid();
  value.checklist.forEach((item, index) => {
    if (!item || item.id !== checklistIds[index] || typeof item.label !== 'string' || typeof item.description !== 'string' ||
      (index < 5 ? item.requirement !== 'MANDATORY' || !['SATISFIED', 'PENDING'].includes(item.state) : item.requirement !== 'RECOMMENDED' || !['REVIEWED', 'NOT_REVIEWED'].includes(item.state))) throw invalid();
  });
  return value;
}

/** Flow 1 Club Manager operations used by CORE-013 (docs/api/flow1-horse.openapi.yaml). */
export function createHorsesApi(http: HttpClient) {
  return {
    listHorses: (query: Record<string, string | number | undefined> = {}) => http.request<Page<HorseDetail>>('GET', '/api/horses', { query }),
    createHorse: (body: HorseIdentityRequest) => http.request<HorseDetail>('POST', '/api/horses', { body }),
    getHorse: (id: number) => http.request<HorseDetail>('GET', `/api/horses/${id}`),
    updateHorse: (id: number, body: HorseIdentityRequest) => http.request<HorseDetail>('PUT', `/api/horses/${id}`, { body }),
    setPedigree: (id: number, body: PedigreeRequest) => http.request<HorseDetail>('PUT', `/api/horses/${id}/pedigree`, { body }),
    addOwnership: (id: number, body: OwnershipRequest) => http.request<Ownership>('POST', `/api/horses/${id}/ownerships`, { body }),
    uploadPhoto: (id: number, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return http.request<Photo>('POST', `/api/horses/${id}/photos`, { body: form });
    },
    listStableBoxes: (status?: 'FREE' | 'OCCUPIED') => http.request<StableBox[]>('GET', '/api/stable-boxes', { query: { status } }),
    listStableAssignments: (id: number) => http.request<StableAssignment[]>('GET', `/api/horses/${id}/stable-assignments`),
    assignStableBox: (id: number, body: StableAssignmentRequest) =>
      http.request<StableAssignment>('POST', `/api/horses/${id}/stable-assignments`, { body }),
    listPendingActivation: async (page = 0, size = 50) => {
      const result = await http.request<Page<ActivationStatus>>('GET', '/api/horses/pending-activation', { query: { page, size } });
      return { ...result, items: result.items.map(activation) };
    },
    getActivationStatus: async (id: number) => activation(await http.request<ActivationStatus>('GET', `/api/horses/${id}/activation-status`)),
    /** Owner picker: shared contract, Club Manager only (CORE-003). */
    listHorseOwners: () =>
      http.request<Page<UserSummary>>('GET', '/api/admin/users', { query: { role: 'HORSE_OWNER', status: 'ACTIVE', size: 100 } }),
  };
}

export type HorsesApi = ReturnType<typeof createHorsesApi>;
