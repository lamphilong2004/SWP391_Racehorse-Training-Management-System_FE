import { Navigate, useLocation, useParams, type RouteObject } from 'react-router';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { OwnerProvider } from './OwnerProvider';
import { createOwnerApi } from './ownerApi';
import { ownerRoutes } from './ownerRoutes';
import { OwnerPage } from './OwnerPage';
import { useAuth } from '../../shared/auth/AuthProvider';

// Official application binding is API-only. Fixtures inject providers in tests, never at runtime.
const service = createOwnerApi();
// Route objects intentionally contain this local redirect component.
// eslint-disable-next-line react-refresh/only-export-components
function LegacyOwnerLink() {
  const { id } = useParams();
  const { user } = useAuth();
  const { search, hash } = useLocation();
  const pathname = id === undefined ? ROUTES.myHorses : `${ROUTES.myHorses}/${encodeURIComponent(id)}`;
  // Reuse the feature's existing Owner boundary before redirecting; dev RequireAuth is auth-only.
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.includes('HORSE_OWNER')) return <OwnerPage />;
  return <Navigate replace to={{ pathname, search, hash }} />;
}
export const ownerApplicationRoutes: RouteObject[] = [
  ...ownerRoutes.map((route) => ({ ...route, element: <RequireAuth><OwnerProvider service={service}>{route.element}</OwnerProvider></RequireAuth> })),
  ...['/my-horses', '/my-horses/:id'].map((path) => ({ path, element: <RequireAuth><LegacyOwnerLink /></RequireAuth> })),
];
