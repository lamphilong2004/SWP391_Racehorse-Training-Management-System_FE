import type { SessionDetail, SessionResultView, UserRef } from '../evaluation/models';
import { viLabel } from '../../shared/viLabels';
export interface RiderSession extends SessionDetail {
  blocked: boolean; blockedReasons: string[]; blockedMessage?: string | null;
  trainingAvailability?: 'AVAILABLE' | 'LIMITED' | 'LOCKED';
  preCheckResult?: 'ALL_NORMAL' | 'ABNORMAL' | null;
  preSessionCheck?: { id: number; overallResult: 'ALL_NORMAL' | 'ABNORMAL'; performedAt: string } | null;
  hasRiderFeedback?: boolean;
}
export type RiderResult = Omit<SessionResultView, 'session'> & { session: RiderSession };
export interface RiderFeedbackInput { responses: {
  horseResponse?: string | null; balance?: string | null; breathing?: string | null;
  strideFeeling?: string | null; abnormalBehavior?: string | null;
  preInterruptionDescription?: string | null; notes?: string | null;
} }
export interface RiderFeedback extends RiderFeedbackInput { id: number; sessionId: number; submittedBy: UserRef; submittedAt: string }
export interface MetricInput { recordedAt: string; heartRate: number | null; speedKmh: number | null; distanceM: number | null }
export interface IssueInput { incidentType: 'OFF_FEED' | 'COLIC_SIGNS' | 'FEVER' | 'HOOF_OR_LEG_PROBLEM' | 'OTHER'; observedSeverity: 'LOW' | 'MEDIUM' | 'HIGH'; description: string; observedAt?: string }
export interface IssueResult { incidentId: number; incidentCode: string; sessionStatus: RiderSession['status'] }
export const isTerminal = (status: RiderSession['status']) => status === 'COMPLETED' || status === 'INTERRUPTED';
export function startBlocks(session: RiderSession, now = Date.now()): string[] {
  const reasons = (session.blockedReasons ?? []).map((reason) => viLabel(reason));
  if (session.status !== 'SCHEDULED') reasons.push('Chỉ buổi tập đã lên lịch mới bắt đầu được.');
  if ((session.preSessionCheck?.overallResult ?? session.preCheckResult) !== 'ALL_NORMAL') reasons.push('Kết quả kiểm tra trước buổi tập của Groom phải là Tất cả bình thường.');
  if (session.trainingAvailability === 'LOCKED') reasons.push('Veterinarian đã khóa tập luyện.');
  if (!Number.isFinite(Date.parse(session.scheduledStart)) || Date.parse(session.scheduledStart) > now) reasons.push('Không được bắt đầu sớm. Trainer cần đổi lịch nếu cần.');
  if (session.blocked && reasons.length === 0) reasons.push(session.blockedMessage || 'Hệ thống đã chặn buổi tập này.');
  return [...new Set(reasons)];
}
export function metricInput(values: { heartRate: string; speedKmh: string; distanceM: string }, recordedAt = new Date().toISOString()): MetricInput {
  const parsed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim() === '' ? null : Number(value)])) as Pick<MetricInput, 'heartRate' | 'speedKmh' | 'distanceM'>;
  if (Object.values(parsed).every((value) => value === null)) throw new Error('Nhập ít nhất một chỉ số.');
  if (Object.values(parsed).some((value) => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error('Chỉ số phải là số không âm.');
  if (parsed.heartRate !== null && !Number.isInteger(parsed.heartRate)) throw new Error('Nhịp tim phải là số nguyên.');
  return { recordedAt, ...parsed };
}
