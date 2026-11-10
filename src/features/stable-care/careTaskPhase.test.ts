import { instructionText, summarize, taskPhase } from './careTaskPhase';
import type { Task } from './stableCareApi';

const open = { slot: '07:00', completedAt: null, cancelledAt: null };

it('marks a task overdue only after the grace period, and keeps finished tasks final', () => {
  expect(taskPhase(open, '2026-11-09', '2026-11-09T06:59')).toBe('upcoming');
  expect(taskPhase(open, '2026-11-09', '2026-11-09T08:00')).toBe('due');
  expect(taskPhase(open, '2026-11-09', '2026-11-09T08:01')).toBe('overdue');
  expect(taskPhase(open, '2026-11-08', '2026-11-09T05:00')).toBe('overdue');
  expect(taskPhase(open, '2026-11-10', '2026-11-09T23:00')).toBe('upcoming');
  expect(taskPhase({ ...open, completedAt: '2026-11-09T09:00:00Z' }, '2026-11-09', '2026-11-09T20:00')).toBe('done');
  expect(taskPhase({ ...open, cancelledAt: '2026-11-09T09:00:00Z' }, '2026-11-09', '2026-11-09T20:00')).toBe('cancelled');
});

it('shows feeding components in Vietnamese and counts overdue work', () => {
  expect(instructionText('HAY: 1.5 kg')).toBe('Cỏ khô: 1.5 kg');
  expect(instructionText('VITAMINS_SUPPLEMENTS: 20 g')).toBe('Bổ sung: 20 g');
  expect(instructionText('Dọn chất độn, HAY: không')).toBe('Dọn chất độn, HAY: không');
  const tasks = [{ ...open }, { ...open, slot: '18:00' }, { ...open, completedAt: 'x' }] as Task[];
  expect(summarize(tasks, '2026-11-09', '2026-11-09T12:00')).toEqual({ total: 3, done: 1, cancelled: 0, overdue: 1, pending: 2 });
});
