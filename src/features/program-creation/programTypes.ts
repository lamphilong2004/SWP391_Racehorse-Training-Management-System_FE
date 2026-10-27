/** CORE-005 flow2-training.openapi.yaml on BE dev @ 8b2e22a; horse selection uses CORE-004 @ ac4e3a0. */
export type Intensity = 'LOW' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH';
export type RecommendationLabel = 'RECOMMENDED' | 'SUITABLE' | 'SUITABLE_WITH_CAUTION' | 'NOT_RECOMMENDED';
export type TrainingAvailability = 'AVAILABLE' | 'LIMITED' | 'LOCKED';

export interface Page<T> {
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

export interface HorseRef {
  id: number;
  horseCode: string;
  name: string;
}

export interface HorseSelection extends HorseRef {
  lifecycle: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  trainingAvailability: TrainingAvailability;
  breed?: string | null;
  sex?: string | null;
  foaledDate?: string | null;
  strengths?: string[];
  currentProgramName?: string | null;
  lastTrainingAt?: string | null;
}

export interface UserRef {
  id: number;
  fullName: string;
  userCode?: string;
}

export interface TemplatePhase {
  id: number;
  phaseOrder: number;
  name: string;
  objective?: string | null;
  recommendedDuration?: string | null;
  intensityGuidance?: string | null;
}

export interface TemplateSummary {
  id: number;
  templateCode: string;
  status: 'ACTIVE' | 'ARCHIVED';
  latestVersionNo: number;
  name: string;
  goals?: string | null;
  duplicatedFromTemplateId?: number | null;
  usedByProgramCount?: number;
}

export interface TemplateVersion {
  id: number;
  versionNo: number;
  name: string;
  phases: TemplatePhase[];
  requiredSkills: { id: number; name: string }[];
  createdAt: string;
  goals?: string | null;
  suitableHorseProfile?: string | null;
  recommendedDistanceUseCase?: string | null;
  recommendedDuration?: string | null;
  workloadIntensityGuidance?: string | null;
  preferredSurfaces?: string | null;
  recoveryGuidance?: string | null;
  /** Strength codes this template develops; used only for labelled recommendations. */
  strengthFocus?: string[];
}

export interface TemplateDetail {
  template: TemplateSummary;
  version: TemplateVersion;
  versions: { id: number; versionNo: number; createdAt: string }[];
}

export interface TemplateRecommendation {
  templateId: number;
  templateCode: string;
  templateVersionId: number;
  versionNo: number;
  name: string;
  label: RecommendationLabel;
  reasons: string[];
}

export interface TrainerCandidate {
  user: UserRef;
  label: RecommendationLabel;
  reasons: string[];
  warnings: string[];
  hardBlock: string | null;
  experienceLevel?: string | null;
  skills?: string[];
}

export interface CandidateList {
  candidates: TrainerCandidate[];
  emptyReason?: string | null;
}

export interface ProgramPhaseInput {
  templateVersionPhaseId?: number | null;
  phaseOrder: number;
  name: string;
  objective?: string | null;
  startDate: string;
  endDate: string;
  intensityMin?: Intensity | null;
  intensityMax?: Intensity | null;
  workload?: string | null;
}

export interface TrainerAssignmentRequest {
  trainerUserId: number;
  effectiveFrom: string;
  reason?: string | null;
  warningsAcknowledged?: boolean;
}

/** Creation has no targetRaceId, template writes, generated status, or activation timestamp. */
export interface CreateProgramRequest {
  horseId: number;
  templateVersionId: number;
  name: string;
  goals?: string | null;
  targetMetrics?: string | null;
  periodStart: string;
  periodEnd: string;
  notes?: string | null;
  phases: ProgramPhaseInput[];
  trainer: TrainerAssignmentRequest;
}

export interface ProgramDetail {
  id: number;
  horse: HorseRef;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  periodStart: string;
  periodEnd: string;
  sourceTemplateId: number;
  sourceTemplateVersion: number;
  phases: (ProgramPhaseInput & { id: number; isCustomized: boolean })[];
  activatedAt: string;
  currentTrainer?: UserRef | null;
  currentPhaseName?: string | null;
  trainingAvailability?: TrainingAvailability;
  sourceTemplateCode?: string;
  sourceTemplateName?: string;
  goals?: string | null;
  targetMetrics?: string | null;
  notes?: string | null;
  createdBy?: UserRef;
  pendingAdjustmentRequests?: number;
}
