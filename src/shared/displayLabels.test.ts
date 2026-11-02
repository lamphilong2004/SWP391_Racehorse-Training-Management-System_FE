import { describe, expect, it } from 'vitest';
import { viLabel } from './viLabels';
import { serverText } from './serverText';

describe('Vietnamese presentation without changing wire data', () => {
  it('translates intensity and surface codes but preserves unknown supplied values', () => {
    expect(viLabel('SAND')).toBe('Cát');expect(viLabel('LOW')).toBe('Thấp');expect(viLabel('New surface')).toBe('New surface');
  });
  it('explains a concurrent plan edit and a stale stock balance without pretending success', () => {
    expect(serverText('The plan changed while completing this task. Refresh your assignments and review before trying again.')).toContain('Kế hoạch vừa thay đổi');
    expect(serverText('Stock changed, item is inactive, or quantity is insufficient. Refresh and review before submitting again.')).toContain('Hãy tải lại tồn kho');
  });
  it('does not rewrite arbitrary clinical or operational notes', () => {
    const note = 'User-entered observation: SAND and LOW remain in this quoted note.';
    expect(serverText(note)).toBe(note);
  });
  it('explains task reassignment conflicts and cancellation without rewriting the contract', () => {
    expect(serverText('Task assignment changed. Refresh before trying again.')).toContain('Phân công vừa thay đổi');
    expect(serverText('This task is cancelled and cannot be completed.')).toContain('không thể đánh dấu hoàn thành');
    expect(serverText('Completed or past tasks cannot be cancelled or reassigned.')).toContain('đã qua ngày');
  });
});
