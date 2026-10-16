import type { CreateProgramRequest, ProgramDetail, TemplateDetail, TrainerCandidate } from '../programTypes';

export const template: TemplateDetail = {
  template: { id: 3, templateCode: 'TPL-003', name: 'Race Preparation', status: 'ACTIVE', latestVersionNo: 3 },
  version: {
    id: 302, versionNo: 2, name: 'Race Preparation 1600m', goals: 'Build endurance and speed',
    phases: [
      { id: 31, phaseOrder: 1, name: 'Foundation', objective: 'Build aerobic base', recommendedDuration: '10–14 days', intensityGuidance: 'Low to moderate' },
      { id: 32, phaseOrder: 2, name: 'Endurance', objective: 'Extend sustained gallop', recommendedDuration: '14 days' },
    ],
    requiredSkills: [{ id: 4, name: 'Endurance' }], createdAt: '2026-10-01T00:00:00.000Z',
  },
  versions: [{ id: 302, versionNo: 2, createdAt: '2026-10-01T00:00:00.000Z' }, { id: 303, versionNo: 3, createdAt: '2026-10-02T00:00:00.000Z' }],
};

export const candidate: TrainerCandidate = {
  user: { id: 12, fullName: 'Fixture Trainer', userCode: 'U-012' },
  label: 'SUITABLE_WITH_CAUTION', reasons: ['Has endurance experience'], warnings: ['Review current workload'], hardBlock: null,
};

export function validRequest(): CreateProgramRequest {
  return {
    horseId: 7, templateVersionId: 302, name: 'Horse-specific program', goals: 'Build endurance',
    periodStart: '2026-11-01', periodEnd: '2026-11-30', notes: 'Protect recovery',
    phases: [
      { templateVersionPhaseId: 31, phaseOrder: 1, name: 'Foundation', startDate: '2026-11-01', endDate: '2026-11-07', intensityMin: 'LOW', intensityMax: 'MEDIUM' },
      { templateVersionPhaseId: 32, phaseOrder: 2, name: 'Endurance', startDate: '2026-11-08', endDate: '2026-11-30', intensityMin: 'MEDIUM', intensityMax: 'MEDIUM_HIGH', workload: 'Progress gradually' },
    ],
    trainer: { trainerUserId: 12, effectiveFrom: '2026-11-01', warningsAcknowledged: true },
  };
}

export const createdProgram: ProgramDetail = {
  id: 1001, horse: { id: 7, horseCode: 'TB-001', name: 'Thunder Bolt' }, name: 'Horse-specific program', status: 'ACTIVE',
  periodStart: '2026-11-01', periodEnd: '2026-11-30', sourceTemplateId: 3, sourceTemplateVersion: 2,
  activatedAt: '2026-10-16T12:00:00.000Z', phases: validRequest().phases.map((phase, index) => ({ ...phase, id: index + 100, isCustomized: true })),
};
