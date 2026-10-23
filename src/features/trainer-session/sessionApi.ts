import type { SessionDetail as ExistingSession, SessionResultView } from '../evaluation/models';
import type { CandidateList, Intensity, Page, ProgramDetail, TrainingAvailability } from '../program-creation/programTypes';
import type { AssignedProgram, Exercise } from '../training/assigned/supportingApi';
import { ApiError } from '../../shared/auth/authApi';
import { idOf, jsonBody, type FlowRequest } from '../main-flows/api';

const invalid = () => new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu huấn luyện không hợp lệ. Hãy tải lại để thử lại.');
/** Envelope shape checks so a malformed response surfaces as an error state instead of crashing the page. */
function list<T>(value: T[]): T[] { if (!Array.isArray(value)) throw invalid(); return value; }
function page<T>(value: Page<T>): Page<T> { if (!value || !Array.isArray(value.items)) throw invalid(); return value; }

export interface SessionExerciseInput {
  exerciseDefinitionId: number; exerciseOrder: number; distanceM?: number | null; durationMin?: number | null;
  repetitions?: number | null; restIntervalMin?: number | null; intensity?: Intensity | null; surface?: string | null; acknowledgementNote?: string | null;
}
export interface SessionDraft {
  horseProgramPhaseId: number; scheduledStart: string; scheduledEnd?: string | null; intensity?: Intensity | null;
  workRiderUserId?: number | null; exercises: SessionExerciseInput[];
}
export interface CreateSessionInput extends SessionDraft { workRiderUserId: number; riderWarningAcknowledged: boolean; surface?: string | null; focus?: string | null }
export interface TrainingSession extends ExistingSession {
  groom?: { id: number; userCode?: string; fullName: string } | null;
  horseProgramPhaseId: number; trainingAvailability: TrainingAvailability; blocked: boolean; blockedReasons: string[];
  blockedMessage?: string | null; hasRiderFeedback?: boolean;
  preSessionCheck?: { overallResult: 'ALL_NORMAL' | 'ABNORMAL' } | null;
}
export interface Suitability {
  trainingAvailability: TrainingAvailability; sessionBlocked: boolean; blockedMessage?: string;
  exercises: { exerciseOrder: number; exerciseDefinitionId: number; category: 'A' | 'B' | 'C' | 'D' | null; messages: string[] }[];
  sessionIssues: { category: 'A' | 'B' | 'C' | 'D'; field?: string; message: string }[];
}
export function draftPayload(input: SessionDraft): SessionDraft {
  return { horseProgramPhaseId: idOf(input.horseProgramPhaseId), scheduledStart: input.scheduledStart, scheduledEnd: input.scheduledEnd,
    intensity: input.intensity, workRiderUserId: input.workRiderUserId,
    exercises: exercisePayload(input.exercises) };
}
export function exercisePayload(exercises: SessionExerciseInput[]): SessionExerciseInput[] {
  return exercises.map((item, index) => ({ exerciseDefinitionId: idOf(item.exerciseDefinitionId), exerciseOrder: index + 1,
    distanceM: item.distanceM, durationMin: item.durationMin, repetitions: item.repetitions, restIntervalMin: item.restIntervalMin,
    intensity: item.intensity, surface: item.surface, acknowledgementNote: item.acknowledgementNote }));
}
export function createSessionPayload(input: CreateSessionInput): CreateSessionInput {
  return { ...draftPayload(input), workRiderUserId: idOf(input.workRiderUserId), riderWarningAcknowledged: input.riderWarningAcknowledged,
    surface: input.surface, focus: input.focus };
}
export function createSessionApi(request: FlowRequest) {
  return {
    programs: async (signal?: AbortSignal) => page(await request<Page<AssignedProgram>>('/api/training-programs?assignedToMe=true&page=0&size=100', { signal })),
    program: (id: number, signal?: AbortSignal) => request<ProgramDetail>(`/api/training-programs/${idOf(id)}`, { signal }),
    availability: (id: number, signal?: AbortSignal) => request<{ availability: TrainingAvailability; reason?: string }>(`/api/horses/${idOf(id)}/training-availability`, { signal }),
    exercises: async (signal?: AbortSignal) => list(await request<Exercise[]>('/api/exercises', { signal })),
    sessions: async (from: string, to: string, signal?: AbortSignal) => list(await request<TrainingSession[]>(`/api/training-sessions?${new URLSearchParams({ from, to })}`, { signal })),
    read: (id: number, signal?: AbortSignal) => request<TrainingSession>(`/api/training-sessions/${idOf(id)}`, { signal }),
    groomCandidates: async (id: number, signal?: AbortSignal) => list(await request<{ id: number; fullName: string }[]>(`/api/training-sessions/${idOf(id)}/groom-candidates`, { signal })),
    assignGroom: (id: number, groomUserId: number) => request<TrainingSession>(`/api/training-sessions/${idOf(id)}/groom-assignment`, jsonBody('POST', { groomUserId: idOf(groomUserId) })),
    reduceIntensity: (id: number, intensity: Intensity) => request<TrainingSession>(`/api/training-sessions/${idOf(id)}/reduce-intensity`, jsonBody('POST', { intensity })),
    result: (id: number, signal?: AbortSignal) => request<SessionResultView>(`/api/training-sessions/${idOf(id)}/result`, { signal }),
    suitability: (draft: SessionDraft) => request<Suitability>('/api/training-sessions/suitability-check', jsonBody('POST', draftPayload(draft))),
    riders: (draft: SessionDraft) => request<CandidateList>('/api/training-sessions/work-rider-recommendations', jsonBody('POST', draftPayload(draft))),
    create: (draft: CreateSessionInput) => request<TrainingSession>('/api/training-sessions', jsonBody('POST', createSessionPayload(draft))),
    /** SCHEDULED only; omitted fields keep their stored value (server rule). */
    update: (id: number, body: { scheduledStart?: string; scheduledEnd?: string; surface?: string; focus?: string; intensity?: Intensity; workRiderUserId?: number; riderWarningAcknowledged?: boolean }) =>
      request<TrainingSession>(`/api/training-sessions/${idOf(id)}`, jsonBody('PATCH', body)),
    replaceExercises: (id: number, exercises: SessionExerciseInput[]) =>
      request<TrainingSession>(`/api/training-sessions/${idOf(id)}/exercises`, jsonBody('PUT', { exercises: exercisePayload(exercises) })),
  };
}
export function blocksSession(result: Suitability, exercises: SessionExerciseInput[]): string[] {
  return [
    ...(result.sessionBlocked ? [result.blockedMessage || 'Veterinarian đã chặn tập luyện.'] : []),
    ...result.sessionIssues.filter((issue) => issue.category === 'A' || issue.category === 'B').map((issue) => issue.message),
    ...result.exercises.flatMap((item) => item.category === 'A' || item.category === 'B' ? item.messages.length ? item.messages : ['Hãy xóa hoặc thay bài tập bị chặn.'] :
      (item.category === 'C' || item.category === 'D') && !exercises[item.exerciseOrder - 1]?.acknowledgementNote?.trim() ? ['Hãy xác nhận từng cảnh báo và nêu lý do cho các bài tập giữ lại.'] : []),
  ];
}
