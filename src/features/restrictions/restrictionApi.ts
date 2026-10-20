import type { TrainingAvailability } from '../program-creation/programTypes';
import { idOf, jsonBody, type FlowRequest } from '../main-flows/api';
export interface ExerciseRule { ruleType: 'ALLOWED' | 'PROHIBITED'; exerciseId?: number; exerciseTypeNote?: string }
export interface Availability { horseId: number; availability: TrainingAvailability; reason?: string; activeRestrictionId?: number; exerciseRules?: ExerciseRule[] }
export interface Restriction { id: number; horseId: number; level: 'LIMITED' | 'LOCKED'; reason: string; effectiveAt: string; reviewDate?: string; liftedAt?: string; exerciseRules?: ExerciseRule[] }
export interface RestrictionInput { level: 'LIMITED' | 'LOCKED'; reason: string; effectiveAt: string; reviewDate?: string; medicalCaseId?: number }
interface RestrictionPage { items: Restriction[]; page: number; size: number; totalElements: number }
export function rulePayload(rules: ExerciseRule[]): { rules: ExerciseRule[] } {
  return { rules: rules.map((item) => {
    if (!['ALLOWED', 'PROHIBITED'].includes(item.ruleType)) throw new Error('Use ALLOWED or PROHIBITED.');
    const hasExercise = item.exerciseId !== undefined;
    if (hasExercise === !!item.exerciseTypeNote?.trim()) throw new Error('Each rule needs exactly one exercise or exercise type note.');
    if (item.exerciseTypeNote && item.exerciseTypeNote.trim().length > 200) throw new Error('Exercise type notes must be at most 200 characters.');
    return { ruleType: item.ruleType, ...(hasExercise ? { exerciseId: idOf(item.exerciseId) } : { exerciseTypeNote: item.exerciseTypeNote!.trim() }) };
  }) };
}
export function createRestrictionApi(request: FlowRequest) {
  return {
    list: (signal?: AbortSignal) => request<RestrictionPage>('/api/medical/restrictions?page=0&size=100', { signal }),
    availability: (horseId: number, signal?: AbortSignal) => request<Availability>(`/api/horses/${idOf(horseId)}/training-availability`, { signal }),
    create: (horseId: number, input: RestrictionInput) => request<Restriction>(`/api/horses/${idOf(horseId)}/medical-restrictions`, jsonBody('POST', {
      level: input.level, reason: input.reason.trim(), effectiveAt: input.effectiveAt, reviewDate: input.reviewDate || undefined, medicalCaseId: input.medicalCaseId,
    })),
    rules: (restrictionId: number, rules: ExerciseRule[]) => request<Restriction>(`/api/medical/restrictions/${idOf(restrictionId)}/exercise-rules`, jsonBody('PUT', rulePayload(rules))),
    lift: (restrictionId: number) => request<Restriction>(`/api/medical/restrictions/${idOf(restrictionId)}/lift`, jsonBody('POST', {})),
    find: async (restrictionId: number, signal?: AbortSignal) => {
      // The approved list operation has no horseId filter or get-by-ID endpoint; page the permitted scope only.
      for (let page = 0; ; page++) {
        const result = await request<RestrictionPage>(`/api/medical/restrictions?page=${page}&size=100`, { signal });
        const match = result.items.find((item) => item.id === restrictionId); if (match) return match;
        if (result.page !== page || !Number.isSafeInteger(result.size) || result.size < 1 || !Number.isSafeInteger(result.totalElements) || result.totalElements < 0)
          throw new Error('Restriction pagination is unavailable. Reload before editing rules.');
        if ((page + 1) * result.size >= result.totalElements) return null;
      }
    },
  };
}
