import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, ChartContainer, DataTable, EmptyState, ErrorState, LoadingState, MetricCard, StatusBadge, TextField } from '../../design-system';
import { evaluationPath } from '../../app/routePaths';
import type { EvaluationApi } from './api';
import { metric, RESULT_LABELS, type PerformancePoint } from './models';

/** Plots one server value per session in date order; a series is drawn only when every returned session carries it. */
function SessionSeries({ rows, title, label, unit, pick, step }: { rows: PerformancePoint[]; title: string; label: string; unit: string; pick: (row: PerformancePoint) => number | null | undefined; step: number }) {
  const values = rows.map(pick);
  const complete = values.length > 0 && values.every((value) => typeof value === 'number' && Number.isFinite(value));
  const series = complete ? (values as number[]) : [];
  const min = series.length ? Math.floor(Math.min(...series) / step) * step : 0;
  const max = series.length ? Math.max(Math.ceil(Math.max(...series) / step) * step, min + step) : step;
  return <ChartContainer title={title} seriesLabel={`${label} (${unit}) per session`} values={series} yTicks={[max, (max + min) / 2, min]}
    xLabels={series.length ? [...new Set([rows[0].date, rows.at(-1)!.date])] : []}
    emptyTitle={`No complete ${label.toLowerCase()} series`} emptyDescription={`At least one returned session has no recorded ${label.toLowerCase()}.`} />;
}

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
    <form className="evaluation-filters" noValidate onSubmit={(event) => {
      event.preventDefault();
      if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) { setValidation('Enter a valid date range; From must not be after To.'); return; }
      setValidation(''); setState({}); setRange({ from: from || undefined, to: to || undefined });
    }}><TextField label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><TextField label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} error={validation || undefined} /><Button type="submit">Apply dates</Button></form>
    {state.error ? <ErrorState title="History unavailable" description={state.error} onRetry={() => { setState({}); setAttempt(attempt + 1); }} /> : !state.rows ? <LoadingState label="Loading performance history…" /> :
      <><div className="evaluation-metrics">
        <MetricCard label="Sessions returned" value={String(state.rows.length)} caption={`${state.rows.filter((row) => row.status === 'COMPLETED').length} completed · ${state.rows.filter((row) => row.status === 'INTERRUPTED').length} interrupted`} />
        <MetricCard label="Evaluated" value={String(state.rows.filter((row) => row.result).length)} caption="Trainer evaluation recorded" />
        <MetricCard label="Pending review" value={String(state.rows.filter((row) => !row.result).length)} caption="No trainer evaluation yet" />
        <MetricCard label="Latest session" value={state.rows.at(-1)?.date ?? 'None'} caption={state.rows.at(-1)?.sessionCode ?? 'No sessions in this period'} />
      </div>
      <div className="evaluation-charts">
        <SessionSeries rows={state.rows} title="Peak heart rate" label="Peak heart rate" unit="bpm" step={20} pick={(row) => row.maxHeartRate} />
        <SessionSeries rows={state.rows} title="Average speed" label="Average speed" unit="km/h" step={10} pick={(row) => row.avgSpeedKmh} />
      </div>
      <Card title="Session history"><div className="evaluation-table"><DataTable<PerformancePoint> caption="Session history, newest first" rowKey={(row) => row.sessionId} rows={[...state.rows].reverse()} empty={<EmptyState title="No performance history" description="No sessions were returned for this period." />} columns={[
        { key: 'date', header: 'Date', render: (row) => row.date },
        { key: 'session', header: 'Session', render: (row) => <Link to={evaluationPath(row.sessionId)}>{row.sessionCode}</Link> },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge family="session" status={row.status} /> },
        { key: 'distance', header: 'Distance', render: (row) => metric(row.totalDistanceM, 'm') },
        { key: 'duration', header: 'Duration', render: (row) => metric(row.durationMin, 'min') },
        { key: 'speed', header: 'Average speed', render: (row) => metric(row.avgSpeedKmh, 'km/h') },
        { key: 'hr', header: 'Peak HR', render: (row) => metric(row.maxHeartRate, 'bpm') },
        { key: 'result', header: 'Evaluation', render: (row) => row.result ? RESULT_LABELS[row.result] : 'Pending review' },
      ]} /></div></Card></>}
    <p className="text-caption">Values come from the server. Recovery time and top-speed history are not supplied by this API. Distance aggregation semantics await approval.</p>
  </div>;
}
