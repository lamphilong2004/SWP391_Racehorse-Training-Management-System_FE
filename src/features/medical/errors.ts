import { ApiError } from '../../shared/auth/authApi';

export function medicalErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) return `Không có quyền truy cập: ${error.message}`;
  return error instanceof Error ? error.message : fallback;
}
