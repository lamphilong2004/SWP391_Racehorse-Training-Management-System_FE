import { ApiError, requestApi } from '../../shared/auth/authApi';
import { readActiveHerd, readHorseIdentityData, type HorseIdentity } from './horseRead';
import { readAvailability, readPage } from './validation';

/** CORE-006 MedicalCaseSummary only. Never reuse the Vet clinical reader for Head Trainer. */
export interface CaseSummary { id: number; horseId: number; status: 'OPEN' | 'CLOSED'; openedAt: string; closedAt?: string }
export interface SummaryHorse extends HorseIdentity { breed?: string | null; sex?: string | null; foaledDate?: string | null; yard?: string | null; latestWeight?: { weightKg: number; recordedAt: string } | null }
export interface SummaryService {
  listHorses: () => ReturnType<typeof readActiveHerd>;
  getHorse: (id: number) => Promise<SummaryHorse>;
  getAvailability: (id: number) => Promise<import('./models').TrainingAvailability>;
  listCases: () => Promise<CaseSummary[]>;
}
const invalid = () => new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu tóm tắt không hợp lệ.');
function readSummary(value: unknown): CaseSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['id', 'horseId', 'status', 'openedAt', 'closedAt'].includes(key)) ||
    !Number.isSafeInteger(v.id) || Number(v.id) < 1 || !Number.isSafeInteger(v.horseId) || Number(v.horseId) < 1 ||
    !['OPEN', 'CLOSED'].includes(String(v.status)) || typeof v.openedAt !== 'string' || !Number.isFinite(Date.parse(v.openedAt)) ||
    (v.closedAt !== undefined && (typeof v.closedAt !== 'string' || !Number.isFinite(Date.parse(v.closedAt))))) throw invalid();
  return v as unknown as CaseSummary;
}
export function createSummaryService(token: string, onError?: (error: unknown) => boolean, options: { baseUrl?: string; fetcher?: typeof fetch } = {}): SummaryService {
  async function get(path: string) {
    try { return await requestApi<unknown>(path, { method: 'GET' }, { token, ...options }); }
    catch (error) { onError?.(error); throw error; }
  }
  return {
    listHorses: () => readActiveHerd(token, onError, options),
    getHorse: async (id) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('Mã ngựa không hợp lệ.');
      const raw = await get(`/api/horses/${id}`), identity = readHorseIdentityData(raw), v = raw as Record<string, unknown>;
      if (identity.id !== id || ['breed', 'sex'].some((key) => v[key] != null && typeof v[key] !== 'string') ||
        (v.foaledDate != null && (typeof v.foaledDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.foaledDate) || !Number.isFinite(Date.parse(v.foaledDate))))) throw invalid();
      const assignment = v.currentAssignment as { yard?: unknown } | null | undefined;
      if (assignment != null && (typeof assignment !== 'object' || Array.isArray(assignment) || (assignment.yard != null && typeof assignment.yard !== 'string'))) throw invalid();
      const weight = v.latestWeight as { weightKg: unknown; recordedAt: unknown } | null | undefined;
      if (weight != null && (typeof weight !== 'object' || Array.isArray(weight) || typeof weight.weightKg !== 'number' || !Number.isFinite(weight.weightKg) || weight.weightKg <= 0 || typeof weight.recordedAt !== 'string' || !Number.isFinite(Date.parse(weight.recordedAt)))) throw invalid();
      return { ...identity, breed: v.breed as string | null | undefined, sex: v.sex as string | null | undefined, foaledDate: v.foaledDate as string | null | undefined,
        yard: assignment?.yard as string | null | undefined, latestWeight: weight ? { weightKg: Number(weight.weightKg), recordedAt: String(weight.recordedAt) } : weight };
    },
    getAvailability: async (id) => {
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('Mã ngựa không hợp lệ.');
      return readAvailability(await get(`/api/horses/${id}/training-availability`), id);
    },
    listCases: async () => {
      const load = async (page: number) => readPage(await get(`/api/medical/cases?page=${page}&size=100`), readSummary, page);
      const first = await load(0), result = [...first.items];
      for (let page = 1; page < Math.ceil(first.totalElements / first.size); page++) {
        const next = await load(page);
        if (next.totalElements !== first.totalElements || next.size !== first.size) throw invalid();
        result.push(...next.items);
      }
      if (result.length !== first.totalElements || new Set(result.map((r) => r.id)).size !== result.length) throw invalid();
      return result;
    },
  };
}
