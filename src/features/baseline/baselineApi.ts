import type { HealthStatus } from '../horses/api/types';
import { idOf, jsonBody, type FlowRequest } from '../main-flows/api';

export interface BaselineInput { weightKg: number; healthStatus: HealthStatus; clinicalNotes?: string; examinedAt?: string }
export interface BaselineRecord extends BaselineInput { id: number; horseId: number; recordedAt: string }
export interface WeightInput { weightKg: number; recordedAt?: string }
export interface WeightRecord extends WeightInput { id: number; horseId: number; recordedAt: string }
export function createBaselineApi(request: FlowRequest) {
  return {
    save: (horseId: number, input: BaselineInput) => request<BaselineRecord>(`/api/horses/${idOf(horseId)}/baseline-examinations`, jsonBody('POST', {
      weightKg: input.weightKg, healthStatus: input.healthStatus, ...(input.clinicalNotes ? { clinicalNotes: input.clinicalNotes } : {}), ...(input.examinedAt ? { examinedAt: input.examinedAt } : {}),
    })),
    weights: (horseId: number, signal?: AbortSignal) => request<{ items: WeightRecord[] }>(`/api/horses/${idOf(horseId)}/weights?page=0&size=20`, { signal }),
    addWeight: (horseId: number, input: WeightInput) => request<WeightRecord>(`/api/horses/${idOf(horseId)}/weights`, jsonBody('POST', { weightKg: input.weightKg, ...(input.recordedAt ? { recordedAt: input.recordedAt } : {}) })),
  };
}
export function validateWeight(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 9999.99;
}
