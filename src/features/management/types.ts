import type { RoleCode } from '../../shared/auth/roles';

/** CORE-003 shared.openapi.yaml: read-only management summaries; no clinical details. */
export interface AuditEntry {
  id: number;
  occurredAt: string;
  actor?: { id: number; fullName: string; userCode?: string } | null;
  actorRole?: RoleCode | null;
  action: string;
  targetType?: string | null;
  targetId?: number | null;
  safeSummary?: string | null;
  source?: string | null;
}

export interface CountByKey { key: string; count: number }
export interface ClubManagerDashboard {
  horsesByLifecycle: CountByKey[];
  horsesByAvailability: CountByKey[];
  boxOccupancy: { total: number; occupied: number; free: number };
  accountsByStatus: CountByKey[];
  needsAttention: { pendingActivations: number; pendingRegistrations: number };
  trainingToday: { byStatus: CountByKey[] };
  openIncidents: number;
  recentAudit: AuditEntry[];
}

export interface AuditPage {
  items: AuditEntry[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface AuditQuery {
  actor?: number;
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
  page: number;
  size: number;
}

export interface ManagementRequest { token: string; signal?: AbortSignal }
export interface ManagementService {
  dashboard(context: ManagementRequest): Promise<ClubManagerDashboard>;
  audit(query: AuditQuery, context: ManagementRequest): Promise<AuditPage>;
}
