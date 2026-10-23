import type { MedicalService } from './models';
import { ApiError, requestApi } from '../../shared/auth/authApi';
import { readAvailability, readCase, readCaseTask, readHerd, readPage } from './validation';
import { readActiveHerd, readHorseIdentity } from './horseRead';

export function createMedicalService(accessToken: string, onApiError?: (error: unknown) => boolean, options: { baseUrl?: string; fetcher?: typeof fetch } = {}): MedicalService {
  if (!accessToken.trim()) throw new Error('Cần đăng nhập để dùng phần y tế.');
  async function request<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
    try {
      const data = await requestApi<T>(path, {
        method, headers: { Accept: 'application/json' },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
      }, { token: accessToken, ...options });
      if (data == null) throw new ApiError(200, 'INVALID_RESPONSE', 'Máy chủ không trả về dữ liệu y tế.');
      return data;
    } catch (error) {
      onApiError?.(error);
      throw error;
    }
  }
  const positiveId = (id: number) => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Cần một mã số hợp lệ.');
    return id;
  };
  const pageQuery = (page: number) => {
    if (!Number.isSafeInteger(page) || page < 0) throw new Error('Cần số trang hợp lệ.');
    return `?page=${page}&size=20`;
  };
  const cases = '/api/medical/cases';
  return {
    listHerdHorses: () => readActiveHerd(accessToken, onApiError, options),
    getHorse: (id) => readHorseIdentity(accessToken, id, onApiError, options),
    listCases: async (page = 0) => readPage(await request(cases + pageQuery(page)), readCase, page),
    getCase: async (id) => {
      const item = readCase(await request(`${cases}/${positiveId(id)}`));
      if (item.id !== id) throw new ApiError(200, 'INVALID_RESPONSE', 'Ca y tế trả về không khớp với yêu cầu.');
      return item;
    },
    createCase: (input) => request(cases, 'POST', input),
    addExamination: (id, input) => request(`${cases}/${positiveId(id)}/examinations`, 'POST', input),
    addInjury: (id, input) => request(`${cases}/${positiveId(id)}/injuries`, 'POST', input),
    saveTreatment: (id, input) => request(`${cases}/${positiveId(id)}/treatment-plan`, 'PUT', input),
    listCaseTasks: async (id, page = 0) => readPage(await request(`${cases}/${positiveId(id)}/treatment-tasks` + pageQuery(page)), (item) => readCaseTask(item, id), page),
    addReexamination: (id, input) => request(`${cases}/${positiveId(id)}/re-examinations`, 'POST', input),
    closeCase: (id) => request(`${cases}/${positiveId(id)}/close`, 'POST'),
    getAvailability: async (horseId) => readAvailability(await request(`/api/horses/${positiveId(horseId)}/training-availability`), horseId),
    getHerdHealth: async () => readHerd(await request('/api/medical/herd-health')),
  };
}
