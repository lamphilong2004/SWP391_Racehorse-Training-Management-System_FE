import { ApiError, requestApi, type CurrentUser } from '../../shared/auth/authApi';
import { isIncidentType } from '../../shared/incidents/incidentTypes';
import type { IncidentCreateRequest } from '../../shared/incidents';
import type { Incident, Page } from './models';
import { readPage } from './validation';
export interface IncidentService {
  list: (page: number) => Promise<Page<Incident>>;
  get: (id: number) => Promise<Incident>;
  report: (input: IncidentCreateRequest) => Promise<Incident>;
  review: (id: number, action: 'OPEN_CASE' | 'LINK_CASE' | 'RESOLVE', caseId?: number) => Promise<Incident>;
  /** OPEN medical cases of one horse, so the Veterinarian links by choosing instead of typing a case id. */
  openCases?: (horseId: number) => Promise<OpenCase[]>;
}
export interface OpenCase { id: number; openedAt: string; reason?: string | null }
const invalid = () => new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu sự cố không có hoặc không hợp lệ.');
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
export function readIncident(v: unknown, actor: Pick<CurrentUser, 'id' | 'roles'>): Incident {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid();
  const x = v as Record<string, unknown>;
  const keys = ['id', 'incidentCode', 'horseId', 'reportedByUserId', 'reportedByName', 'reportedByRole', 'medicalCaseId', 'preSessionCheckId', 'trainingSessionId', 'careTaskId', 'incidentType', 'observedSeverity', 'description', 'observedAt', 'reportedAt', 'status'];
  if (Object.keys(x).some((k) => !keys.includes(k)) || !positive(x.id) || typeof x.incidentCode !== 'string' || !x.incidentCode.trim() || !positive(x.horseId) || !positive(x.reportedByUserId) ||
    !isIncidentType(x.incidentType) || (x.reportedByName != null && typeof x.reportedByName !== 'string') || (x.reportedByRole != null && typeof x.reportedByRole !== 'string') || !['LOW', 'MEDIUM', 'HIGH'].includes(String(x.observedSeverity)) ||
    !['REPORTED', 'UNDER_REVIEW', 'RESOLVED'].includes(String(x.status)) || typeof x.observedAt !== 'string' || !Number.isFinite(Date.parse(x.observedAt)) || typeof x.reportedAt !== 'string' || !Number.isFinite(Date.parse(x.reportedAt)) ||
    (x.description !== undefined && typeof x.description !== 'string') || ['medicalCaseId', 'preSessionCheckId', 'trainingSessionId', 'careTaskId'].some((k) => x[k] !== undefined && !positive(x[k]))) throw invalid();
  if (actor.roles.includes('GROOM') && !actor.roles.some((role) => ['VETERINARIAN', 'HEAD_TRAINER', 'CLUB_MANAGER'].includes(role)) && x.reportedByUserId !== actor.id)
    throw new ApiError(403, 'FORBIDDEN', 'Tài khoản của bạn không xem được báo cáo này.');
  return x as unknown as Incident;
}
export function createIncidentService(token: string, actor: Pick<CurrentUser, 'id' | 'roles'>, onError?: (error: unknown) => boolean, options: { baseUrl?: string; fetcher?: typeof fetch } = {}): IncidentService {
  const idPath = (id: number) => { if (!positive(id)) throw new Error('Mã sự cố không hợp lệ.'); return `/api/incidents/${id}`; };
  async function request(path: string, body?: unknown) {
    try { return await requestApi<unknown>(path, { method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { token, ...options }); }
    catch (error) { onError?.(error); throw error; }
  }
  const read = (v: unknown) => readIncident(v, actor);
  return {
    list: async (page) => { if (!Number.isSafeInteger(page) || page < 0) throw new Error('Trang không hợp lệ.'); return readPage(await request(`/api/incidents?page=${page}&size=50`), read, page); },
    get: async (id) => { const result = read(await request(idPath(id))); if (result.id !== id) throw invalid(); return result; },
    report: async (input) => {
      const result = read(await request('/api/incidents', input));
      if (result.horseId !== input.horseId || result.reportedByUserId !== actor.id || result.status !== 'REPORTED') throw invalid();
      return result;
    },
    review: async (id, action, caseId) => {
      if (!actor.roles.includes('VETERINARIAN')) throw new ApiError(403, 'FORBIDDEN', 'Chỉ Veterinarian được xem xét sự cố.');
      if (action === 'LINK_CASE' && !positive(caseId)) throw new Error('Nhập mã ca y tế là số dương hợp lệ.');
      const result = read(await request(`${idPath(id)}/review`, action === 'LINK_CASE' ? { action, medicalCaseId: caseId } : { action }));
      if (result.id !== id || result.status !== (action === 'RESOLVE' ? 'RESOLVED' : 'UNDER_REVIEW') || (action !== 'RESOLVE' && !result.medicalCaseId)) throw invalid();
      return result;
    },
    openCases: actor.roles.includes('VETERINARIAN') ? async (horseId) => {
      const page = await request('/api/medical/cases?page=0&size=100') as { items?: unknown };
      const items = Array.isArray(page?.items) ? page.items : [];
      return items.flatMap((v) => {
        const c = v as Record<string, unknown>;
        return positive(c.id) && c.horseId === horseId && c.status === 'OPEN' && typeof c.openedAt === 'string'
          ? [{ id: Number(c.id), openedAt: c.openedAt, reason: typeof c.reason === 'string' ? c.reason : null }] : [];
      });
    } : undefined,
  };
}
