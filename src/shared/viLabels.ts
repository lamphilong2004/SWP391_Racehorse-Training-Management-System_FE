/**
 * Vietnamese display labels for codes and stored English values. The value sent to or read from the
 * API never changes; only what the user reads does. Unknown values are shown as they are.
 */
const LABELS: Record<string, string> = {
  // lifecycle / account / program / generic status
  JUNIOR: 'Mới vào nghề', INTERMEDIATE: 'Trung bình', SENIOR: 'Nhiều kinh nghiệm', EXPERT: 'Chuyên gia',
  RECOMMENDED: 'Được gợi ý', SUITABLE: 'Phù hợp', SUITABLE_WITH_CAUTION: 'Phù hợp — cần lưu ý', NOT_RECOMMENDED: 'Không khuyến nghị',
  DRAFT: 'Nháp', ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', PAUSED: 'Tạm dừng', COMPLETED: 'Hoàn thành',
  // incident types (same wording as the report forms)
  OFF_FEED: 'Bỏ ăn', COLIC_SIGNS: 'Dấu hiệu đau bụng', FEVER: 'Sốt', HOOF_OR_LEG_PROBLEM: 'Vấn đề móng hoặc chân',
  // training availability
  AVAILABLE: 'Sẵn sàng', LIMITED: 'Hạn chế', LOCKED: 'Khóa',
  // health status
  FIT: 'Khỏe', MONITORING: 'Theo dõi', INJURED: 'Chấn thương', QUARANTINED: 'Cách ly',
  // session
  SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang tập', INTERRUPTED: 'Gián đoạn', BLOCKED: 'Bị chặn',
  PRE_CHECK_MISSING: 'Groom chưa lưu kiểm tra trước buổi tập cho đúng buổi này.',
  PRE_CHECK_ABNORMAL: 'Kiểm tra trước buổi tập có bất thường; chưa được bắt đầu.',
  AVAILABILITY_LOCKED: 'Veterinarian đã khóa khả năng tập luyện của ngựa.',
  PROGRAM_NOT_ACTIVE: 'Chương trình huấn luyện chưa ở trạng thái hoạt động.',
  EXERCISE_MEDICAL_BLOCK: 'Bài tập đang bị hạn chế y tế chặn.',
  // intensity
  LOW: 'Thấp', MEDIUM: 'Trung bình', MEDIUM_HIGH: 'Trung bình cao', HIGH: 'Cao',
  // severity / realtime
  NORMAL: 'Bình thường', WARNING: 'Cảnh báo', CRITICAL: 'Nghiêm trọng', MILD: 'Nhẹ', MODERATE: 'Vừa', SEVERE: 'Nặng',
  // recovery / incident / adjustment / registration
  NOT_RECOVERED: 'Chưa hồi phục', IMPROVING: 'Đang cải thiện', RECOVERED: 'Đã hồi phục',
  REPORTED: 'Mới báo', UNDER_REVIEW: 'Đang xem xét', RESOLVED: 'Đã xử lý',
  PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', PENDING_APPROVAL: 'Chờ duyệt',
  ALLOWED: 'Được phép', PROHIBITED: 'Bị cấm', ALL_NORMAL: 'Tất cả bình thường', ABNORMAL: 'Bất thường',
  // stored English option values (horse sex, rider feedback)
  Colt: 'Ngựa đực non', Filly: 'Ngựa cái non', Stallion: 'Ngựa đực giống', Mare: 'Ngựa cái', Gelding: 'Ngựa thiến',
  MALE: 'Đực', FEMALE: 'Cái', Male: 'Đực', Female: 'Cái',
  Strong: 'Tốt', Normal: 'Bình thường', Sluggish: 'Uể oải', Good: 'Tốt', 'Some issues': 'Có vài vấn đề', Difficult: 'Khó khăn',
};

export function viLabel(value: string | null | undefined, fallback = ''): string {
  if (value == null || value === '') return fallback;
  return LABELS[value] ?? LABELS[value.toUpperCase()] ?? value;
}
