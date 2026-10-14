/**
 * DEMO INTEGRATION (demo/main-flow-hour1): one HTTP client for the shared envelope
 * `{ success, data, error{code,message,details[]} }` (BE docs/api/shared.openapi.yaml, CORE-003).
 * The bearer token comes from the auth session; requests never carry identity in query parameters.
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

let tokenProvider: () => string | null = () => null;
let unauthorizedHandler: () => void = () => {};

export function configureHttp(options: { token: () => string | null; onUnauthorized: () => void }) {
  tokenProvider = options.token;
  unauthorizedHandler = options.onUnauthorized;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = tokenProvider();
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'The server cannot be reached. Check that the backend is running.');
  }
  if (response.status === 204) return undefined as T;
  let body: { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: ApiErrorDetail[] } } | null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || !body || body.success === false) {
    if (response.status === 401 && token) unauthorizedHandler();
    const err = body?.error;
    throw new ApiError(response.status, err?.code ?? `HTTP_${response.status}`,
      err?.message ?? defaultMessage(response.status), err?.details ?? []);
  }
  return body.data as T;
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return 'The requested record was not found.';
  if (status === 409) return 'This action conflicts with the current state. Reload and try again.';
  return 'Something went wrong. Please try again.';
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message)).join('; ');
    return detail ? `${error.message} (${detail})` : error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
