import { useMemo } from 'react';
import { Outlet } from 'react-router';
import { MedicalProvider } from '../medical/runtime';
import { useAuth } from '../../shared/auth/authState';
import { createHttpMedicalService } from './httpMedicalService';

/** Provides the CORE-036 medical runtime from the authenticated session, inside the shared protected shell. */
export function MedicalOutlet() {
  const { user } = useAuth();
  const value = useMemo(
    () => (user ? { actor: { id: user.id, fullName: user.fullName, roles: user.roles, accountStatus: user.accountStatus }, service: createHttpMedicalService() } : null),
    [user],
  );
  if (!value) return null;
  return (
    <MedicalProvider value={value}>
      <div className="medical-stack">
        <Outlet />
      </div>
    </MedicalProvider>
  );
}
