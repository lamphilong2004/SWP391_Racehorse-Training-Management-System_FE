import { describe, expect, it, vi } from 'vitest';
import { createBaselineApi, validateWeight } from '../baseline/baselineApi';
import { blocksSession, createSessionApi, type CreateSessionInput } from '../trainer-session/sessionApi';
import { createRestrictionApi, rulePayload } from '../restrictions/restrictionApi';

describe('approved FE adapter boundaries', () => {
  it('sends only approved baseline fields; the server owns the timestamp', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createBaselineApi(request).save(7, { weightKg: 512.25, healthStatus: 'FIT', clinicalNotes: 'Normal gait', recordedAt: 'forbidden' } as never);
    expect(request.mock.calls[0][0]).toBe('/api/horses/7/baseline-examinations');
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ weightKg: 512.25, healthStatus: 'FIT', clinicalNotes: 'Normal gait' });
    expect(['0', '-1', '9999.999', '10000', 'Infinity'].some(validateWeight)).toBe(false);
    expect(validateWeight('512.25')).toBe(true);
  });
  it('serializes draft and create separately and does not send UI fields or source objects', async () => {
    const request = vi.fn().mockResolvedValue({});
    const input = { horseProgramPhaseId: 31, scheduledStart: '2026-11-05T06:00:00Z', workRiderUserId: 5, riderWarningAcknowledged: false,
      surface: 'Turf', focus: 'Balance', sourceProgram: {}, exercises: [{ exerciseDefinitionId: 8, exerciseOrder: 99, exerciseName: 'Do not serialize', durationMin: 20 }] } as unknown as CreateSessionInput;
    const api = createSessionApi(request); await api.suitability(input); await api.create(input);
    const check = JSON.parse(request.mock.calls[0][1].body), create = JSON.parse(request.mock.calls[1][1].body);
    expect(check).not.toHaveProperty('surface'); expect(check).not.toHaveProperty('focus'); expect(create).not.toHaveProperty('sourceProgram');
    expect(create.exercises).toEqual([{ exerciseDefinitionId: 8, exerciseOrder: 1, durationMin: 20 }]);
    expect(create.workRiderUserId).toBe(5);
  });
  it('never treats medical/operational blocks as acknowledgeable', () => {
    expect(blocksSession({ trainingAvailability: 'LIMITED', sessionBlocked: false, sessionIssues: [], exercises: [{ exerciseOrder: 1, exerciseDefinitionId: 8, category: 'A', messages: ['Prohibited exercise'] }] }, [{ exerciseDefinitionId: 8, exerciseOrder: 1, acknowledgementNote: 'Override requested' }])).toContain('Prohibited exercise');
  });
  it('retains ALLOWED/PROHIBITED and requires exactly one rule target', async () => {
    expect(rulePayload([{ ruleType: 'ALLOWED', exerciseTypeNote: 'Walk' }, { ruleType: 'PROHIBITED', exerciseId: 8 }])).toEqual({ rules: [{ ruleType: 'ALLOWED', exerciseTypeNote: 'Walk' }, { ruleType: 'PROHIBITED', exerciseId: 8 }] });
    expect(() => rulePayload([{ ruleType: 'PROHIBITED', exerciseId: 8, exerciseTypeNote: 'Gallop' }])).toThrow('exactly one');
    expect(() => rulePayload([{ ruleType: 'PERMITTED' as never, exerciseId: 8 }])).toThrow('ALLOWED or PROHIBITED');
    const request = vi.fn().mockResolvedValue({}); await createRestrictionApi(request).lift(12);
    expect(request.mock.calls[0]).toEqual(['/api/medical/restrictions/12/lift', { method: 'POST', body: '{}' }]);
  });
});
