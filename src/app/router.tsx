import { MedicalRoute } from '../features/medical/runtime';
import { CaseListPage, CreateCasePage, CaseDetailPage, IncidentListPage, TreatmentTaskListPage, TreatmentTaskDetailPage } from '../features/medical/pages';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { DesignSystemPage } from '../pages/design-system/DesignSystemPage';
import { ShellPreviewPage } from '../pages/design-system/ShellPreviewPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ROUTES } from './routePaths';

/**
 * Route table. CORE-002 ships the foundation only:
 * - `/design-system` + `/design-system/shell/:role`: design-system reference used for visual review.
 * - `/` redirects there until Landing (CORE-010) and Login + protected routes (CORE-008) land.
 * Feature screens are added by their owning CORE task, using ROUTES and AppShell.
 */
export const routes: RouteObject[] = [
  { path: ROUTES.root, element: <Navigate to={ROUTES.designSystem} replace /> },
  { path: ROUTES.designSystem, element: <DesignSystemPage /> },
  { path: ROUTES.shellPreview, element: <ShellPreviewPage /> },
  { element: <MedicalRoute role="VETERINARIAN" />, children: [
    { path: ROUTES.medical, element: <CaseListPage /> },
    { path: ROUTES.medicalCaseNew, element: <CreateCasePage /> },
    { path: ROUTES.medicalCaseDetail, element: <CaseDetailPage /> },
    { path: ROUTES.incidents, element: <IncidentListPage /> },
  ] },
  { element: <MedicalRoute role="GROOM" />, children: [
    { path: ROUTES.treatmentTasks, element: <TreatmentTaskListPage /> },
    { path: ROUTES.treatmentTaskDetail, element: <TreatmentTaskDetailPage /> },
  ] },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
