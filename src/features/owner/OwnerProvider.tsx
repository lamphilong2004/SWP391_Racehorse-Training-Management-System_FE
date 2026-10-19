import { createContext, type ReactNode } from 'react';
import type { OwnerService } from './ownerModel';
import { ownerContractPending } from './ownerSampleTransport';

// Explicit integration boundary; default never silently selects sample or invents a real API contract.
// eslint-disable-next-line react-refresh/only-export-components
export const OwnerContext = createContext<OwnerService>(ownerContractPending);
export function OwnerProvider({ service, children }: { service: OwnerService; children: ReactNode }) {
  return <OwnerContext.Provider value={service}>{children}</OwnerContext.Provider>;
}
