import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertBanner, Button, Card } from '../design-system';
import { useAuth } from '../shared/auth/AuthProvider';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import styles from './staging.module.css';

/** Protected Preview only: choose one of the seven roles to inspect the official UI. No accounts, passwords or data. */
export function RoleTestEntry() {
  const auth = useAuth(), navigate = useNavigate(), location = useLocation();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  async function enter(role: RoleCode) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      await auth.login(role, '', false);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from?.startsWith('/') && !from.startsWith('//') ? from : '/dashboard', { replace: true });
    } catch { setMessage('The role workspace could not open. Try again.'); }
    finally { setBusy(false); }
  }
  return <main className={styles.entry}>
    <Card>
      <p className="text-caption">Racehorse Ops · PROTECTED TEST ENVIRONMENT</p>
      <h1 className="text-h1">Role test sign-in</h1>
      <AlertBanner type="warning" title="UI inspection only — no server access">A test role is not a server account. Screens that need the server show an error, and no record is created, changed or saved. Do not enter personal or production data.</AlertBanner>
      <p className="text-body">Choose a role to inspect its workspace. Use Account menu → Sign out to choose another role.</p>
      {message && <AlertBanner type="danger" title={message} />}
      <div className={styles.roles} role="group" aria-label="Test roles">{ROLE_CODES.map((role) => <Button key={role} variant="secondary" size="lg" disabled={busy} onClick={() => void enter(role)}>{ROLE_LABELS[role]}</Button>)}</div>
    </Card>
  </main>;
}
