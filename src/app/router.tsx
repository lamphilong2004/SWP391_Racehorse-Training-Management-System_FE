import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/LoginPage';
import { LandingPage } from '../pages/LandingPage';
import { ManagementDashboardEntry, ManagementAuditEntry } from './ManagementEntry';
import { AccountPage } from '../pages/AccountPage';
import { ProgramCreationPage, ProgramListPage, ProgramDetailPage, AdjustmentRequestsPage, BaselinePage, CreateSessionPage, SessionDetailPage, RestrictionsPage, LiveMonitoringPage, SessionEvaluationPage, PerformancePage, GroomTodayPage, PrecheckPage,
  RiderDashboardPage, RiderAssignmentsPage, RiderAssignmentPage, RiderSessionPage, RiderFeedbackPage, RiderHistoryPage,
  CaseListPage, CreateCasePage, CaseDetailPage, TreatmentPlanPage, HerdHealthPage, UserListPage, UserEditorPage, RolesPage, NotificationsPage } from './DeferredPages';
import { HorseManagementLayout } from '../features/horses/shared/HorseManagementLayout';
import { HorseListPage, HorseProfilePage } from '../features/horses/HorsePages';
import { RegisterHorsePage } from '../features/horses/create/RegisterHorsePage';
import { PedigreeOwnershipPage } from '../features/horses/create/PedigreeOwnershipPage';
import { PendingActivationPage } from '../features/horses/activation/PendingActivationPage';
import { PublicOnly, RequireAuth } from './RequireAuth';
import { ROUTES } from './routePaths';
import { RouteErrorPage } from './RouteErrorPage';
import { IncidentAccess } from '../features/medical/Incidents';
import { GroomTreatmentAccess } from '../features/medical/GroomTasks';
import { MedicalSummaryAccess } from '../features/medical/MedicalSummary';
import { MedicalAccess } from '../features/medical/runtime';
import { AssignedProgramsPage } from '../features/training/assigned/AssignedProgramsPage';
import { TrainingCalendarPage } from '../features/training/calendar/TrainingCalendarPage';
import { ExerciseLibraryPage } from '../features/training/exercises/ExerciseLibraryPage';
import { ownerApplicationRoutes } from '../features/owner/ownerApplicationRoutes';
import { registrationRoutes } from '../features/registration/routes';
import { TemplateLibraryPage } from '../features/program-creation/TemplateLibraryPage';


/**
 * Dev-only routes (DEC-010): the component gallery and the per-role shell preview. They are lazy-loaded inside an
 * `import.meta.env.DEV` branch, so production builds neither register nor bundle them.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/foundation-v2',
        lazy: async () => ({ Component: (await import('../pages/dev/FoundationV2Page')).FoundationV2Page }),
      },
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

/**
 * CORE-008 owns public sign-in and the authenticated role workspace entry. Other feature screens remain with their
 * owning CORE tasks and continue to use the canonical ROUTES/AppShell configuration.
 */
export function buildRoutes(includeDevRoutes: boolean): RouteObject[] {
  // Inline build flags let the bundler remove the role test entry chunk from API/normal/production artifacts.
  const signInRoute: RouteObject = import.meta.env.MODE === 'staging-preview' && import.meta.env.VITE_ROLE_TEST_LOGIN === 'true'
    ? { path: ROUTES.login, hydrateFallbackElement: <p role="status">Đang tải đăng nhập thử theo vai trò…</p>, lazy: async () => {
      const { RoleTestEntry } = await import('../staging/RoleTestEntry');
      return { Component: () => <PublicOnly><RoleTestEntry /></PublicOnly> };
    } }
    : { path: ROUTES.login, element: <PublicOnly><LoginPage /></PublicOnly> };
  const routeList: RouteObject[] = [
    ...(includeDevRoutes
      ? [{ path: ROUTES.root, element: <Navigate to={ROUTES.devComponents} replace /> }, ...devRoutes]
      : [{ path: ROUTES.root, element: <PublicOnly><LandingPage /></PublicOnly> }]),
    signInRoute,
    { path: ROUTES.dashboard, element: <RequireAuth><ManagementDashboardEntry /></RequireAuth> },
    { path: ROUTES.auditLog, element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><ManagementAuditEntry /></RequireAuth> },
    { path: ROUTES.account, element: <RequireAuth><AccountPage /></RequireAuth> },
    { path: ROUTES.staffUsers, element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><UserListPage /></RequireAuth> },
    { path: '/admin/users/new', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><UserEditorPage /></RequireAuth> },
    { path: '/admin/users/:id/edit', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><UserEditorPage /></RequireAuth> },
    { path: ROUTES.rolesPermissions, element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><RolesPage /></RequireAuth> },
    { path: ROUTES.notifications, element: <RequireAuth><NotificationsPage /></RequireAuth> },
    // CORE-048 (DEC-008): public access request and Club Manager review; each page enforces its own boundary.
    ...registrationRoutes,
    // CORE-056 candidate mount: canonical API provider plus legacy deep-link aliases.
    ...ownerApplicationRoutes,
    { element: <RequireAuth allowedRoles={['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM']}><HorseManagementLayout /></RequireAuth>, children: [
      { path: ROUTES.horses, element: <HorseListPage /> },
      { path: '/horses/:id', element: <HorseProfilePage /> },
      { path: '/horses/new', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><RegisterHorsePage /></RequireAuth> },
      { path: '/horses/:id/identity', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><RegisterHorsePage /></RequireAuth> },
      { path: '/horses/:id/edit', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><PedigreeOwnershipPage /></RequireAuth> },
      { path: '/horses/pending-activation', element: <RequireAuth allowedRoles={['CLUB_MANAGER']}><PendingActivationPage /></RequireAuth> },
    ] },
    { path: ROUTES.trainingProgramCreate, element: <RequireAuth allowedRoles={['HEAD_TRAINER']}><ProgramCreationPage /></RequireAuth> },
    { path: ROUTES.programTemplates, element: <RequireAuth allowedRoles={['HEAD_TRAINER']}><TemplateLibraryPage /></RequireAuth> },
    { path: '/horses/:id/baseline', element: <RequireAuth allowedRoles={['VETERINARIAN']}><BaselinePage /></RequireAuth> },
    { path: ROUTES.restrictions, element: <RequireAuth allowedRoles={['VETERINARIAN', 'HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER']}><RestrictionsPage /></RequireAuth> },
    { path: ROUTES.realtimeMonitoring, element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']}><LiveMonitoringPage /></RequireAuth> },
    { path: ROUTES.assignedPrograms, element: <RequireAuth allowedRoles={['TRAINER']}><AssignedProgramsPage /></RequireAuth> },
    { path: ROUTES.trainingSchedule, element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']}><TrainingCalendarPage /></RequireAuth> },
    { path: ROUTES.trainingCalendar, element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']}><TrainingCalendarPage /></RequireAuth> },
    { path: '/training/exercise-library', element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', 'WORK_RIDER']}><ExerciseLibraryPage /></RequireAuth> },
    { path: '/training/exercise-library/new', element: <RequireAuth allowedRoles={['TRAINER']}><ExerciseLibraryPage /></RequireAuth> },
    { path: ROUTES.exerciseLibrary, element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', 'WORK_RIDER']}><ExerciseLibraryPage /></RequireAuth> },
    { path: ROUTES.adjustmentRequests, element: <RequireAuth allowedRoles={['HEAD_TRAINER', 'TRAINER']}><AdjustmentRequestsPage /></RequireAuth> },
    { path: '/training/programs/:id', element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', 'GROOM']}><ProgramDetailPage /></RequireAuth> },
    { path: '/training/session/:id', element: <RequireAuth allowedRoles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']}><SessionDetailPage /></RequireAuth> },
    { path: '/training/schedule/session/new', element: <RequireAuth allowedRoles={['TRAINER']}><CreateSessionPage /></RequireAuth> },
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
    { path: ROUTES.medicalSummary, element: <RequireAuth><MedicalSummaryAccess /></RequireAuth> },
    { path: ROUTES.careTasks, element: <RequireAuth><GroomTreatmentAccess /></RequireAuth> },
    { path: ROUTES.treatmentTasks, element: <Navigate to={ROUTES.careTasks} replace /> },
    { path: ROUTES.incidents, element: <RequireAuth><IncidentAccess /></RequireAuth> },
    { path: ROUTES.incidentDetail, element: <RequireAuth><IncidentAccess detail /></RequireAuth> },
    // Sidebar destinations whose owning CORE screen is not integrated yet: explicit unavailable state instead of a 404.
    { path: ROUTES.trainingPrograms, element: <RequireAuth allowedRoles={['HEAD_TRAINER']}><ProgramListPage /></RequireAuth> },
    { path: '*', element: <RequireAuth><NotFoundPage /></RequireAuth> },
  ];
  // Every top-level route recovers from render or chunk-load failures with a calm, recoverable screen.
  for (const route of routeList) route.errorElement ??= <RouteErrorPage />;
  return routeList;
}

// Keep the app's public root; make the existing review galleries reachable only in a Vite dev server.
export const routes = [...buildRoutes(false), ...(import.meta.env.DEV ? devRoutes : [])];

export const router = createBrowserRouter(routes);
