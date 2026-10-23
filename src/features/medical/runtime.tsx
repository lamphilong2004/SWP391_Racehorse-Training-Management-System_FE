import { UiPreviewNotice } from './UiPreviewNotice';
import { useMemo, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { AlertBanner } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { createMedicalService } from './service';

import { RuntimeContext, type MedicalRuntime } from './runtimeContext';

export function MedicalProvider({ value, children }: { value: MedicalRuntime; children: ReactNode }) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}
/** Role gate executes before mounting feature pages or making medical requests. */
export function MedicalAccess({ children }: { children?: ReactNode }) {
  const auth = useAuth();
  const actor = auth.user;
  const token = authSession.read()?.accessToken;
  const runtime = useMemo(() => actor && token ? { actor, service: createMedicalService(token, auth.handleApiError) } : null,
    [actor, token, auth.handleApiError]);
  if (auth.status !== 'authenticated' || !actor || actor.accountStatus !== 'ACTIVE' || !actor.roles.includes('VETERINARIAN'))
    return <AlertBanner type="danger" title="Không có quyền truy cập" />;
  if (!runtime) return <AlertBanner type="danger" title="Đăng nhập lại để truy cập phần y tế" />;
  return <MedicalProvider key={`${actor.id}:${auth.expiresAt}`} value={runtime}>
    <MedicalShell actor={actor}>{children}</MedicalShell>
  </MedicalProvider>;
}

function MedicalShell({ actor, children }: { actor: MedicalRuntime['actor']; children?: ReactNode }) {
  return <AppShell user={{ fullName: actor.fullName, role: 'VETERINARIAN' }} breadcrumb={[{ label: 'Y tế' }]}>
    <div className="medical-stack">
      <UiPreviewNotice />
      {children ?? <Outlet />}
    </div>
  </AppShell>;
}
