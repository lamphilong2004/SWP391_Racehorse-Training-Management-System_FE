import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Card, DataTable, EmptyState, Icon, KeyValue, MetricCard, StatusBadge } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { RiderApi } from './api';
import { ReadState, RiderShell } from './common';
import { useRiderApi } from './data';
import type { RiderSession } from './types';
import styles from './rider.module.css';
import { AssignmentsTable, HistoryTable } from './tables';

export function RiderDashboardPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><Dashboard api={api} /></RiderShell>;
}
export function RiderAssignmentsPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><AssignmentsTable api={api} /></RiderShell>;
}
const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const clock = (iso: string) => (Number.isFinite(Date.parse(iso)) ? CLOCK.format(new Date(iso)) : '—');
const sameDay = (iso: string, day: Date) => { const date = new Date(iso); return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate(); };
const ACTIVE = ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'];
function relative(iso: string, now: number) {
  const minutes = Math.round((Date.parse(iso) - now) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes <= 0) return 'start time reached';
  return minutes < 60 ? `in ${minutes} min` : `in ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
function duration(ride: RiderSession) {
  const minutes = ride.scheduledEnd ? Math.round((Date.parse(ride.scheduledEnd) - Date.parse(ride.scheduledStart)) / 60000) : NaN;
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : 'Duration not supplied';
}
const preCheck = (ride: RiderSession) => ride.preSessionCheck?.overallResult ?? ride.preCheckResult ?? null;
const preCheckText = (ride: RiderSession) => preCheck(ride) === 'ALL_NORMAL' ? 'Pre-session check cleared' : preCheck(ride) === 'ABNORMAL' ? 'Pre-session check abnormal' : 'Pre-session check pending';

/** Figma WR-D1 dashboard (416:9660). The full assignment list lives in tables.tsx (WR-D4). */
function Dashboard({ api }: { api: RiderApi }) {
  const { handleApiError, user } = useAuth();
  const [items, setItems] = useState<RiderSession[]>();
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    api.assignments().then((data) => { if (active) setItems(data); }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    return () => { active = false; };
  }, [api, attempt, handleApiError]);
  const retry = () => { setError(undefined); setItems(undefined); setAttempt((old) => old + 1); };
  const sorted = [...(items ?? [])].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const today = sorted.filter((ride) => sameDay(ride.scheduledStart, new Date(now)));
  const next = sorted.find((ride) => ACTIVE.includes(ride.status));
  const later = today.filter((ride) => ride.id !== next?.id && ride.status === 'SCHEDULED' && Date.parse(ride.scheduledStart) > now);
  return <div className={styles.stack}>
    <div className={styles.header}><div><h1 className={styles.heading}>Good morning, {user?.fullName}</h1><p className={styles.muted}>{items ? `${today.length} ${today.length === 1 ? 'ride' : 'rides'} assigned to you today · ${DAY.format(new Date(now))}` : 'Only rides returned for your signed-in account are shown.'}</p></div>
      <div className={styles.actions}><Link className={styles.secondaryLink} to="/rider/history">Riding History</Link><Link className={styles.secondaryLink} to="/rider/assignments">View all assignments</Link></div></div>
    <div className={styles.metrics}>
      <MetricCard label="Today's rides" value={items ? String(today.length) : '—'} />
      <MetricCard label="Completed" value={items ? String(today.filter((ride) => ride.status === 'COMPLETED').length) : '—'} />
      <MetricCard label="Upcoming" value={items ? String(today.filter((ride) => ride.status === 'SCHEDULED').length) : '—'} />
      <MetricCard label="Attention" value={items ? String(today.filter((ride) => ride.blocked).length) : '—'} />
    </div>
    <ReadState error={error} loading={!items} retry={retry} />
    {items && <>
      <div className={styles.columns}>
        {next ? <Card><div className={styles.smallStack}><p className={styles.eyebrow}>Next ride</p>
          <div className={styles.nextRide}><div className={styles.timeTile}><strong>{clock(next.scheduledStart)}</strong><span>{relative(next.scheduledStart, now)}</span></div>
            <div className={styles.smallStack}><h2 className={styles.rideTitle}>{next.horse.name} · {next.horse.horseCode}</h2><p className={styles.muted}>{next.focus || next.sessionCode} · {next.phaseName}</p>
              <div className={styles.badges}><StatusBadge family="session" status={next.status} />{next.trainingAvailability && <StatusBadge family="availability" status={next.trainingAvailability} />}</div>
              <div className={styles.facts}><KeyValue label="Surface · duration" value={`${next.surface ?? 'Surface not supplied'} · ${duration(next)}`} /><KeyValue label="Trainer" value={next.trainer?.fullName ?? 'Not supplied'} /></div></div></div>
          {!next.blocked && preCheck(next) === 'ALL_NORMAL'
            ? <AlertBanner type="success" title="Ready">Stable pre-session check cleared{next.preSessionCheck ? ` at ${clock(next.preSessionCheck.performedAt)}` : ''}.</AlertBanner>
            : <AlertBanner type="warning" title="Start gate pending">{next.blockedMessage || (preCheck(next) === 'ABNORMAL' ? 'The pre-session check found something abnormal. The session must not start.' : 'Waiting for the stable pre-session check.')}</AlertBanner>}
          <div className={styles.endActions}><Link className={styles.primaryLink} to={`/rider/assignments/${next.id}`}>View Assignment</Link></div></div></Card>
          : <Card><EmptyState title="No upcoming rides" description="You have no scheduled rides." /></Card>}
        <Card><div className={styles.smallStack}><p className={styles.eyebrowMuted}>Later today</p>
          {later.length === 0 ? <p className={styles.muted}>No other rides later today.</p> : later.map((ride) => <div key={ride.id} className={styles.laterRide}><span className={styles.timeChip}>{clock(ride.scheduledStart)}</span><div className={styles.cellStack}><strong>{ride.horse.name} · {ride.horse.horseCode}</strong><span className={styles.muted}>{ride.focus || ride.sessionCode} · {ride.phaseName}</span><span className={styles.muted}>Trainer {ride.trainer?.fullName ?? 'not supplied'}</span><div className={styles.badges}><StatusBadge family="session" status={ride.status} /></div>
            <span className={preCheck(ride) === 'ALL_NORMAL' ? styles.toneSuccess : styles.toneWarning}>{preCheckText(ride)}</span></div></div>)}</div></Card>
      </div>
      <Card title="Today's schedule"><DataTable<RiderSession> caption="Today's schedule" rows={today} rowKey={(ride) => ride.id} empty={<EmptyState title="No rides today" description="Open View all assignments for other days." />} columns={[
        { key: 'time', header: 'Time', render: (ride) => clock(ride.scheduledStart) },
        { key: 'horse', header: 'Horse', render: (ride) => <div className={styles.cellStack}><span className={styles.strong}>{ride.horse.name}</span><span className={styles.caption}>{ride.horse.horseCode}</span></div> },
        { key: 'session', header: 'Session', render: (ride) => ride.focus || ride.sessionCode },
        { key: 'trainer', header: 'Trainer', render: (ride) => ride.trainer?.fullName ?? 'Not supplied' },
        { key: 'status', header: 'Status', render: (ride) => <StatusBadge family="session" status={ride.status} /> },
        { key: 'open', header: 'Open', render: (ride) => <Link className={styles.link} to={`/rider/assignments/${ride.id}`} aria-label={`View Assignment ${ride.sessionCode}`}><Icon name="chevron-right" size={16} /></Link> },
      ]} /></Card>
    </>}
  </div>;
}
export function RiderHistoryPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied);
  return <RiderShell><HistoryTable api={api} /></RiderShell>;
}
