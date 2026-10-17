import { ApiError, type CurrentUser } from '../auth/authApi';
import { ROLE_CODES } from '../auth/roles';
import { readSamples, sampleUser } from './sampleStore';
import { readAuditQuery, validateAuditQuery } from '../../features/management/auditQuery';
import type { AuditEntry, ClubManagerDashboard } from '../../features/management/types';

/** Read-only projections of the ONE shared sample graph. Snapshot rows are not backend audit events. */
export function handleManagementSample(path: string, init: RequestInit, user: CurrentUser): { handled: boolean; data?: unknown } {
  const url = new URL(path, 'http://sample.invalid');
  if (!['/api/dashboard/club-manager', '/api/admin/audit-log'].includes(url.pathname)) return { handled: false };
  if (user.accountStatus !== 'ACTIVE' || !user.roles.includes('CLUB_MANAGER')) throw new ApiError(403, 'FORBIDDEN', 'Club Manager access is required.');
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Management samples are read-only.');
  const data = readSamples(), registry = data.horseRegistry!;
  const count = (values: string[], keys = [...new Set(values)]) => keys.map((key) => ({ key, count: values.filter((value) => value === key).length }));
  // Explicit synthetic snapshots: no clinical notes, credentials or fabricated canonical action vocabulary.
  const audit: AuditEntry[] = [
    ...registry.records.map((horse): AuditEntry => ({ id: horse.id * 10 + 1, occurredAt: horse.createdAt, actor: sampleUser('CLUB_MANAGER'), actorRole: 'CLUB_MANAGER', action: 'SAMPLE_HORSE_RECORD', targetType: 'HORSE', targetId: horse.id, safeSummary: `Sample register snapshot: ${horse.horseCode} · ${horse.name}`, source: 'SAMPLE_SNAPSHOT' })),
    ...data.sessions.map(({ session }): AuditEntry => ({ id: session.id * 10 + 2, occurredAt: session.actualEnd ?? session.scheduledStart, actor: session.trainer, actorRole: 'TRAINER', action: 'SAMPLE_SESSION_RECORD', targetType: 'TRAINING_SESSION', targetId: session.id, safeSummary: `Sample session snapshot: ${session.sessionCode} · ${session.status}`, source: 'SAMPLE_SNAPSHOT' })),
    ...data.incidents.map((incident): AuditEntry => ({ id: incident.id * 10 + 3, occurredAt: incident.reportedAt, actor: { id: incident.reportedByUserId, fullName: 'Sample incident reporter' }, actorRole: null, action: 'SAMPLE_INCIDENT_RECORD', targetType: 'INCIDENT', targetId: incident.id, safeSummary: `Sample incident snapshot: ${incident.incidentCode} · ${incident.status}`, source: 'SAMPLE_SNAPSHOT' })),
  ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id - a.id);
  if (url.pathname === '/api/admin/audit-log') {
    const query = readAuditQuery(url.searchParams);
    if (Object.keys(validateAuditQuery(query)).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Check the audit filters.');
    const rows = audit.filter((entry) => (query.actor === undefined || entry.actor?.id === query.actor) && (!query.action || entry.action === query.action) && (!query.targetType || entry.targetType === query.targetType) && (!query.from || Date.parse(entry.occurredAt) >= Date.parse(query.from)) && (!query.to || Date.parse(entry.occurredAt) <= Date.parse(query.to)));
    return { handled: true, data: { items: rows.slice(query.page * query.size, (query.page + 1) * query.size), page: query.page, size: query.size, totalItems: rows.length, totalPages: Math.ceil(rows.length / query.size) } };
  }
  const today = new Date().toDateString();
  const dashboard: ClubManagerDashboard = {
    horsesByLifecycle: count(registry.records.map((horse) => horse.lifecycle), ['DRAFT', 'ACTIVE', 'INACTIVE']),
    horsesByAvailability: count(registry.records.filter((horse) => horse.lifecycle === 'ACTIVE').map((horse) => horse.trainingAvailability), ['AVAILABLE', 'LIMITED', 'LOCKED']),
    boxOccupancy: { total: registry.boxes.length, occupied: registry.boxes.filter((box) => box.status === 'OCCUPIED').length, free: registry.boxes.filter((box) => box.status === 'FREE').length },
    accountsByStatus: count(ROLE_CODES.map((role) => sampleUser(role).accountStatus), ['ACTIVE', 'INACTIVE']),
    needsAttention: { pendingActivations: registry.records.filter((horse) => horse.lifecycle === 'DRAFT').length, pendingRegistrations: 0 },
    trainingToday: { byStatus: count(data.sessions.filter(({ session }) => new Date(session.scheduledStart).toDateString() === today).map(({ session }) => session.status)) },
    openIncidents: data.incidents.filter((incident) => ['REPORTED', 'UNDER_REVIEW'].includes(incident.status)).length,
    recentAudit: audit.slice(0, 10),
  };
  return { handled: true, data: dashboard };
}
