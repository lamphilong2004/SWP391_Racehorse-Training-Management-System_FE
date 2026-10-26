/**
 * Vietnamese display labels for audit actions, history event types, audit target types and sources.
 * The code from the API stays the record of truth (shown as a secondary value / tooltip);
 * unknown codes are shown unchanged so a new Backend action is never hidden.
 */
const ACTIONS: Record<string, string> = {
  // accounts & access
  USER_CREATED: 'Tạo người dùng', USER_UPDATED: 'Cập nhật người dùng', USER_ACTIVATED: 'Kích hoạt tài khoản',
  USER_DEACTIVATED: 'Vô hiệu hóa tài khoản', USER_LOGGED_OUT: 'Đăng xuất', ROLE_ASSIGNED: 'Gán vai trò',
  PASSWORD_CHANGED: 'Đổi mật khẩu', PASSWORD_RESET: 'Đặt lại mật khẩu',
  REGISTRATION_REQUEST: 'Gửi yêu cầu đăng ký', REGISTRATION_APPROVED: 'Duyệt yêu cầu đăng ký', REGISTRATION_REJECTED: 'Từ chối yêu cầu đăng ký',
  // horses
  HORSE_CREATED: 'Thêm ngựa', HORSE_UPDATED: 'Cập nhật hồ sơ ngựa', HORSE_ACTIVATED: 'Kích hoạt ngựa',
  VETERINARIAN_BASELINE: 'Khám sức khỏe ban đầu', HEAD_TRAINER_READINESS_REVIEW: 'Head Trainer đánh giá mức sẵn sàng',
  HEAD_TRAINER_READINESS_REVIEWED: 'Head Trainer đánh giá mức sẵn sàng',
  // templates & programs
  TEMPLATE_CREATED: 'Tạo mẫu chương trình', TEMPLATE_VERSION_SAVED: 'Lưu phiên bản mẫu mới', TEMPLATE_ARCHIVED: 'Lưu trữ mẫu chương trình',
  PROGRAM_CREATED: 'Tạo chương trình huấn luyện', PROGRAM_ASSIGNED: 'Giao chương trình', PROGRAM_STATUS_CHANGED: 'Đổi trạng thái chương trình',
  PROGRAM_PHASES_ADJUSTED: 'Điều chỉnh giai đoạn', PHASES_ADJUSTED: 'Điều chỉnh giai đoạn', STATUS_CHANGED: 'Đổi trạng thái',
  TRAINER_ASSIGNED: 'Phân công Trainer',
  ADJUSTMENT_REQUESTED: 'Gửi yêu cầu điều chỉnh', ADJUSTMENT_REQUEST_SUBMITTED: 'Gửi yêu cầu điều chỉnh',
  ADJUSTMENT_APPROVED: 'Duyệt yêu cầu điều chỉnh', ADJUSTMENT_REJECTED: 'Từ chối yêu cầu điều chỉnh', ADJUSTMENT_REQUEST_DECIDED: 'Xử lý yêu cầu điều chỉnh',
  // sessions
  SESSION_CREATED: 'Tạo buổi tập', SESSION_UPDATED: 'Cập nhật buổi tập', SESSION_ASSIGNED: 'Phân công buổi tập',
  SESSION_EXERCISES_UPDATED: 'Cập nhật bài tập của buổi', SESSION_GROOM_ASSIGNED: 'Phân công Groom kiểm tra',
  GROOM_PRECHECK_ASSIGNED: 'Phân công Groom kiểm tra', SESSION_STARTED: 'Bắt đầu buổi tập', SESSION_RESUMED: 'Tiếp tục buổi tập',
  SESSION_INTENSITY_REDUCED: 'Giảm cường độ buổi tập', SESSION_INTERRUPTED_BY_ISSUE: 'Dừng buổi tập do sự cố',
  SESSION_EVALUATED: 'Đánh giá buổi tập', RIDER_WARNINGS_ACKNOWLEDGED: 'Work Rider xác nhận cảnh báo',
  // monitoring, medical, incidents
  MONITORING_ALERT_CRITICAL: 'Cảnh báo nghiêm trọng', CRITICAL_RAISED: 'Phát cảnh báo nghiêm trọng',
  CRITICAL_ACKNOWLEDGED: 'Xác nhận cảnh báo nghiêm trọng', MONITORING_ALERT_ACKNOWLEDGED: 'Xác nhận cảnh báo giám sát',
  MEDICAL_RESTRICTION_SET: 'Đặt hạn chế y tế', MEDICAL_RESTRICTION_LIFTED: 'Gỡ hạn chế y tế',
  INCIDENT_REPORTED: 'Báo cáo sự cố', OPEN_CASE: 'Mở ca y tế', LINK_CASE: 'Liên kết ca y tế',
};

const TARGETS: Record<string, string> = {
  APP_USER: 'Người dùng', REGISTRATION_REQUEST: 'Yêu cầu đăng ký', HORSE: 'Ngựa',
  TRAINING_PROGRAM: 'Chương trình huấn luyện', TRAINING_PROGRAM_TEMPLATE: 'Mẫu chương trình', TRAINING_SESSION: 'Buổi tập',
  CARE_TASK: 'Công việc chăm sóc', MEDICAL_CASE: 'Ca y tế', INCIDENT: 'Sự cố', STABLE_BOX: 'Ô chuồng',
};

const SOURCES: Record<string, string> = { WEB: 'Web', HTTP: 'Web', API: 'API', SYSTEM: 'Hệ thống' };

export function auditActionLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return ACTIONS[code] ?? code;
}

export function auditTargetLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return TARGETS[code] ?? code;
}

export function auditSourceLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return SOURCES[code] ?? code;
}

export interface CodeOption { value: string; label: string }

/** Select options for the exact-code audit filters; a code already in the URL but unknown here is kept selectable. */
function options(map: Record<string, string>, current?: string): CodeOption[] {
  const list = Object.entries(map).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  return current && !map[current] ? [{ value: current, label: current }, ...list] : list;
}
export const auditActionOptions = (current?: string) => options(ACTIONS, current);
export const auditTargetOptions = (current?: string) => options(TARGETS, current);
