import { ApiError, requestApi } from '../../shared/auth/authApi';
import type { Availability, HealthStatus } from './models';

/** Approved CORE-004 HorseSummary allowlist, consumed read-only by the Vet overview. */
export interface HorseIdentity {
  id: number; horseCode: string; name: string; lifecycle: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  healthStatus?: HealthStatus | null; trainingAvailability: Availability; currentBoxCode?: string | null;
}
export interface HerdHorse extends HorseIdentity { lifecycle: 'ACTIVE' }
function object(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && Number(v) >= min;
const invalid = () => new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu tổng quan ngựa chưa đầy đủ hoặc không hợp lệ. Hãy tải lại để thử lại.');
export function readHorseIdentityData(v: unknown): HorseIdentity {
  if (!object(v) || !integer(v.id, 1) || typeof v.horseCode !== 'string' || typeof v.name !== 'string' || !['DRAFT', 'ACTIVE', 'INACTIVE'].includes(String(v.lifecycle)) ||
    !['AVAILABLE', 'LIMITED', 'LOCKED'].includes(String(v.trainingAvailability)) ||
    (v.healthStatus != null && !['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'].includes(String(v.healthStatus))) ||
    (v.currentBoxCode != null && typeof v.currentBoxCode !== 'string')) throw invalid();
  return { id: v.id, horseCode: v.horseCode, name: v.name, lifecycle: v.lifecycle as HorseIdentity['lifecycle'], healthStatus: v.healthStatus as HorseIdentity['healthStatus'],
    trainingAvailability: v.trainingAvailability as Availability, currentBoxCode: v.currentBoxCode as HorseIdentity['currentBoxCode'] };
}
function horse(v: unknown): HerdHorse {
  const result = readHorseIdentityData(v);
  if (result.lifecycle !== 'ACTIVE') throw invalid();
  return { ...result, lifecycle: 'ACTIVE' };
}
/** Read only the already-assigned horse IDs for Groom; the approved GET is non-clinical. */
export async function readHorseIdentity(token: string, id: number, onApiError?: (error: unknown) => boolean, options: { baseUrl?: string; fetcher?: typeof fetch } = {}): Promise<HorseIdentity> {
  if (!integer(id, 1)) throw new Error('Mã ngựa không hợp lệ.');
  try {
    const result = readHorseIdentityData(await requestApi<unknown>(`/api/horses/${id}`, { method: 'GET' }, { token, ...options }));
    if (result.id !== id) throw invalid();
    return result;
  } catch (error) { onApiError?.(error); throw error; }
}
export async function readActiveHerd(token: string, onApiError?: (error: unknown) => boolean, options: { baseUrl?: string; fetcher?: typeof fetch } = {}): Promise<HerdHorse[]> {
  async function page(number: number) {
    let v: unknown;
    try { v = await requestApi<unknown>(`/api/horses?lifecycle=ACTIVE&page=${number}&size=100`, { method: 'GET' }, { token, ...options }); }
    catch (error) { onApiError?.(error); throw error; }
    if (!object(v) || !Array.isArray(v.items) || v.page !== number || !integer(v.size, 1) || !integer(v.totalItems) || !integer(v.totalPages) || v.items.length > v.size) throw invalid();
    return { items: v.items.map(horse), page: number, size: v.size, totalItems: v.totalItems, totalPages: v.totalPages };
  }
  const first = await page(0), result = [...first.items];
  for (let number = 1; number < first.totalPages; number++) {
    const next = await page(number);
    if (next.size !== first.size || next.totalItems !== first.totalItems || next.totalPages !== first.totalPages) throw invalid();
    result.push(...next.items);
  }
  if (result.length !== first.totalItems || new Set(result.map((h) => h.id)).size !== result.length) throw invalid();
  return result;
}
