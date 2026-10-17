import { DataTable, EmptyState, type DataTableColumn } from '../../design-system';
import { ROLE_LABELS } from '../../shared/auth/roles';
import type { AuditEntry } from './types';
import styles from './Management.module.css';

function auditTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

const columns: DataTableColumn<AuditEntry>[] = [
  { key: 'time', header: 'Timestamp', render: (row) => <time dateTime={row.occurredAt} title={row.occurredAt}>{auditTime(row.occurredAt)}</time> },
  { key: 'actor', header: 'Actor · Role', render: (row) => <div><strong>{row.actor?.fullName ?? (row.actor === null ? 'Automatic backend action' : 'Actor unavailable')}</strong><small className={styles.secondary}>{row.actorRole ? ROLE_LABELS[row.actorRole] : '—'}{row.actor ? ` · ${row.actor.userCode ?? `#${row.actor.id}`}` : ''}</small></div> },
  { key: 'action', header: 'Action', render: (row) => <span className={styles.code}>{row.action}</span> },
  { key: 'target', header: 'Entity · ID', render: (row) => <span>{row.targetType ?? '—'}{row.targetId != null ? ` · #${row.targetId}` : ''}</span> },
  { key: 'summary', header: 'Change summary', render: (row) => row.safeSummary || '—' },
  { key: 'source', header: 'Source', render: (row) => row.source || '—' },
];

export function AuditTable({ entries, compact = false, caption = 'Audit log, newest first', emptyTitle = 'No audit records' }: { entries: AuditEntry[]; compact?: boolean; caption?: string; emptyTitle?: string }) {
  const sorted = [...entries].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id - a.id);
  return <div className={styles.tableScroll}><DataTable columns={compact ? columns.filter((column) => ['time', 'actor', 'summary'].includes(column.key)) : columns} rows={sorted} rowKey={(row) => row.id} caption={caption} empty={<EmptyState title={emptyTitle} description="Try changing or clearing the filters." />} /></div>;
}
