import { ApiError } from '../../shared/auth/authApi';

// Exact messages from the approved case-closure rules; unknown failures retain the server's wording.
// Bảng dưới chỉ dịch chính xác những thông báo đóng ca Backend đã quy định.
// Ví dụ lỗi còn task chưa xong phải hướng dẫn Groom hoàn thành, không mở nút đóng
// để vượt điều kiện. Đây là giải thích lỗi, không phải một bộ luật y tế thứ hai.
const CLINICAL_ERRORS: Record<string, string> = {
  'Medical case is closed.': 'Ca y tế đã đóng. Hãy tải lại để xem trạng thái mới nhất.',
  'A medical case requires at least one clinical examination before closure.': 'Cần ghi ít nhất một lần khám hoặc tái khám trước khi đóng ca.',
  'The latest re-examination must record RECOVERED before closure when an injury or treatment plan exists.': 'Ca có chấn thương hoặc phác đồ điều trị: lần tái khám gần nhất phải ghi nhận Đã hồi phục trước khi đóng ca.',
  'All treatment tasks must be completed before case closure.': 'Groom cần hoàn tất tất cả công việc điều trị của ca trước khi đóng.',
  'All restrictions linked to the case must be lifted before closure.': 'Veterinarian cần xem xét và gỡ các hạn chế liên quan trước khi đóng ca. Hoàn tất công việc chăm sóc không tự gỡ hạn chế.',
  'All incidents linked to the case must be resolved before closure.': 'Cần xử lý xong các sự cố liên quan trước khi đóng ca.',
};

// 403 được trình bày là vấn đề quyền truy cập. Lỗi đóng ca đã biết được tra bằng
// rawMessage để không phụ thuộc thông điệp đã xử lý ở lớp HTTP. Với lỗi chưa có
// trong bảng, code hiện giữ Error.message hoặc fallback; hàm này không hứa lọc
// toàn bộ dữ liệu nhạy cảm trong mọi thông báo do server trả về.
export function medicalErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) return `Không có quyền truy cập: ${error.message}`;
  if (error instanceof ApiError && CLINICAL_ERRORS[error.rawMessage]) return CLINICAL_ERRORS[error.rawMessage];
  return error instanceof Error ? error.message : fallback;
}
