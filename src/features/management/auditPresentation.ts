import { ROLE_LABELS } from '../../shared/auth/roles';
import type { AuditEntry } from './types';

export function auditDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
}

export function auditClock(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function auditActor(entry: AuditEntry): string {
  return entry.actor?.fullName ?? (entry.actor === null ? 'Automatic backend action' : 'Actor unavailable');
}

export function auditRole(entry: AuditEntry): string {
  return entry.actorRole ? ROLE_LABELS[entry.actorRole] : '—';
}

export function newestAudit(entries: AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id - a.id);
}
