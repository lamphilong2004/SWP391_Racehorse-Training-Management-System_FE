import { ApiError, requestApi } from '../../shared/auth/authApi';
import type { Page } from './models';
import { readHorseIdentity } from './horseRead';

/** CORE-006 GroomTreatmentTask: never includes clinical case or plan fields. */
export interface GroomTreatmentTask {
  id: number;
  horseId: number;
  assignedGroomUserId: number;
  instruction: string;
  taskDate: string;
  scheduledSlot?: string;
  status: 'PENDING' | 'COMPLETED';
  completedAt?: string;
}
const allowed = new Set(['id', 'horseId', 'assignedGroomUserId', 'instruction', 'taskDate', 'scheduledSlot', 'status', 'completedAt']);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function validTask(v: unknown, actorId: number): v is GroomTreatmentTask {
  return object(v) && Object.keys(v).every((key) => allowed.has(key)) && positive(v.id) && positive(v.horseId) &&
    v.assignedGroomUserId === actorId && typeof v.instruction === 'string' && v.instruction.length <= 2000 && validDate(v.taskDate) &&
    (v.scheduledSlot === undefined || (typeof v.scheduledSlot === 'string' && v.scheduledSlot.length <= 50)) &&
    (v.status === 'PENDING' || v.status === 'COMPLETED') &&
    (v.completedAt === undefined || (typeof v.completedAt === 'string' && Number.isFinite(Date.parse(v.completedAt)))) &&
    (v.status !== 'COMPLETED' || typeof v.completedAt === 'string') && (v.status !== 'PENDING' || v.completedAt === undefined);
}
const invalid = () => new ApiError(200, 'INVALID_RESPONSE', 'Treatment task data does not match the authorized contract. Reload to retry.');

export function createGroomService(token: string, actorId: number, onApiError?: (error: unknown) => boolean,
  options: { baseUrl?: string; fetcher?: typeof fetch } = {}) {
  if (!token.trim() || !positive(actorId)) throw new Error('An authenticated Groom session is required.');
  async function request(path: string, init: RequestInit = {}) {
    try { return await requestApi<unknown>(path, init, { token, ...options }); }
    catch (error) { onApiError?.(error); throw error; }
  }
  return {
    horse: (horseId: number) => readHorseIdentity(token, horseId, onApiError, options),
    async list(page = 0): Promise<Page<GroomTreatmentTask>> {
      if (!Number.isSafeInteger(page) || page < 0) throw new Error('Invalid page.');
      const v = await request(`/api/groom/treatment-tasks?page=${page}&size=100`, { method: 'GET' });
      if (!object(v) || !Array.isArray(v.items) || v.page !== page || !positive(v.size) || v.size > 100 ||
        !Number.isSafeInteger(v.totalElements) || Number(v.totalElements) < 0 || !v.items.every((row) => validTask(row, actorId))) throw invalid();
      return v as unknown as Page<GroomTreatmentTask>;
    },
    async complete(id: number): Promise<GroomTreatmentTask> {
      if (!positive(id)) throw new Error('Invalid task ID.');
      // Actor/time are supplied by the server JWT. Completion notes have no approved persistence contract.
      const v = await request(`/api/groom/treatment-tasks/${id}/complete`, { method: 'POST', body: '{}' });
      if (!validTask(v, actorId) || v.id !== id || v.status !== 'COMPLETED') throw invalid();
      return v;
    },
  };
}
type LiveGroomService = ReturnType<typeof createGroomService>;
export type GroomService = Pick<LiveGroomService, 'list' | 'complete'> & Partial<Pick<LiveGroomService, 'horse'>>;

/** Collect ONLY the server's JWT-scoped pages. Fail instead of silently showing a partial list. */
export async function collectAssignedTasks(service: Pick<GroomService, 'list'>): Promise<GroomTreatmentTask[]> {
  const first = await service.list(0), tasks = [...first.items];
  const pages = Math.ceil(first.totalElements / first.size);
  for (let page = 1; page < pages; page++) {
    const next = await service.list(page);
    if (next.page !== page || next.size !== first.size || next.totalElements !== first.totalElements) throw invalid();
    tasks.push(...next.items);
  }
  if (tasks.length !== first.totalElements || new Set(tasks.map((task) => task.id)).size !== tasks.length) throw invalid();
  return tasks;
}
