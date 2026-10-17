import type { CurrentUser } from '../auth/authApi';
import type { RoleCode } from '../auth/roles';
import type { SessionResultView } from '../../features/evaluation/models';
import type { MedicalCase, CaseTreatmentTask, Incident, HealthStatus } from '../../features/medical/models';
import type { ProgramDetail, TemplateDetail, HorseSelection } from '../../features/program-creation/programTypes';
import { initialHorses, type HorseSampleState } from './horseSamples';
import type { PreSessionCheck } from '../../features/precheck/types';
export type SampleSession = SessionResultView & { session: SessionResultView['session'] & { blocked?: boolean; blockedReasons?: string[]; blockedMessage?: string | null; trainingAvailability?: 'AVAILABLE' | 'LIMITED' | 'LOCKED'; preCheckResult?: 'ALL_NORMAL' | 'ABNORMAL' | null; preSessionCheck?: PreSessionCheck | null; hasRiderFeedback?: boolean } };

const STATE_KEY = 'racehorse.business-samples.v1';
export const horse: HorseSelection = { id: 7, horseCode: 'RH-007', name: 'Thunder Bolt', lifecycle: 'ACTIVE', trainingAvailability: 'AVAILABLE', breed: 'Thoroughbred', sex: 'GELDING', foaledDate: '2021-03-12' };
export const template: TemplateDetail = {
  template: { id: 3, templateCode: 'TPL-003', name: 'Endurance foundation', status: 'ACTIVE', latestVersionNo: 1 },
  version: { id: 301, versionNo: 1, name: 'Endurance foundation', goals: 'Steady aerobic work with recovery',
    phases: [{ id: 31, phaseOrder: 1, name: 'Foundation', objective: 'Build an aerobic base', recommendedDuration: '14 days', intensityGuidance: 'Low to medium' }],
    requiredSkills: [{ id: 4, name: 'Endurance' }], createdAt: '2026-10-01T00:00:00Z', recoveryGuidance: 'Review recorded response before the next session.' },
  versions: [{ id: 301, versionNo: 1, createdAt: '2026-10-01T00:00:00Z' }],
};
export function sampleUser(role: RoleCode): CurrentUser {
  const ids: Record<RoleCode, number> = { CLUB_MANAGER: 10, HEAD_TRAINER: 11, TRAINER: 12, WORK_RIDER: 13, VETERINARIAN: 15, GROOM: 16, HORSE_OWNER: 17 };
  const person = SAMPLE_PEOPLE[role];
  return { id: ids[role], userCode: `USR-${String(ids[role]).padStart(4, '0')}`, fullName: person.fullName, email: `${person.login}@racehorse.test`, roles: [role], accountStatus: 'ACTIVE' };
}
/**
 * Fictitious illustrative people (names follow the approved Figma examples). Emails use the reserved `.test` domain:
 * they are local sample identities, not SQL accounts, and carry no password.
 */
const SAMPLE_PEOPLE: Record<RoleCode, { fullName: string; login: string }> = {
  CLUB_MANAGER: { fullName: 'Hoang Minh Tuan', login: 'club.manager' },
  HEAD_TRAINER: { fullName: 'Vo Thanh Son', login: 'head.trainer' },
  TRAINER: { fullName: 'Nguyen Minh Khoa', login: 'trainer' },
  WORK_RIDER: { fullName: 'Pham Quang Huy', login: 'work.rider' },
  VETERINARIAN: { fullName: 'Dr. Nguyen Thu Ha', login: 'veterinarian' },
  GROOM: { fullName: 'Bui Van Hai', login: 'groom' },
  HORSE_OWNER: { fullName: 'Tran Quoc Bao', login: 'horse.owner' },
};
export interface SampleData {
  horseRegistry?: HorseSampleState;
  /** Validated Groom identities seen through the shared sample transport, not API credentials. */
  groomUserIds?: number[];
  version: 1;
  nextId: number;
  healthStatus: HealthStatus;
  programs: ProgramDetail[];
  sessions: SampleSession[];
  flow2Seeded?: boolean;
  cases: MedicalCase[];
  tasks: CaseTreatmentTask[];
  incidents: Incident[];
}
function seed(): SampleData {
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const groomId = sampleUser('GROOM').id;
  const sessions = (['INTERRUPTED', 'COMPLETED'] as const).map((status, index): SessionResultView => ({
    session: { id: 42 + index, sessionCode: `SES-00${42 + index}`, horse, programId: 1001, phaseName: 'Foundation',
      scheduledStart: now, scheduledEnd: now, actualStart: now, actualEnd: now, status,
      focus: index ? 'Steady canter' : 'Response review', surface: 'SAND', intensity: 'MEDIUM',
      interruptionReason: index ? null : 'Trainer stopped after an abnormal rider observation',
      trainer: sampleUser('TRAINER'), workRider: sampleUser('WORK_RIDER'), hasEvaluation: false,
      exercises: [{ id: 1, exerciseDefinitionId: 9, exerciseOrder: 1, exerciseName: 'Canter', distanceM: 400, durationMin: null, repetitions: 3, restIntervalMin: 2, intensity: 'MEDIUM' }] },
    actual: { totalDistanceM: index ? 1200 : 400, durationMin: index ? 18 : 7, maxHeartRate: 174, avgHeartRate: 144, maxSpeedKmh: 32, avgSpeedKmh: null, sampleCount: 3 },
    samples: [118, 174, 140].map((heartRate, i) => ({ recordedAt: new Date(Date.now() - (3 - i) * 60000).toISOString(), source: 'MANUAL', heartRate, speedKmh: i ? 28 : null, distanceM: null })),
    alerts: [], evaluation: null,
    riderFeedback: { id: 81 + index, sessionId: 42 + index, submittedBy: sampleUser('WORK_RIDER'), submittedAt: now, responses: { horseResponse: index ? 'Settled and responsive' : 'Uneven response; stopped for review', notes: 'Sample observation, not a clinical diagnosis.' } },
  }));
  return { version: 1, nextId: 2000, healthStatus: 'MONITORING', groomUserIds: [groomId],
    programs: [{ id: 1001, horse, name: 'Thunder Bolt · Foundation', status: 'ACTIVE', periodStart: day, periodEnd: '2026-12-31', sourceTemplateId: 3, sourceTemplateVersion: 1, activatedAt: now, currentTrainer: sampleUser('TRAINER'), phases: [{ id: 101, phaseOrder: 1, name: 'Foundation', startDate: day, endDate: '2026-12-31', isCustomized: true }] }],
    sessions,
    cases: [{ id: 501, horseId: 7, status: 'OPEN', openedAt: now, reason: 'Review observation from interrupted session SES-0042', incidentIds: [601],
      examinations: [{ id: 511, caseId: 501, horseId: 7, symptoms: 'Mild stiffness after exercise', diagnosis: 'Sample veterinary observation', severity: 'MILD', healthStatus: 'MONITORING', examinedAt: now }],
      injuries: [], reexaminations: [], treatmentPlan: { id: 521, caseId: 501, treatmentMedicationInstructions: 'Sample plan — observe response; no actual medication instruction', careInstructions: 'Observe and report changes', restInstructions: 'Follow the veterinary plan', createdAt: now } }],
    tasks: [{ id: 701, caseId: 501, treatmentPlanId: 521, horseId: 7, assignedGroomUserId: groomId, instruction: 'Observe Thunder Bolt and report changes to the Veterinarian', taskDate: day, scheduledSlot: 'Morning', status: 'PENDING' }],
    incidents: [{ id: 601, incidentCode: 'INC-0601', horseId: 7, reportedByUserId: groomId, medicalCaseId: 501, trainingSessionId: 42, incidentType: 'HOOF_OR_LEG_PROBLEM', observedSeverity: 'LOW', description: 'Sample observation linked to interrupted session and case 501', observedAt: now, reportedAt: now, status: 'UNDER_REVIEW' }],
  };
}
export function readSamples(): SampleData {
  const raw = localStorage.getItem(STATE_KEY);
  if (raw) {
    try { const data = JSON.parse(raw) as SampleData; if (data.version === 1 && Array.isArray(data.sessions) && Array.isArray(data.cases)) { seedOperationalSessions(data); ensureHorseRegistry(data); return data; } } catch { /* Recover only sample data, never auth. */ }
  }
  const data = seed(); seedOperationalSessions(data); ensureHorseRegistry(data); saveSamples(data); return data;
}
export function saveSamples(data: SampleData) { localStorage.setItem(STATE_KEY, JSON.stringify(data)); }
export function resetSamples() { const data = seed(); seedOperationalSessions(data); ensureHorseRegistry(data); saveSamples(data); return data; }

/** Initialize missing registry only; never replace persisted Horse/Medical/Session data. */
function ensureHorseRegistry(data: SampleData) {
  if (data.horseRegistry) return;
  data.horseRegistry = initialHorses();
  const sharedHorse = data.horseRegistry.records.find((record) => record.id === horse.id);
  if (sharedHorse) sharedHorse.healthStatus = data.healthStatus;
  saveSamples(data);
}

function seedOperationalSessions(data: SampleData) {
  if (data.flow2Seeded) return;
  for (const item of data.sessions) Object.assign(item.session, { blocked: false, blockedReasons: [], trainingAvailability: 'AVAILABLE', preCheckResult: 'ALL_NORMAL', hasRiderFeedback: Boolean(item.riderFeedback) });
  const baseline = data.sessions[0];
  for (const [id, status] of [[44, 'SCHEDULED'], [45, 'SCHEDULED'], [46, 'PAUSED'], [47, 'IN_PROGRESS'], [48, 'SCHEDULED']] as const) {
    const item: SampleSession = structuredClone(baseline);
    Object.assign(item.session, { id, sessionCode: `SES-00${id}`, status, focus: id === 48 ? 'Upcoming canter' : 'Foundation canter', scheduledStart: new Date(Date.now() + (id === 48 ? 3600000 : -300000)).toISOString(), scheduledEnd: new Date(Date.now() + 5400000).toISOString(), actualStart: status === 'SCHEDULED' ? null : new Date(Date.now() - 180000).toISOString(), actualEnd: null, interruptionReason: null, preCheckResult: status === 'SCHEDULED' ? null : 'ALL_NORMAL', preSessionCheck: null, blocked: status === 'SCHEDULED', blockedReasons: status === 'SCHEDULED' ? ['PRE_CHECK_MISSING'] : [], hasRiderFeedback: false, hasEvaluation: false });
    item.evaluation = null; item.riderFeedback = null; item.actual = { durationMin: null, totalDistanceM: null, maxHeartRate: null, avgSpeedKmh: null, sampleCount: 0 }; item.samples = []; item.alerts = [];
    data.sessions.push(item);
  }
  data.flow2Seeded = true;
  saveSamples(data);
}
