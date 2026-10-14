import type { RoleCode } from '../../shared/auth/roles';

/** CORE-006 draft DTOs. Status/body-region taxonomies remain unapproved. */
export type RecoveryStatus = 'NOT_RECOVERED' | 'IMPROVING' | 'RECOVERED';
export interface MedicalCaseCreateRequest { horseId: string; incidentId?: string; reason: string }
export interface ExaminationRequest { symptoms: string; diagnosis?: string; severity?: string; examinedAt?: string }
export interface InjuryRequest { bodyRegion: string; severity: string; recoveryStatus?: RecoveryStatus; position3d?: { x: number; y: number; z: number }; clinicalNotes?: string }
export interface TreatmentPlanRequest {
  medications?: { name: string; instructions?: string }[];
  restInstructions?: string;
  groomTasks?: { instruction: string; dueAt?: string }[];
  reexaminationDate?: string;
}
export interface ReexaminationRequest { recoveryStatus: RecoveryStatus; findings: string; examinedAt?: string }
export interface TreatmentTaskCompleteRequest { completionNotes?: string }
export interface MedicalCase { id: string; horseId: string; incidentId?: string; status?: string; reason?: string }
export interface Examination { id: string; caseId: string; symptoms?: string; diagnosis?: string; severity?: string }
export interface Injury { id: string; caseId: string; bodyRegion: string; severity?: string; recoveryStatus?: RecoveryStatus }
export interface TreatmentPlan { id: string; caseId: string; status?: string; reexaminationDate?: string }
export interface TreatmentTask { id: string; horseId: string; caseId?: string; instruction: string; status?: string }
export interface Reexamination { id: string; caseId: string; recoveryStatus: RecoveryStatus; findings?: string }
export interface Incident { id: string; horseId: string; description: string; status?: string }
export interface Page<T> { items: T[]; page: number; size: number; totalElements: number }
export type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };
export interface MedicalActor { id: number; fullName: string; roles: RoleCode[]; accountStatus: string }

/** Feature view models, NOT claims about approved backend read projections. */
export interface CaseView extends MedicalCase {
  examinations: Examination[];
  injuries: (Injury & Pick<InjuryRequest, 'position3d' | 'clinicalNotes'>)[];
  treatment?: TreatmentPlan & TreatmentPlanRequest;
  reexaminations: Reexamination[];
}
export interface TaskView extends TreatmentTask { completionNotes?: string }
export interface MedicalService {
  readonly mode: 'mock' | 'unavailable';
  listCases(): Promise<MedicalCase[]>;
  getCase(id: string): Promise<CaseView>;
  createCase(input: MedicalCaseCreateRequest): Promise<MedicalCase>;
  addExamination(id: string, input: ExaminationRequest): Promise<void>;
  addInjury(id: string, input: InjuryRequest): Promise<void>;
  saveTreatment(id: string, input: TreatmentPlanRequest): Promise<void>;
  addReexamination(id: string, input: ReexaminationRequest): Promise<void>;
  closeCase(id: string): Promise<void>;
  listIncidents(): Promise<Incident[]>;
  listTasks(): Promise<TaskView[]>;
  completeTask(id: string, input: TreatmentTaskCompleteRequest): Promise<void>;
}
