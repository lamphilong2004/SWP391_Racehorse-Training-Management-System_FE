import type { CurrentUser } from '../auth/authApi';
import { ROLE_LABELS, type RoleCode } from '../auth/roles';
import type { SessionResultView } from '../../features/evaluation/models';
import type { MedicalCase, CaseTreatmentTask, Incident, HealthStatus } from '../../features/medical/models';
import type { ProgramDetail, TemplateDetail, HorseSelection } from '../../features/program-creation/programTypes';
import type { HorseSampleState } from './horseSamples';

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
  return { id: ids[role], userCode: `PREVIEW-${ids[role]}`, fullName: `${ROLE_LABELS[role]} · Sample`, email: `${role.toLowerCase()}@sample.invalid`, roles: [role], accountStatus: 'ACTIVE' };
}
export interface SampleData {
  horseRegistry?: HorseSampleState;
  version: 1;
  nextId: number;
  healthStatus: HealthStatus;
  programs: ProgramDetail[];
  sessions: SessionResultView[];
  cases: MedicalCase[];
  tasks: CaseTreatmentTask[];
  incidents: Incident[];
}
function seed(): SampleData {
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
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
  return { version: 1, nextId: 2000, healthStatus: 'MONITORING',
    programs: [{ id: 1001, horse, name: 'Thunder Bolt · Foundation', status: 'ACTIVE', periodStart: day, periodEnd: '2026-12-31', sourceTemplateId: 3, sourceTemplateVersion: 1, activatedAt: now, currentTrainer: sampleUser('TRAINER'), phases: [{ id: 101, phaseOrder: 1, name: 'Foundation', startDate: day, endDate: '2026-12-31', isCustomized: true }] }],
    sessions,
    cases: [{ id: 501, horseId: 7, status: 'OPEN', openedAt: now, reason: 'Review observation from interrupted session SES-0042', incidentIds: [601],
      examinations: [{ id: 511, caseId: 501, horseId: 7, symptoms: 'Mild stiffness after exercise', diagnosis: 'Sample veterinary observation', severity: 'MILD', healthStatus: 'MONITORING', examinedAt: now }],
      injuries: [], reexaminations: [], treatmentPlan: { id: 521, caseId: 501, treatmentMedicationInstructions: 'Sample plan — observe response; no actual medication instruction', careInstructions: 'Observe and report changes', restInstructions: 'Follow the veterinary plan', createdAt: now } }],
    tasks: [{ id: 701, caseId: 501, treatmentPlanId: 521, horseId: 7, assignedGroomUserId: 16, instruction: 'Observe Thunder Bolt and report changes to the Veterinarian', taskDate: day, scheduledSlot: 'Morning', status: 'PENDING' }],
    incidents: [{ id: 601, incidentCode: 'INC-0601', horseId: 7, reportedByUserId: 16, medicalCaseId: 501, trainingSessionId: 42, incidentType: 'HOOF_OR_LEG_PROBLEM', observedSeverity: 'LOW', description: 'Sample observation linked to interrupted session and case 501', observedAt: now, reportedAt: now, status: 'UNDER_REVIEW' }],
  };
}
export function readSamples(): SampleData {
  const raw = localStorage.getItem(STATE_KEY);
  if (raw) {
    try { const data = JSON.parse(raw) as SampleData; if (data.version === 1 && Array.isArray(data.sessions) && Array.isArray(data.cases)) return data; } catch { /* Reset only this preview's state. */ }
  }
  const data = seed(); saveSamples(data); return data;
}
export function saveSamples(data: SampleData) { localStorage.setItem(STATE_KEY, JSON.stringify(data)); }
export function resetSamples() { const data = seed(); saveSamples(data); return data; }
