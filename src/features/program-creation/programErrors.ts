import { serverText } from '../../shared/serverText';
import { ApiError } from '../../shared/auth/authApi';
import type { ProgramValidationIssue } from './programDraft';

export function programFieldErrors(error: unknown): ProgramValidationIssue[] {
  if (!(error instanceof ApiError) || error.status !== 400) return [];
  return error.details.filter((detail) => Boolean(detail.field)).map((detail) => ({
    // Chuẩn hóa phases.0.name thành phases[0].name để khớp khóa lỗi của các trường trong wizard.
    field: detail.field!.replace(/\.(\d+)(?=\.|$)/g, '[$1]'),
    message: detail.message,
  }));
}

export function programErrorMessage(error: unknown): string {
  return error instanceof Error ? serverText(error.message) : 'Không thực hiện được yêu cầu. Hãy thử lại.';
}

export function stepForField(field: string): number {
  // Đây là chỉ số bước từ 0; đưa người dùng về đúng nơi sửa thay vì chỉ báo lỗi ở bước xác nhận.
  if (field === 'horseId') return 0;
  if (field === 'templateVersionId') return 2;
  if (field.startsWith('trainer')) return 5;
  if (/\.(intensityMin|intensityMax|workload)$/.test(field)) return 4;
  // Các lỗi còn lại thuộc cấu hình chương trình/giai đoạn, bao gồm tên và khoảng ngày.
  return 3;
}
