import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ROUTES } from './routePaths';
import { Core046Route } from '../features/core046/auth';
import { TreatmentTasksPage, IncidentsPage, IncidentDetailPage } from '../features/core046/pages';

const INCIDENT_READ_ROLES = ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'WORK_RIDER', 'VETERINARIAN', 'GROOM'] as const;
const GROOM_ROLE = ['GROOM'] as const;

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
 * Route table. CORE-002 ships the foundation only; feature screens are added by their owning CORE task using ROUTES
 * and AppShell. In development `/` opens the gallery; in production it falls through to "not found" until Landing
 * (CORE-010) and Login + protected routes (CORE-008) land.
 */
export function buildRoutes(includeDevRoutes: boolean): RouteObject[] {
  return [
    ...(includeDevRoutes
      ? [{ path: ROUTES.root, element: <Navigate to={ROUTES.devComponents} replace /> }, ...devRoutes]
      : []),
    { element: <Core046Route allowedRoles={[...GROOM_ROLE]} />, children: [
      { path: ROUTES.treatmentTasks, element: <TreatmentTasksPage /> },
    ] },
    { element: <Core046Route allowedRoles={[...INCIDENT_READ_ROLES]} />, children: [
      { path: ROUTES.incidents, element: <IncidentsPage /> },
      { path: ROUTES.incidentDetail, element: <IncidentDetailPage /> },
    ] },
    { path: '*', element: <NotFoundPage /> },
  ];
}

export const routes = buildRoutes(import.meta.env.DEV);

export const router = createBrowserRouter(routes);
