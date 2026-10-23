import type { AuditQuery } from './types';

export type AuditFilterValues = Record<'actor' | 'action' | 'targetType' | 'from' | 'to', string>;
export type AuditFilterErrors = Partial<Record<keyof AuditFilterValues | 'page' | 'size', string>>;

export function isAuditDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDay && !/T24:/.test(value);
}

function wholeNumber(value: string): number { return /^\d+$/.test(value) ? Number(value) : Number.NaN; }

export function validateAuditQuery(query: AuditQuery): AuditFilterErrors {
  const errors: AuditFilterErrors = {};
  if (query.actor !== undefined && (!Number.isSafeInteger(query.actor) || query.actor <= 0)) errors.actor = 'Nhập mã người thực hiện là số nguyên dương.';
  if ((query.action?.length ?? 0) > 100) errors.action = 'Tối đa 100 ký tự.';
  if ((query.targetType?.length ?? 0) > 50) errors.targetType = 'Tối đa 50 ký tự.';
  for (const key of ['from', 'to'] as const) {
    const date = query[key];
    if (date && !isAuditDate(date)) errors[key] = 'Chọn ngày giờ hợp lệ.';
  }
  if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) errors.to = 'Thời điểm kết thúc phải sau hoặc bằng thời điểm bắt đầu.';
  if (!Number.isSafeInteger(query.page) || query.page < 0) errors.page = 'Số trang phải từ 0 trở lên.';
  if (!Number.isSafeInteger(query.size) || query.size < 1 || query.size > 100) errors.size = 'Số bản ghi mỗi trang phải từ 1 đến 100.';
  return errors;
}

export function readAuditQuery(params: URLSearchParams): AuditQuery {
  return {
    actor: params.has('actor') ? wholeNumber(params.get('actor')!) : undefined,
    action: params.get('action') || undefined,
    targetType: params.get('targetType') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    page: params.has('page') ? wholeNumber(params.get('page')!) : 0,
    size: params.has('size') ? wholeNumber(params.get('size')!) : 20,
  };
}

export function auditSearchParams(query: AuditQuery): URLSearchParams {
  const params = new URLSearchParams();
  // Explicit allow-list: search/role are current-page UI filters, never invented API parameters.
  for (const key of ['actor', 'action', 'targetType', 'from', 'to', 'page', 'size'] as const) {
    const value = query[key];
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params;
}

export function localDateInput(iso?: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function filtersFromQuery(query: AuditQuery): AuditFilterValues {
  return { actor: query.actor === undefined ? '' : String(query.actor), action: query.action ?? '', targetType: query.targetType ?? '', from: localDateInput(query.from), to: localDateInput(query.to) };
}

export function queryFromFilters(values: AuditFilterValues, size: number): AuditQuery {
  const toISO = (value: string) => {
    if (!value) return undefined;
    // Validate the calendar before Date can silently roll e.g. February 30 into March.
    return isAuditDate(`${value}Z`) ? new Date(value).toISOString() : value;
  };
  return { actor: values.actor.trim() ? wholeNumber(values.actor.trim()) : undefined, action: values.action.trim() || undefined, targetType: values.targetType.trim() || undefined, from: toISO(values.from), to: toISO(values.to), page: 0, size };
}
