import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, DataTable, EmptyState, ErrorState, LoadingState, MetricCard, StatusBadge } from '../../design-system';
import { FlowShell } from '../main-flows/FlowShell';
import { useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createSessionApi, type TrainingSession } from './sessionApi';
import { dateTime } from '../evaluation/models';
import styles from '../main-flows/flow.module.css';

export function TrainerDashboardPage() {
  const request = useFlowRequest(), api = useMemo(() => createSessionApi(request), [request]);
  const [range] = useState(() => { const today = new Date(); today.setHours(0, 0, 0, 0); const from = new Date(today); from.setDate(from.getDate() - 7); const end = new Date(today); end.setDate(end.getDate() + 7); return { today: today.toISOString(), from: from.toISOString(), to: end.toISOString() }; });
  const loadSessions = useCallback((signal: AbortSignal) => api.sessions(range.from, range.to, signal), [api, range]);
  const loadPrograms = useCallback((signal: AbortSignal) => api.programs(signal), [api]);
  const sessions = useResource(loadSessions), programs = useResource(loadPrograms);
  const loadReview = useCallback(async (signal: AbortSignal) => {
    if (!sessions.data) return null;
    const details = await Promise.all(sessions.data.filter((item) => ['COMPLETED', 'INTERRUPTED'].includes(item.status)).map((item) => api.read(item.id, signal)));
    return { items: details.filter((item) => item.hasEvaluation === false), unknown: details.some((item) => typeof item.hasEvaluation !== 'boolean') };
  }, [api, sessions.data]);
  const reviewResource = useResource(loadReview);
  const today = sessions.data?.filter((item) => new Date(item.scheduledStart).toDateString() === new Date(range.today).toDateString());
  const upcoming = sessions.data?.filter((item) => item.scheduledStart >= range.today && item.status === 'SCHEDULED');
  const review = reviewResource.data?.items;
  return <FlowShell title="Trainer Dashboard" description="Today’s assigned horses, sessions and training priorities." section="Training" role="TRAINER" actions={<div className={styles.row}><Link to="/training/calendar">View Calendar</Link><Link to="/training/schedule/session/new">+ New Training Session</Link></div>}>
    <div className={styles.metrics}><MetricCard label="Today’s sessions" value={today ? String(today.length) : '—'} caption="Assigned sessions today" /><MetricCard label="Upcoming this week" value={upcoming ? String(upcoming.length) : '—'} caption="Scheduled within the loaded range" /><MetricCard label="Requires review" value={review && !reviewResource.data?.unknown ? String(review.length) : '—'} caption="Evaluation readiness from the server" /><MetricCard label="Assigned programs" value={programs.data ? String(programs.data.totalItems) : '—'} caption="Server-scoped assignments" /></div>
    <div className={styles.columns}><Card title="Today’s Sessions">{sessions.pending && <LoadingState label="Loading sessions…" />}{sessions.error && <ErrorState title="Sessions unavailable" description={sessions.error} onRetry={sessions.reload} />}{today && <div className={styles.table}><DataTable<TrainingSession> caption="Today’s assigned sessions" rows={today} rowKey={(item) => item.id} empty={<EmptyState title="No sessions today" />} columns={[
      { key: 'time', header: 'Time', render: (item) => dateTime(item.scheduledStart) }, { key: 'horse', header: 'Horse', render: (item) => item.horse.name },
      { key: 'session', header: 'Session', render: (item) => item.sessionCode }, { key: 'rider', header: 'Work Rider', render: (item) => item.workRider?.fullName ?? 'Not assigned' },
      { key: 'status', header: 'Status', render: (item) => <StatusBadge family="session" status={item.status} /> }, { key: 'view', header: '', render: (item) => <Link to={`/training/session/${item.id}`}>View Session →</Link> },
    ]} /></div>}</Card><Card title="Attention Required"><div className={styles.stack}><p>Completed and interrupted sessions awaiting your evaluation.</p>{reviewResource.error && <ErrorState title="Evaluation readiness unavailable" description={reviewResource.error} onRetry={reviewResource.reload} />}{reviewResource.data?.unknown && <p>Some session responses do not include evaluation readiness. No pending count is inferred.</p>}{review?.map((item) => <Card key={item.id} title={item.horse.name}><div className={styles.stack}><StatusBadge family="session" status={item.status} /><span>{dateTime(item.scheduledStart)} · {item.sessionCode}</span><Link to={`/training/sessions/${item.id}/evaluation`}>Review</Link></div></Card>)}{review?.length === 0 && !reviewResource.data?.unknown && <EmptyState title="No sessions awaiting review" />}</div></Card></div>
    <Card title="Assigned Horse Training Programs" action={<Link to="/training/programs/assigned">View all Assigned Programs →</Link>}>{programs.pending && <LoadingState label="Loading assignments…" />}{programs.error && <ErrorState title="Programs unavailable" description={programs.error} onRetry={programs.reload} />}<div className={styles.factGrid}>{programs.data?.items.map((item) => <Card title={item.horse.name} key={item.id}><div className={styles.stack}><p>{item.horse.horseCode} · {item.name}</p>{item.trainingAvailability && <StatusBadge family="availability" status={item.trainingAvailability} />}<p>Current phase: {item.currentPhaseName ?? 'Not provided'}</p><Link to={`/training/schedule/session/new?programId=${item.id}`}>Schedule session</Link></div></Card>)}</div>{programs.data?.items.length === 0 && <EmptyState title="No assigned programs" />}</Card>
  </FlowShell>;
}
