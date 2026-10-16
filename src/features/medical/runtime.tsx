import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { AlertBanner } from '../../design-system';
import { AppShell } from '../../layout/AppShell';

import { RuntimeContext, useMedicalRuntime, type MedicalRuntime } from './runtimeContext';

export function MedicalProvider({ value, children }: { value: MedicalRuntime; children: ReactNode }) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}
/** Role gate executes before mounting feature pages or making medical requests. */
export function MedicalAccess({ children }: { children?: ReactNode }) {
  const { actor } = useMedicalRuntime();
  if (actor.accountStatus !== 'ACTIVE' || !actor.roles.includes('VETERINARIAN')) return <AlertBanner type="danger" title="Access denied" />;
  return <AppShell user={{ fullName: actor.fullName, role: 'VETERINARIAN' }} breadcrumb={[{ label: 'Medical' }]}>
    <div className="medical-stack">
      {children ?? <Outlet />}
    </div>
  </AppShell>;
}
