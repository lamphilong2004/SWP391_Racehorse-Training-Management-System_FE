import type { IconName } from '../../icons/Icon';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'simulated';

export interface BadgeSpec {
  tone: BadgeTone;
  icon: IconName;
  label: string;
}

/**
 * Business status badges, copied from the Figma component library. Keys are the API codes; labels are Vietnamese (UI language decision 2026-10-23). These are the ONLY business statuses
 * (Foundations · Status system 5:2): never add one here without an approved requirement/decision.
 *
 *  availability  → Badge / Availability   69:151 (Veterinarian is the sole writer, BR-11)
 *  session       → Badge / Session        69:170
 *  realtime      → Badge / Realtime       69:203 (data severity, not transport)
 *  simulated     → Badge / Simulated      69:221 (orthogonal to every other state)
 *  program       → Badge / Program        77:294 (exactly ACTIVE / PAUSED / COMPLETED)
 *  health        → Badge / Health Status  238:9597 (separate from Training Availability, BR-08)
 *  preventive    → Badge / Preventive Due 238:9627
 *  incident      → Badge / Incident       238:9656 (only the Veterinarian advances it)
 *  lifecycle     → Badge / Horse Lifecycle 238:9679 (INACTIVE = soft delete, BR-D07)
 *  account       → Badge / Account        238:9700
 */
export const STATUS_REGISTRY = {
  availability: {
    AVAILABLE: { tone: 'success', icon: 'check-circle', label: 'Sẵn sàng' },
    LIMITED: { tone: 'warning', icon: 'alert-triangle', label: 'Hạn chế' },
    LOCKED: { tone: 'danger', icon: 'lock', label: 'Khóa' },
  },
  session: {
    SCHEDULED: { tone: 'info', icon: 'calendar', label: 'Đã lên lịch' },
    BLOCKED: { tone: 'danger', icon: 'lock', label: 'Bị chặn' },
    IN_PROGRESS: { tone: 'info', icon: 'play', label: 'Đang tập' },
    PAUSED: { tone: 'warning', icon: 'pause', label: 'Tạm dừng' },
    COMPLETED: { tone: 'success', icon: 'check-circle', label: 'Hoàn thành' },
    INTERRUPTED: { tone: 'danger', icon: 'octagon-x', label: 'Gián đoạn' },
  },
  realtime: {
    NORMAL: { tone: 'success', icon: 'activity', label: 'Bình thường' },
    WARNING: { tone: 'warning', icon: 'alert-triangle', label: 'Cảnh báo' },
    CRITICAL: { tone: 'danger', icon: 'alert-octagon', label: 'Nghiêm trọng' },
  },
  simulated: {
    SIMULATED: { tone: 'simulated', icon: 'flask-conical', label: 'Mô phỏng' },
  },
  program: {
    ACTIVE: { tone: 'info', icon: 'activity', label: 'Đang chạy' },
    PAUSED: { tone: 'warning', icon: 'pause', label: 'Tạm dừng' },
    COMPLETED: { tone: 'success', icon: 'check-circle', label: 'Đã kết thúc' },
  },
  health: {
    FIT: { tone: 'success', icon: 'check-circle', label: 'Khỏe' },
    MONITORING: { tone: 'warning', icon: 'alert-triangle', label: 'Theo dõi' },
    INJURED: { tone: 'danger', icon: 'alert-octagon', label: 'Chấn thương' },
    QUARANTINED: { tone: 'danger', icon: 'alert-octagon', label: 'Cách ly' },
  },
  preventive: {
    UPCOMING: { tone: 'neutral', icon: 'circle', label: 'Sắp tới' },
    DUE: { tone: 'warning', icon: 'alert-triangle', label: 'Đến hạn' },
    OVERDUE: { tone: 'danger', icon: 'alert-octagon', label: 'Quá hạn' },
    COMPLETED: { tone: 'success', icon: 'check-circle', label: 'Đã xong' },
  },
  incident: {
    REPORTED: { tone: 'warning', icon: 'alert-triangle', label: 'Mới báo' },
    UNDER_REVIEW: { tone: 'info', icon: 'info', label: 'Đang xem xét' },
    RESOLVED: { tone: 'success', icon: 'check-circle', label: 'Đã xử lý' },
  },
  lifecycle: {
    DRAFT: { tone: 'neutral', icon: 'circle', label: 'Nháp' },
    ACTIVE: { tone: 'success', icon: 'check-circle', label: 'Hoạt động' },
    INACTIVE: { tone: 'neutral', icon: 'circle', label: 'Ngừng hoạt động' },
  },
  account: {
    ACTIVE: { tone: 'success', icon: 'check-circle', label: 'Hoạt động' },
    INACTIVE: { tone: 'neutral', icon: 'circle', label: 'Ngừng hoạt động' },
  },
  /** Medical case lifecycle (Flow 3): OPEN until the Veterinarian closes it. */
  medicalCase: {
    OPEN: { tone: 'warning', icon: 'stethoscope', label: 'Đang mở' },
    CLOSED: { tone: 'neutral', icon: 'check-circle', label: 'Đã đóng' },
  },
  /** Program Adjustment Request, DEC-005: PENDING → APPROVED / REJECTED (Head Trainer decides). */
  adjustment: {
    PENDING: { tone: 'warning', icon: 'clock', label: 'Chờ duyệt' },
    APPROVED: { tone: 'success', icon: 'check-circle', label: 'Đã duyệt' },
    REJECTED: { tone: 'danger', icon: 'octagon-x', label: 'Từ chối' },
  },
} as const satisfies Record<string, Record<string, BadgeSpec>>;

export type StatusFamily = keyof typeof STATUS_REGISTRY;
export type StatusOf<F extends StatusFamily> = keyof (typeof STATUS_REGISTRY)[F];
