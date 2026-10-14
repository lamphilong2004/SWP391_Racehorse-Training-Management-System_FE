import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { NotInDemoPage } from '../pages/NotInDemoPage';
import { HorseListPage } from '../features/horses/HorseListPage';
import { HorseCreatePage } from '../features/horses/HorseCreatePage';
import { HorseDetailPage } from '../features/horses/HorseDetailPage';
import { ProgramListPage } from '../features/training/ProgramListPage';
import { ProgramCreatePage } from '../features/training/ProgramCreatePage';
import { ProgramDetailPage } from '../features/training/ProgramDetailPage';
import { SessionCreatePage } from '../features/training/SessionCreatePage';
import { SessionDetailPage } from '../features/training/SessionDetailPage';
import { LiveMonitoringPage, MonitoringIndexPage } from '../features/training/LiveMonitoringPage';
import { RiderHomePage, RiderSessionPage } from '../features/rides/RiderPages';
import { RestrictionsPage } from '../features/restrictions/RestrictionsPage';
import { MedicalOutlet } from '../features/medicalIntegration/MedicalOutlet';
import { CaseDetailPage, CaseListPage, CreateCasePage, IncidentListPage, TreatmentTaskDetailPage, TreatmentTaskListPage } from '../features/medical/pages';
import { ProtectedLayout, type RouteHandle } from './ProtectedLayout';
import { ROUTES } from './routePaths';
import type { RoleCode } from '../shared/auth/roles';

const h = (crumb: string, roles?: RoleCode[]): RouteHandle => ({ crumb, roles });
const STAFF: RoleCode[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'];

/** Dev-only routes (DEC-010): lazy-loaded inside an import.meta.env.DEV branch, so production builds never bundle them. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      { path: ROUTES.devComponents, lazy: async () => ({ Component: (await import('../pages/dev/ComponentsPage')).ComponentsPage }) },
      { path: ROUTES.devShell, lazy: async () => ({ Component: (await import('../pages/dev/ShellPreviewPage')).ShellPreviewPage }) },
    ]
  : [];

const notInDemo = (path: string, title: string, roles?: RoleCode[]): RouteObject => ({ path, element: <NotInDemoPage title={title} />, handle: h(title, roles) });

/**
 * DEMO INTEGRATION route table (demo/main-flow-hour1): Login → role-resolving /dashboard → Flow 1 → Flow 2 → Flow 3.
 * Feature screens stay owned by their CORE tasks; screens outside the demo path render NotInDemoPage (no dead links).
 */
export function buildRoutes(includeDevRoutes: boolean): RouteObject[] {
  return [
    { path: ROUTES.root, element: <Navigate to={ROUTES.dashboard} replace /> },
    { path: ROUTES.login, element: <LoginPage /> },
    ...(includeDevRoutes ? devRoutes : []),
    {
      element: <ProtectedLayout />,
      children: [
        { path: ROUTES.dashboard, element: <DashboardPage />, handle: h('Dashboard') },
        { path: ROUTES.horses, element: <HorseListPage />, handle: h('Horses', STAFF) },
        { path: ROUTES.horseNew, element: <HorseCreatePage />, handle: h('Register horse', ['CLUB_MANAGER']) },
        { path: ROUTES.horseDetail, element: <HorseDetailPage />, handle: h('Horse profile', STAFF) },
        { path: ROUTES.trainingPrograms, element: <ProgramListPage />, handle: h('Training programs', ['HEAD_TRAINER', 'TRAINER']) },
        { path: ROUTES.programNew, element: <ProgramCreatePage />, handle: h('Create program', ['HEAD_TRAINER']) },
        { path: ROUTES.programDetail, element: <ProgramDetailPage />, handle: h('Program detail', ['HEAD_TRAINER', 'TRAINER']) },
        { path: ROUTES.sessionNew, element: <SessionCreatePage />, handle: h('Create session', ['TRAINER']) },
        { path: ROUTES.sessionDetail, element: <SessionDetailPage />, handle: h('Session detail', ['HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'CLUB_MANAGER']) },
        { path: ROUTES.realtimeMonitoring, element: <MonitoringIndexPage />, handle: h('Live monitoring', ['TRAINER', 'HEAD_TRAINER']) },
        { path: ROUTES.monitoringSession, element: <LiveMonitoringPage />, handle: h('Live monitoring', ['TRAINER', 'HEAD_TRAINER']) },
        { path: ROUTES.myRides, element: <RiderHomePage />, handle: h('My rides', ['WORK_RIDER']) },
        { path: ROUTES.assignments, element: <RiderHomePage />, handle: h('Assignments', ['WORK_RIDER']) },
        { path: ROUTES.ridingHistory, element: <RiderHomePage history />, handle: h('Riding history', ['WORK_RIDER']) },
        { path: ROUTES.reportIssue, element: <Navigate to={ROUTES.myRides} replace />, handle: h('Report issue', ['WORK_RIDER']) },
        { path: ROUTES.riderSession, element: <RiderSessionPage />, handle: h('Assignment', ['WORK_RIDER']) },
        { path: ROUTES.restrictions, element: <RestrictionsPage />, handle: h('Restrictions', ['VETERINARIAN', 'HEAD_TRAINER', 'TRAINER']) },
        {
          element: <MedicalOutlet />,
          children: [
            { path: ROUTES.medical, element: <CaseListPage />, handle: h('Medical cases', ['VETERINARIAN']) },
            { path: ROUTES.medicalCaseNew, element: <CreateCasePage />, handle: h('Create medical case', ['VETERINARIAN']) },
            { path: ROUTES.medicalCaseDetail, element: <CaseDetailPage />, handle: h('Medical case', ['VETERINARIAN']) },
            { path: ROUTES.incidents, element: <IncidentListPage />, handle: h('Incidents', ['VETERINARIAN', 'HEAD_TRAINER', 'TRAINER', 'GROOM', 'CLUB_MANAGER']) },
            { path: ROUTES.treatmentTasks, element: <TreatmentTaskListPage />, handle: h('Treatment tasks', ['GROOM']) },
            { path: ROUTES.treatmentTaskDetail, element: <TreatmentTaskDetailPage />, handle: h('Treatment task', ['GROOM']) },
          ],
        },
        notInDemo(ROUTES.programTemplates, 'Program Templates'),
        notInDemo(ROUTES.trainingSchedule, 'Training Schedule'),
        notInDemo(ROUTES.trainingCalendar, 'Training Calendar'),
        notInDemo(ROUTES.exerciseLibrary, 'Exercise Library'),
        notInDemo(ROUTES.performance, 'Performance'),
        notInDemo(ROUTES.medicalSummary, 'Medical Summary'),
        notInDemo(ROUTES.herdHealth, 'Herd Health'),
        notInDemo(ROUTES.staffUsers, 'Staff & Users'),
        notInDemo(ROUTES.rolesPermissions, 'Roles & Permissions'),
        notInDemo(ROUTES.auditLog, 'Audit Log'),
        notInDemo(ROUTES.myHorses, 'My Horses'),
        notInDemo(ROUTES.notifications, 'Notifications'),
      ],
    },
    { path: '*', element: <NotFoundPage /> },
  ];
}

export const routes = buildRoutes(import.meta.env.DEV);
export const router = createBrowserRouter(routes);
