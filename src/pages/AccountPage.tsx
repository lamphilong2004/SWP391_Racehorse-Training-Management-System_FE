import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, Card, KeyValue } from '../design-system';
import { AppShell } from '../layout/AppShell';
import { useAuth } from '../shared/auth/AuthProvider';
import { ROUTES } from '../app/routePaths';
import { ROLE_LABELS } from '../shared/auth/roles';

/** Shared account entry from every feature header; identity always comes from canonical backend auth. */
export function AccountPage() {
  const { user, logout } = useAuth(), navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return <AppShell user={{ fullName: user.fullName, role: user.roles[0] }} breadcrumb={[{ label: 'Account' }]}><Card title="Your account">
    <KeyValue label="Name" value={user.fullName} /><KeyValue label="Email" value={user.email} /><KeyValue label="Roles" value={user.roles.map((role) => ROLE_LABELS[role]).join(', ')} />
    <p><Link to={ROUTES.dashboard}>Back to workspace</Link></p>
    <Button disabled={busy} onClick={async () => { if (busy) return; setBusy(true); await logout(); navigate(ROUTES.login, { replace: true }); }}>{busy ? 'Signing out…' : 'Sign out'}</Button>
  </Card></AppShell>;
}
