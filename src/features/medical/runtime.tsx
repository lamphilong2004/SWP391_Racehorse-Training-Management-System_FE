import { useEffect, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { AlertBanner, Button } from '../../design-system';
import { AppShell } from '../../layout/AppShell';

import { loadMedicalRuntime } from './runtimeClient';
import { RuntimeContext, useMedicalRuntime, type MedicalRuntime } from './runtimeContext';

export function MedicalProvider({ value, children }: { value: MedicalRuntime; children: ReactNode }) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}
/** Reads the authenticated server session. Never derives identity from query parameters/storage. */
/** Role gate executes before mounting feature pages or making medical requests. */
export function MedicalAccess({ role, children }: { role: 'VETERINARIAN' | 'GROOM'; children?: ReactNode }) {
  const { actor, service } = useMedicalRuntime();
  if (actor.accountStatus !== 'ACTIVE' || !actor.roles.includes(role)) return <AlertBanner type="danger" title="Access denied" />;
  return <AppShell user={{ fullName: actor.fullName, role }} breadcrumb={[{ label: role === 'GROOM' ? 'Treatment care' : 'Medical' }]}>
    <div className="medical-stack">
      {service.mode === 'mock' && <AlertBanner type="simulated" title="Mock medical workspace">Sample data only. Changes are held in memory and reset after reload.</AlertBanner>}
      {children ?? <Outlet />}
    </div>
  </AppShell>;
}
export function MedicalRoute({ role }: { role: 'VETERINARIAN' | 'GROOM' }) {
  const [state, setState] = useState<{ runtime?: MedicalRuntime; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadMedicalRuntime().then((runtime) => { if (active) setState({ runtime }); })
      .catch((error: unknown) => { if (active) setState({ error: error instanceof Error ? error.message : 'Authentication unavailable' }); });
    return () => { active = false; };
  }, [attempt]);
  if (state.error) return <div className="medical-stack"><AlertBanner type="danger" title={state.error} /><Button onClick={() => { setState({}); setAttempt((value) => value + 1); }}>Retry account verification</Button></div>;
  if (!state.runtime) return <p role="status">Verifying account…</p>;
  return <MedicalProvider value={state.runtime}><MedicalAccess role={role} /></MedicalProvider>;
}
