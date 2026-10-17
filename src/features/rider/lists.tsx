import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, MetricCard, SelectField, StatusBadge } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RiderApi, RiderHistory } from './api';
import { ReadState, RiderShell } from './common';
import { useRiderApi, when } from './data';
import type { RiderSession } from './types';
import styles from './rider.module.css';

function AssignmentRows({ sessions }: { sessions: RiderSession[] }) {
  return sessions.length === 0 ? <EmptyState title="No assigned rides" description="There are no rides for this selection." /> : <div>{sessions.map((ride) => <article key={ride.id} className={styles.row}><div><h3>{ride.horse.name} · {ride.horse.horseCode}</h3><p>{when(ride.scheduledStart)} · {ride.focus || ride.phaseName}</p><p className={styles.muted}>{ride.trainer?.fullName ?? 'Trainer not supplied'} · {ride.sessionCode}</p><StatusBadge family="session" status={ride.status} /> <span>{ride.blocked ? ride.blockedMessage || 'Start blocked' : ride.preCheckResult === 'ALL_NORMAL' ? 'Pre-check cleared' : 'Check pending'}</span></div><Link className={styles.link} to={`/rider/assignments/${ride.id}`}>View Assignment</Link></article>)}</div>;
}
export function RiderDashboardPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><Assignments api={api} dashboard /></RiderShell>;
}
export function RiderAssignmentsPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><Assignments api={api} /></RiderShell>;
}
function Assignments({ api, dashboard = false }: { api: RiderApi; dashboard?: boolean }) {
  const { handleApiError, user } = useAuth();
  const [items, setItems] = useState<RiderSession[]>();
  const [error, setError] = useState<unknown>();
  const [status, setStatus] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api.assignments(status || undefined).then((data) => { if (active) setItems(data); }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    return () => { active = false; };
  }, [api, status, attempt, handleApiError]);
  const retry = () => { setError(undefined); setItems(undefined); setAttempt((old) => old + 1); };
  const sorted = [...(items ?? [])].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const next = sorted.find((ride) => ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'].includes(ride.status));
  return <div className={styles.stack}><div className={styles.header}><div><h1 className={styles.heading}>{dashboard ? `Good morning, ${user?.fullName}` : 'My Riding Assignments'}</h1><p className={styles.muted}>Only rides returned for your signed-in account are shown.</p></div><div className={styles.actions}><Link className={styles.link} to={dashboard ? '/rider/assignments' : '/rider'}>{dashboard ? 'View all assignments' : 'My Rides'}</Link><Link className={styles.link} to="/rider/history">Riding History</Link></div></div>
    {dashboard && <div className={styles.metrics}><MetricCard label="Assigned rides" value={items ? String(items.length) : '—'} /><MetricCard label="Completed" value={items ? String(items.filter((ride) => ride.status === 'COMPLETED').length) : '—'} /><MetricCard label="Scheduled" value={items ? String(items.filter((ride) => ride.status === 'SCHEDULED').length) : '—'} /><MetricCard label="Attention" value={items ? String(items.filter((ride) => ride.blocked).length) : '—'} /></div>}
    {!dashboard && <SelectField label="Session status" value={status} onChange={(event) => { setItems(undefined); setError(undefined); setStatus(event.target.value); }} options={[{ value: '', label: 'Upcoming and active' }, ...['SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))]} />}
    <ReadState error={error} loading={!items} retry={retry} />
    {items && <>{dashboard && next && <Card title="Next ride"><h2>{next.horse.name} · {next.sessionCode}</h2><p>{when(next.scheduledStart)} · {next.phaseName}</p><AlertBanner type={next.blocked ? 'warning' : 'info'} title={next.blocked ? 'Start gate pending' : 'View your assignment'}>{next.blockedMessage || 'Review the instructions and pre-session check before starting.'}</AlertBanner><Link className={styles.link} to={`/rider/assignments/${next.id}`}>View Assignment</Link></Card>}<Card title={dashboard ? 'Your riding schedule' : 'Assignments'}><AssignmentRows sessions={sorted} /></Card></>}
  </div>;
}
export function RiderHistoryPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><History api={api} /></RiderShell>;
}
function History({ api }: { api: RiderApi }) {
  const { handleApiError } = useAuth();
  const [data, setData] = useState<RiderHistory>();
  const [error, setError] = useState<unknown>();
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api.history(page).then((result) => { if (active) setData(result); }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    return () => { active = false; };
  }, [api, page, attempt, handleApiError]);
  const changePage = (next: number) => { setData(undefined); setError(undefined); setPage(next); };
  return <div className={styles.stack}><div className={styles.header}><h1 className={styles.heading}>My Riding History</h1><Link className={styles.link} to="/rider">My Rides</Link></div><p className={styles.muted}>Your completed and interrupted rides. Horse performance trends are reviewed by your Trainer.</p><ReadState error={error} loading={!data} retry={() => { setError(undefined); setAttempt((old) => old + 1); }} />{data && <Card title={`${data.totalItems} rides`}><AssignmentRows sessions={data.items} /><div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => changePage(page - 1)}>Previous</Button><span>Page {page + 1} of {Math.max(1, data.totalPages)}</span><Button variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => changePage(page + 1)}>Next</Button></div></Card>}</div>;
}
