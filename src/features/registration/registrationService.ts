import { ApiError, requestApi } from '../../shared/auth/authApi';
import { isRoleCode } from '../../shared/auth/roles';
import { REGISTRATION_STATUSES, type RegistrationRequest, type RegistrationService, type RequestContext } from './types';
import { queryParams, validateQuery, validateRegistration } from './validation';

function invalid(): never { throw new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu đăng ký trả về không hợp lệ.'); }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(); return value as Record<string, unknown>; }
function text(value: unknown, max?: number): string { if (typeof value !== 'string' || (max && value.length > max)) return invalid(); return value; }
function integer(value: unknown, minimum = 0): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) return invalid(); return value; }
function iso(value: unknown): string { const result = text(value); if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) return invalid(); return result; }
function optional<T>(value: unknown, parse: (value: unknown) => T): T | null | undefined { return value == null ? value : parse(value); }

/** Explicit display-field projection: password/hash/extra properties never cross into UI state. */
export function parseRegistration(value: unknown): RegistrationRequest {
  const row = object(value);
  if (!(REGISTRATION_STATUSES as readonly unknown[]).includes(row.status)) return invalid();
  return {
    id: integer(row.id, 1), fullName: text(row.fullName, 150), email: text(row.email, 254), status: row.status as RegistrationRequest['status'], requestedAt: iso(row.requestedAt),
    reviewedAt: optional(row.reviewedAt, iso), reviewedBy: optional(row.reviewedBy, (value) => { const user = object(value); return { id: integer(user.id, 1), fullName: text(user.fullName), userCode: optional(user.userCode, text) }; }),
    approvedRoleCode: optional(row.approvedRoleCode, (value) => { if (typeof value !== 'string' || !isRoleCode(value)) return invalid(); return value; }),
    createdUserId: optional(row.createdUserId, (value) => integer(value, 1)), decisionReason: optional(row.decisionReason, (value) => text(value, 500)),
  };
}

const endpoint = '/api/admin/registrations';
export function createRegistrationService(options: { fetcher?: typeof fetch; baseUrl?: string } = {}): RegistrationService {
  const authenticated = <T,>(path: string, context: RequestContext, method = 'GET', body?: object) => {
    if (!context.token.trim()) throw new ApiError(401, 'UNAUTHORIZED', 'Đăng nhập để duyệt yêu cầu đăng ký.');
    return requestApi<T>(path, { method, signal: context.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { ...options, token: context.token });
  };
  const idPath = (id: number) => { if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, 'VALIDATION_ERROR', 'Hãy chọn yêu cầu đăng ký hợp lệ.'); return `${endpoint}/${id}`; };
  return {
    register: async (input) => {
      if (Object.keys(validateRegistration(input)).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Hãy kiểm tra thông tin đăng ký.');
      // Public request deliberately has no bearer token or role, including extra caller properties.
      const result = object(await requestApi('/api/auth/register', { method: 'POST', body: JSON.stringify({ fullName: input.fullName.trim(), email: input.email.trim(), password: input.password, confirmPassword: input.confirmPassword }) }, options));
      if (!text(result.message).trim()) return invalid();
    },
    list: async (query, context) => {
      if (validateQuery(query)) throw new ApiError(400, 'VALIDATION_ERROR', 'Hãy kiểm tra bộ lọc đăng ký.');
      const row = object(await authenticated(`${endpoint}?${queryParams(query)}`, context));
      if (!Array.isArray(row.items)) return invalid();
      const result = { items: row.items.map(parseRegistration), page: integer(row.page), size: integer(row.size, 1), totalItems: integer(row.totalItems), totalPages: integer(row.totalPages) };
      if (result.page !== query.page || result.size !== query.size || result.totalPages !== Math.ceil(result.totalItems / result.size) || result.items.length > result.size || new Set(result.items.map((item) => item.id)).size !== result.items.length || result.items.some((item) => query.status && item.status !== query.status)) return invalid();
      return result;
    },
    approve: async (id, roleCode, context) => {
      if (!isRoleCode(roleCode)) throw new ApiError(400, 'VALIDATION_ERROR', 'Hãy chọn đúng một vai trò.');
      const result = parseRegistration(await authenticated(`${idPath(id)}/approve`, context, 'POST', { roleCode }));
      if (result.id !== id || result.status !== 'APPROVED' || (result.approvedRoleCode != null && result.approvedRoleCode !== roleCode)) return invalid();
      return result;
    },
    reject: async (id, reason, context) => {
      if (reason.length > 500) throw new ApiError(400, 'VALIDATION_ERROR', 'Lý do tối đa 500 ký tự.');
      const result = parseRegistration(await authenticated(`${idPath(id)}/reject`, context, 'POST', reason.trim() ? { reason: reason.trim() } : {}));
      if (result.id !== id || result.status !== 'REJECTED') return invalid();
      return result;
    },
  };
}
