import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramCreationApi } from './programApi';
import { useProgramCreation } from './useProgramCreation';
import { candidate, createdProgram, template, validRequest } from './__tests__/fixtures';
import type { HorseSelection, TemplateDetail } from './programTypes';
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T03:00Z')); });
afterEach(() => vi.useRealTimers());

const horse: HorseSelection = { id: 7, horseCode: 'TB-001', name: 'Thunder Bolt', lifecycle: 'ACTIVE', trainingAvailability: 'AVAILABLE' };

function fixtureApi(): ProgramCreationApi {
  return {
    listPrograms: vi.fn().mockResolvedValue({ items: [] }),
    listHorses: vi.fn().mockResolvedValue({ items: [horse] }),
    listTemplates: vi.fn().mockResolvedValue({ items: [template.template] }),
    templateRecommendations: vi.fn().mockResolvedValue([]),
    template: vi.fn().mockResolvedValue(structuredClone(template)),
    trainerRecommendations: vi.fn().mockResolvedValue({ candidates: [candidate] }),
    create: vi.fn().mockResolvedValue(createdProgram),
    read: vi.fn().mockResolvedValue(createdProgram),
  };
}

describe('CORE-022 program creation slice (fixtures, not BE integration)', () => {
  it('selects horse/version, customizes its copy, assigns Trainer, validates and creates once', async () => {
    const api = fixtureApi();
    const { result } = renderHook(() => useProgramCreation(api));
    await act(() => result.current.selectHorse(horse));
    await act(() => result.current.selectTemplate(3, 2));
    expect(api.trainerRecommendations).toHaveBeenCalledWith(7, 302, expect.any(AbortSignal));

    const values = validRequest();
    await act(() => result.current.updateDraft({
      name: values.name, periodStart: values.periodStart, periodEnd: values.periodEnd,
      phases: values.phases, trainer: values.trainer,
    }));
    await act(() => result.current.submit());
    await act(() => result.current.submit());

    expect(result.current.created).toEqual(createdProgram);
    expect(result.current.issues).toEqual([]);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ horseId: 7, templateVersionId: 302 }));
    expect(result.current.template).toEqual(template);
  });

  it('blocks unacknowledged warnings, then preserves the draft and exact API error on submit failure', async () => {
    const api = fixtureApi();
    const error = Object.assign(new Error('Horse is now LOCKED.'), { status: 409, code: 'BUSINESS_RULE_VIOLATION' });
    vi.mocked(api.create).mockRejectedValue(error);
    const { result } = renderHook(() => useProgramCreation(api));
    await act(() => result.current.selectHorse(horse));
    await act(() => result.current.selectTemplate(3, 2));
    await act(() => result.current.updateDraft({ ...validRequest(), trainer: { ...validRequest().trainer, warningsAcknowledged: false } }));
    await act(() => result.current.submit());
    expect(api.create).not.toHaveBeenCalled();
    expect(result.current.issues.map((issue) => issue.field)).toContain('trainer.warningsAcknowledged');

    await act(() => result.current.updateDraft({ trainer: validRequest().trainer }));
    await act(() => result.current.submit());
    expect(result.current.error).toBe(error);
    expect(result.current.created).toBeNull();
    expect(result.current.draft?.templateVersionId).toBe(302);
  });

  it('rejects LOCKED horse selection and ignores stale template responses after changing horse', async () => {
    const api = fixtureApi();
    let finishTemplate!: (value: TemplateDetail) => void;
    vi.mocked(api.template).mockImplementation(() => new Promise((resolve) => { finishTemplate = resolve; }));
    const { result } = renderHook(() => useProgramCreation(api));
    await act(() => result.current.selectHorse({ ...horse, trainingAvailability: 'LOCKED' }));
    expect(result.current.issues[0]?.field).toBe('horseId');
    expect(api.templateRecommendations).not.toHaveBeenCalled();

    await act(() => result.current.selectHorse(horse));
    let templateRequest!: Promise<void>;
    act(() => { templateRequest = result.current.selectTemplate(3, 2); });
    await act(() => result.current.selectHorse({ ...horse, id: 8, name: 'Another horse' }));
    await act(async () => { finishTemplate(template); await templateRequest; });
    expect(result.current.horse?.id).toBe(8);
    expect(result.current.draft).toBeNull();
    expect(api.trainerRecommendations).not.toHaveBeenCalled();
  });
});
