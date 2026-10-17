import { createContext, type ReactNode } from 'react';
import { createRegistrationService } from './registrationService';
import type { RegistrationService } from './types';

const realService = createRegistrationService();
// A single feature boundary for tests or an Integration Owner-approved shared adapter; no local business store.
// eslint-disable-next-line react-refresh/only-export-components
export const RegistrationContext = createContext<RegistrationService>(realService);
export function RegistrationProvider({ service = realService, children }: { service?: RegistrationService; children: ReactNode }) {
  return <RegistrationContext.Provider value={service}>{children}</RegistrationContext.Provider>;
}
