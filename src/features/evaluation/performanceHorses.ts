import { ApiError, requestApi } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import type { ProgramPage } from '../training/assigned/supportingApi';

export interface PerformanceHorse { id: number; horseCode: string; name: string }
export type PerformanceHorseLoader = (assignedToMe: boolean, signal?: AbortSignal) => Promise<PerformanceHorse[]>;

/** Select from server-scoped programs, without depending on the unmerged Flow 1 horse-list contract. */
export const loadPerformanceHorses: PerformanceHorseLoader = async (assignedToMe, signal) => {
  const session = authSession.read();
  if (!session || session.expiresAt <= Date.now()) throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
  const horses = new Map<number, PerformanceHorse>();
  let totalPages = 1, totalItems = 0, received = 0;
  for (let page = 0; page < totalPages; page += 1) {
    const query = new URLSearchParams({ page: String(page), size: '100' });
    if (assignedToMe) query.set('assignedToMe', 'true');
    const data = await requestApi<ProgramPage>(`/api/training-programs?${query}`, { signal }, { token: session.accessToken });
    if (!data || !Array.isArray(data.items) || data.page !== page || data.size !== 100 || !Number.isSafeInteger(data.totalItems) || data.totalItems < 0 || data.totalPages !== Math.ceil(data.totalItems / data.size)
      || (page > 0 && (data.totalPages !== totalPages || data.totalItems !== totalItems))) {
      throw new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu chương trình đã thay đổi hoặc không đọc được. Hãy tải lại để thử lại.');
    }
    totalPages = data.totalPages; totalItems = data.totalItems; received += data.items.length;
    for (const { horse } of data.items) {
      if (!horse || !Number.isSafeInteger(horse.id) || horse.id < 1 || typeof horse.horseCode !== 'string' || typeof horse.name !== 'string')
        throw new ApiError(200, 'INVALID_RESPONSE', 'Không đọc được thông tin ngựa. Hãy tải lại để thử lại.');
      horses.set(horse.id, { id: horse.id, horseCode: horse.horseCode, name: horse.name });
    }
  }
  if (received !== totalItems) throw new ApiError(200, 'INVALID_RESPONSE', 'Danh sách chương trình chưa đầy đủ. Hãy tải lại để thử lại.');
  return [...horses.values()].sort((a, b) => a.name.localeCompare(b.name));
};
