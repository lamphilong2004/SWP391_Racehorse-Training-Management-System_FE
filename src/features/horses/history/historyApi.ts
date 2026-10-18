import { ApiError, requestApi } from '../../../shared/auth/authApi';
import { authSession } from '../../../shared/auth/authSession';
import type { Ownership, Page, StableAssignment } from '../api/types';
import type { HorseHistoryService, ReadinessChecklist, TimelineEvent } from './historyTypes';

const invalid = () => new ApiError(502, 'INVALID_RESPONSE', 'Horse history does not match the API contract.');
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Record<string, unknown>; };
const list = (v: unknown): unknown[] => { if (!Array.isArray(v)) throw invalid(); return v; };
const int = (v: unknown, min = 0): number => { if (!Number.isSafeInteger(v) || (v as number) < min) throw invalid(); return v as number; };
const text = (v: unknown): string => { if (typeof v !== 'string') throw invalid(); return v; };
const instant = (v: unknown): string => { const s = text(v); if (!Number.isFinite(Date.parse(s)) || !/(Z|[+-]\d\d:\d\d)$/.test(s)) throw invalid(); return s; };
const date = (v: unknown): string => { const s = text(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) throw invalid(); return s; };
const nullableDate = (v: unknown) => v == null ? null : date(v);
const user = (v: unknown) => { const u = object(v); return { id: int(u.id, 1), fullName: text(u.fullName), ...(u.userCode == null ? {} : { userCode: text(u.userCode) }) }; };
export function parseChecklist(value: unknown, id: number): ReadinessChecklist {
  const v = object(value); if (int(v.horseId, 1) !== id) throw invalid();
  const expected = ['IDENTITY', 'PEDIGREE', 'OWNER', 'FREE_STABLE_BOX', 'VETERINARIAN_BASELINE', 'HEAD_TRAINER_READINESS_REVIEW'];
  const items = list(v.checklist); if (items.length !== 6) throw invalid();
  const checklist = items.map((item, index) => {
    const c = object(item); if (c.id !== expected[index] || typeof c.label !== 'string' || typeof c.description !== 'string') throw invalid();
    const recommended = index === 5;
    if (c.requirement !== (recommended ? 'RECOMMENDED' : 'MANDATORY') || !(recommended ? ['REVIEWED', 'NOT_REVIEWED'] : ['SATISFIED', 'PENDING']).includes(String(c.state))) throw invalid();
    return { id: c.id, label: c.label, description: c.description, requirement: c.requirement, state: c.state } as ReadinessChecklist['checklist'][number];
  });
  if (!['DRAFT', 'ACTIVE', 'INACTIVE'].includes(String(v.lifecycle))) throw invalid();
  return { horseId: id, horseCode: text(v.horseCode), name: text(v.name), lifecycle: v.lifecycle as ReadinessChecklist['lifecycle'], activatedAt: v.activatedAt == null ? null : instant(v.activatedAt), checklist };
}
/** Shared HTTP client, exact pinned paths, no error-to-sample fallback. */
export function createHorseHistoryApi(options: { fetcher?: typeof fetch; baseUrl?: string; getToken?: () => string | undefined } = {}): HorseHistoryService {
  const call = async (id: number, suffix: string, signal?: AbortSignal, method = 'GET') => {
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a valid horse.');
    signal?.throwIfAborted(); const token = options.getToken ? options.getToken() : authSession.read()?.accessToken;
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in again to view horse history.');
    let responseStatus: number | undefined;
    const fetcher: typeof fetch = async (input, init) => { const response = await (options.fetcher ?? fetch)(input, init); responseStatus = response.status; return response; };
    const value = await requestApi<unknown>(`/api/horses/${id}/${suffix}`, { method, signal }, { ...options, token, fetcher });
    if (method === 'POST' && responseStatus !== 204) throw invalid();
    signal?.throwIfAborted(); return value;
  };
  return {
    source: 'api',
    async timeline(id, page, signal) {
      if (!Number.isSafeInteger(page) || page < 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a valid page.');
      const v = object(await call(id, `timeline?page=${page}&size=20`, signal));
      const items = list(v.items).map((value): TimelineEvent => { const e = object(value); return { occurredAt: instant(e.occurredAt), eventType: text(e.eventType), title: text(e.title) }; });
      return { items, page: int(v.page), size: int(v.size, 1), totalItems: int(v.totalItems), totalPages: int(v.totalPages) } satisfies Page<TimelineEvent>;
    },
    async ownerships(id, signal) { return list(await call(id, 'ownerships', signal)).map((value): Ownership => { const v = object(value); if (typeof v.sharePercentage !== 'number' || !Number.isFinite(v.sharePercentage) || v.sharePercentage <= 0 || v.sharePercentage > 100 || typeof v.isManagingOwner !== 'boolean') throw invalid(); return { id: int(v.id, 1), owner: user(v.owner), sharePercentage: v.sharePercentage, effectiveFrom: date(v.effectiveFrom), effectiveTo: nullableDate(v.effectiveTo), isManagingOwner: v.isManagingOwner }; }); },
    async assignments(id, signal) { return list(await call(id, 'stable-assignments', signal)).map((value): StableAssignment => { const v = object(value); return { id: int(v.id, 1), stableBoxId: int(v.stableBoxId, 1), boxCode: text(v.boxCode), yard: v.yard == null ? null : text(v.yard), effectiveFrom: date(v.effectiveFrom), effectiveTo: nullableDate(v.effectiveTo), reason: null, assignedBy: user(v.assignedBy) }; }); },
    async checklist(id, signal) { return parseChecklist(await call(id, 'activation-status', signal), id); },
    async acknowledge(id) { const result = await call(id, 'readiness-review', undefined, 'POST'); if (result !== undefined) throw invalid(); },
  };
}
