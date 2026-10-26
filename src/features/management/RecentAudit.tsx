import { EmptyState } from '../../design-system';
import { auditActor, auditClock, auditDate, auditRole, newestAudit } from './auditPresentation';
import type { AuditEntry } from './types';
import { auditActionLabel } from '../../shared/auditLabels';
import styles from './Management.module.css';

export function RecentAudit({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <EmptyState title="Chưa có hoạt động gần đây" description="Hoạt động của hệ thống sẽ hiện ở đây khi có dữ liệu." />;
  return <ul className={styles.recentList} aria-label="Hoạt động gần đây, mới nhất trước">
    {newestAudit(entries).map((entry) => <li key={entry.id}>
      <time dateTime={entry.occurredAt} title={entry.occurredAt}>{auditDate(entry.occurredAt)} · {auditClock(entry.occurredAt)}</time>
      <span className={styles.recentActor}>{auditActor(entry)}{entry.actorRole ? ` · ${auditRole(entry)}` : ''}</span>
      <span><strong>{auditActionLabel(entry.action)}</strong>{entry.safeSummary && <small className={styles.secondary}>{entry.safeSummary}</small>}</span>
    </li>)}
  </ul>;
}
