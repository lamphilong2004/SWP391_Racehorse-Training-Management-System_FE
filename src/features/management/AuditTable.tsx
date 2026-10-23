import { DataTable, EmptyState, type DataTableColumn } from '../../design-system';
import { auditActor, auditClock, auditDate, auditRole, newestAudit } from './auditPresentation';
import type { AuditEntry } from './types';
import styles from './Management.module.css';

const columns: DataTableColumn<AuditEntry>[] = [
  { key: 'time', header: 'Thời điểm', width: '11%', render: (row) => <time dateTime={row.occurredAt} title={row.occurredAt}>{auditDate(row.occurredAt)}<small className={styles.secondary}>{auditClock(row.occurredAt)}</small></time> },
  { key: 'actor', header: 'Người thực hiện · Vai trò', width: '17%', render: (row) => <div><strong>{auditActor(row)}</strong><small className={styles.secondary}>{auditRole(row)}</small></div> },
  { key: 'action', header: 'Thao tác', width: '17%', render: (row) => <span className={styles.code}>{row.action}</span> },
  { key: 'target', header: 'Đối tượng · Mã', width: '16%', render: (row) => <span>{row.targetType ?? '—'}{row.targetId != null && <small className={styles.secondary}>#{row.targetId}</small>}</span> },
  { key: 'summary', header: 'Tóm tắt thay đổi', width: '28%', render: (row) => row.safeSummary || '—' },
  { key: 'source', header: 'Nguồn', width: '11%', render: (row) => <span className={styles.secondary}>{row.source || '—'}</span> },
];

export function AuditTable({ entries, caption = 'Nhật ký hệ thống, mới nhất trước', emptyTitle = 'Chưa có bản ghi nhật ký' }: { entries: AuditEntry[]; caption?: string; emptyTitle?: string }) {
  return <div className={styles.tableScroll}><DataTable className={styles.auditTable} columns={columns} rows={newestAudit(entries)} rowKey={(row) => row.id} caption={caption} empty={<EmptyState title={emptyTitle} description="Hãy đổi hoặc xóa bộ lọc." />} /></div>;
}
