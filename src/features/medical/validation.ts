import { ApiError } from '../../shared/auth/authApi';
import type { MedicalCase, Page, CaseTreatmentTask, HerdHealthOverview, TrainingAvailability } from './models';

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const timestamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const oneOf = (v: unknown, values: string[]) => typeof v === 'string' && values.includes(v);
const optional = (v: Record<string, unknown>, keys: string[]) => keys.every((key) => v[key] === undefined || typeof v[key] === 'string');
const recovery = ['NOT_RECOVERED', 'IMPROVING', 'RECOVERED'];
const severity = ['MILD', 'MODERATE', 'SEVERE'];
const invalid = () => new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu y tế không hợp lệ. Hãy tải lại để thử lại.');

export function readCase(v: unknown): MedicalCase {
  if (!object(v) || !positive(v.id) || !positive(v.horseId) || !oneOf(v.status, ['OPEN', 'CLOSED']) || !timestamp(v.openedAt) ||
    !optional(v, ['reason', 'closedAt']) || !Array.isArray(v.incidentIds) || !v.incidentIds.every(positive) ||
    !Array.isArray(v.examinations) || !v.examinations.every((x) => object(x) && positive(x.id) && x.caseId === v.id && x.horseId === v.horseId && timestamp(x.examinedAt) && optional(x, ['symptoms', 'diagnosis', 'bodyCondition'])) ||
    !Array.isArray(v.injuries) || !v.injuries.every((x) => object(x) && positive(x.id) && x.caseId === v.id && typeof x.bodyRegion === 'string' && oneOf(x.severity, severity) && oneOf(x.recoveryStatus, recovery) && optional(x, ['side', 'position3d'])) ||
    !Array.isArray(v.reexaminations) || !v.reexaminations.every((x) => object(x) && positive(x.id) && x.caseId === v.id && x.horseId === v.horseId && timestamp(x.examinedAt) && typeof x.findings === 'string' && oneOf(x.recoveryStatus, recovery)) ||
    (v.treatmentPlan !== undefined && (!object(v.treatmentPlan) || !positive(v.treatmentPlan.id) || v.treatmentPlan.caseId !== v.id || typeof v.treatmentPlan.treatmentMedicationInstructions !== 'string' || !timestamp(v.treatmentPlan.createdAt) || !optional(v.treatmentPlan, ['restInstructions', 'careInstructions', 'reexaminationDate'])))) throw invalid();
  return v as unknown as MedicalCase;
}
export function readPage<T>(v: unknown, read: (item: unknown) => T, page: number): Page<T> {
  if (!object(v) || !Array.isArray(v.items) || v.page !== page || !Number.isSafeInteger(v.size) || Number(v.size) < 1 || Number(v.size) > 100 ||
    !Number.isSafeInteger(v.totalElements) || Number(v.totalElements) < 0 || v.items.length > Number(v.size) || v.items.length > Number(v.totalElements)) throw invalid();
  return { items: v.items.map(read), page, size: Number(v.size), totalElements: Number(v.totalElements) };
}
export function readCaseTask(v: unknown, caseId: number): CaseTreatmentTask {
  if (!object(v) || !positive(v.id) || v.caseId !== caseId || !positive(v.horseId) || !positive(v.treatmentPlanId) || !positive(v.assignedGroomUserId) ||
    typeof v.instruction !== 'string' || typeof v.taskDate !== 'string' || !oneOf(v.status, ['PENDING', 'COMPLETED']) || !optional(v, ['scheduledSlot', 'completedAt'])) throw invalid();
  return v as unknown as CaseTreatmentTask;
}
export function readHerd(v: unknown): HerdHealthOverview {
  const keys = ['totalHorses', 'fit', 'monitoring', 'injured', 'quarantined', 'unassessed'];
  if (!object(v) || !keys.every((key) => Number.isSafeInteger(v[key]) && Number(v[key]) >= 0)) throw invalid();
  return v as unknown as HerdHealthOverview;
}
export function readAvailability(v: unknown, horseId: number): TrainingAvailability {
  if (!object(v) || v.horseId !== horseId || !oneOf(v.availability, ['AVAILABLE', 'LIMITED', 'LOCKED']) || !optional(v, ['reason']) ||
    (v.exerciseRules !== undefined && (!Array.isArray(v.exerciseRules) || !v.exerciseRules.every((x) => object(x) && oneOf(x.ruleType, ['ALLOWED', 'PROHIBITED']) &&
      ((positive(x.exerciseId) && x.exerciseTypeNote === undefined) || (x.exerciseId === undefined && typeof x.exerciseTypeNote === 'string')))))) throw invalid();
  return v as unknown as TrainingAvailability;
}
