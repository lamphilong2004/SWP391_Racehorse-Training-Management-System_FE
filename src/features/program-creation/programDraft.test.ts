import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyTemplateForHorse, validateProgramCreation } from './programDraft';
import { candidate, template, validRequest } from './__tests__/fixtures';
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T03:00Z')); });
afterEach(() => vi.useRealTimers());

describe('CORE-022 horse-specific program draft', () => {
  it('copies the selected immutable version and preserves phase lineage without guessing dates or intensity enums', () => {
    const source = structuredClone(template);
    const draft = copyTemplateForHorse(7, source);
    draft.phases[0].name = 'Horse-specific foundation';
    draft.goals = 'Horse-specific goal';

    expect(draft.templateVersionId).toBe(302);
    expect(draft.phases[0].templateVersionPhaseId).toBe(31);
    expect(draft.phases[0].startDate).toBe('');
    expect(draft.phases[0].intensityMin).toBeUndefined();
    expect(source).toEqual(template);
    expect(validateProgramCreation(draft).map((issue) => issue.field)).toContain('trainer.trainerUserId');
  });

  it('accepts the completed contract payload including acknowledged candidate warnings', () => {
    expect(validateProgramCreation(validRequest(), candidate)).toEqual([]);
  });

  it('rejects yesterday at Vietnam midnight but accepts today and a future program', () => {
    const input = validRequest();
    expect(validateProgramCreation(input, candidate, new Date('2026-11-01T16:59:59Z'))).toEqual([]);
    expect(validateProgramCreation(input, candidate, new Date('2026-11-01T17:00:00Z'))).toContainEqual(expect.objectContaining({ field: 'periodStart' }));
    expect(validateProgramCreation(input, candidate, new Date('2026-01-01T00:00:00Z'))).toEqual([]);
  });

  it('reports missing selections, required values and schema text limits by field', () => {
    const input = validRequest();
    input.horseId = 0;
    input.templateVersionId = 0;
    input.name = '';
    input.goals = 'x'.repeat(2001);
    input.phases = [];
    input.trainer.trainerUserId = 0;
    expect(validateProgramCreation(input).map((issue) => issue.field)).toEqual(expect.arrayContaining([
      'horseId', 'templateVersionId', 'name', 'goals', 'phases', 'trainer.trainerUserId',
    ]));
  });

  it('rejects impossible calendar dates, backwards dates, and phases outside the program', () => {
    const input = validRequest();
    input.phases[0].startDate = '2026-02-30';
    input.phases[1].endDate = '2026-12-01';
    input.periodEnd = '2026-10-31';
    expect(validateProgramCreation(input).map((issue) => issue.field)).toEqual(expect.arrayContaining([
      'periodEnd', 'phases[0].startDate', 'phases[1].endDate',
    ]));
  });

  it('detects overlapping phases irrespective of input order, while allowing the next calendar day', () => {
    const input = validRequest();
    input.phases.reverse();
    expect(validateProgramCreation(input)).toEqual([]);
    input.phases[0].startDate = '2026-11-07';
    expect(validateProgramCreation(input)).toContainEqual({ field: 'phases[0].startDate', message: 'Thời gian các giai đoạn không được chồng lấn.' });
  });

  it('validates the ordered intensity range and Trainer warning acknowledgement', () => {
    const input = validRequest();
    input.phases[0].intensityMin = 'HIGH';
    input.phases[0].intensityMax = 'MEDIUM_HIGH';
    input.trainer.warningsAcknowledged = false;
    expect(validateProgramCreation(input, candidate).map((issue) => issue.field)).toEqual([
      'phases[0].intensityMax', 'trainer.warningsAcknowledged',
    ]);
  });
});
