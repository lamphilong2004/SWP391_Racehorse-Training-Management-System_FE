/**
 * Vietnamese display labels for codes and stored English values. The value sent to or read from the
 * API never changes; only what the user reads does. Unknown values are shown as they are.
 */
const LABELS: Record<string, string> = {
  // lifecycle / account / program / generic status
  DRAFT: 'Nháp', ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', PAUSED: 'Tạm dừng', COMPLETED: 'Hoàn thành',
  // training availability
  AVAILABLE: 'Sẵn sàng', LIMITED: 'Hạn chế', LOCKED: 'Khóa',
  // health status
  FIT: 'Khỏe', MONITORING: 'Theo dõi', INJURED: 'Chấn thương', QUARANTINED: 'Cách ly',
  // session
  SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang tập', INTERRUPTED: 'Gián đoạn', BLOCKED: 'Bị chặn',
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
