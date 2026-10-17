import { useMemo, type ReactNode } from 'react';
import { AppShell } from '../../layout/AppShell';
import type { RoleCode } from '../../shared/auth/roles';
import { Core046Client } from './client';
import { SessionContext } from './session';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';

export function Core046Route({ allowedRoles, children }: { allowedRoles: RoleCode[]; children: ReactNode }) {
  const auth = useAuth();
  const token = authSession.read()?.accessToken;
  const user = auth.user;
  const role = user?.roles.find((item) => allowedRoles.includes(item));
  const session = useMemo(() => token && user && role ? {
    client: new Core046Client(token, undefined, auth.handleApiError, user),
    user: { id: user.id, fullName: user.fullName, role },
  } : null, [token, user, role, auth.handleApiError]);
  if (auth.status !== 'authenticated' || user?.accountStatus !== 'ACTIVE' || !role) return <main role="alert">Access Denied</main>;
  if (!session) return <main role="alert">Sign in again to continue.</main>;
  return <SessionContext.Provider value={session}><AppShell user={session.user} breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Medical / Incidents' }]}>{children}</AppShell></SessionContext.Provider>;
}
