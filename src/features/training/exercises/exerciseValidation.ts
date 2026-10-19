import type { ExerciseInput } from '../assigned/supportingApi';
export function exerciseErrors(input: ExerciseInput) {
  const errors: Record<string, string> = {};
  if (!input.name.trim() || input.name.length > 150) errors.name = 'Enter an exercise name of 1–150 characters.';
  if (input.exerciseType != null && input.exerciseType.length > 50) errors.exerciseType = 'Gait / type must be at most 50 characters.';
  if (input.description != null && input.description.length > 2000) errors.description = 'Purpose must be at most 2000 characters.';
  if (input.targetMetric != null && input.targetMetric.length > 100) errors.targetMetric = 'Target guidance must be at most 100 characters.';
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
