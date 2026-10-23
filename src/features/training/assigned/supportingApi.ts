import { ApiError, requestApi } from '../../../shared/auth/authApi';
import { authSession } from '../../../shared/auth/authSession';
import type { SessionStatus } from '../../evaluation/models';

export interface Ref { id: number; fullName: string }
export interface HorseRef { id: number; horseCode: string; name: string }
export type ProgramStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export interface AssignedProgram {
  id: number; horse: HorseRef; name: string; status: ProgramStatus; periodStart: string; periodEnd: string;
  sourceTemplateId: number; sourceTemplateVersion: number; currentTrainer?: Ref | null;
  currentPhaseName?: string | null; trainingAvailability?: 'AVAILABLE' | 'LIMITED' | 'LOCKED';
}
export interface ProgramPage { items: AssignedProgram[]; page: number; size: number; totalItems: number; totalPages: number }
export interface CalendarSession {
  id: number; sessionCode: string; horse: HorseRef; programId: number; phaseName: string;
  scheduledStart: string; scheduledEnd?: string | null; status: SessionStatus; workRider: Ref;
  trainer?: Ref | null; blocked: boolean; blockedReasons: string[]; blockedMessage?: string | null;
  preCheckResult?: 'ALL_NORMAL' | 'ABNORMAL' | null;
}
/** CORE-005 ExerciseInput deliberately has no default intensity, surface or repetitions. */
export interface ExerciseInput { name: string; exerciseType?: string | null; description?: string | null; targetMetric?: string | null }
export interface Exercise extends ExerciseInput { id: number }
export interface SupportingApi {
  programs(query?: { page?: number; status?: string; horseId?: number }): Promise<ProgramPage>;
  sessions(range: { from: string; to: string }): Promise<CalendarSession[]>;
  exercises(query?: { q?: string; exerciseType?: string }): Promise<Exercise[]>;
  exercise(id: number): Promise<Exercise>;
  saveExercise(input: ExerciseInput, id?: number): Promise<Exercise>;
}
export function createSupportingApi(options: { fetcher?: typeof fetch; baseUrl?: string; handleApiError?: (error: unknown) => boolean } = {}): SupportingApi {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      const session = authSession.read();
      if (!session || session.expiresAt <= Date.now()) throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
      return await requestApi<T>(path, init, { ...options, token: session.accessToken });
    } catch (error) { options.handleApiError?.(error); throw error; }
  }
  return {
    programs: ({ page = 0, status, horseId } = {}) => {
      const params = new URLSearchParams({ assignedToMe: 'true', page: String(page), size: '20' });
      if (status) params.set('status', status);
      if (horseId) params.set('horseId', String(horseId));
      return request(`/api/training-programs?${params}`);
    },
    sessions: ({ from, to }) => request(`/api/training-sessions?${new URLSearchParams({ from, to })}`),
    exercises: ({ q, exerciseType } = {}) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q); if (exerciseType) params.set('exerciseType', exerciseType);
      return request(`/api/exercises${params.size ? `?${params}` : ''}`);
    },
    exercise: (id) => request(`/api/exercises/${id}`),
    saveExercise: (input, id) => request(`/api/exercises${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ name: input.name, exerciseType: input.exerciseType ?? null, description: input.description ?? null, targetMetric: input.targetMetric ?? null }),
    }),
  };
}
