import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { AppShell } from '../../layout/AppShell';
import type { RoleCode } from '../../shared/auth/roles';
import { Core046Client } from './client';
import { getCore046AccessToken, SessionContext, type Core046Session } from './session';

export function Core046Route({ allowedRoles }: { allowedRoles: RoleCode[] }) {
  const [state, setState] = useState<{ session?: Core046Session; error?: string }>({});
  const token = getCore046AccessToken();
  useEffect(() => {
    let active = true;
    if (!token) return;
    const client = new Core046Client(token);
    client.getMe().then((me) => {
      if (!active) return;
      const role = me.roles.find((item): item is RoleCode => allowedRoles.includes(item as RoleCode));
      if (!role || me.accountStatus !== 'ACTIVE') { setState({ error: 'You do not have access to this page.' }); return; }
      setState({ session: { client, user: { id: me.id, fullName: me.fullName, role } } });
    }).catch((error: unknown) => { if (active) setState({ error: error instanceof Error ? error.message : 'Authentication failed.' }); });
    return () => { active = false; };
  }, [allowedRoles, token]);
  if (!token) return <main role="alert">Sign in is required. Shared authentication is not connected yet.</main>;
  if (state.error) return <main role="alert">{state.error}</main>;
  if (!state.session) return <main role="status">Checking access…</main>;
  return <SessionContext.Provider value={state.session}><AppShell user={state.session.user} breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Medical / Incidents' }]}><Outlet /></AppShell></SessionContext.Provider>;
}
