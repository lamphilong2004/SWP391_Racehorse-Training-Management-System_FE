import { Navigate, useLocation, useParams, type RouteObject } from 'react-router';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { OwnerProvider } from './OwnerProvider';
import { createOwnerApi } from './ownerApi';
import { ownerRoutes } from './ownerRoutes';

// Official application binding is API-only. Fixtures inject providers in tests, never at runtime.
const service = createOwnerApi();
// Route objects intentionally contain this local redirect component.
// eslint-disable-next-line react-refresh/only-export-components
function LegacyOwnerLink() {
  const { id } = useParams();
  const { search, hash } = useLocation();
  const pathname = id === undefined ? ROUTES.myHorses : `${ROUTES.myHorses}/${encodeURIComponent(id)}`;
  return <Navigate replace to={{ pathname, search, hash }} />;
}
export const ownerApplicationRoutes: RouteObject[] = [
  ...ownerRoutes.map((route) => ({ ...route, element: <RequireAuth allowedRoles={['HORSE_OWNER']}><OwnerProvider service={service}>{route.element}</OwnerProvider></RequireAuth> })),
  ...['/my-horses', '/my-horses/:id'].map((path) => ({ path, element: <RequireAuth allowedRoles={['HORSE_OWNER']}><LegacyOwnerLink /></RequireAuth> })),
];
