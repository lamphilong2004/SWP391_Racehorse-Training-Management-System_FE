import type { IconName } from '../../icons/Icon';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'simulated';

export interface BadgeSpec {
  tone: BadgeTone;
  icon: IconName;
  label: string;
}

/**
 * Business status badges, copied from the Figma component library. These are the ONLY business statuses
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
    AVAILABLE: { tone: 'success', icon: 'check-circle', label: 'AVAILABLE' },
    LIMITED: { tone: 'warning', icon: 'alert-triangle', label: 'LIMITED' },
    LOCKED: { tone: 'danger', icon: 'lock', label: 'LOCKED' },
  },
  session: {
    SCHEDULED: { tone: 'info', icon: 'calendar', label: 'SCHEDULED' },
    BLOCKED: { tone: 'danger', icon: 'lock', label: 'BLOCKED' },
    IN_PROGRESS: { tone: 'info', icon: 'play', label: 'IN PROGRESS' },
    PAUSED: { tone: 'warning', icon: 'pause', label: 'PAUSED' },
    COMPLETED: { tone: 'success', icon: 'check-circle', label: 'COMPLETED' },
    INTERRUPTED: { tone: 'danger', icon: 'octagon-x', label: 'INTERRUPTED' },
  },
  realtime: {
    NORMAL: { tone: 'success', icon: 'activity', label: 'NORMAL' },
    WARNING: { tone: 'warning', icon: 'alert-triangle', label: 'WARNING' },
    CRITICAL: { tone: 'danger', icon: 'alert-octagon', label: 'CRITICAL' },
  },
  simulated: {
    SIMULATED: { tone: 'simulated', icon: 'flask-conical', label: 'SIMULATED' },
  },
  program: {
    ACTIVE: { tone: 'info', icon: 'activity', label: 'ACTIVE' },
    PAUSED: { tone: 'warning', icon: 'pause', label: 'PAUSED' },
    COMPLETED: { tone: 'success', icon: 'check-circle', label: 'COMPLETED' },
  },
  health: {
    FIT: { tone: 'success', icon: 'check-circle', label: 'FIT' },
    MONITORING: { tone: 'warning', icon: 'alert-triangle', label: 'MONITORING' },
    INJURED: { tone: 'danger', icon: 'alert-octagon', label: 'INJURED' },
    QUARANTINED: { tone: 'danger', icon: 'alert-octagon', label: 'QUARANTINED' },
  },
  preventive: {
    UPCOMING: { tone: 'neutral', icon: 'circle', label: 'UPCOMING' },
    DUE: { tone: 'warning', icon: 'alert-triangle', label: 'DUE' },
    OVERDUE: { tone: 'danger', icon: 'alert-octagon', label: 'OVERDUE' },
    COMPLETED: { tone: 'success', icon: 'check-circle', label: 'COMPLETED' },
  },
  incident: {
    REPORTED: { tone: 'warning', icon: 'alert-triangle', label: 'REPORTED' },
    UNDER_REVIEW: { tone: 'info', icon: 'info', label: 'UNDER REVIEW' },
    RESOLVED: { tone: 'success', icon: 'check-circle', label: 'RESOLVED' },
  },
  lifecycle: {
    DRAFT: { tone: 'neutral', icon: 'circle', label: 'DRAFT' },
    ACTIVE: { tone: 'success', icon: 'check-circle', label: 'ACTIVE' },
    INACTIVE: { tone: 'neutral', icon: 'circle', label: 'INACTIVE' },
  },
  account: {
    ACTIVE: { tone: 'success', icon: 'check-circle', label: 'ACTIVE' },
    INACTIVE: { tone: 'neutral', icon: 'circle', label: 'INACTIVE' },
  },
  /** Program Adjustment Request, DEC-005: PENDING → APPROVED / REJECTED (Head Trainer decides). */
  adjustment: {
    PENDING: { tone: 'warning', icon: 'clock', label: 'PENDING' },
    APPROVED: { tone: 'success', icon: 'check-circle', label: 'APPROVED' },
    REJECTED: { tone: 'danger', icon: 'octagon-x', label: 'REJECTED' },
  },
} as const satisfies Record<string, Record<string, BadgeSpec>>;

export type StatusFamily = keyof typeof STATUS_REGISTRY;
export type StatusOf<F extends StatusFamily> = keyof (typeof STATUS_REGISTRY)[F];
