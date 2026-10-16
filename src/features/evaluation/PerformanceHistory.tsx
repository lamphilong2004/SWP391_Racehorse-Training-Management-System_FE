import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, DataTable, EmptyState, ErrorState, LoadingState, StatusBadge, TextField } from '../../design-system';
import { evaluationPath } from '../../app/routePaths';
import type { EvaluationApi } from './api';
import { metric, RESULT_LABELS, type PerformancePoint } from './models';

/** Only contract fields are shown: no invented recovery, phase filters, top-speed history or aggregates. */
export function PerformanceHistory({ horseId, api, onError }: { horseId: number; api: EvaluationApi; onError: (error: unknown) => boolean }) {
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ rows?: PerformancePoint[]; error?: string }>({});
  const [validation, setValidation] = useState('');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.performance(horseId, range, controller.signal).then((rows) => {
      if (active) setState({ rows });
    }).catch((error: unknown) => { if (active && !onError(error)) setState({ error: error instanceof Error ? error.message : 'Unable to load history.' }); });
    return () => { active = false; controller.abort(); };
  }, [horseId, api, range, attempt, onError]);
  return <div className="evaluation-stack"><h2 className="text-h2">Performance History</h2>
    <form className="evaluation-actions" noValidate onSubmit={(event) => {
      event.preventDefault();
      if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) { setValidation('Enter a valid date range; From must not be after To.'); return; }
      setValidation(''); setState({}); setRange({ from: from || undefined, to: to || undefined });
    }}><TextField label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><TextField label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} error={validation || undefined} /><Button type="submit">Apply dates</Button></form>
    {state.error ? <ErrorState title="History unavailable" description={state.error} onRetry={() => { setState({}); setAttempt(attempt + 1); }} /> : !state.rows ? <LoadingState label="Loading performance history…" /> :
      <Card title="Session history"><div className="evaluation-table"><DataTable<PerformancePoint> caption="Session history, newest first" rowKey={(row) => row.sessionId} rows={[...state.rows].reverse()} empty={<EmptyState title="No performance history" description="No sessions were returned for this period." />} columns={[
        { key: 'date', header: 'Date', render: (row) => row.date },
        { key: 'session', header: 'Session', render: (row) => <Link to={evaluationPath(row.sessionId)}>{row.sessionCode}</Link> },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge family="session" status={row.status} /> },
        { key: 'distance', header: 'Distance', render: (row) => metric(row.totalDistanceM, 'm') },
        { key: 'duration', header: 'Duration', render: (row) => metric(row.durationMin, 'min') },
        { key: 'speed', header: 'Average speed', render: (row) => metric(row.avgSpeedKmh, 'km/h') },
        { key: 'hr', header: 'Peak HR', render: (row) => metric(row.maxHeartRate, 'bpm') },
        { key: 'result', header: 'Evaluation', render: (row) => row.result ? RESULT_LABELS[row.result] : 'Pending review' },
      ]} /></div></Card>}
    <p className="text-caption">Values come from the server. Recovery time and top-speed history are not supplied by this API. Distance aggregation semantics await approval.</p>
  </div>;
}
