import type { CreateProgramRequest, ProgramPhaseInput, TemplateDetail, TrainerCandidate } from './programTypes';
import { clubDate } from '../../shared/clubCalendar';

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

export function validateProgramCreation(input: CreateProgramRequest, candidate?: TrainerCandidate, now = new Date()): ProgramValidationIssue[] {
  const issues: ProgramValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  const text = (field: string, value: string | null | undefined, max: number, required = false) => {
    if (required && !value?.trim()) add(field, 'Trường này là bắt buộc.');
    if (value && value.length > max) add(field, `Tối đa ${max} ký tự.`);
  };
  const date = (field: string, value: string) => {
    if (!validDate(value)) add(field, 'Nhập ngày hợp lệ.');
  };

  if (!Number.isSafeInteger(input.horseId) || input.horseId <= 0) add('horseId', 'Hãy chọn ngựa.');
  if (!Number.isSafeInteger(input.templateVersionId) || input.templateVersionId <= 0) add('templateVersionId', 'Hãy chọn phiên bản mẫu.');
  text('name', input.name, 150, true);
  text('goals', input.goals, 2000);
  text('targetMetrics', input.targetMetrics, 1000);
  text('notes', input.notes, 2000);
  date('periodStart', input.periodStart);
  date('periodEnd', input.periodEnd);
  if (validDate(input.periodStart) && input.periodStart < clubDate(now)) {
    add('periodStart', 'Chương trình phải bắt đầu từ hôm nay trở đi, tính theo giờ Việt Nam.');
  }
  if (validDate(input.periodStart) && validDate(input.periodEnd) && input.periodEnd < input.periodStart) {
    add('periodEnd', 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
  }
  if (input.phases.length === 0) add('phases', 'Cần ít nhất một giai đoạn.');

  const intensities = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'];
  input.phases.forEach((phase, index) => {
    const prefix = `phases[${index}]`;
    if (!Number.isInteger(phase.phaseOrder) || phase.phaseOrder < 1) add(`${prefix}.phaseOrder`, 'Thứ tự giai đoạn phải là số nguyên dương.');
    text(`${prefix}.name`, phase.name, 150, true);
    text(`${prefix}.objective`, phase.objective, 1000);
    text(`${prefix}.workload`, phase.workload, 500);
    date(`${prefix}.startDate`, phase.startDate);
    date(`${prefix}.endDate`, phase.endDate);
    if (phase.intensityMin != null && !intensities.includes(phase.intensityMin)) add(`${prefix}.intensityMin`, 'Hãy chọn cường độ hợp lệ.');
    if (phase.intensityMax != null && !intensities.includes(phase.intensityMax)) add(`${prefix}.intensityMax`, 'Hãy chọn cường độ hợp lệ.');
    if (validDate(phase.startDate) && validDate(phase.endDate)) {
      if (phase.endDate < phase.startDate) add(`${prefix}.endDate`, 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
      if (validDate(input.periodStart) && phase.startDate < input.periodStart) add(`${prefix}.startDate`, 'Giai đoạn phải nằm trong thời gian chương trình.');
      if (validDate(input.periodEnd) && phase.endDate > input.periodEnd) add(`${prefix}.endDate`, 'Giai đoạn phải nằm trong thời gian chương trình.');
    }
    if (phase.intensityMin && phase.intensityMax && intensities.indexOf(phase.intensityMin) > intensities.indexOf(phase.intensityMax)) {
      add(`${prefix}.intensityMax`, 'Cường độ tối đa phải lớn hơn hoặc bằng cường độ tối thiểu.');
    }
  });
  const datedPhases = input.phases.map((phase, index) => ({ phase, index }))
    .filter(({ phase }) => validDate(phase.startDate) && validDate(phase.endDate))
    .sort((a, b) => a.phase.startDate.localeCompare(b.phase.startDate));
  for (let index = 1; index < datedPhases.length; index += 1) {
    if (datedPhases.slice(0, index).some(({ phase }) => phase.endDate >= datedPhases[index].phase.startDate)) {
      add(`phases[${datedPhases[index].index}].startDate`, 'Thời gian các giai đoạn không được chồng lấn.');
    }
  }

  if (!Number.isSafeInteger(input.trainer.trainerUserId) || input.trainer.trainerUserId <= 0) add('trainer.trainerUserId', 'Hãy chọn Trainer.');
  date('trainer.effectiveFrom', input.trainer.effectiveFrom);
  text('trainer.reason', input.trainer.reason, 500);
  if (candidate) {
    if (candidate.user.id !== input.trainer.trainerUserId) add('trainer.trainerUserId', 'Hãy chọn Trainer trong danh sách ứng viên hiện tại.');
    if (candidate.hardBlock) add('trainer.trainerUserId', candidate.hardBlock);
    if (candidate.warnings.length > 0 && !input.trainer.warningsAcknowledged) add('trainer.warningsAcknowledged', 'Hãy xác nhận các cảnh báo về Trainer trước khi gửi.');
  }
  return issues;
}

export interface AdjustedPhase extends ProgramPhaseInput { id?: number }
/** Mirrors the server rule for PUT /phases: ordered, non-overlapping, inside the program period, approved intensities. */
export function validateAdjustedPhases(phases: AdjustedPhase[], periodStart: string, periodEnd: string): Record<string, string> {
  const issues: Record<string, string> = {}, intensities = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'];
  if (!phases.length) issues.phases = 'Cần giữ ít nhất một giai đoạn.';
  phases.forEach((phase, index) => {
    const key = (field: string) => `${index}.${field}`;
    if (!phase.name.trim()) issues[key('name')] = 'Nhập tên giai đoạn.';
    else if (phase.name.trim().length > 150) issues[key('name')] = 'Tối đa 150 ký tự.';
    if ((phase.objective ?? '').length > 1000) issues[key('objective')] = 'Tối đa 1000 ký tự.';
    if ((phase.workload ?? '').length > 500) issues[key('workload')] = 'Tối đa 500 ký tự.';
    if (!validDate(phase.startDate)) issues[key('startDate')] = 'Nhập ngày hợp lệ.';
    else if (phase.startDate < periodStart) issues[key('startDate')] = 'Ngày bắt đầu phải nằm trong thời gian chương trình.';
    if (!validDate(phase.endDate)) issues[key('endDate')] = 'Nhập ngày hợp lệ.';
    else if (phase.endDate > periodEnd) issues[key('endDate')] = 'Ngày kết thúc phải nằm trong thời gian chương trình.';
    else if (validDate(phase.startDate) && phase.endDate < phase.startDate) issues[key('endDate')] = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
    const previous = phases[index - 1];
    if (previous && validDate(previous.endDate) && validDate(phase.startDate) && phase.startDate <= previous.endDate && !issues[key('startDate')]) issues[key('startDate')] = 'Ngày bắt đầu phải sau khi giai đoạn trước kết thúc.';
    if (phase.intensityMin && phase.intensityMax && intensities.indexOf(phase.intensityMin) > intensities.indexOf(phase.intensityMax)) issues[key('intensityMax')] = 'Tối đa phải lớn hơn hoặc bằng tối thiểu.';
  });
  return issues;
}
