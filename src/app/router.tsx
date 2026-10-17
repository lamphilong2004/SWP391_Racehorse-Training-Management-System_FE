import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/LoginPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { PublicOnly, RequireAuth } from './RequireAuth';
import { ROUTES } from './routePaths';
import { MedicalAccess } from '../features/medical/runtime';
import { CaseListPage, CreateCasePage, CaseDetailPage, TreatmentPlanPage, HerdHealthPage } from '../features/medical/pages';

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

/**
 * CORE-008 owns public sign-in and the authenticated role workspace entry. Other feature screens remain with their
 * owning CORE tasks and continue to use the canonical ROUTES/AppShell configuration.
 */
export function buildRoutes(includeDevRoutes: boolean): RouteObject[] {
  return [
    ...(includeDevRoutes
      ? [{ path: ROUTES.root, element: <Navigate to={ROUTES.devComponents} replace /> }, ...devRoutes]
      : [{ path: ROUTES.root, element: <Navigate to={ROUTES.dashboard} replace /> }]),
    { path: ROUTES.login, element: <PublicOnly><LoginPage /></PublicOnly> },
    { path: ROUTES.dashboard, element: <RequireAuth><WorkspacePage /></RequireAuth> },
    { path: ROUTES.medical, element: <RequireAuth><MedicalAccess><CaseListPage /></MedicalAccess></RequireAuth> },
    { path: ROUTES.medicalCaseNew, element: <RequireAuth><MedicalAccess><CreateCasePage /></MedicalAccess></RequireAuth> },
    { path: ROUTES.medicalCaseDetail, element: <RequireAuth><MedicalAccess><CaseDetailPage /></MedicalAccess></RequireAuth> },
    { path: ROUTES.treatmentPlan, element: <RequireAuth><MedicalAccess><TreatmentPlanPage /></MedicalAccess></RequireAuth> },
    { path: ROUTES.herdHealth, element: <RequireAuth><MedicalAccess><HerdHealthPage /></MedicalAccess></RequireAuth> },
    { path: '*', element: <RequireAuth><NotFoundPage /></RequireAuth> },
  ];
}

export const routes = buildRoutes(import.meta.env.DEV);

export const router = createBrowserRouter(routes);
