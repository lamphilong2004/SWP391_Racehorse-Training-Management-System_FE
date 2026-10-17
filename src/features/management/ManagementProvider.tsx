import { createContext, type ReactNode } from 'react';
import { createManagementService } from './managementService';
import type { ManagementService } from './types';

// The integration owner can inject the shared sample adapter through this single boundary.
// This module neither creates a sample store nor changes shared transport/authentication.
// eslint-disable-next-line react-refresh/only-export-components
export const ManagementContext = createContext<ManagementService>(createManagementService());

export function ManagementProvider({ service, children }: { service: ManagementService; children: ReactNode }) {
  return <ManagementContext.Provider value={service}>{children}</ManagementContext.Provider>;
}
