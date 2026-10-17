import { useState } from 'react';
import { useAuth } from '../shared/auth/AuthProvider';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import { readSamples, resetSamples } from '../shared/data/sampleStore';
import { router } from '../app/router';
import { demoEmail } from './demoAuthApi';
import './demo.css';

/** Where each role starts in the demo (role landing per tracker Screen Registry, where the screen exists). */
const LANDING: Record<RoleCode, string> = {
  CLUB_MANAGER: '/dashboard',
  HEAD_TRAINER: '/dashboard',
  TRAINER: '/dashboard',
  WORK_RIDER: '/rider',
  VETERINARIAN: '/incidents',
  GROOM: '/groom/today',
  HORSE_OWNER: '/dashboard',
};

const SHORTCUTS: Partial<Record<RoleCode, { label: string; to: string }[]>> = {
  CLUB_MANAGER: [
    { label: 'Horses', to: '/horses' },
    { label: 'Register horse', to: '/horses/new' },
    { label: 'Pending activation', to: '/horses/pending-activation' },
  ],
  VETERINARIAN: [
    { label: 'Horses', to: '/horses' },
    { label: 'Incidents', to: '/incidents' },
    { label: 'Medical cases', to: '/medical' },
    { label: 'Herd health', to: '/medical/herd-health' },
  ],
  HEAD_TRAINER: [
    { label: 'Create program', to: '/training/programs/new' },
    { label: 'Horses', to: '/horses' },
  ],
  GROOM: [
    { label: 'Today & prechecks', to: '/groom/today' },
    { label: 'Treatment tasks', to: '/medical/my-tasks' },
    { label: 'Incidents', to: '/incidents' },
  ],
  WORK_RIDER: [
    { label: 'My rides', to: '/rider' },
    { label: 'Assignments', to: '/rider/assignments' },
    { label: 'History', to: '/rider/history' },
  ],
};

/**
 * UI DEMO ONLY. Fixed bar: clear "sample data" label, role switcher (simulated identity, no JWT), scenario shortcuts
 * and a reset that only touches the browser-local sample store.
 */
export function DemoBar() {
  const auth = useAuth();
  const role = auth.user?.roles[0];
  const [sessions, setSessions] = useState<{ id: number; code: string; status: string }[]>([]);

  const switchRole = async (next: RoleCode) => {
    await auth.logout();
    await auth.login(demoEmail(next), 'ui-demo', false);
    // Full navigation: avoids racing PublicOnly's own redirect; the tab session restores the simulated identity.
    window.location.assign(LANDING[next]);
  };

  const reset = () => {
    if (!window.confirm('Reset all UI demo sample data to the starting scenario? Only this browser’s sample store is affected.')) return;
    resetSamples();
    window.location.assign(role ? LANDING[role] : '/login');
  };

  const loadSessions = () => setSessions(readSamples().sessions.map(({ session }) => ({ id: session.id, code: session.sessionCode, status: session.status })));

  return (
    <div className="ui-demo-bar" role="region" aria-label="UI demo controls">
      <span className="ui-demo-bar__label">DEV HARNESS — SAMPLE DATA</span>
      <span className="ui-demo-bar__note">Not connected to the backend · simulated sign-in · not FE-BE integration</span>
      <label className="ui-demo-bar__role">
        Role
        <select value={role ?? ''} onChange={(event) => void switchRole(event.target.value as RoleCode)}>
          <option value="" disabled>Choose a role…</option>
          {ROLE_CODES.map((code) => <option key={code} value={code}>{ROLE_LABELS[code]}</option>)}
        </select>
      </label>
      <nav className="ui-demo-bar__links" aria-label="Demo shortcuts">
        {role && (SHORTCUTS[role] ?? []).map((item) => (
          <button key={item.to} type="button" onClick={() => void router.navigate(item.to)}>{item.label}</button>
        ))}
        {role === 'TRAINER' && (
          <details className="ui-demo-bar__menu" onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) loadSessions(); }}>
            <summary>Session results ▾</summary>
            <div className="ui-demo-bar__menu-list">
              {sessions.map((item) => (
                <button key={item.id} type="button" onClick={() => void router.navigate(`/training/sessions/${item.id}/evaluation`)}>{item.code} · {item.status}</button>
              ))}
            </div>
          </details>
        )}
        {role === 'HORSE_OWNER' && <span className="ui-demo-bar__note">Minimum Owner workspace is required (DEC-009); delivery is still pending.</span>}
      </nav>
      <button type="button" className="ui-demo-bar__reset" onClick={reset}>Reset sample data</button>
    </div>
  );
}
