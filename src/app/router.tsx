import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/LoginPage';
import { ManagementDashboardEntry, ManagementAuditEntry } from './ManagementEntry';
import { AccountPage } from '../pages/AccountPage';
import { ProgramCreationPage, SessionEvaluationPage, PerformancePage, GroomTodayPage, PrecheckPage,
  RiderDashboardPage, RiderAssignmentsPage, RiderAssignmentPage, RiderSessionPage, RiderFeedbackPage, RiderHistoryPage,
  TreatmentTasksPage, CaseListPage, CreateCasePage, CaseDetailPage, TreatmentPlanPage, HerdHealthPage } from './DeferredPages';
import { HorseManagementLayout } from '../features/horses/shared/HorseManagementLayout';
import { HorseListPage, HorseProfilePage } from '../features/horses/HorsePages';
import { RegisterHorsePage } from '../features/horses/create/RegisterHorsePage';
import { PedigreeOwnershipPage } from '../features/horses/create/PedigreeOwnershipPage';
import { PendingActivationPage } from '../features/horses/activation/PendingActivationPage';
import { PublicOnly, RequireAuth } from './RequireAuth';
import { ROUTES } from './routePaths';
import { DEMO_UI_ONLY } from '../demo/demoMode';
import { Core046Route } from '../features/core046/auth';
import { IncidentLayout, IncidentListRoute, IncidentDetailRoute } from './IncidentRoutes';
import { MedicalAccess } from '../features/medical/runtime';
import { AssignedProgramsPage } from '../features/training/assigned/AssignedProgramsPage';
import { TrainingCalendarPage } from '../features/training/calendar/TrainingCalendarPage';
import { ExerciseLibraryPage } from '../features/training/exercises/ExerciseLibraryPage';
import { OwnerHandoffPage } from './OwnerHandoffPage';
import { ROLE_CODES, type RoleCode } from '../shared/auth/roles';

/** Route integration only. Owners: CORE-022 program list, CORE-041 templates, CORE-031 monitoring,
 * CORE-036 medical summary, CORE-020 restrictions, CORE-050 accounts, CORE-052 audit, CORE-056 Owner,
 * CORE-054 notifications. DEC-009 requires the minimum Owner workspace; it is not deferred. */
const pendingScreens: { path: string; title: string; section: string; roles: RoleCode[] }[] = [
  { path: ROUTES.trainingPrograms, title: 'Horse Training Programs', section: 'Training', roles: ['HEAD_TRAINER'] },
  { path: ROUTES.programTemplates, title: 'Program Templates', section: 'Training', roles: ['HEAD_TRAINER'] },
  { path: ROUTES.realtimeMonitoring, title: 'Realtime Monitoring', section: 'Training', roles: ['HEAD_TRAINER', 'TRAINER'] },
  { path: ROUTES.medicalSummary, title: 'Medical Summary', section: 'Medical', roles: ['HEAD_TRAINER'] },
  { path: ROUTES.restrictions, title: 'Restrictions', section: 'Medical', roles: ['HEAD_TRAINER', 'TRAINER'] },
  { path: ROUTES.staffUsers, title: 'Staff & Users', section: 'Administration', roles: ['CLUB_MANAGER'] },
  { path: ROUTES.rolesPermissions, title: 'Roles & Permissions', section: 'Administration', roles: ['CLUB_MANAGER'] },
  { path: ROUTES.myHorses, title: 'My Horses', section: 'Owner Portal', roles: ['HORSE_OWNER'] },
  { path: '/my-horses', title: 'My Horses', section: 'Owner Portal', roles: ['HORSE_OWNER'] },
  { path: '/my-horses/:id', title: 'Horse details', section: 'Owner Portal', roles: ['HORSE_OWNER'] },
  { path: ROUTES.notifications, title: 'Notifications', section: 'Workspace', roles: [...ROLE_CODES] },
];

/**
 * Dev-only routes (DEC-010): the component gallery and the per-role shell preview. They are lazy-loaded inside an
 * `import.meta.env.DEV` branch, so production builds neither register nor bundle them.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: ROUTES.devComponents,
        lazy: async () => ({ Component: (await import('../pages/dev/ComponentsPage')).ComponentsPage }),
      },
      {
        path: ROUTES.devShell,
        lazy: async () => ({ Component: (await import('../pages/dev/ShellPreviewPage')).ShellPreviewPage }),
      },
    ]
  : [];

/** Development harness only (dead code in production builds): hidden presenter page, never linked from navigation. */
const presenterRoutes: RouteObject[] = import.meta.env.DEV && DEMO_UI_ONLY
  ? [{ path: '/presenter-tools', lazy: async () => ({ Component: (await import('../demo/PresenterToolsPage')).PresenterToolsPage }) }]
  : [];

/**
 * CORE-008 owns public sign-in and the authenticated role workspace entry. Other feature screens remain with their
 * owning CORE tasks and continue to use the canonical ROUTES/AppShell configuration.
 */
export function buildRoutes(includeDevRoutes: boolean): RouteObject[] {
  return [
    ...(includeDevRoutes
      ? [{ path: ROUTES.root, element: <Navigate to={ROUTES.devComponents} replace /> }, ...devRoutes]
      : [{ path: ROUTES.root, element: <Navigate to={ROUTES.dashboard} replace /> }]),
    ...presenterRoutes,
    { path: ROUTES.login, element: <PublicOnly><LoginPage /></PublicOnly> },
    { path: ROUTES.dashboard, element: <RequireAuth><ManagementDashboardEntry /></RequireAuth> },
    { path: ROUTES.auditLog, element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><ManagementAuditEntry /></RequireAuth> },
    { path: ROUTES.account, element: <RequireAuth><AccountPage /></RequireAuth> },
    { element: <RequireAuth allowedRoles={['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM']}><HorseManagementLayout /></RequireAuth>, children: [
      { path: ROUTES.horses, element: <HorseListPage /> },
      { path: '/horses/:id', element: <HorseProfilePage /> },
      { path: '/horses/new', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><RegisterHorsePage /></RequireAuth> },
      { path: '/horses/:id/identity', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><RegisterHorsePage /></RequireAuth> },
      { path: '/horses/:id/edit', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><PedigreeOwnershipPage /></RequireAuth> },
      { path: '/horses/pending-activation', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><PendingActivationPage /></RequireAuth> },
    ] },
    { path: ROUTES.trainingProgramCreate, element: <RequireAuth allowedRoles={['HEAD_TRAINER']}><ProgramCreationPage /></RequireAuth> },
    { path: ROUTES.assignedPrograms, element: <RequireAuth allowedRoles={['TRAINER']}><AssignedProgramsPage /></RequireAuth> },
    { path: ROUTES.trainingSchedule, element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']}><TrainingCalendarPage /></RequireAuth> },
    { path: ROUTES.trainingCalendar, element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']}><TrainingCalendarPage /></RequireAuth> },
    { path: '/training/exercise-library', element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', 'WORK_RIDER']}><ExerciseLibraryPage /></RequireAuth> },
    { path: '/training/exercise-library/new', element: <RequireAuth allowedRoles={['TRAINER']}><ExerciseLibraryPage /></RequireAuth> },
    { path: ROUTES.exerciseLibrary, element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', 'WORK_RIDER']}><ExerciseLibraryPage /></RequireAuth> },
    { path: '/training/programs/:id', element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', 'GROOM']}><OwnerHandoffPage title="Program details" /></RequireAuth> },
    { path: '/training/session/:id', element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']}><OwnerHandoffPage title="Session details" /></RequireAuth> },
    { path: '/training/schedule/session/new', element: <RequireAuth allowedRoles={['TRAINER']}><OwnerHandoffPage title="Session scheduling" /></RequireAuth> },
    { path: ROUTES.sessionEvaluation, element: <RequireAuth><SessionEvaluationPage /></RequireAuth> },
    { path: ROUTES.performance, element: <RequireAuth allowedRoles={['HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER', 'VETERINARIAN']}><PerformancePage /></RequireAuth> },
    { path: ROUTES.groomToday, element: <RequireAuth allowedRoles={['GROOM']}><GroomTodayPage /></RequireAuth> },
    { path: ROUTES.groomPrecheck, element: <RequireAuth allowedRoles={['GROOM']}><PrecheckPage /></RequireAuth> },
    { path: ROUTES.myRides, element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderDashboardPage /></RequireAuth> },
    { path: ROUTES.assignments, element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderAssignmentsPage /></RequireAuth> },
    { path: ROUTES.riderAssignment, element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderAssignmentPage /></RequireAuth> },
    { path: ROUTES.riderStart, element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderAssignmentPage /></RequireAuth> },
    { path: ROUTES.riderSession, element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderSessionPage /></RequireAuth> },
    { path: ROUTES.riderFeedback, element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderFeedbackPage /></RequireAuth> },
    { path: ROUTES.ridingHistory, element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderHistoryPage /></RequireAuth> },
    // Workbook routes reuse the existing CORE-027/029 screens; retain published links as compatible entries.
    { path: '/training/my-sessions', element: <RequireAuth allowedRoles={['GROOM']}><GroomTodayPage /></RequireAuth> },
    { path: '/training/my-rides', element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderDashboardPage /></RequireAuth> },
    { path: '/training/rides/assigned', element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderAssignmentsPage /></RequireAuth> },
    { path: '/training/rides/history', element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderHistoryPage /></RequireAuth> },
    { path: '/training/rides/:id', element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderAssignmentPage /></RequireAuth> },
    { path: '/training/rides/:id/start', element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderAssignmentPage /></RequireAuth> },
    { path: '/training/rides/:id/execute', element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderSessionPage /></RequireAuth> },
    { path: '/training/rides/:id/feedback', element: <RequireAuth allowedRoles={['WORK_RIDER']}><RiderFeedbackPage /></RequireAuth> },
    { path: '/rides', element: <Navigate to={ROUTES.myRides} replace /> },
    { path: '/rides/assignments', element: <Navigate to={ROUTES.assignments} replace /> },
    { path: '/rides/history', element: <Navigate to={ROUTES.ridingHistory} replace /> },
    { path: '/rides/report-issue', element: <Navigate to={ROUTES.assignments} replace /> },
    { path: ROUTES.medical, element: <RequireAuth><MedicalAccess><CaseListPage /></MedicalAccess></RequireAuth> },
    { path: ROUTES.medicalCaseNew, element: <RequireAuth><MedicalAccess><CreateCasePage /></MedicalAccess></RequireAuth> },
    { path: ROUTES.medicalCaseDetail, element: <RequireAuth><MedicalAccess><CaseDetailPage /></MedicalAccess></RequireAuth> },
    { path: ROUTES.treatmentPlan, element: <RequireAuth><MedicalAccess><TreatmentPlanPage /></MedicalAccess></RequireAuth> },
    { path: ROUTES.herdHealth, element: <RequireAuth><MedicalAccess><HerdHealthPage /></MedicalAccess></RequireAuth> },
    { element: <RequireAuth><Core046Route allowedRoles={['GROOM']} /></RequireAuth>, children: [{ path: ROUTES.treatmentTasks, element: <TreatmentTasksPage /> }] },
    { element: <RequireAuth><IncidentLayout /></RequireAuth>, children: [
      { path: ROUTES.incidents, element: <IncidentListRoute /> },
      { path: ROUTES.incidentDetail, element: <IncidentDetailRoute /> },
    ] },
    // Sidebar destinations whose owning CORE screen is not integrated yet: explicit unavailable state instead of a 404.
    ...pendingScreens.map(({ path, title, section, roles }) => ({ path, element: <RequireAuth allowedRoles={roles}><OwnerHandoffPage title={title} section={section} /></RequireAuth> })),
    { path: '*', element: <RequireAuth><NotFoundPage /></RequireAuth> },
  ];
}

export const routes = buildRoutes(false);

export const router = createBrowserRouter(routes);
