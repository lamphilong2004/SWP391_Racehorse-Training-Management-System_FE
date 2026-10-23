import { REGISTRATION_STATUSES, type RegisterRequest, type RegistrationQuery } from './types';

/** DEC-008 password policy shared by registration and password reset (the server re-validates). */
export function passwordAllowed(password: string) {
  const length = Array.from(password).length;
  return length >= 8 && length <= 64 && /\p{L}/u.test(password) && /\p{Nd}/u.test(password) && new TextEncoder().encode(password).length <= 72;
}

export function validateRegistration(input: RegisterRequest): Partial<Record<keyof RegisterRequest, string>> {
  const errors: Partial<Record<keyof RegisterRequest, string>> = {};
  if (!input.fullName.trim() || input.fullName.trim().length > 150) errors.fullName = 'Nhập họ và tên, tối đa 150 ký tự.';
  if (!/^[^\s@]+@[^\s@]+$/u.test(input.email.trim()) || input.email.trim().length > 254) errors.email = 'Nhập email hợp lệ, tối đa 254 ký tự.';
  if (!passwordAllowed(input.password) || input.password === input.email.trim()) {
    errors.password = 'Dùng 8–64 ký tự, có chữ cái và chữ số, tối đa 72 byte UTF-8, khác với email.';
  }
  if (!input.confirmPassword || input.confirmPassword !== input.password) errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
  return errors;
}

export function validateQuery(query: RegistrationQuery): string | undefined {
  if (query.status !== undefined && !(REGISTRATION_STATUSES as readonly string[]).includes(query.status)) return 'Hãy chọn trạng thái đăng ký hợp lệ.';
  if (!Number.isSafeInteger(query.page) || query.page < 0) return 'Số trang phải là số nguyên từ 0.';
  if (!Number.isSafeInteger(query.size) || query.size < 1 || query.size > 100) return 'Số bản ghi mỗi trang phải từ 1 đến 100.';
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
