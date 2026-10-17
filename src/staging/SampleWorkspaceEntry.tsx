import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertBanner, Button, Card } from '../design-system';
import { useAuth } from '../shared/auth/AuthProvider';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import { resetSamples } from '../shared/data/sampleStore';
import styles from './staging.module.css';

/** Staging-only entry into the existing official router. No accounts/passwords or developer toolbar. */
export function SampleWorkspaceEntry() {
  const auth = useAuth(), navigate = useNavigate(), location = useLocation();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  async function enter(role: RoleCode) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      await auth.login(role, '', false);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from?.startsWith('/') && !from.startsWith('//') ? from : '/dashboard', { replace: true });
    } catch { setMessage('Sample workspace could not open. Try again.'); }
    finally { setBusy(false); }
  }
  return <main className={styles.entry}>
    <Card>
      <p className="text-caption">Racehorse Ops · STAGING SAMPLE</p>
      <h1 className="text-h1">Explore sample workspace</h1>
      <AlertBanner type="info" title="Sample identity and data — no backend connection">This is the official application's sample build. Actions stay in this browser; they do not authenticate a real account or save to SQL Server. Do not enter personal or production data.</AlertBanner>
      <p className="text-body">Choose a role to explore the implemented screens. Unavailable modules remain clearly marked. Use Account menu → Sign out to choose another role.</p>
      {message && <AlertBanner type={message === 'Sample records reset in this browser.' ? 'success' : 'danger'} title={message} />}
      <div className={styles.roles} role="group" aria-label="Sample workspaces">{ROLE_CODES.map((role) => <Button key={role} variant="secondary" size="lg" disabled={busy} onClick={() => void enter(role)}>{ROLE_LABELS[role]}</Button>)}</div>
      <Button variant="tertiary" disabled={busy} onClick={() => { resetSamples(); setMessage('Sample records reset in this browser.'); }}>Reset sample records</Button>
    </Card>
  </main>;
}
