import { idOf, jsonBody, type FlowRequest } from '../main-flows/api';
import type { CandidateList, ProgramDetail, ProgramPhaseInput, TemplateDetail, UserRef } from './programTypes';

/** DEC-005 request types; TARGET_RACE stays deferred. */
export const ADJUSTMENT_TYPES = [
  { value: 'PHASE_WORKLOAD_INTENSITY', label: 'Khối lượng / cường độ giai đoạn' },
  { value: 'PHASE_TIMELINE', label: 'Thời gian giai đoạn' },
  { value: 'PHASE_OBJECTIVE', label: 'Mục tiêu giai đoạn' },
  { value: 'PHASE_STRUCTURE', label: 'Cấu trúc giai đoạn' },
  { value: 'TOTAL_DURATION', label: 'Tổng thời gian chương trình' },
  { value: 'PRIMARY_GOAL', label: 'Mục tiêu chính' },
  { value: 'SOURCE_TEMPLATE', label: 'Mẫu gốc' },
  { value: 'OTHER_STRUCTURAL', label: 'Thay đổi cấu trúc khác' },
] as const;
export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface AdjustmentRequest {
  id: number; programId: number; horseProgramPhaseId?: number | null; requestType: string;
  currentValue?: string | null; requestedValue: string; reason: string; evidenceNotes?: string | null; status: AdjustmentStatus;
  requestedBy: UserRef; requestedAt: string; reviewedBy?: UserRef | null; reviewedAt?: string | null; decisionReason?: string | null;
  horse?: { id: number; horseCode: string; name: string } | null;
}
export interface AdjustmentPage { items: AdjustmentRequest[]; page: number; size: number; totalItems: number; totalPages: number }
export interface AdjustmentInput {
  horseProgramPhaseId?: number; requestType: string; currentValue?: string; requestedValue: string; reason: string; evidenceNotes?: string;
}

/** Approved CORE-021/040 program management and adjustment operations; the server enforces role and row scope. */
export function createProgramManagementApi(request: FlowRequest) {
  return {
    setStatus: (id: number, status: 'ACTIVE' | 'PAUSED' | 'COMPLETED', reason?: string) =>
      request<ProgramDetail>(`/api/training-programs/${idOf(id)}/status`, jsonBody('PATCH', { status, reason: reason || undefined })),
    reassignTrainer: (id: number, body: { trainerUserId: number; effectiveFrom: string; reason?: string; warningsAcknowledged: boolean }) =>
      request<ProgramDetail>(`/api/training-programs/${idOf(id)}/trainer-assignment`, jsonBody('PUT', body)),
    templateVersion: (templateId: number, versionNo: number, signal?: AbortSignal) =>
      request<TemplateDetail>(`/api/program-templates/${idOf(templateId)}?versionNo=${versionNo}`, { signal }),
    trainerCandidates: (horseId: number, templateVersionId: number, signal?: AbortSignal) =>
      request<CandidateList>(`/api/horses/${idOf(horseId)}/trainer-recommendations?templateVersionId=${idOf(templateVersionId)}`, { signal }),
    requestAdjustment: (programId: number, body: AdjustmentInput) =>
      request<AdjustmentRequest>(`/api/training-programs/${idOf(programId)}/adjustment-requests`, jsonBody('POST', body)),
    adjustments: (query: { status?: AdjustmentStatus | ''; programId?: number; page?: number }, signal?: AbortSignal) => {
      const params = new URLSearchParams({ page: String(query.page ?? 0), size: '20' });
      if (query.status) params.set('status', query.status);
      if (query.programId) params.set('programId', String(query.programId));
      return request<AdjustmentPage>(`/api/adjustment-requests?${params}`, { signal });
    },
    approve: (id: number, decisionReason?: string) =>
      request<AdjustmentRequest>(`/api/adjustment-requests/${idOf(id)}/approve`, jsonBody('POST', { decisionReason: decisionReason || undefined })),
    /** PUT /phases: replaces the program's phases; the server requires the request to be APPROVED for this program. */
    applyPhases: (programId: number, adjustmentRequestId: number, phases: (ProgramPhaseInput & { id?: number })[]) =>
      request<ProgramDetail>(`/api/training-programs/${idOf(programId)}/phases`, jsonBody('PUT', { adjustmentRequestId: idOf(adjustmentRequestId), phases })),
    reject: (id: number, decisionReason: string) =>
      request<AdjustmentRequest>(`/api/adjustment-requests/${idOf(id)}/reject`, jsonBody('POST', { decisionReason })),
  };
}
