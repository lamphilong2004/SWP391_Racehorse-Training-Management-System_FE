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
export const STABLE_CARE_READ_TIMEOUT_MS = 15_000;

/** Bound read-only loading, including JSON decoding. Never time out/replay a database write here. */
// Giới hạn 15 giây chỉ áp dụng GET, bao gồm chờ giải mã response. Khi quá hạn
// thì hủy đọc và cho người dùng thử lại. Không dùng timer này cho POST/PUT vì
// request ghi có thể đã tới DB: tự gửi lại sẽ gây ghi trùng mà UI không biết.
async function readStableCare<T>(path: string, token: string): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Máy chủ phản hồi chậm. Dữ liệu chưa tải được; hãy bấm Thử lại.'));
      controller.abort();
    }, STABLE_CARE_READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([requestApi<T>(path, { method: 'GET', signal: controller.signal }, { token }), timeout]);
  } finally { clearTimeout(timer); }
}
// Adapter gom endpoint đã có, không định nghĩa quyền mới. Các đường /tasks,
// /inventory... được gắn prefix stable-care; báo sự cố dùng /api/incidents riêng.
// 401/403 vẫn đi qua xử lý lỗi auth, không chuyển sang transport mẫu.
export function createStableCareApi(token: string, onError: (cause: unknown) => boolean) {
  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const endpoint = path === '/api/incidents' ? path : `/api/stable-care${path}`;
    try {
      if (method === 'GET') return await readStableCare<T>(endpoint, token);
      return await requestApi<T>(endpoint, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { token });
    }
    catch (cause) { onError(cause); throw cause; }
  }
  return {
    horses: () => call<Horse[]>('/horses'), grooms: () => call<Person[]>('/grooms'),
    plans: (horseId: number, nutrition: boolean) => call<Plan[]>(`/${nutrition ? 'nutrition' : 'care'}-plans?horseId=${horseId}`),
    savePlan: (nutrition: boolean, body: PlanRequest, id?: number) => call<Plan>(`/${nutrition ? 'nutrition' : 'care'}-plans${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', body),
    tasks: (date: string) => call<Task[]>(`/tasks?date=${encodeURIComponent(date)}`),
    complete: (id: number) => call<Task>(`/tasks/${id}/complete`, 'POST', {}),
    // expectedGroomUserId giúp Backend biết UI đang sửa dựa trên phân công nào.
    // Nếu người khác đã đổi Groom, server có thể từ chối thay vì ghi đè âm thầm.
    reassign: (id: number, expectedGroomUserId: number, groomUserId: number, reason: string) => call<Task>(`/tasks/${id}/reassign`, 'POST', { expectedGroomUserId, groomUserId, reason }),
    cancel: (id: number, expectedGroomUserId: number, reason: string) => call<Task>(`/tasks/${id}/cancel`, 'POST', { expectedGroomUserId, reason }),
    changes: (id: number) => call<TaskChange[]>(`/tasks/${id}/changes`),
    reportIncident: (body: IncidentCreateRequest) => call<{ id: number; incidentCode: string }>('/api/incidents', 'POST', body),
    inventory: () => call<StockItem[]>('/inventory'),
    saveItem: (body: Omit<StockItem, 'id' | 'currentQuantity'>, id?: number) => call<StockItem>(`/inventory${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', body),
    // Ghi kho gửi cả biến động và expectedQuantity để kiểm tra xung đột.
    // Nhập dùng số dương, xuất số âm; gửi yêu cầu bổ sung là endpoint khác và không
    // đồng nghĩa hàng đã về kho. Hoàn thành task cũng là lời gọi khác, không kèm
    // phiếu xuất ngầm. Chỉ server xác nhận mới được báo thao tác đã thành công.
    move: (id: number, changeQuantity: number, expectedQuantity: number, note: string) => call<StockItem>(`/inventory/${id}/movements`, 'POST', { changeQuantity, expectedQuantity, note }),
    movements: (id: number) => call<Movement[]>(`/movements?inventoryItemId=${id}`),
    requests: () => call<Replenishment[]>('/replenishments'),
    request: (inventoryItemId: number, quantity: number, reason: string) => call<Replenishment>('/replenishments', 'POST', { inventoryItemId, quantity, reason }),
  };
}
export type StableCareApi = ReturnType<typeof createStableCareApi>;
