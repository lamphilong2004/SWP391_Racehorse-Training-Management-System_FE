import { requestApi } from '../../shared/auth/authApi';
import type { IncidentCreateRequest } from '../../shared/incidents';
export interface Horse { id: number; name: string; horseCode: string }
export interface Person { id: number; fullName: string }
export interface CareItem { taskType: string; timeSlot: string; instructions: string }
export interface NutritionItem { meal: string; component: string; quantity: number; unit: string }
export interface Plan { id: number; horseId: number; horseName: string; from: string; to: string; notes: string | null; groomUserId: number; careItems: CareItem[]; nutritionItems: NutritionItem[] }
export interface PlanRequest { horseId: number; groomUserId: number; from: string; to: string; notes: string; items: CareItem[] | NutritionItem[] }
export interface Task { id: number; horseId: number; horseName: string; horseCode: string; source: 'CARE' | 'NUTRITION'; taskType: string; taskDate: string; slot: string; instructions: string; groomUserId: number; groomName: string; boxCode: string | null; completedAt: string | null; cancelledAt: string | null; cancellationReason: string | null }
export interface TaskChange { id: number; taskId: number; changeType: 'REASSIGN' | 'CANCEL'; previousGroomUserId: number; previousGroomName: string; newGroomUserId: number | null; newGroomName: string | null; changedBy: string; changedAt: string; reason: string }
export interface StockItem { id: number; name: string; category: string; unit: string; threshold: number | null; currentQuantity: number; active: boolean }
export interface Movement { id: number; itemName: string; changeQuantity: number; unit: string; note: string; recordedBy: string; recordedAt: string }
export interface Replenishment { id: number; inventoryItemId: number; itemName: string; quantity: number; unit: string; reason: string; requestedBy: string; submittedAt: string }
export function createStableCareApi(token: string, onError: (cause: unknown) => boolean) {
  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    try { return await requestApi<T>(path === '/api/incidents' ? path : `/api/stable-care${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { token }); }
    catch (cause) { onError(cause); throw cause; }
  }
  return {
    horses: () => call<Horse[]>('/horses'), grooms: () => call<Person[]>('/grooms'),
    plans: (horseId: number, nutrition: boolean) => call<Plan[]>(`/${nutrition ? 'nutrition' : 'care'}-plans?horseId=${horseId}`),
    savePlan: (nutrition: boolean, body: PlanRequest, id?: number) => call<Plan>(`/${nutrition ? 'nutrition' : 'care'}-plans${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', body),
    tasks: (date: string) => call<Task[]>(`/tasks?date=${encodeURIComponent(date)}`),
    complete: (id: number) => call<Task>(`/tasks/${id}/complete`, 'POST', {}),
    reassign: (id: number, expectedGroomUserId: number, groomUserId: number, reason: string) => call<Task>(`/tasks/${id}/reassign`, 'POST', { expectedGroomUserId, groomUserId, reason }),
    cancel: (id: number, expectedGroomUserId: number, reason: string) => call<Task>(`/tasks/${id}/cancel`, 'POST', { expectedGroomUserId, reason }),
    changes: (id: number) => call<TaskChange[]>(`/tasks/${id}/changes`),
    reportIncident: (body: IncidentCreateRequest) => call<{ id: number; incidentCode: string }>('/api/incidents', 'POST', body),
    inventory: () => call<StockItem[]>('/inventory'),
    saveItem: (body: Omit<StockItem, 'id' | 'currentQuantity'>, id?: number) => call<StockItem>(`/inventory${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', body),
    move: (id: number, changeQuantity: number, expectedQuantity: number, note: string) => call<StockItem>(`/inventory/${id}/movements`, 'POST', { changeQuantity, expectedQuantity, note }),
    movements: (id: number) => call<Movement[]>(`/movements?inventoryItemId=${id}`),
    requests: () => call<Replenishment[]>('/replenishments'),
    request: (inventoryItemId: number, quantity: number, reason: string) => call<Replenishment>('/replenishments', 'POST', { inventoryItemId, quantity, reason }),
  };
}
export type StableCareApi = ReturnType<typeof createStableCareApi>;
