import { ROUTES } from '../app/routePaths';
import type { IconName } from '../design-system/icons/Icon';
import type { RoleCode } from '../shared/auth/roles';

/** Why a Figma module is not shown in the current delivery scope (traceable to the decision records). */
export const DEFERRED_REASON = 'Tạm hoãn khỏi phạm vi hiện tại (DEC-007, DEC-008 §3.5)';

export interface NavItem {
  label: string;
  icon: IconName;
  to: string;
  /**
   * Set when the module exists in Figma but is out of the current scope. The item stays in this config so the Figma
   * mapping remains traceable, but it is never rendered (see `visibleSections`).
   */
  deferred?: string;
}

export interface NavSection {
  /** Overline heading (TRAINING, MEDICAL, …). Omitted for the top group. */
  heading?: string;
  items: NavItem[];
}

export interface RoleNavigation {
  workspaceLabel: string;
  sections: NavSection[];
}

/**
 * Role-filtered sidebar, copied from Figma Sidebar (74:110) for all 7 roles: modules a role cannot access are
 * ABSENT, never disabled. Labels, order, section headings and icons follow the Figma frames exactly.
 * Items marked `deferred` are kept for traceability and filtered out by `visibleSections`.
 */
export const NAVIGATION: Record<RoleCode, RoleNavigation> = {
  HEAD_TRAINER: {
    workspaceLabel: 'Không gian Head Trainer',
    sections: [
      {
        items: [
          { label: 'Tổng quan', icon: 'dashboard', to: ROUTES.dashboard },
          { label: 'Ngựa', icon: 'horseshoe', to: ROUTES.horses },
        ],
      },
      {
        heading: 'Huấn luyện',
        items: [
          { label: 'Chương trình huấn luyện ngựa', icon: 'clipboard-list', to: ROUTES.trainingPrograms },
          { label: 'Mẫu chương trình', icon: 'file-text', to: ROUTES.programTemplates },
          { label: 'Yêu cầu điều chỉnh', icon: 'history', to: ROUTES.adjustmentRequests },
          { label: 'Lịch tập', icon: 'calendar', to: ROUTES.trainingSchedule },
          { label: 'Thành tích', icon: 'trending-up', to: ROUTES.performance },
          { label: 'Giám sát trực tiếp', icon: 'activity', to: ROUTES.realtimeMonitoring },
          { label: 'Cuộc đua', icon: 'target', to: ROUTES.races, deferred: DEFERRED_REASON },
        ],
      },
      {
        heading: 'Y tế',
        items: [
          { label: 'Tóm tắt y tế', icon: 'stethoscope', to: ROUTES.medicalSummary },
          { label: 'Hạn chế tập luyện', icon: 'shield-alert', to: ROUTES.restrictions },
          { label: 'Sự cố', icon: 'alert-triangle', to: ROUTES.incidents },
        ],
      },
    ],
  },
  TRAINER: {
    workspaceLabel: 'Không gian Trainer',
    sections: [
      {
        items: [
          { label: 'Tổng quan', icon: 'dashboard', to: ROUTES.dashboard },
          { label: 'Chương trình được giao', icon: 'folder', to: ROUTES.assignedPrograms },
          { label: 'Yêu cầu điều chỉnh', icon: 'history', to: ROUTES.adjustmentRequests },
          { label: 'Lịch tập', icon: 'calendar', to: ROUTES.trainingCalendar },
          { label: 'Thư viện bài tập', icon: 'book-open', to: ROUTES.exerciseLibrary },
          { label: 'Giám sát trực tiếp', icon: 'activity', to: ROUTES.realtimeMonitoring },
          { label: 'Thành tích', icon: 'trending-up', to: ROUTES.performance },
          { label: 'Hạn chế tập luyện', icon: 'shield-alert', to: ROUTES.restrictions },
          { label: 'Sự cố', icon: 'alert-triangle', to: ROUTES.incidents },
          { label: 'Ngựa', icon: 'horseshoe', to: ROUTES.horses },
        ],
      },
    ],
  },
  WORK_RIDER: {
    workspaceLabel: 'Không gian Work Rider',
    sections: [
      {
        items: [
          { label: 'Lượt cưỡi của tôi', icon: 'dashboard', to: ROUTES.myRides },
          { label: 'Lịch phân công', icon: 'clipboard-list', to: ROUTES.assignments },
          { label: 'Lịch sử cưỡi', icon: 'history', to: ROUTES.ridingHistory },
          { label: 'Báo cáo vấn đề', icon: 'alert-triangle', to: ROUTES.reportIssue },
        ],
      },
    ],
  },
  VETERINARIAN: {
    workspaceLabel: 'Không gian Veterinarian',
    sections: [
      {
        items: [
          { label: 'Tổng quan', icon: 'dashboard', to: ROUTES.dashboard },
          { label: 'Ngựa', icon: 'horseshoe', to: ROUTES.horses },
        ],
      },
      {
        heading: 'Y tế',
        items: [
          { label: 'Y tế / sức khỏe', icon: 'stethoscope', to: ROUTES.medical },
          { label: 'Sức khỏe đàn ngựa', icon: 'activity', to: ROUTES.herdHealth },
          {
            label: 'Chăm sóc phòng ngừa',
            icon: 'calendar',
            to: ROUTES.preventiveHealthcare,
            deferred: DEFERRED_REASON,
          },
          { label: 'Sự cố', icon: 'alert-triangle', to: ROUTES.incidents },
        ],
      },
    ],
  },
  CLUB_MANAGER: {
    workspaceLabel: 'Không gian Club Manager',
    sections: [
      {
        items: [
          { label: 'Tổng quan', icon: 'dashboard', to: ROUTES.dashboard },
          { label: 'Ngựa', icon: 'horseshoe', to: ROUTES.horses },
          { label: 'Chờ kích hoạt', icon: 'clipboard-list', to: ROUTES.pendingActivation },
          { label: 'Chuồng', icon: 'warehouse', to: ROUTES.stable, deferred: DEFERRED_REASON },
        ],
      },
      {
        heading: 'Quản trị',
        items: [
          { label: 'Nhân sự & người dùng', icon: 'users', to: ROUTES.staffUsers },
          { label: 'Yêu cầu đăng ký', icon: 'user', to: ROUTES.registrations },
          { label: 'Vai trò & quyền hạn', icon: 'shield-check', to: ROUTES.rolesPermissions },
        ],
      },
      {
        heading: 'Vận hành',
        items: [
          { label: 'Cuộc đua', icon: 'target', to: ROUTES.races, deferred: DEFERRED_REASON },
          { label: 'Kho', icon: 'package', to: ROUTES.inventory, deferred: DEFERRED_REASON },
          { label: 'Báo cáo', icon: 'bar-chart', to: ROUTES.reports, deferred: DEFERRED_REASON },
          { label: 'Nhật ký hệ thống', icon: 'history', to: ROUTES.auditLog },
        ],
      },
    ],
  },
  GROOM: {
    workspaceLabel: 'Không gian Groom',
    sections: [
      {
        items: [{ label: 'Hôm nay', icon: 'dashboard', to: ROUTES.groomToday }],
      },
      {
        heading: 'Công việc của tôi',
        items: [
          { label: 'Công việc chăm sóc', icon: 'clipboard-list', to: ROUTES.careTasks },
          { label: 'Chăm sóc hằng ngày', icon: 'check-circle', to: ROUTES.dailyCare, deferred: DEFERRED_REASON },
          {
            label: 'Chăm sóc phòng ngừa',
            icon: 'calendar',
            to: ROUTES.preventiveHealthcare,
            deferred: DEFERRED_REASON,
          },
          { label: 'Sự cố', icon: 'alert-triangle', to: ROUTES.incidents },
        ],
      },
    ],
  },
  HORSE_OWNER: {
    workspaceLabel: 'Cổng thông tin Horse Owner',
    sections: [
      {
        items: [
          { label: 'Ngựa của tôi', icon: 'horseshoe', to: ROUTES.myHorses },
          { label: 'Thông báo', icon: 'bell', to: ROUTES.notifications },
        ],
      },
    ],
  },
};

/**
 * The sidebar as rendered for a role: deferred items removed, and a section dropped when none of its items remain,
 * so no orphan heading is shown.
 */
export function visibleSections(role: RoleCode): NavSection[] {
  return withoutDeferred(NAVIGATION[role].sections);
}

export function withoutDeferred(sections: NavSection[]): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.deferred) }))
    .filter((section) => section.items.length > 0);
}
