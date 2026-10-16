import type { RoleCode } from '../../shared/auth/roles';

// CORE-006, docs/api/flow3-medical.openapi.yaml on origin/dev.
export type RecoveryStatus = 'NOT_RECOVERED' | 'IMPROVING' | 'RECOVERED';
export type ClinicalSeverity = 'MILD' | 'MODERATE' | 'SEVERE';
export type HealthStatus = 'FIT' | 'MONITORING' | 'INJURED' | 'QUARANTINED';
export type Availability = 'AVAILABLE' | 'LIMITED' | 'LOCKED';
export type IncidentType = 'OFF_FEED' | 'COLIC_SIGNS' | 'FEVER' | 'HOOF_OR_LEG_PROBLEM' | 'OTHER';
export type ObservedSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export interface MedicalActor { id: number; fullName: string; roles: RoleCode[]; accountStatus: 'ACTIVE' | 'INACTIVE' }
export interface Page<T> { items: T[]; page: number; size: number; totalElements: number }
export interface MedicalCaseCreateRequest { horseId: number; reason: string }
export interface ExaminationRequest { symptoms: string; diagnosis?: string; severity?: ClinicalSeverity; examinedAt: string; healthStatus?: HealthStatus; bodyCondition?: string }
export interface InjuryRequest { bodyRegion: string; severity: ClinicalSeverity; recoveryStatus: RecoveryStatus; veterinaryExaminationId?: number; position3d?: string; side?: string }
export interface GroomTaskInstruction { assignedGroomUserId: number; instruction: string; taskDate: string; scheduledSlot?: string }
export interface TreatmentPlanRequest { treatmentMedicationInstructions: string; restInstructions?: string; careInstructions?: string; groomTasks?: GroomTaskInstruction[]; reexaminationDate?: string }
export interface ReexaminationRequest { recoveryStatus: RecoveryStatus; findings: string; examinedAt: string; healthStatus?: HealthStatus; diagnosis?: string; severity?: ClinicalSeverity; bodyCondition?: string }
export interface MedicalCase { id: number; horseId: number; status: 'OPEN' | 'CLOSED'; openedAt: string; closedAt?: string; reason?: string; incidentIds: number[]; examinations: Examination[]; injuries: Injury[]; treatmentPlan?: TreatmentPlan; reexaminations: Reexamination[] }
export interface Examination { id: number; caseId: number; horseId: number; examinedAt: string; symptoms: string; diagnosis?: string; severity?: ClinicalSeverity; healthStatus?: HealthStatus }
export interface Injury { id: number; caseId: number; bodyRegion: string; severity: ClinicalSeverity; recoveryStatus: RecoveryStatus; position3d?: string; side?: string }
export interface TreatmentPlan { id: number; caseId: number; treatmentMedicationInstructions: string; restInstructions?: string; careInstructions?: string; reexaminationDate?: string; createdAt: string }
export interface Reexamination { id: number; caseId: number; horseId: number; recoveryStatus: RecoveryStatus; findings: string; examinedAt: string }
export interface Incident { id: number; incidentCode: string; horseId: number; reportedByUserId: number; medicalCaseId?: number; preSessionCheckId?: number; trainingSessionId?: number; careTaskId?: number; incidentType: IncidentType; observedSeverity: ObservedSeverity; description?: string; observedAt: string; reportedAt: string; status: 'REPORTED' | 'UNDER_REVIEW' | 'RESOLVED' }
export interface CaseTreatmentTask { id: number; caseId: number; treatmentPlanId: number; horseId: number; assignedGroomUserId: number; instruction: string; taskDate: string; scheduledSlot?: string; status: 'PENDING' | 'COMPLETED'; completedAt?: string; completedByUserId?: number }
export interface RestrictionExerciseRule { ruleType: 'ALLOWED' | 'PROHIBITED'; exerciseId?: number; exerciseTypeNote?: string }
export interface TrainingAvailability { horseId: number; availability: Availability; reason?: string; activeRestrictionId?: number; exerciseRules?: RestrictionExerciseRule[] }
export interface MedicalRestriction { id: number; horseId: number; level: 'LIMITED' | 'LOCKED'; reason: string; effectiveAt: string; liftedAt?: string; reviewDate?: string; medicalCaseId?: number; exerciseRules?: RestrictionExerciseRule[] }
export interface HerdHealthOverview { totalHorses: number; fit: number; monitoring: number; injured: number; quarantined: number; unassessed: number }

export interface MedicalService {
  listCases(page?: number): Promise<Page<MedicalCase>>;
  getCase(id: number): Promise<MedicalCase>;
  createCase(input: MedicalCaseCreateRequest): Promise<MedicalCase>;
  addExamination(id: number, input: ExaminationRequest): Promise<Examination>;
  addInjury(id: number, input: InjuryRequest): Promise<Injury>;
  saveTreatment(id: number, input: TreatmentPlanRequest): Promise<TreatmentPlan>;
  listCaseTasks(id: number, page?: number): Promise<Page<CaseTreatmentTask>>;
  addReexamination(id: number, input: ReexaminationRequest): Promise<Reexamination>;
  closeCase(id: number): Promise<MedicalCase>;
  listIncidents(page?: number): Promise<Page<Incident>>;
  getIncident(id: number): Promise<Incident>;
  reviewIncident(id: number, action: 'OPEN_CASE' | 'RESOLVE' | 'LINK_CASE', medicalCaseId?: number): Promise<Incident>;
  getAvailability(horseId: number): Promise<TrainingAvailability>;
  listRestrictions(page?: number): Promise<Page<MedicalRestriction>>;
  getHerdHealth(): Promise<HerdHealthOverview>;
}
