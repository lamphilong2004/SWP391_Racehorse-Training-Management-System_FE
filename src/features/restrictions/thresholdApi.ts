import { ApiError } from '../../shared/auth/authApi';
import { idOf, jsonBody, type FlowRequest } from '../main-flows/api';

export interface Threshold { metricType: 'HEART_RATE'; thresholdValue: number; scope: 'GLOBAL' | 'HORSE_OVERRIDE'; horseId?: number; effectiveFrom?: string; effectiveTo?: string }
export interface ThresholdInput { metricType: 'HEART_RATE'; thresholdValue: number; reason?: string; effectiveFrom: string }
export function validThreshold(value: string): boolean { return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 99999.99; }
const isThreshold = (value: Threshold) => value && value.metricType === 'HEART_RATE' && Number.isFinite(value.thresholdValue) && value.thresholdValue > 0 && ['GLOBAL', 'HORSE_OVERRIDE'].includes(value.scope);
const invalid = () => new ApiError(200, 'INVALID_RESPONSE', 'Máy chủ chưa xác nhận ngưỡng đang áp dụng. Hãy tải lại trước khi thay đổi.');
export function createThresholdApi(request: FlowRequest) {
  return {
    read: async (horseId: number, signal?: AbortSignal) => {
      const result = await request<Threshold[]>(`/api/horses/${idOf(horseId)}/medical-thresholds`, { signal });
      if (!Array.isArray(result) || !result.every(isThreshold)) throw invalid();
      return result;
    },
    set: async (horseId: number, input: ThresholdInput) => {
      if (input.metricType !== 'HEART_RATE' || !validThreshold(String(input.thresholdValue)) || !Number.isFinite(Date.parse(input.effectiveFrom)) || (input.reason?.length ?? 0) > 1000) throw new Error('Nhập ngưỡng dương tối đa 99999.99 bpm, thời điểm hiệu lực hợp lệ và lý do tối đa 1000 ký tự.');
      const result = await request<Threshold>(`/api/horses/${idOf(horseId)}/medical-thresholds`, jsonBody('PUT', { metricType: 'HEART_RATE', thresholdValue: input.thresholdValue, effectiveFrom: input.effectiveFrom, ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}) }));
      if (!isThreshold(result) || result.scope !== 'HORSE_OVERRIDE' || (result.horseId !== undefined && result.horseId !== horseId)) throw invalid();
      return result;
    },
    end: async (horseId: number, effectiveTo: string) => {
      if (!Number.isFinite(Date.parse(effectiveTo))) throw new Error('Chọn thời điểm kết thúc hợp lệ.');
      const result = await request<Threshold>(`/api/horses/${idOf(horseId)}/medical-thresholds/end`, jsonBody('POST', { effectiveTo }));
      if (!isThreshold(result) || (result.horseId !== undefined && result.horseId !== horseId)) throw invalid();
      return result;
    },
  };
}
