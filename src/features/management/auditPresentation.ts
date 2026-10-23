import { ROLE_LABELS } from '../../shared/auth/roles';
import type { AuditEntry } from './types';

export function auditDate(iso: string): string {
  // Figma 313:5232 uses "20 Oct 2026". Locale controls presentation only;
  // keep the viewer's local timezone and the original instant in <time dateTime/title>.
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function auditClock(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function auditActor(entry: AuditEntry): string {
  return entry.actor?.fullName ?? (entry.actor === null ? 'Thao tác tự động của hệ thống' : 'Không rõ người thực hiện');
}

export function auditRole(entry: AuditEntry): string {
  return entry.actorRole ? ROLE_LABELS[entry.actorRole] : '—';
}

export function newestAudit(entries: AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id - a.id);
}
