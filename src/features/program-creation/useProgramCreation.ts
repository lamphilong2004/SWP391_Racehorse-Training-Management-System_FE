import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgramCreationApi } from './programApi';
import { copyTemplateForHorse, validateProgramCreation, type ProgramValidationIssue } from './programDraft';
import { programFieldErrors } from './programErrors';
import type {
  CandidateList, CreateProgramRequest, HorseSelection, ProgramDetail, TemplateDetail, TemplateRecommendation,
} from './programTypes';

interface CreationState {
  horse: HorseSelection | null;
  recommendations: TemplateRecommendation[];
  template: TemplateDetail | null;
  trainers: CandidateList | null;
  draft: CreateProgramRequest | null;
  created: ProgramDetail | null;
  pending: 'recommendations' | 'template' | 'create' | null;
  error: unknown;
  issues: ProgramValidationIssue[];
}

const initialState: CreationState = {
  horse: null, recommendations: [], template: null, trainers: null, draft: null,
  created: null, pending: null, error: null, issues: [],
};

export function useProgramCreation(api: ProgramCreationApi) {
  const [state, setState] = useState<CreationState>(initialState);
  const selectionRevision = useRef(0);
  const selectionRequest = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const created = useRef<ProgramDetail | null>(null);

  useEffect(() => () => {
    selectionRevision.current += 1;
    selectionRequest.current?.abort();
  }, []);

  const selectHorse = useCallback(async (horse: HorseSelection) => {
    if (submitting.current) return;
    const revision = ++selectionRevision.current;
    selectionRequest.current?.abort();
    created.current = null;
    if (horse.lifecycle !== 'ACTIVE' || horse.trainingAvailability === 'LOCKED') {
      setState({ ...initialState, issues: [{ field: 'horseId', message: 'Hãy chọn ngựa đang hoạt động và không bị khóa tập luyện.' }] });
      return;
    }
    const controller = new AbortController();
    selectionRequest.current = controller;
    setState({ ...initialState, horse, pending: 'recommendations' });
    try {
      const recommendations = await api.templateRecommendations(horse.id, controller.signal);
      if (revision === selectionRevision.current) setState((previous) => ({ ...previous, recommendations, pending: null }));
    } catch (error) {
      if (revision === selectionRevision.current) setState((previous) => ({ ...previous, error, pending: null }));
    }
  }, [api]);

  const selectTemplate = useCallback(async (templateId: number, versionNo?: number) => {
    if (!state.horse || submitting.current) return;
    const horse = state.horse;
    const revision = ++selectionRevision.current;
    selectionRequest.current?.abort();
    const controller = new AbortController();
    selectionRequest.current = controller;
    created.current = null;
    setState((previous) => ({ ...previous, template: null, trainers: null, draft: null, created: null, issues: [], error: null, pending: 'template' }));
    try {
      const template = await api.template(templateId, versionNo, controller.signal);
      if (revision !== selectionRevision.current) return;
      if (template.template.status !== 'ACTIVE') {
        setState((previous) => ({ ...previous, pending: null, issues: [{ field: 'templateVersionId', message: 'Hãy chọn phiên bản của một mẫu đang hoạt động.' }] }));
        return;
      }
      const trainers = await api.trainerRecommendations(horse.id, template.version.id, controller.signal);
      if (revision === selectionRevision.current) {
        setState((previous) => ({ ...previous, template, trainers, draft: copyTemplateForHorse(horse.id, template), pending: null }));
      }
    } catch (error) {
      if (revision === selectionRevision.current) setState((previous) => ({ ...previous, error, pending: null }));
    }
  }, [api, state.horse]);

  const updateDraft = useCallback((patch: Partial<Omit<CreateProgramRequest, 'horseId' | 'templateVersionId'>>) => {
    if (submitting.current || created.current) return;
    setState((previous) => previous.draft ? {
      ...previous,
      draft: { ...previous.draft, ...patch, horseId: previous.draft.horseId, templateVersionId: previous.draft.templateVersionId },
      issues: [], error: null,
    } : previous);
  }, []);

  const submit = useCallback(async () => {
    if (submitting.current || created.current || !state.draft || state.pending) return;
    const selectedTrainer = state.trainers?.candidates.find((candidate) => candidate.user.id === state.draft!.trainer.trainerUserId);
    const issues = validateProgramCreation(state.draft, selectedTrainer);
    if (!selectedTrainer) issues.push({ field: 'trainer.trainerUserId', message: 'Hãy chọn Trainer trong danh sách ứng viên hiện tại.' });
    if (issues.length > 0) {
      setState((previous) => ({ ...previous, issues, error: null }));
      return { kind: 'invalid' as const, issues };
    }
    submitting.current = true;
    setState((previous) => ({ ...previous, pending: 'create', issues: [], error: null }));
    try {
      const program = await api.create(state.draft);
      created.current = program;
      setState((previous) => ({ ...previous, created: program, pending: null }));
      return { kind: 'created' as const, program };
    } catch (error) {
      const issues = programFieldErrors(error);
      setState((previous) => ({ ...previous, error, issues, pending: null }));
      return { kind: 'error' as const, error, issues };
    } finally {
      submitting.current = false;
    }
  }, [api, state.draft, state.pending, state.trainers]);

  return { ...state, selectHorse, selectTemplate, updateDraft, submit };
}

export type ProgramCreationFlow = ReturnType<typeof useProgramCreation>;
