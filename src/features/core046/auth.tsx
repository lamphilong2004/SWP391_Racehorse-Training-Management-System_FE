import { useMemo } from 'react';
import { Outlet } from 'react-router';
import { AppShell } from '../../layout/AppShell';
import type { RoleCode } from '../../shared/auth/roles';
import { Core046Client } from './client';
import { SessionContext } from './session';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { AlertBanner } from '../../design-system';

export function Core046Route({ allowedRoles }: { allowedRoles: RoleCode[] }) {
  const auth = useAuth();
  const token = authSession.read()?.accessToken;
  const client = useMemo(() => token ? new Core046Client(token, undefined, auth.handleApiError) : null, [token, auth.handleApiError]);
  const actor = auth.user;
  const role = actor?.roles.find((candidate) => allowedRoles.includes(candidate));
  if (!actor || !role || !client || actor.accountStatus !== 'ACTIVE') return <AlertBanner type="danger" title="Access denied" />;
  const user = { id: actor.id, fullName: actor.fullName, role };
  return <SessionContext.Provider value={{ client, user }}><AppShell user={user} breadcrumb={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Medical / Incidents' }]}><Outlet /></AppShell></SessionContext.Provider>;
}
