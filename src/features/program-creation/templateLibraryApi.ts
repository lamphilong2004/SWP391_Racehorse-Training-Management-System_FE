import { ApiError } from '../../shared/auth/authApi';
import { idOf, jsonBody, type FlowRequest } from '../main-flows/api';
import type { Page, TemplateDetail, TemplateSummary, TemplateVersion } from './programTypes';

export interface TemplateInput {
  name: string; goals?: string | null; suitableHorseProfile?: string | null;
  recommendedDistanceUseCase?: string | null; recommendedDuration?: string | null;
  workloadIntensityGuidance?: string | null; preferredSurfaces?: string | null; recoveryGuidance?: string | null;
  requiredSkillIds: number[];
  phases: { phaseOrder: number; name: string; objective?: string | null; recommendedDuration?: string | null; intensityGuidance?: string | null }[];
}
export function templateInput(version?: TemplateVersion): TemplateInput {
  return {
    name: version?.name ?? '', goals: version?.goals, suitableHorseProfile: version?.suitableHorseProfile,
    recommendedDistanceUseCase: version?.recommendedDistanceUseCase, recommendedDuration: version?.recommendedDuration,
    workloadIntensityGuidance: version?.workloadIntensityGuidance, preferredSurfaces: version?.preferredSurfaces,
    recoveryGuidance: version?.recoveryGuidance, requiredSkillIds: version?.requiredSkills.map((skill) => idOf(skill.id)) ?? [],
    phases: version?.phases.map((phase) => ({ phaseOrder: phase.phaseOrder, name: phase.name, objective: phase.objective, recommendedDuration: phase.recommendedDuration, intensityGuidance: phase.intensityGuidance })) ?? [{ phaseOrder: 1, name: '' }],
  };
}
export function createTemplateLibraryApi(request: FlowRequest) {
  return {
    trainerSpecializations: async (signal?: AbortSignal) => {
      const result = await request<{ id: number; name: string }[]>('/api/program-templates/trainer-specializations', { signal });
      if (!Array.isArray(result) || result.some((skill) => !skill || !Number.isSafeInteger(skill.id) || skill.id < 1 || typeof skill.name !== 'string' || !skill.name.trim()) || new Set(result.map((skill) => skill.id)).size !== result.length)
        throw new ApiError(200, 'INVALID_RESPONSE', 'Trainer specializations could not be confirmed.');
      return result;
    },
    list: async (status: string, q: string, page: number, signal?: AbortSignal) => {
      const result = await request<Page<TemplateSummary>>(`/api/program-templates?${new URLSearchParams({ status, q, page: String(page), size: '20' })}`, { signal });
      if (!result || !Array.isArray(result.items) || result.page !== page || !Number.isSafeInteger(result.totalPages)) throw new ApiError(200, 'INVALID_RESPONSE', 'Template list could not be confirmed.');
      return result;
    },
    read: (id: number, versionNo?: number, signal?: AbortSignal) => request<TemplateDetail>(`/api/program-templates/${idOf(id)}${versionNo ? `?versionNo=${versionNo}` : ''}`, { signal }),
    create: (input: TemplateInput) => request<TemplateDetail>('/api/program-templates', jsonBody('POST', input)),
    version: (id: number, input: TemplateInput) => request<TemplateDetail>(`/api/program-templates/${idOf(id)}/versions`, jsonBody('POST', input)),
    duplicate: (id: number, name: string, sourceVersionNo: number) => request<TemplateDetail>(`/api/program-templates/${idOf(id)}/duplicate`, jsonBody('POST', { name, sourceVersionNo })),
    archive: (id: number) => request<TemplateSummary>(`/api/program-templates/${idOf(id)}/archive`, { method: 'POST' }),
  };
}
