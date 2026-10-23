import type { RoleCode } from './roles';
import { getBusinessActor, usesSampleData } from '../data/businessData';
import { resolveApiBase } from '../apiOrigin';

const API_BASE_URL = resolveApiBase(import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8080' : ''), import.meta.env.DEV);

export interface CurrentUser {
  id: number;
  userCode: string;
  fullName: string;
  email: string;
  roles: RoleCode[];
  accountStatus: 'ACTIVE' | 'INACTIVE';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: CurrentUser;
}

export interface ApiErrorDetail {
  field?: string | null;
  message: string;
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'BUSINESS_RULE_VIOLATION'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'SERVER_UNAVAILABLE',
    message: string,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The BE uses FORBIDDEN for both deactivation and role denial; the approved message distinguishes deactivation. */
export function isInactiveAccountError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.code === 'FORBIDDEN' &&
    error.message === 'Your account is deactivated.'
  );
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ApiErrorCode;
    message: string;
    details: ApiErrorDetail[];
  };
}

interface RequestOptions {
  token?: string;
  onUnauthorized?: () => void;
  fetcher?: typeof fetch;
  baseUrl?: string;
}

/** All responses follow the CORE-001 envelope; a 204 response intentionally has no body. */
export async function requestApi<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  // Test-only fixtures; the MODE guard lets every runtime build drop the sample transport entirely.
  if (import.meta.env.MODE === 'test' && usesSampleData(path)) {
    const actor = getBusinessActor();
    if (!actor || actor.accountStatus !== 'ACTIVE') throw new ApiError(401, 'UNAUTHORIZED', 'Đăng nhập để tiếp tục.');
    const { sampleRequest } = await import('../data/sampleTransport');
    return sampleRequest<T>(path, init, actor);
  }
  // A protected-Preview test identity carries no server authority and is never sent to the backend.
  if (isTestIdentityToken(options.token))
    throw new ApiError(503, 'SERVER_UNAVAILABLE', 'Không thực hiện được thao tác: đăng nhập thử không có quyền truy cập máy chủ. Hãy đăng nhập bằng tài khoản thật khi hệ thống sẵn sàng.');
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  let response: Response;
  try {
    const baseUrl = (options.baseUrl ?? API_BASE_URL).replace(/\/$/, '');
    response = await (options.fetcher ?? fetch)(`${baseUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ. Hãy kiểm tra kết nối và thử lại.');
  }

  if (response.status === 204) return undefined as T;

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    if (response.status === 401) options.onUnauthorized?.();
    // Static hosting may return HTML/plain text when no Auth API is connected. Never treat that as sign-in.
    if (path === '/api/auth/login' && [404, 405, 502, 503, 504].includes(response.status))
      throw new ApiError(response.status, 'SERVER_UNAVAILABLE', 'Dịch vụ đăng nhập không khả dụng. Hãy thử lại sau.');
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Máy chủ trả về dữ liệu không đọc được.');
  }

  if (response.status === 401) options.onUnauthorized?.();
  if (!response.ok || envelope.success !== true) {
    const error = envelope.error;
    throw new ApiError(
      response.status,
      error?.code ?? (response.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR'),
      error?.message ?? 'Không thực hiện được yêu cầu. Hãy thử lại.',
      error?.details ?? [],
    );
  }

  return envelope.data as T;
}

export interface AuthApi {
  login(request: LoginRequest): Promise<LoginResponse>;
  currentUser(token: string, onUnauthorized: () => void): Promise<CurrentUser>;
  logout(token: string): Promise<void>;
}

export function createAuthApi(options: Pick<RequestOptions, 'fetcher' | 'baseUrl'> = {}): AuthApi {
  const request = <T>(path: string, init: RequestInit = {}, requestOptions: Omit<RequestOptions, 'fetcher' | 'baseUrl'> = {}) =>
    requestApi<T>(path, init, { ...options, ...requestOptions });

  return {
    login: (credentials) =>
      request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    currentUser: (token, onUnauthorized) =>
      request<CurrentUser>('/api/auth/me', { method: 'GET' }, { token, onUnauthorized }),
    logout: (token) => request<void>('/api/auth/logout', { method: 'POST' }, { token }),
  };
}

export const authApi = createAuthApi();

/** Local markers used by the role test login (and legacy sample markers). Never JWTs or backend credentials. */
export const TEST_IDENTITY_PREFIX = 'role-test:';
export function isTestIdentityToken(token: string | undefined): boolean {
  return !!token && [TEST_IDENTITY_PREFIX, 'staging-sample:', 'ui-demo-session:'].some((prefix) => token.startsWith(prefix));
}
