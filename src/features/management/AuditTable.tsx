import { DataTable, EmptyState, type DataTableColumn } from '../../design-system';
import { auditActor, auditClock, auditDate, auditRole, newestAudit } from './auditPresentation';
import type { AuditEntry } from './types';
import styles from './Management.module.css';

const columns: DataTableColumn<AuditEntry>[] = [
  { key: 'time', header: 'Timestamp', width: '11%', render: (row) => <time dateTime={row.occurredAt} title={row.occurredAt}>{auditDate(row.occurredAt)}<small className={styles.secondary}>{auditClock(row.occurredAt)}</small></time> },
  { key: 'actor', header: 'Actor · Role', width: '17%', render: (row) => <div><strong>{auditActor(row)}</strong><small className={styles.secondary}>{auditRole(row)}</small></div> },
  { key: 'action', header: 'Action', width: '17%', render: (row) => <span className={styles.code}>{row.action}</span> },
  { key: 'target', header: 'Entity · ID', width: '16%', render: (row) => <span>{row.targetType ?? '—'}{row.targetId != null && <small className={styles.secondary}>#{row.targetId}</small>}</span> },
  { key: 'summary', header: 'Change summary', width: '28%', render: (row) => row.safeSummary || '—' },
  { key: 'source', header: 'Source', width: '11%', render: (row) => <span className={styles.secondary}>{row.source || '—'}</span> },
];

export function AuditTable({ entries, caption = 'Audit log, newest first', emptyTitle = 'No audit records' }: { entries: AuditEntry[]; caption?: string; emptyTitle?: string }) {
  return <div className={styles.tableScroll}><DataTable className={styles.auditTable} columns={columns} rows={newestAudit(entries)} rowKey={(row) => row.id} caption={caption} empty={<EmptyState title={emptyTitle} description="Try changing or clearing the filters." />} /></div>;
}
