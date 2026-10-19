import { REGISTRATION_STATUSES, type RegisterRequest, type RegistrationQuery } from './types';

export function validateRegistration(input: RegisterRequest): Partial<Record<keyof RegisterRequest, string>> {
  const errors: Partial<Record<keyof RegisterRequest, string>> = {};
  if (!input.fullName.trim() || input.fullName.trim().length > 150) errors.fullName = 'Enter your full name, up to 150 characters.';
  if (!/^[^\s@]+@[^\s@]+$/u.test(input.email.trim()) || input.email.trim().length > 254) errors.email = 'Enter a valid email, up to 254 characters.';
  const length = Array.from(input.password).length;
  if (length < 8 || length > 64 || !/\p{L}/u.test(input.password) || !/\p{Nd}/u.test(input.password) || new TextEncoder().encode(input.password).length > 72 || input.password === input.email.trim()) {
    errors.password = 'Use 8–64 characters with a letter and a digit, at most 72 UTF-8 bytes, different from your email.';
  }
  if (!input.confirmPassword || input.confirmPassword !== input.password) errors.confirmPassword = 'Passwords must match.';
  return errors;
}

export function validateQuery(query: RegistrationQuery): string | undefined {
  if (query.status !== undefined && !(REGISTRATION_STATUSES as readonly string[]).includes(query.status)) return 'Choose a valid registration status.';
  if (!Number.isSafeInteger(query.page) || query.page < 0) return 'Page must be a zero-based whole number.';
  if (!Number.isSafeInteger(query.size) || query.size < 1 || query.size > 100) return 'Page size must be between 1 and 100.';
}
export function queryFromParams(params: URLSearchParams): RegistrationQuery {
  const integer = (name: string, fallback: number) => params.has(name) ? (/^\d+$/.test(params.get(name) ?? '') ? Number(params.get(name)) : NaN) : fallback;
  return { ...(params.has('status') ? { status: params.get('status') as RegistrationQuery['status'] } : {}), page: integer('page', 0), size: integer('size', 20) };
}
export function queryParams(query: RegistrationQuery): URLSearchParams {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
  if (query.status) params.set('status', query.status);
  return params;
}
