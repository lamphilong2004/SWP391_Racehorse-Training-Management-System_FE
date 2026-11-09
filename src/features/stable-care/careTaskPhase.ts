import type { Task } from './stableCareApi';

/** A task still open this long after its slot is shown as overdue to the Groom and the manager. */
export const OVERDUE_AFTER_MINUTES = 60;

export type CarePhase = 'overdue' | 'due' | 'upcoming' | 'done' | 'cancelled';

export const PHASE_LABELS: Record<CarePhase, string> = {
  overdue: 'Quá giờ', due: 'Cần làm', upcoming: 'Chưa đến giờ', done: 'Đã hoàn thành', cancelled: 'Đã hủy',
};

const PHASE_ORDER: Record<CarePhase, number> = { overdue: 0, due: 1, upcoming: 2, done: 3, cancelled: 4 };

const COMPONENT_LABELS: Record<string, string> = { HAY: 'Cỏ khô', GRAIN: 'Thức ăn hạt', VITAMINS_SUPPLEMENTS: 'Bổ sung' };

export const slotTime = (slot?: string | null) => slot?.trim().match(/^([01]\d|2[0-3]):[0-5]\d(?=$|\s|[·—–-])/)?.[0];

/** Feeding tasks store "HAY: 2 kg"; show the Vietnamese component name instead of the API code (DEC-011). */
export const instructionText = (text: string) =>
  text.replace(/^(HAY|GRAIN|VITAMINS_SUPPLEMENTS):/, (_, code: string) => `${COMPONENT_LABELS[code]}:`);

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Phase of one task on `date`, judged against the club clock `clubNow` (YYYY-MM-DDTHH:mm, Vietnam time). */
export function taskPhase(task: Pick<Task, 'slot' | 'completedAt' | 'cancelledAt'>, date: string, clubNow: string): CarePhase {
  if (task.cancelledAt) return 'cancelled';
  if (task.completedAt) return 'done';
  const today = clubNow.slice(0, 10);
  if (date < today) return 'overdue';
  if (date > today) return 'upcoming';
  const slot = slotTime(task.slot) ?? '00:00';
  const now = minutes(clubNow.slice(11, 16));
  if (now < minutes(slot)) return 'upcoming';
  return now - minutes(slot) > OVERDUE_AFTER_MINUTES ? 'overdue' : 'due';
}

export function comparePhase(a: { phase: CarePhase; slot: string; horseName: string }, b: { phase: CarePhase; slot: string; horseName: string }) {
  return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]
    || (slotTime(a.slot) ?? '').localeCompare(slotTime(b.slot) ?? '')
    || a.horseName.localeCompare(b.horseName, 'vi');
}

export function summarize(tasks: Task[], date: string, clubNow: string) {
  const phases = tasks.map(task => taskPhase(task, date, clubNow));
  const count = (phase: CarePhase) => phases.filter(value => value === phase).length;
  return {
    total: tasks.length, done: count('done'), cancelled: count('cancelled'), overdue: count('overdue'),
    pending: tasks.length - count('done') - count('cancelled'),
  };
}
