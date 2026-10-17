import { ROUTES } from '../app/routePaths';
import type { IconName } from '../design-system/icons/Icon';
import type { RoleCode } from '../shared/auth/roles';

/** Why a Figma module is not shown in the current delivery scope (traceable to the decision records). */
export const DEFERRED_REASON = 'Deferred from the current scope (DEC-007, DEC-008 §3.5)';

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
    workspaceLabel: 'Head Trainer Workspace',
    sections: [
      {
        items: [
          { label: 'Dashboard', icon: 'dashboard', to: ROUTES.dashboard },
          { label: 'Horses', icon: 'horseshoe', to: ROUTES.horses },
        ],
      },
      {
        heading: 'Training',
        items: [
          { label: 'Horse Training Programs', icon: 'clipboard-list', to: ROUTES.trainingPrograms },
          { label: 'Program Templates', icon: 'file-text', to: ROUTES.programTemplates },
          { label: 'Training Schedule', icon: 'calendar', to: ROUTES.trainingSchedule },
          { label: 'Performance', icon: 'trending-up', to: ROUTES.performance },
          { label: 'Realtime Monitoring', icon: 'activity', to: ROUTES.realtimeMonitoring },
          { label: 'Races', icon: 'target', to: ROUTES.races, deferred: DEFERRED_REASON },
        ],
      },
      {
        heading: 'Medical',
        items: [
          { label: 'Medical Summary', icon: 'stethoscope', to: ROUTES.medicalSummary },
          { label: 'Restrictions', icon: 'shield-alert', to: ROUTES.restrictions },
          { label: 'Incidents', icon: 'alert-triangle', to: ROUTES.incidents },
        ],
      },
    ],
  },
  TRAINER: {
    workspaceLabel: 'Trainer Workspace',
    sections: [
      {
        items: [
          { label: 'Dashboard', icon: 'dashboard', to: ROUTES.dashboard },
          { label: 'Assigned Programs', icon: 'folder', to: ROUTES.assignedPrograms },
          { label: 'Training Calendar', icon: 'calendar', to: ROUTES.trainingCalendar },
          { label: 'Exercise Library', icon: 'book-open', to: ROUTES.exerciseLibrary },
          { label: 'Live Monitoring', icon: 'activity', to: ROUTES.realtimeMonitoring },
          { label: 'Performance', icon: 'trending-up', to: ROUTES.performance },
          { label: 'Restrictions', icon: 'shield-alert', to: ROUTES.restrictions },
          { label: 'Incidents', icon: 'alert-triangle', to: ROUTES.incidents },
          { label: 'Horses', icon: 'horseshoe', to: ROUTES.horses },
        ],
      },
    ],
  },
  WORK_RIDER: {
    workspaceLabel: 'Work Rider Workspace',
    sections: [
      {
        items: [
          { label: 'My Rides', icon: 'dashboard', to: ROUTES.myRides },
          { label: 'Assignments', icon: 'clipboard-list', to: ROUTES.assignments },
          { label: 'Riding History', icon: 'history', to: ROUTES.ridingHistory },
          { label: 'Report Issue', icon: 'alert-triangle', to: ROUTES.reportIssue },
        ],
      },
    ],
  },
  VETERINARIAN: {
    workspaceLabel: 'Veterinary Workspace',
    sections: [
      {
        items: [
          { label: 'Dashboard', icon: 'dashboard', to: ROUTES.dashboard },
          { label: 'Horses', icon: 'horseshoe', to: ROUTES.horses },
        ],
      },
      {
        heading: 'Medical',
        items: [
          { label: 'Medical / Health', icon: 'stethoscope', to: ROUTES.medical },
          { label: 'Herd Health', icon: 'activity', to: ROUTES.herdHealth },
          {
            label: 'Preventive Healthcare',
            icon: 'calendar',
            to: ROUTES.preventiveHealthcare,
            deferred: DEFERRED_REASON,
          },
          { label: 'Incidents', icon: 'alert-triangle', to: ROUTES.incidents },
        ],
      },
    ],
  },
  CLUB_MANAGER: {
    workspaceLabel: 'Club Manager Workspace',
    sections: [
      {
        items: [
          { label: 'Dashboard', icon: 'dashboard', to: ROUTES.dashboard },
          { label: 'Horses', icon: 'horseshoe', to: ROUTES.horses },
          { label: 'Pending Activation', icon: 'clipboard-list', to: ROUTES.pendingActivation },
          { label: 'Stable', icon: 'warehouse', to: ROUTES.stable, deferred: DEFERRED_REASON },
        ],
      },
      {
        heading: 'Administration',
        items: [
          { label: 'Staff & Users', icon: 'users', to: ROUTES.staffUsers },
          { label: 'Registration Requests', icon: 'user', to: ROUTES.registrations },
          { label: 'Roles & Permissions', icon: 'shield-check', to: ROUTES.rolesPermissions },
        ],
      },
      {
        heading: 'Operations',
        items: [
          { label: 'Races', icon: 'target', to: ROUTES.races, deferred: DEFERRED_REASON },
          { label: 'Inventory', icon: 'package', to: ROUTES.inventory, deferred: DEFERRED_REASON },
          { label: 'Reports', icon: 'bar-chart', to: ROUTES.reports, deferred: DEFERRED_REASON },
          { label: 'Audit Log', icon: 'history', to: ROUTES.auditLog },
        ],
      },
    ],
  },
  GROOM: {
    workspaceLabel: 'Stable Care Workspace',
    sections: [
      {
        items: [{ label: 'Today', icon: 'dashboard', to: ROUTES.groomToday }],
      },
      {
        heading: 'My Work',
        items: [
          { label: 'Treatment Tasks', icon: 'clipboard-list', to: ROUTES.treatmentTasks },
          { label: 'Care Tasks', icon: 'clipboard-list', to: ROUTES.careTasks, deferred: DEFERRED_REASON },
          { label: 'Daily Care', icon: 'check-circle', to: ROUTES.dailyCare, deferred: DEFERRED_REASON },
          {
            label: 'Preventive Healthcare',
            icon: 'calendar',
            to: ROUTES.preventiveHealthcare,
            deferred: DEFERRED_REASON,
          },
          { label: 'Incidents', icon: 'alert-triangle', to: ROUTES.incidents },
        ],
      },
    ],
  },
  HORSE_OWNER: {
    workspaceLabel: 'Horse Owner Portal',
    sections: [
      {
        items: [
          { label: 'My Horses', icon: 'horseshoe', to: ROUTES.myHorses },
          { label: 'Notifications', icon: 'bell', to: ROUTES.notifications },
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
