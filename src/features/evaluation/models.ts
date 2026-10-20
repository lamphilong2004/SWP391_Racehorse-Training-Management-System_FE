/** CORE-005 flow2-training.openapi.yaml at BE dev 8b2e22a. Units are wire units; no aggregation is inferred. */
export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'INTERRUPTED';
export type EvaluationResult = 'MET' | 'PARTIALLY_MET' | 'NOT_MET';
export interface UserRef { id: number; fullName: string; userCode?: string }
export interface SessionExercise {
  id: number; exerciseDefinitionId: number; exerciseOrder: number; exerciseName: string;
  distanceM?: number | null; durationMin?: number | null; repetitions?: number | null;
  restIntervalMin?: number | null; intensity?: string | null; surface?: string | null;
}
export interface SessionDetail {
  id: number; sessionCode: string; horse: { id: number; horseCode: string; name: string };
  programId: number; phaseName: string; scheduledStart: string; scheduledEnd?: string | null;
  status: SessionStatus; workRider: UserRef; trainer?: UserRef | null;
  focus?: string | null; surface?: string | null; intensity?: string | null;
  actualStart?: string | null; actualEnd?: string | null; interruptionReason?: string | null;
  exercises: SessionExercise[]; hasEvaluation?: boolean;
}
export interface EvaluationRequest {
  result: EvaluationResult; evaluatedSummary?: string | null; evaluationNotes?: string | null; recommendation?: string | null;
}
export interface SessionResult extends EvaluationRequest { id: number; sessionId: number; evaluatedBy: UserRef; evaluatedAt: string }
export interface SessionResultView {
  session: SessionDetail;
  actual: {
    durationMin?: number | null; totalDistanceM?: number | null; maxHeartRate?: number | null;
    avgHeartRate?: number | null; maxSpeedKmh?: number | null; avgSpeedKmh?: number | null;
    sampleCount?: number; simulated?: boolean;
  };
  samples?: { recordedAt: string; source: 'MANUAL' | 'SIMULATOR'; heartRate?: number | null; speedKmh?: number | null; distanceM?: number | null }[];
  alerts: { id: number; sessionId: number; metric: 'HEART_RATE'; metricValue: number; thresholdApplied: number; severity: 'CRITICAL'; raisedAt: string; acknowledgedAt?: string | null; acknowledgedBy?: UserRef | null; actionTaken?: string | null; escalatedToVetAt?: string | null }[];
  riderFeedback?: { id: number; sessionId: number; submittedBy: UserRef; submittedAt: string; responses: { horseResponse?: string | null; balance?: string | null; breathing?: string | null; strideFeeling?: string | null; abnormalBehavior?: string | null; preInterruptionDescription?: string | null; notes?: string | null } } | null;
  evaluation?: SessionResult | null;
}
export interface PerformancePoint {
  sessionId: number; sessionCode: string; date: string; status: SessionStatus;
  totalDistanceM?: number | null; durationMin?: number | null; maxHeartRate?: number | null;
  avgSpeedKmh?: number | null; result?: EvaluationResult | null;
}
export const RESULT_LABELS: Record<EvaluationResult, string> = { MET: 'Met target', PARTIALLY_MET: 'Partially met target', NOT_MET: 'Did not meet target' };
export const isTerminal = (status: SessionStatus) => status === 'COMPLETED' || status === 'INTERRUPTED';
export const metric = (value: number | null | undefined, unit: string) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unit}` : 'Not measured';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const valid = (value: string | null | undefined) => (value && Number.isFinite(Date.parse(value)) ? new Date(value) : null);
/** Server ISO timestamp as Figma's "20 Oct 2026 · 08:34" in the viewer's time zone; never invents a value. */
export const dateTime = (value: string | null | undefined) => { const date = valid(value); return date ? DATE_TIME.format(date).replace(', ', ' · ') : 'Not recorded'; };
/** Recorded-sample clock time (HH:mm:ss). */
export const clockTime = (value: string | null | undefined) => { const date = valid(value); return date ? CLOCK.format(date) : 'Not recorded'; };
