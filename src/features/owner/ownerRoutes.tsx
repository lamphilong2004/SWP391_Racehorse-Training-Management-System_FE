import type { RouteObject } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { OwnerPage } from './OwnerPage';

/** Integration Owner mounts these entries; shared router/navigation are deliberately unchanged. */
export const ownerRoutes: RouteObject[] = [
  { path: ROUTES.myHorses, element: <OwnerPage /> },
  { path: `${ROUTES.myHorses}/:horseId`, element: <OwnerPage /> },
];
