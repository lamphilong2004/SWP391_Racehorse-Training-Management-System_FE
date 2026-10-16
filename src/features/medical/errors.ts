import { ApiError } from '../../shared/auth/authApi';

export function medicalErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) return `Access Denied: ${error.message}`;
  return error instanceof Error ? error.message : fallback;
}
