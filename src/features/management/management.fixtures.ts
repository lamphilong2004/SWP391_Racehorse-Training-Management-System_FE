// Test fixtures only. Production code never imports these records or falls back to them.
import type { AuditEntry, AuditPage, ClubManagerDashboard } from './types';

export const auditEntry: AuditEntry = {
  id: 91, occurredAt: '2026-10-17T06:30:00Z',
  actor: { id: 12, fullName: 'Club Manager Test', userCode: 'U-012' }, actorRole: 'CLUB_MANAGER',
  action: 'REGISTRATION_APPROVED', targetType: 'REGISTRATION', targetId: 7,
  safeSummary: 'Registration approved.', source: 'WEB',
};

export const dashboardFixture: ClubManagerDashboard = {
  horsesByLifecycle: [{ key: 'ACTIVE', count: 8 }, { key: 'DRAFT', count: 1 }, { key: 'INACTIVE', count: 0 }],
  horsesByAvailability: [{ key: 'AVAILABLE', count: 6 }, { key: 'LIMITED', count: 1 }, { key: 'LOCKED', count: 1 }],
  boxOccupancy: { total: 18, occupied: 9, free: 9 },
  accountsByStatus: [{ key: 'ACTIVE', count: 12 }, { key: 'INACTIVE', count: 1 }],
  needsAttention: { pendingActivations: 1, pendingRegistrations: 2 },
  trainingToday: { byStatus: [{ key: 'PLANNED', count: 3 }, { key: 'COMPLETED', count: 1 }] },
  openIncidents: 2, recentAudit: [auditEntry],
};

export const auditPageFixture: AuditPage = { items: [auditEntry], page: 0, size: 20, totalItems: 1, totalPages: 1 };
