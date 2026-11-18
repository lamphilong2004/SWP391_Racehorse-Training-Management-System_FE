// CORE-036 — lớp nối giao diện Vet với API thật.
// Service là tập hàm có tên dễ đọc; màn gọi addExamination thay vì tự ghép URL ở từng nút.
// GET đọc dữ liệu; POST tạo bản ghi/thực hiện hành động; PUT cập nhật phác đồ theo contract.
// payload là dữ liệu từ form. JSON.stringify đổi nó thành chuỗi JSON để gửi qua HTTP.
// requestApi dùng cơ chế xác thực chung. File này không truy vấn SQL trực tiếp.
// readCase/readPage/readAvailability kiểm tra và chuyển dữ liệu phản hồi thành kiểu FE chờ đợi.
// HTTP thành công nhưng thiếu/sai dữ liệu vẫn có thể bị từ chối; không biến lỗi thành danh sách rỗng.
// Không có nhánh tự thay API bằng sample khi gọi thất bại.
// Ví dụ: nút Lưu phác đồ → saveTreatment → PUT /treatment-plan → BE kiểm tra và lưu SQL.
// Promise thành công mới cho phép màn hiển thị kết quả thành công; catch giữ nguyên đường báo lỗi.

import type { MedicalService } from './models';
import { ApiError, requestApi } from '../../shared/auth/authApi';
import { readAvailability, readCase, readCaseTask, readHerd, readPage } from './validation';
import { readActiveHerd, readHorseIdentity } from './horseRead';

export function createMedicalService(accessToken: string, onApiError?: (error: unknown) => boolean, options: { baseUrl?: string; fetcher?: typeof fetch } = {}): MedicalService {
  if (!accessToken.trim()) throw new Error('Cần đăng nhập để dùng phần y tế.');
  // T là kiểu dữ liệu hàm gọi mong nhận về; nó giúp TypeScript phát hiện dùng sai trường.
  // try/catch chuyển lỗi qua xử lý Auth rồi ném lại; không nuốt lỗi để màn hiểu nhầm đã lưu.
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
  // Mã định danh như caseId/horseId phải là số nguyên dương an toàn.
  // Kiểm tra sớm ở FE giúp URL sai không tạo request vô nghĩa; BE vẫn kiểm tra lần nữa.
  const positiveId = (id: number) => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Cần một mã số hợp lệ.');
    return id;
  };
  const pageQuery = (page: number) => {
    if (!Number.isSafeInteger(page) || page < 0) throw new Error('Cần số trang hợp lệ.');
    return `?page=${page}&size=20`;
  };
  // Đọc bảng ánh xạ bên dưới như danh sách việc của Vet:
  // list/get đọc ca; create mở ca; examinations ghi lần khám; injuries ghi chấn thương;
  // treatment-plan lưu hướng dẫn; re-examinations ghi hồi phục; close xin đóng ca.
  // Đóng ca là yêu cầu gửi BE kiểm tra điều kiện, không phải FE tự đổi status sang CLOSED.
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
