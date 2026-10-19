import { type ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { ErrorState } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RoleCode } from '../../shared/auth/roles';
import { HorseListPage, HorseProfilePage } from './HorsePages';
import { RegisterHorsePage } from './create/RegisterHorsePage';
import { PedigreeOwnershipPage } from './create/PedigreeOwnershipPage';
import { PendingActivationPage } from './activation/PendingActivationPage';
import { HorseManagementLayout } from './shared/HorseManagementLayout';

const readers: readonly RoleCode[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'];
// Feature-local boundary: dev's shared RequireAuth intentionally remains unchanged.
// eslint-disable-next-line react-refresh/only-export-components
function HorseAccess({ children, manager = false }: { children: ReactNode; manager?: boolean }) {
  const { user, expiresAt } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.some((role) => manager ? role === 'CLUB_MANAGER' : readers.includes(role))) {
    return <ErrorState title="Access denied" description="Your account does not have permission to access this page." />;
  }
  return <div key={`${user.id}:${expiresAt}`}>{children}</div>;
}

export const horseApplicationRoutes: RouteObject[] = [{
  path: ROUTES.horses,
  element: <RequireAuth><HorseAccess><HorseManagementLayout /></HorseAccess></RequireAuth>,
  children: [
    { index: true, element: <HorseListPage /> },
    { path: 'new', element: <HorseAccess manager><RegisterHorsePage /></HorseAccess> },
    { path: 'pending-activation', element: <HorseAccess manager><PendingActivationPage /></HorseAccess> },
    { path: ':id/edit', element: <HorseAccess manager><PedigreeOwnershipPage /></HorseAccess> },
    { path: ':id', element: <HorseProfilePage /> },
  ],
}];
