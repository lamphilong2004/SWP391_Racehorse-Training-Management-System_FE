import { createContext, type ReactNode } from 'react';
import { createManagementService } from './managementService';
import type { ManagementService } from './types';
import { ROUTES } from '../../app/routePaths';

/** Leader supplies only canonical destinations whose screens and CM role guards are integrated.
 * Reports intentionally has no entry: it remains deferred. No destination is enabled by default.
 */
export interface ManagementDestinations {
  registerHorse?: '/horses/new';
  createUser?: string;
  rolesPermissions?: { to: typeof ROUTES.rolesPermissions; readOnly: true };
}

const realService = createManagementService();

// The integration owner can inject the shared sample adapter through this single boundary.
// This module neither creates a sample store nor changes shared transport/authentication.
// eslint-disable-next-line react-refresh/only-export-components
export const ManagementContext = createContext<ManagementService>(realService);

// eslint-disable-next-line react-refresh/only-export-components
export const ManagementDestinationsContext = createContext<ManagementDestinations>({});

export function ManagementProvider({ service = realService, destinations = {}, children }: { service?: ManagementService; destinations?: ManagementDestinations; children: ReactNode }) {
  return <ManagementContext.Provider value={service}><ManagementDestinationsContext.Provider value={destinations}>{children}</ManagementDestinationsContext.Provider></ManagementContext.Provider>;
}
