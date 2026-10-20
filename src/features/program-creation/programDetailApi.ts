import { ApiError } from '../../shared/auth/authApi';
import { idOf, type FlowRequest } from '../main-flows/api';
import type { ProgramDetail, UserRef } from './programTypes';

export interface ProgramProgress {
  programId: number;
  phases: { phaseId: number; phaseOrder: number; name: string; startDate?: string; endDate?: string;
    scheduled: number; completed: number; interrupted: number; totalDistanceM?: number | null; lastEvaluationLabel?: string | null }[];
}
export interface ProgramHistoryEntry { occurredAt: string; entryType: string; summary: string; actor?: UserRef | null }
const invalid = () => new ApiError(200, 'INVALID_RESPONSE', 'Program data is unavailable: the response does not match the approved contract.');

/** Approved CORE-021 reads only. No program/template mutation or client-derived progress. */
export function createProgramDetailApi(request: FlowRequest) {
  return {
    read: async (id: number, signal?: AbortSignal) => {
      const result = await request<ProgramDetail>(`/api/training-programs/${idOf(id)}`, { signal });
      if (!result || result.id !== id || !result.horse || !Array.isArray(result.phases)) throw invalid();
      return result;
    },
    progress: async (id: number, signal?: AbortSignal) => {
      const result = await request<ProgramProgress>(`/api/training-programs/${idOf(id)}/progress`, { signal });
      if (!result || result.programId !== id || !Array.isArray(result.phases)) throw invalid();
      return result;
    },
    history: async (id: number, signal?: AbortSignal) => {
      const result = await request<ProgramHistoryEntry[]>(`/api/training-programs/${idOf(id)}/history`, { signal });
      if (!Array.isArray(result)) throw invalid();
      return result;
    },
  };
}
