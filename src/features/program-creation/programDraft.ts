import type { CreateProgramRequest, TemplateDetail, TrainerCandidate } from './programTypes';

export interface ProgramValidationIssue {
  field: string;
  message: string;
}

/** Copy only fields defined on both schemas. Textual duration/intensity guidance is not parsed into dates/enums. */
export function copyTemplateForHorse(horseId: number, template: TemplateDetail): CreateProgramRequest {
  return {
    horseId,
    templateVersionId: template.version.id,
    name: template.version.name,
    goals: template.version.goals ?? null,
    periodStart: '',
    periodEnd: '',
    phases: template.version.phases.map((phase) => ({
      templateVersionPhaseId: phase.id,
      phaseOrder: phase.phaseOrder,
      name: phase.name,
      objective: phase.objective ?? null,
      startDate: '',
      endDate: '',
    })),
    trainer: { trainerUserId: 0, effectiveFrom: '', warningsAcknowledged: false },
  };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateProgramCreation(input: CreateProgramRequest, candidate?: TrainerCandidate): ProgramValidationIssue[] {
  const issues: ProgramValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  const text = (field: string, value: string | null | undefined, max: number, required = false) => {
    if (required && !value?.trim()) add(field, 'This field is required.');
    if (value && value.length > max) add(field, `Use at most ${max} characters.`);
  };
  const date = (field: string, value: string) => {
    if (!validDate(value)) add(field, 'Enter a valid date.');
  };

  if (!Number.isSafeInteger(input.horseId) || input.horseId <= 0) add('horseId', 'Select a horse.');
  if (!Number.isSafeInteger(input.templateVersionId) || input.templateVersionId <= 0) add('templateVersionId', 'Select a template version.');
  text('name', input.name, 150, true);
  text('goals', input.goals, 2000);
  text('targetMetrics', input.targetMetrics, 1000);
  text('notes', input.notes, 2000);
  date('periodStart', input.periodStart);
  date('periodEnd', input.periodEnd);
  if (validDate(input.periodStart) && validDate(input.periodEnd) && input.periodEnd < input.periodStart) {
    add('periodEnd', 'End date must be on or after the start date.');
  }
  if (input.phases.length === 0) add('phases', 'Define at least one phase.');

  const intensities = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'];
  input.phases.forEach((phase, index) => {
    const prefix = `phases[${index}]`;
    if (!Number.isInteger(phase.phaseOrder) || phase.phaseOrder < 1) add(`${prefix}.phaseOrder`, 'Phase order must be a positive integer.');
    text(`${prefix}.name`, phase.name, 150, true);
    text(`${prefix}.objective`, phase.objective, 1000);
    text(`${prefix}.workload`, phase.workload, 500);
    date(`${prefix}.startDate`, phase.startDate);
    date(`${prefix}.endDate`, phase.endDate);
    if (validDate(phase.startDate) && validDate(phase.endDate)) {
      if (phase.endDate < phase.startDate) add(`${prefix}.endDate`, 'End date must be on or after the start date.');
      if (validDate(input.periodStart) && phase.startDate < input.periodStart) add(`${prefix}.startDate`, 'Phase must be inside the program period.');
      if (validDate(input.periodEnd) && phase.endDate > input.periodEnd) add(`${prefix}.endDate`, 'Phase must be inside the program period.');
    }
    if (phase.intensityMin && phase.intensityMax && intensities.indexOf(phase.intensityMin) > intensities.indexOf(phase.intensityMax)) {
      add(`${prefix}.intensityMax`, 'Maximum intensity must be on or above minimum intensity.');
    }
  });
  const datedPhases = input.phases.map((phase, index) => ({ phase, index }))
    .filter(({ phase }) => validDate(phase.startDate) && validDate(phase.endDate))
    .sort((a, b) => a.phase.startDate.localeCompare(b.phase.startDate));
  for (let index = 1; index < datedPhases.length; index += 1) {
    if (datedPhases.slice(0, index).some(({ phase }) => phase.endDate >= datedPhases[index].phase.startDate)) {
      add(`phases[${datedPhases[index].index}].startDate`, 'Phase date ranges must not overlap.');
    }
  }

  if (!Number.isSafeInteger(input.trainer.trainerUserId) || input.trainer.trainerUserId <= 0) add('trainer.trainerUserId', 'Select a Trainer.');
  date('trainer.effectiveFrom', input.trainer.effectiveFrom);
  text('trainer.reason', input.trainer.reason, 500);
  if (candidate) {
    if (candidate.user.id !== input.trainer.trainerUserId) add('trainer.trainerUserId', 'Select the current Trainer candidate.');
    if (candidate.hardBlock) add('trainer.trainerUserId', candidate.hardBlock);
    if (candidate.warnings.length > 0 && !input.trainer.warningsAcknowledged) add('trainer.warningsAcknowledged', 'Acknowledge the Trainer warnings before submitting.');
  }
  return issues;
}
