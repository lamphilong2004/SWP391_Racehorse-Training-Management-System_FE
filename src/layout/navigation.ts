import { ROUTES } from '../app/routePaths';
import type { IconName } from '../design-system/icons/Icon';
import type { RoleCode } from '../shared/auth/roles';

export interface NavItem {
  label: string;
  icon: IconName;
  to: string;
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
          { label: 'Races', icon: 'target', to: ROUTES.races },
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
          { label: 'Assigned Programs', icon: 'folder', to: ROUTES.trainingPrograms },
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
          { label: 'Horses', icon: 'horseshoe', to: ROUTES.horses },
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
          { label: 'Preventive Healthcare', icon: 'calendar', to: ROUTES.preventiveHealthcare },
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
          { label: 'Stable', icon: 'warehouse', to: ROUTES.stable },
        ],
      },
      {
        heading: 'Administration',
        items: [
          { label: 'Staff & Users', icon: 'users', to: ROUTES.staffUsers },
          { label: 'Roles & Permissions', icon: 'shield-check', to: ROUTES.rolesPermissions },
        ],
      },
      {
        heading: 'Operations',
        items: [
          { label: 'Races', icon: 'target', to: ROUTES.races },
          { label: 'Inventory', icon: 'package', to: ROUTES.inventory },
          { label: 'Reports', icon: 'bar-chart', to: ROUTES.reports },
          { label: 'Audit Log', icon: 'history', to: ROUTES.auditLog },
        ],
      },
    ],
  },
  GROOM: {
    workspaceLabel: 'Stable Care Workspace',
    sections: [
      {
        items: [{ label: 'Today', icon: 'dashboard', to: ROUTES.dashboard }],
      },
      {
        heading: 'My Work',
        items: [
          { label: 'Care Tasks', icon: 'clipboard-list', to: ROUTES.careTasks },
          { label: 'Treatment Tasks', icon: 'stethoscope', to: ROUTES.treatmentTasks },
          { label: 'Daily Care', icon: 'check-circle', to: ROUTES.dailyCare },
          { label: 'Preventive Healthcare', icon: 'calendar', to: ROUTES.preventiveHealthcare },
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
