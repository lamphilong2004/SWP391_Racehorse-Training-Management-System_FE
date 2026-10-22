/**
 * Single source of route paths. Feature tasks own their screens and must reuse/extend these constants
 * instead of hard-coding paths (one screen = one route).
 *
 * Confirmed from Figma annotations / CORE-003: `/dashboard` is the role landing (sitemap, `GET /api/auth/me`)
 * and reports live under `/reports/*`.
 * PROVISIONAL (sitemap B.2 / B.6 / B.7 is not in the workspace): every other module path below.
 * Replace them with the sitemap values when it is shared — the sidebar picks the change up automatically.
 */
export const ROUTES = {
  root: '/',
  /** DEV ONLY (DEC-010): component gallery and per-role shell preview. Not registered in production builds. */
  devComponents: '/dev/components',
  devShell: '/dev/shell/:role',

  login: '/login',
  dashboard: '/dashboard',
  account: '/account',
  horses: '/horses',
  pendingActivation: '/horses/pending-activation',
  groomToday: '/groom/today',
  groomPrecheck: '/training/my-sessions/:id/pre-check',
  stable: '/stable',
  trainingPrograms: '/training/programs',
  assignedPrograms: '/training/programs/assigned',
  adjustmentRequests: '/training/adjustment-requests',
  trainingProgramCreate: '/training/programs/new',
  programTemplates: '/training/templates',
  trainingSchedule: '/training/schedule',
  trainingCalendar: '/training/calendar',
  exerciseLibrary: '/training/exercises',
  performance: '/training/performance',
  sessionEvaluation: '/training/sessions/:id/evaluation',
  realtimeMonitoring: '/training/monitoring',
  myRides: '/rider',
  assignments: '/rider/assignments',
  riderAssignment: '/rider/assignments/:id',
  riderStart: '/rider/assignments/:id/start',
  riderSession: '/rider/sessions/:id/active',
  riderFeedback: '/rider/sessions/:id/feedback',
  ridingHistory: '/rider/history',
  reportIssue: '/rider/assignments',
  medical: '/medical',
  medicalCaseNew: '/medical/cases/new',
  medicalCaseDetail: '/medical/cases/:caseId',
  treatmentPlan: '/medical/cases/:caseId/treatment-plan',
  medicalSummary: '/medical/summary',
  herdHealth: '/medical/herd-health',
  preventiveHealthcare: '/medical/preventive',
  restrictions: '/medical/restrictions',
  incidents: '/incidents',
  incidentDetail: '/incidents/:incidentId',
  careTasks: '/care/tasks',
  treatmentTasks: '/medical/my-tasks',
  dailyCare: '/care/daily',
  staffUsers: '/admin/users',
  rolesPermissions: '/admin/roles',
  races: '/races',
  inventory: '/inventory',
  reports: '/reports',
  auditLog: '/admin/audit-log',
  register: '/register',
  /** DEC-008 R9 public reset; the dev outbox link targets /reset-password?token=… */
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  registrations: '/admin/registrations',
  myHorses: '/owner/horses',
  notifications: '/notifications',
} as const;

export function devShellPath(role: string): string {
  return ROUTES.devShell.replace(':role', role);
}

export function evaluationPath(id: number): string {
  return ROUTES.sessionEvaluation.replace(':id', String(id));
}
