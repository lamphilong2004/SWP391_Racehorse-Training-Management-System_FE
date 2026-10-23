import { ApiError, requestApi } from '../../shared/auth/authApi';
import { isRoleCode } from '../../shared/auth/roles';
import { auditSearchParams, isAuditDate, validateAuditQuery } from './auditQuery';
import type { AuditEntry, AuditPage, ClubManagerDashboard, CountByKey, ManagementService } from './types';

function invalid(): never { throw new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu quản lý trả về không hợp lệ.'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid();
  return value;
}
function text(value: unknown): string { if (typeof value !== 'string') return invalid(); return value; }
function optionalText(value: unknown): string | null | undefined { return value == null ? value : text(value); }
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) return invalid();
  return value.map(parse);
}
function counts(value: unknown, keys?: readonly string[]): CountByKey[] {
  const result = list(value, (item) => { const row = record(item); return { key: text(row.key), count: integer(row.count) }; });
  if (new Set(result.map((row) => row.key)).size !== result.length) return invalid();
  if (keys && result.some((row) => !keys.includes(row.key))) return invalid();
  return result;
}

/** Only approved, display-safe fields cross the boundary; never spread arbitrary server audit payloads. */
export function parseAuditEntry(value: unknown): AuditEntry {
  const row = record(value);
  const occurredAt = text(row.occurredAt);
  if (!isAuditDate(occurredAt)) return invalid();
  let actor: AuditEntry['actor'];
  if (row.actor != null) {
    const user = record(row.actor);
    actor = { id: integer(user.id), fullName: text(user.fullName), userCode: optionalText(user.userCode) ?? undefined };
  } else actor = row.actor;
  const role = row.actorRole;
  if (role != null && (typeof role !== 'string' || !isRoleCode(role))) return invalid();
  return {
    id: integer(row.id), occurredAt, actor, actorRole: role as AuditEntry['actorRole'], action: text(row.action),
    targetType: optionalText(row.targetType), targetId: row.targetId == null ? row.targetId : integer(row.targetId),
    safeSummary: optionalText(row.safeSummary), source: optionalText(row.source),
  };
}

export function parseAuditPage(value: unknown): AuditPage {
  const row = record(value);
  const result = { items: list(row.items, parseAuditEntry), page: integer(row.page), size: integer(row.size), totalItems: integer(row.totalItems), totalPages: integer(row.totalPages) };
  if (result.size < 1 || result.size > 100 || result.items.length > result.size || new Set(result.items.map((entry) => entry.id)).size !== result.items.length) return invalid();
  if (result.totalPages !== Math.ceil(result.totalItems / result.size)) return invalid();
  return result;
}

export function parseDashboard(value: unknown): ClubManagerDashboard {
  const row = record(value), boxes = record(row.boxOccupancy), needs = record(row.needsAttention), training = record(row.trainingToday);
  const recentAudit = list(row.recentAudit, parseAuditEntry);
  if (recentAudit.length > 10) return invalid();
  return {
    horsesByLifecycle: counts(row.horsesByLifecycle, ['DRAFT', 'ACTIVE', 'INACTIVE']), horsesByAvailability: counts(row.horsesByAvailability, ['AVAILABLE', 'LIMITED', 'LOCKED']),
    boxOccupancy: { total: integer(boxes.total), occupied: integer(boxes.occupied), free: integer(boxes.free) },
    accountsByStatus: counts(row.accountsByStatus, ['ACTIVE', 'INACTIVE']), needsAttention: { pendingActivations: integer(needs.pendingActivations), pendingRegistrations: integer(needs.pendingRegistrations) },
    trainingToday: { byStatus: counts(training.byStatus) }, openIncidents: integer(row.openIncidents), recentAudit,
  };
}

/** Default transport is the shared real HTTP client. API failures never switch to sample data. */
export function createManagementService(options: { fetcher?: typeof fetch; baseUrl?: string } = {}): ManagementService {
  return {
    dashboard: async ({ token, signal }) => parseDashboard(await requestApi('/api/dashboard/club-manager', { method: 'GET', signal }, { ...options, token })),
    audit: async (query, { token, signal }) => {
      if (Object.keys(validateAuditQuery(query)).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Hãy kiểm tra bộ lọc nhật ký.');
      const page = parseAuditPage(await requestApi(`/api/admin/audit-log?${auditSearchParams(query)}`, { method: 'GET', signal }, { ...options, token }));
      if (page.page !== query.page || page.size !== query.size) return invalid();
      return page;
    },
  };
}
