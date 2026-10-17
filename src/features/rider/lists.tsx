import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Card, EmptyState, MetricCard, StatusBadge } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RiderApi } from './api';
import { ReadState, RiderShell } from './common';
import { useRiderApi, when } from './data';
import type { RiderSession } from './types';
import styles from './rider.module.css';
import { AssignmentsTable, HistoryTable } from './tables';

function AssignmentRows({ sessions }: { sessions: RiderSession[] }) {
  return sessions.length === 0 ? <EmptyState title="No assigned rides" description="There are no rides for this selection." /> : <div>{sessions.map((ride) => <article key={ride.id} className={styles.row}><div><h3>{ride.horse.name} · {ride.horse.horseCode}</h3><p>{when(ride.scheduledStart)} · {ride.focus || ride.phaseName}</p><p className={styles.muted}>{ride.trainer?.fullName ?? 'Trainer not supplied'} · {ride.sessionCode}</p><StatusBadge family="session" status={ride.status} /> <span>{ride.blocked ? ride.blockedMessage || 'Start blocked' : ride.preCheckResult === 'ALL_NORMAL' ? 'Pre-check cleared' : 'Check pending'}</span></div><Link className={styles.link} to={`/rider/assignments/${ride.id}`}>View Assignment</Link></article>)}</div>;
}
export function RiderDashboardPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><Dashboard api={api} /></RiderShell>;
}
export function RiderAssignmentsPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><AssignmentsTable api={api} /></RiderShell>;
}
/** Figma WR-D1 dashboard (416:9660). The full assignment list lives in tables.tsx (WR-D4). */
function Dashboard({ api }: { api: RiderApi }) {
  const dashboard = true;
  const { handleApiError, user } = useAuth();
  const [items, setItems] = useState<RiderSession[]>();
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api.assignments().then((data) => { if (active) setItems(data); }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    return () => { active = false; };
  }, [api, attempt, handleApiError]);
  const retry = () => { setError(undefined); setItems(undefined); setAttempt((old) => old + 1); };
  const sorted = [...(items ?? [])].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const next = sorted.find((ride) => ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'].includes(ride.status));
  return <div className={styles.stack}><div className={styles.header}><div><h1 className={styles.heading}>{dashboard ? `Good morning, ${user?.fullName}` : 'My Riding Assignments'}</h1><p className={styles.muted}>Only rides returned for your signed-in account are shown.</p></div><div className={styles.actions}><Link className={styles.link} to={dashboard ? '/rider/assignments' : '/rider'}>{dashboard ? 'View all assignments' : 'My Rides'}</Link><Link className={styles.link} to="/rider/history">Riding History</Link></div></div>
    {dashboard && <div className={styles.metrics}><MetricCard label="Assigned rides" value={items ? String(items.length) : '—'} /><MetricCard label="Completed" value={items ? String(items.filter((ride) => ride.status === 'COMPLETED').length) : '—'} /><MetricCard label="Scheduled" value={items ? String(items.filter((ride) => ride.status === 'SCHEDULED').length) : '—'} /><MetricCard label="Attention" value={items ? String(items.filter((ride) => ride.blocked).length) : '—'} /></div>}
    <ReadState error={error} loading={!items} retry={retry} />
    {items && <>{dashboard && next && <Card title="Next ride"><h2>{next.horse.name} · {next.sessionCode}</h2><p>{when(next.scheduledStart)} · {next.phaseName}</p><AlertBanner type={next.blocked ? 'warning' : 'info'} title={next.blocked ? 'Start gate pending' : 'View your assignment'}>{next.blockedMessage || 'Review the instructions and pre-session check before starting.'}</AlertBanner><Link className={styles.link} to={`/rider/assignments/${next.id}`}>View Assignment</Link></Card>}<Card title={dashboard ? 'Your riding schedule' : 'Assignments'}><AssignmentRows sessions={sorted} /></Card></>}
  </div>;
}
export function RiderHistoryPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><HistoryTable api={api} /></RiderShell>;
}
