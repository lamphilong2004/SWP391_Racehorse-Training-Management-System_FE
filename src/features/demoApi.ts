import { api } from '../shared/api/http';

/** DEMO INTEGRATION: typed calls for the BE demo branch (flow1/flow2/flow3 contracts). */
export type Availability = 'AVAILABLE' | 'LIMITED' | 'LOCKED';
export interface UserRef { id: number; userCode?: string; fullName: string }
export interface HorseSummary {
  id: number; horseCode: string; name: string; breed: string | null; sex: string | null; foaledDate: string | null;
  lifecycle: 'DRAFT' | 'ACTIVE' | 'INACTIVE'; healthStatus: string | null; trainingAvailability: Availability; currentBoxCode: string | null;
}
export interface ParentRef { horseId: number | null; horseCode?: string | null; name: string | null }
export interface HorseDetail extends HorseSummary {
  countryOfOrigin: string | null; registrationNo: string | null; activatedAt: string | null;
  pedigree: { sire: ParentRef; dam: ParentRef };
  currentOwnerships: { id: number; owner: UserRef; sharePercentage: number; effectiveFrom: string; isManagingOwner: boolean }[];
  currentAssignment: { id: number; boxCode: string; yard: string | null; effectiveFrom: string } | null;
  latestWeight: { weightKg: number; measuredAt: string } | null;
}
export interface ActivationStatus {
  horseId: number; horseCode: string; name: string; lifecycle: string; activatedAt: string | null;
  checklist: { item: string; complete: boolean; detail: string }[];
  readinessReview: { recommendation: string; blocking: boolean; reviewed: boolean; lastReviewedAt: string | null };
}
export interface StableBox { id: number; boxCode: string; yard: string | null; status: 'FREE' | 'OCCUPIED' }
export interface Page<T> { items: T[]; page: number; size: number; totalElements: number }

export const horsesApi = {
  list: (q = '') => api<Page<HorseSummary>>(`/api/horses?size=100${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  get: (id: number) => api<HorseDetail>(`/api/horses/${id}`),
  create: (body: Record<string, unknown>) => api<HorseDetail>('/api/horses', { body }),
  pedigree: (id: number, body: Record<string, unknown>) => api<HorseDetail>(`/api/horses/${id}/pedigree`, { method: 'PUT', body }),
  addOwner: (id: number, body: Record<string, unknown>) => api<unknown>(`/api/horses/${id}/ownerships`, { body }),
  assignBox: (id: number, body: Record<string, unknown>) => api<unknown>(`/api/horses/${id}/stable-assignments`, { body }),
  boxes: () => api<StableBox[]>('/api/stable-boxes'),
  owners: () => api<UserRef[]>('/api/horse-owners'),
  activation: (id: number) => api<ActivationStatus>(`/api/horses/${id}/activation-status`),
  readiness: (id: number) => api<void>(`/api/horses/${id}/readiness-review`, { method: 'POST' }),
  baseline: (id: number, body: Record<string, unknown>) => api<unknown>(`/api/horses/${id}/baseline-examinations`, { body }),
  availability: (id: number) => api<{ horseId: number; availability: Availability; reason: string | null; activeRestrictionId: number | null;
    exerciseRules: { exerciseDefinitionId: number | null; exerciseName: string | null; ruleType: string }[] }>(`/api/horses/${id}/training-availability`),
};

export interface Recommendation<T> { item: T; label: string; reasons: string[]; warnings: string[]; hardBlock: boolean }
export interface Template {
  id: number; templateCode: string; status: string; templateVersionId: number; versionNo: number; name: string; goals: string | null;
  recommendedDuration: string | null; workloadIntensityGuidance: string | null; preferredSurfaces: string | null;
  phases: { id: number; phaseOrder: number; name: string; objective: string | null; intensityGuidance: string | null }[];
  requiredSkills: string[];
}
export interface Phase { id: number; phaseOrder: number; name: string; objective: string | null; startDate: string; endDate: string;
  intensityMin: string | null; intensityMax: string | null; workload: string | null; sessionCount: number }
export interface Program {
  id: number; horse: { id: number; horseCode: string; name: string }; name: string; goals: string | null; periodStart: string; periodEnd: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED'; sourceTemplate: { templateCode: string; versionNo: number; name: string };
  trainer: UserRef | null; createdBy: UserRef; phases: Phase[];
  progress: { total: number; completed: number; interrupted: number; upcoming: number; evaluated: number }; trainingAvailability: Availability;
}
export interface Exercise { id: number; name: string; exerciseType: string | null }
export interface SessionSummary {
  id: number; sessionCode: string; horse: { id: number; horseCode: string; name: string }; programId: number; programName: string;
  horseProgramPhaseId: number; phaseName: string; scheduledStart: string; scheduledEnd: string | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'INTERRUPTED'; workRider: UserRef; trainer: UserRef | null;
  preCheckResult: 'ALL_NORMAL' | 'ABNORMAL' | null; blocked: boolean; blockedReasons: string[]; blockedMessage: string | null;
  intensity: string | null; surface: string | null; focus: string | null;
}
export interface SessionExercise { id: number; exerciseDefinitionId: number; exerciseName: string; exerciseOrder: number; distanceM: number | null;
  durationMin: number | null; repetitions: number | null; restIntervalMin: number | null; intensity: string | null; surface: string | null }
export interface SessionDetail {
  summary: SessionSummary; trainingAvailability: Availability; phaseIntensityMin: string | null; phaseIntensityMax: string | null;
  actualStart: string | null; actualEnd: string | null; interruptionReason: string | null; exercises: SessionExercise[];
  preSessionCheck: { id: number; overallResult: string; observations: string; performedBy: UserRef; performedAt: string } | null;
  linkedIncidentIds: number[]; hasRiderFeedback: boolean; hasEvaluation: boolean;
}
export interface Suitability { trainingAvailability: Availability; availabilityReason: string | null; canSchedule: boolean;
  exercises: { exerciseDefinitionId: number; exerciseName: string; category: string | null; label: string; messages: string[] }[] }
export interface SessionResult {
  session: SessionDetail;
  actual: { maxHeartRate: number | null; avgHeartRate: number | null; maxSpeedKmh: number | null; totalDistanceM: number | null; sampleCount: number; simulatedCount: number };
  samples: { recordedAt: string; heartRate: number | ''; speedKmh: number | ''; distanceM: number | ''; source: string }[];
  alerts: { id: number; metricValue: number; thresholdApplied: number; raisedAt: string; acknowledgedAt: string | null; acknowledgedBy: string | null; actionTaken: string | null; escalatedToVetAt: string | null }[];
  riderFeedback: { submittedBy: string; submittedAt: string; responses: Record<string, string> } | null;
  evaluation: { evaluationLabel: string; evaluationNotes: string; recommendation: string; evaluatedBy: string; evaluatedAt: string } | null;
}

export const trainingApi = {
  templates: () => api<Template[]>('/api/program-templates'),
  templateRecs: (horseId: number) => api<Recommendation<Template>[]>(`/api/horses/${horseId}/template-recommendations`),
  trainerRecs: (horseId: number, templateId?: number) =>
    api<Recommendation<UserRef>[]>(`/api/horses/${horseId}/trainer-recommendations${templateId ? `?templateId=${templateId}` : ''}`),
  exercises: () => api<Exercise[]>('/api/exercises'),
  programs: () => api<Program[]>('/api/training-programs'),
  program: (id: number) => api<Program>(`/api/training-programs/${id}`),
  createProgram: (body: Record<string, unknown>) => api<Program>('/api/training-programs', { body }),
  sessions: (params: string) => api<SessionSummary[]>(`/api/training-sessions?${params}`),
  session: (id: number) => api<SessionDetail>(`/api/training-sessions/${id}`),
  suitability: (body: Record<string, unknown>) => api<Suitability>('/api/training-sessions/suitability-check', { body }),
  riders: (body: Record<string, unknown>) => api<Recommendation<UserRef>[]>('/api/training-sessions/work-rider-recommendations', { body }),
  createSession: (body: Record<string, unknown>) => api<SessionDetail>('/api/training-sessions', { body }),
  start: (id: number) => api<SessionDetail>(`/api/training-sessions/${id}/start`, { method: 'POST' }),
  pause: (id: number) => api<SessionDetail>(`/api/training-sessions/${id}/pause`, { method: 'POST' }),
  resume: (id: number) => api<SessionDetail>(`/api/training-sessions/${id}/resume`, { method: 'POST' }),
  stop: (id: number, body: Record<string, unknown>) => api<SessionDetail>(`/api/training-sessions/${id}/stop`, { body }),
  complete: (id: number) => api<SessionDetail>(`/api/training-sessions/${id}/complete`, { method: 'POST' }),
  reduce: (id: number, intensity: string) => api<SessionDetail>(`/api/training-sessions/${id}/reduce-intensity`, { body: { intensity } }),
  reportIssue: (id: number, body: Record<string, unknown>) =>
    api<{ incidentId: number; incidentCode: string; sessionStatus: string }>(`/api/training-sessions/${id}/report-issue`, { body }),
  feedback: (id: number, responses: Record<string, string>) => api<unknown>(`/api/training-sessions/${id}/rider-feedback`, { body: { responses } }),
  evaluate: (id: number, body: Record<string, unknown>) => api<SessionResult>(`/api/training-sessions/${id}/evaluation`, { body }),
  result: (id: number) => api<SessionResult>(`/api/training-sessions/${id}/result`),
  assignments: () => api<SessionSummary[]>('/api/work-rider/assignments'),
  history: () => api<SessionSummary[]>('/api/work-rider/history'),
  metric: (id: number, body: Record<string, unknown>) => api<{ realtimeState: string }>(`/api/training-sessions/${id}/metrics`, { body }),
  simStart: (id: number) => api<void>(`/api/simulator/sessions/${id}/start`, { method: 'POST' }),
  simStop: (id: number) => api<void>(`/api/simulator/sessions/${id}/stop`, { method: 'POST' }),
  acknowledge: (alertId: number, body: Record<string, unknown>) => api<unknown>(`/api/monitoring-alerts/${alertId}/acknowledge`, { body }),
  groomSessions: (date: string) => api<SessionSummary[]>(`/api/groom/sessions?date=${date}`),
  preCheck: (id: number, body: Record<string, unknown>) =>
    api<{ id: number; overallResult: 'ALL_NORMAL' | 'ABNORMAL' }>(`/api/training-sessions/${id}/pre-session-check`, { body }),
  createIncident: (body: Record<string, unknown>) => api<{ id: number; incidentCode: string }>('/api/incidents', { body }),
};

export interface Restriction { id: number; horseId: number; level: 'LIMITED' | 'LOCKED'; reason: string; effectiveAt: string; liftedAt: string | null;
  reviewDate: string | null; medicalCaseId: number | null; exerciseRules: { exerciseDefinitionId: number | null; exerciseName: string | null; ruleType: string }[] }
export const restrictionApi = {
  list: (horseId?: number) => api<{ items: Restriction[] }>(`/api/medical/restrictions${horseId ? `?horseId=${horseId}` : ''}`),
  create: (horseId: number, body: Record<string, unknown>) => api<Restriction>(`/api/horses/${horseId}/medical-restrictions`, { body }),
  lift: (id: number) => api<Restriction>(`/api/medical/restrictions/${id}/lift`, { method: 'POST', body: {} }),
};
