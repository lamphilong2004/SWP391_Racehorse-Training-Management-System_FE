import type { ExerciseInput } from '../assigned/supportingApi';
export function exerciseErrors(input: ExerciseInput) {
  const errors: Record<string, string> = {};
  if (!input.name.trim() || input.name.length > 150) errors.name = 'Nhập tên bài tập từ 1–150 ký tự.';
  if (input.exerciseType != null && input.exerciseType.length > 50) errors.exerciseType = 'Dáng chạy / loại tối đa 50 ký tự.';
  if (input.description != null && input.description.length > 2000) errors.description = 'Mục đích tối đa 2000 ký tự.';
  if (input.targetMetric != null && input.targetMetric.length > 100) errors.targetMetric = 'Hướng dẫn mục tiêu tối đa 100 ký tự.';
  return errors;
}
export function exercisePayload(input: ExerciseInput): ExerciseInput {
  return { name: input.name.trim(), exerciseType: input.exerciseType?.trim() || null, description: input.description?.trim() || null, targetMetric: input.targetMetric?.trim() || null };
}
export function exerciseSelectionTarget(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value, 'http://local.invalid');
    return value.startsWith('/') && parsed.origin === 'http://local.invalid' && parsed.pathname === '/training/schedule/session/new' ? `${parsed.pathname}${parsed.search}` : null;
  } catch { return null; }
}
