import { EmptyState } from '../../design-system';
import { auditActor, auditClock, auditDate, auditRole, newestAudit } from './auditPresentation';
import type { AuditEntry } from './types';
import styles from './Management.module.css';

export function RecentAudit({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <EmptyState title="No recent audit activity" description="System activity will appear here when records are available." />;
  return <ul className={styles.recentList} aria-label="Recent audit activity, newest first">
    {newestAudit(entries).map((entry) => <li key={entry.id}>
      <time dateTime={entry.occurredAt} title={entry.occurredAt}>{auditDate(entry.occurredAt)} · {auditClock(entry.occurredAt)}</time>
      <span className={styles.recentActor}>{auditActor(entry)}{entry.actorRole ? ` · ${auditRole(entry)}` : ''}</span>
      <span>{entry.safeSummary || '—'}</span>
    </li>)}
  </ul>;
}
