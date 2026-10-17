import { ManagementProvider } from './ManagementProvider';
import { ClubManagerDashboardEntry } from './routes';
import { AuditLogPage } from './AuditLogPage';

// Only the real, CM-authorized registration screen is enabled. Users/roles/registrations are still undelivered.
export function ManagementDashboard() {
  return <ManagementProvider destinations={{ registerHorse: '/horses/new' }}><ClubManagerDashboardEntry /></ManagementProvider>;
}

export function ManagementAudit() {
  return <ManagementProvider><AuditLogPage /></ManagementProvider>;
}
