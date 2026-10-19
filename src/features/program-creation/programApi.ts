import type {
  CandidateList, CreateProgramRequest, HorseSelection, Page, ProgramDetail,
  TemplateDetail, TemplateRecommendation, TemplateSummary,
} from './programTypes';

/** Bind the app's authenticated envelope transport here. This module never supplies a mock transport. */
export type ProgramTransport = <T>(path: string, init?: RequestInit) => Promise<T>;

interface ListQuery {
  q?: string;
  availability?: string;
  page?: number;
  size?: number;
}

function listQuery(query: ListQuery, filter: Record<string, string>): string {
  const params = new URLSearchParams(filter);
  if (query.q) params.set('q', query.q);
  if (query.availability) params.set('availability', query.availability);
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 20));
  return params.toString();
}

/** Explicit serialization prevents UI-only or source-template properties from entering a create request. */
export function programCreationPayload(input: CreateProgramRequest): CreateProgramRequest {
  return {
    horseId: input.horseId,
    templateVersionId: input.templateVersionId,
    name: input.name,
    goals: input.goals,
    targetMetrics: input.targetMetrics,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    notes: input.notes,
    phases: input.phases.map((phase) => ({
      templateVersionPhaseId: phase.templateVersionPhaseId,
      phaseOrder: phase.phaseOrder,
      name: phase.name,
      objective: phase.objective,
      startDate: phase.startDate,
      endDate: phase.endDate,
      intensityMin: phase.intensityMin,
      intensityMax: phase.intensityMax,
      workload: phase.workload,
    })),
    trainer: {
      trainerUserId: input.trainer.trainerUserId,
      effectiveFrom: input.trainer.effectiveFrom,
      reason: input.trainer.reason,
      warningsAcknowledged: input.trainer.warningsAcknowledged,
    },
  };
}

export function createProgramCreationApi(request: ProgramTransport) {
  return {
    listHorses: (query: ListQuery = {}, signal?: AbortSignal) =>
      request<Page<HorseSelection>>(`/api/horses?${listQuery(query, { lifecycle: 'ACTIVE' })}`, { signal }),
    listTemplates: (query: ListQuery = {}, signal?: AbortSignal) =>
      request<Page<TemplateSummary>>(`/api/program-templates?${listQuery(query, { status: 'ACTIVE' })}`, { signal }),
    templateRecommendations: (horseId: number, signal?: AbortSignal) =>
      request<TemplateRecommendation[]>(`/api/horses/${horseId}/template-recommendations`, { signal }),
    template: (templateId: number, versionNo?: number, signal?: AbortSignal) =>
      request<TemplateDetail>(`/api/program-templates/${templateId}${versionNo === undefined ? '' : `?versionNo=${versionNo}`}`, { signal }),
    trainerRecommendations: (horseId: number, templateVersionId: number, signal?: AbortSignal) =>
      request<CandidateList>(`/api/horses/${horseId}/trainer-recommendations?templateVersionId=${templateVersionId}`, { signal }),
    create: (input: CreateProgramRequest) =>
      request<ProgramDetail>('/api/training-programs', {
        method: 'POST',
        body: JSON.stringify(programCreationPayload(input)),
      }),
    read: (programId: number) => request<ProgramDetail>(`/api/training-programs/${programId}`),
  };
}

export type ProgramCreationApi = ReturnType<typeof createProgramCreationApi>;
