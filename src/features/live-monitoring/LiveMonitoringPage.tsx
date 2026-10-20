import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, ChartContainer, EmptyState, ErrorState, KeyValue, LoadingState, MetricCard, StatusBadge, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { dateTime, metric, type SessionResultView } from '../evaluation/models';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, jsonBody, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createSessionApi, type TrainingSession } from '../trainer-session/sessionApi';
import { connectSessionStream, type StreamStatus } from './sessionStream';
import { AlertDetail, type MonitoringAlertView } from './AlertDetail';
import styles from '../main-flows/flow.module.css';

type Sample = NonNullable<SessionResultView['samples']>[number];
type Alert = SessionResultView['alerts'][number] & { simulated?: boolean };
export function LiveMonitoringPage() {
  const [params, setParams] = useSearchParams(), [selected, setSelected] = useState(params.get('sessionId') ?? '');
  const sessionId = params.get('sessionId');
  return sessionId ? <LiveSession key={sessionId} rawId={sessionId} /> : <FlowShell title="Live Monitoring" section="Training" role="TRAINER"><form className={styles.row} onSubmit={(event) => { event.preventDefault(); if (Number.isSafeInteger(Number(selected)) && Number(selected) > 0) setParams({ sessionId: selected }); }}><TextField label="Session ID" required type="number" min="1" value={selected} onChange={(event) => setSelected(event.target.value)} /><Button type="submit">Open session</Button></form><EmptyState title="Choose a session to monitor" description="Open Live Monitoring from a session detail or enter a server session ID." /><Link to="/training/calendar">Open Training Calendar</Link></FlowShell>;
}
function LiveSession({ rawId }: { rawId: string }) {
  const request = useFlowRequest(), { user } = useAuth(), api = useMemo(() => createSessionApi(request), [request]);
  const load = useCallback(async (signal: AbortSignal) => {
    const sessionId = idOf(rawId);
    const [session, result] = await Promise.all([api.read(sessionId, signal), api.result(sessionId, signal)]);
    return { session, result };
  }, [api, rawId]);
  const resource = useResource(load);
  const loadThresholds = useCallback((signal: AbortSignal) => resource.data && user?.roles.some((role) => ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN'].includes(role)) ? request<{ metricType: string; thresholdValue: number; scope: string }[]>(`/api/horses/${resource.data.session.horse.id}/medical-thresholds`, { signal }) : Promise.resolve(null), [request, resource.data, user?.roles]);
  const thresholds = useResource(loadThresholds);
  const threshold = thresholds.data?.find((item) => item.metricType === 'HEART_RATE' && Number.isFinite(item.thresholdValue) && item.thresholdValue > 0);
  const [overlay, setOverlay] = useState<{ source?: typeof resource.data; sample?: Sample; state?: 'NORMAL' | 'WARNING' | 'CRITICAL'; samples: Sample[]; alerts: Alert[]; warning?: MonitoringAlertView; simulated?: boolean; session?: Partial<TrainingSession> }>({ samples: [], alerts: [] });
  const [connection, setConnection] = useState<{ source?: typeof resource.data; status: StreamStatus; message?: string }>({ status: 'Disconnected' });
  const [selectedAlert, setSelectedAlert] = useState<number | 'warning'>();
  const [actionError, setActionError] = useState(''), [busy, setBusy] = useState(false), [reason, setReason] = useState(''); const pending = useRef(false);
  useEffect(() => {
    const source = resource.data; if (!source) return;
    const token = authSession.read()?.accessToken;
    if (!token) return;
    try {
      return connectSessionStream({ sessionId: idOf(rawId), token,
        onStatus: (status, message) => setConnection({ source, status, message }),
        onEvent: ({ topic, data }) => {
          if (topic === 'metrics' && typeof data.recordedAt === 'string' && ['MANUAL', 'SIMULATOR'].includes(String(data.source))) {
            const validMetric = (value: unknown) => value == null || (typeof value === 'number' && Number.isFinite(value));
            if (![data.heartRate, data.speedKmh, data.distanceM].every(validMetric)) return;
            const sample: Sample = { recordedAt: data.recordedAt, source: data.source as Sample['source'], heartRate: data.heartRate as number | null, speedKmh: data.speedKmh as number | null, distanceM: data.distanceM as number | null };
            if (!Number.isFinite(Date.parse(sample.recordedAt))) return;
            setOverlay((previous) => {
              const prior = previous.source === source ? previous : { source, samples: [], alerts: [] };
              if (prior.sample && Date.parse(sample.recordedAt) <= Date.parse(prior.sample.recordedAt)) return prior;
              return { ...prior, source, sample, simulated: prior.simulated || data.simulated === true, samples: [...prior.samples, sample].slice(-300), state: ['NORMAL', 'WARNING', 'CRITICAL'].includes(String(data.realtimeState)) ? data.realtimeState as 'NORMAL' | 'WARNING' | 'CRITICAL' : prior.state };
            });
          } else if (topic === 'state' && ['SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED'].includes(String(data.status))) {
            setOverlay((previous) => ({ ...(previous.source === source ? previous : { samples: [], alerts: [] }), source, session: { status: data.status as TrainingSession['status'], ...(typeof data.blocked === 'boolean' ? { blocked: data.blocked } : {}), ...(typeof data.interruptionReason === 'string' ? { interruptionReason: data.interruptionReason } : {}) } }));
          } else if (topic === 'alerts' && data.type === 'WARNING' && (data.severity === undefined || data.severity === 'WARNING')) {
            setOverlay((previous) => ({ ...(previous.source === source ? previous : { samples: [], alerts: [] }), source, state: 'WARNING', warning: { sessionId: idOf(rawId), severity: 'WARNING', metric: typeof data.metric === 'string' ? data.metric : undefined, metricValue: typeof data.metricValue === 'number' && Number.isFinite(data.metricValue) ? data.metricValue : undefined, thresholdApplied: typeof data.thresholdApplied === 'number' && Number.isFinite(data.thresholdApplied) ? data.thresholdApplied : undefined, raisedAt: typeof data.raisedAt === 'string' ? data.raisedAt : undefined, simulated: data.simulated === true }, simulated: previous.source === source && previous.simulated || data.simulated === true }));
           } else if (topic === 'alerts' && ['CRITICAL_RAISED', 'CRITICAL_ACKNOWLEDGED', 'CRITICAL_ESCALATED'].includes(String(data.type)) && Number.isSafeInteger(data.alertId) && Number(data.alertId) > 0 && (data.severity === undefined || data.severity === 'CRITICAL') && (data.metric === undefined || data.metric === 'HEART_RATE')) {
            setOverlay((previous) => {
              const prior = previous.source === source ? previous : { samples: [], alerts: [] };
              const existing = prior.alerts.find((item) => item.id === data.alertId) ?? source.result.alerts.find((item) => item.id === data.alertId);
              const alert: Alert = { ...existing, id: Number(data.alertId), sessionId: idOf(rawId), metric: 'HEART_RATE', severity: 'CRITICAL',
                metricValue: typeof data.metricValue === 'number' ? data.metricValue : existing?.metricValue ?? NaN,
                thresholdApplied: typeof data.thresholdApplied === 'number' ? data.thresholdApplied : existing?.thresholdApplied ?? NaN,
                raisedAt: typeof data.raisedAt === 'string' ? data.raisedAt : existing?.raisedAt ?? '',
                ...(typeof data.simulated === 'boolean' ? { simulated: data.simulated } : {}),
                ...(typeof data.acknowledgedAt === 'string' || data.acknowledgedAt === null ? { acknowledgedAt: data.acknowledgedAt } : {}),
                ...(data.acknowledgedBy === null || data.acknowledgedBy && typeof data.acknowledgedBy === 'object' && typeof (data.acknowledgedBy as Record<string, unknown>).fullName === 'string' ? { acknowledgedBy: data.acknowledgedBy as Alert['acknowledgedBy'] } : {}),
                ...(typeof data.actionTaken === 'string' || data.actionTaken === null ? { actionTaken: data.actionTaken } : {}),
                ...(typeof data.escalatedToVetAt === 'string' || data.escalatedToVetAt === null ? { escalatedToVetAt: data.escalatedToVetAt } : {}),
              };
              if (!Number.isFinite(alert.metricValue) || !Number.isFinite(alert.thresholdApplied) || !Number.isFinite(Date.parse(alert.raisedAt))) return prior;
              return { ...prior, source, simulated: prior.simulated || data.simulated === true, alerts: [...prior.alerts.filter((item) => item.id !== alert.id), alert], ...(data.type === 'CRITICAL_RAISED' ? { state: 'CRITICAL' as const } : {}) };
            });
          }
        },
      });
    } catch (error) { queueMicrotask(() => setConnection({ source, status: 'Unavailable', message: errorMessage(error) })); }
  }, [resource.data, rawId]);
  const current = overlay.source === resource.data ? overlay : undefined;
  const data = resource.data, session = data ? { ...data.session, ...current?.session } : undefined;
  const live = connection.source === data && connection.status === 'Connected';
  const samples = [...(data?.result.samples ?? []), ...(current?.samples ?? [])].filter((item, index, all) => all.findIndex((value) => value.recordedAt === item.recordedAt) === index).sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)).slice(-300);
  const last = current?.sample ?? samples.at(-1);
  const simulated = current?.simulated || samples.some((item) => item.source === 'SIMULATOR') || data?.result.actual.simulated;
  const alerts = [...(data?.result.alerts ?? []).filter((item) => !current?.alerts.some((value) => value.id === item.id)), ...(current?.alerts ?? [])].sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt));
  const values = samples.map((item) => item.heartRate).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const max = Math.ceil(Math.max(1, threshold?.thresholdValue ?? 0, ...values) / 20) * 20, min = Math.max(0, Math.floor(Math.min(max, ...values) / 20) * 20 - 20);
  const canWrite = user?.roles.includes('TRAINER'), canAck = canWrite || user?.roles.includes('VETERINARIAN');
  async function action(kind: 'pause' | 'resume' | 'stop' | 'acknowledge', alertId?: number) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setActionError('');
    try {
      if (kind === 'stop' && !reason.trim()) throw new Error('Give the reason for stopping the session.');
      const path = kind === 'acknowledge' ? `/api/monitoring-alerts/${idOf(alertId)}/acknowledge` : `/api/training-sessions/${idOf(rawId)}/${kind}`;
      await request(path, (kind === 'pause' || kind === 'resume') ? { method: 'POST' } : jsonBody('POST', kind === 'acknowledge' ? { action: 'ACKNOWLEDGE' } : { reason: reason.trim(), medicallyRelevant: false }));
      resource.reload();
    } catch (error) { setActionError(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  const role = user?.roles.find((value) => ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER'].includes(value)) ?? 'TRAINER';
  return <FlowShell title={session ? `${session.horse.name} · ${session.horse.horseCode}` : 'Live Monitoring'} description={session ? `${session.sessionCode} · ${session.focus ?? session.phaseName} · Work Rider ${session.workRider?.fullName ?? 'Not assigned'}` : undefined} section="Live Monitoring" role={role} actions={<div className={styles.row}><span role="status">{live ? 'Connected' : connection.source === data ? connection.status : 'Loading REST data'}</span><Button variant="secondary" onClick={resource.reload}>Reconnect / reload</Button><Link to={`/training/session/${rawId}`}>Session Detail</Link></div>}>
    {resource.pending && <LoadingState label="Loading recorded session and samples before connecting…" />}{resource.error && <ErrorState title="Monitoring unavailable" description={resource.error} onRetry={resource.reload} />}
    {actionError && <AlertBanner type="danger" title="Action not confirmed">{actionError}</AlertBanner>}
    {connection.source === data && connection.message && <AlertBanner type="warning" title="Realtime unavailable">{connection.message}</AlertBanner>}
    {simulated && <AlertBanner type="simulated" title="SIMULATED DEMO DATA">The server marked samples or alerts as simulated. They are not real training data.</AlertBanner>}
    {session && <div className={styles.row}><StatusBadge family="session" status={session.status} /><StatusBadge family="availability" status={session.trainingAvailability} />{current?.state && <StatusBadge family="realtime" status={current.state} />}<span>{last ? `${live ? 'Last sample' : 'Last recorded sample'}: ${dateTime(last.recordedAt)} · ${last.source}` : 'No telemetry received.'}</span></div>}
    {current?.state && <AlertBanner type={current.state === 'CRITICAL' ? 'danger' : current.state === 'WARNING' ? 'warning' : 'success'} title={`${current.state} · server classification`}>{live ? 'Classification received from the realtime server.' : 'Last received classification; realtime is disconnected.'}</AlertBanner>}
    <div className={styles.metrics}><MetricCard label="Heart rate" value={metric(last?.heartRate, 'bpm')} caption="Last server sample" /><MetricCard label="Speed" value={metric(last?.speedKmh, 'km/h')} caption="Last server sample" /><MetricCard label="Distance" value={metric(last?.distanceM, 'm')} caption="Server distance value" /><MetricCard label="Elapsed time" value={metric(data?.result.actual.durationMin, 'min')} caption="Recorded duration from server" /></div>
    <div className={styles.columns}><div className={styles.stack}><ChartContainer title="Heart rate — this session" seriesLabel="Heart rate (bpm)" values={values} yTicks={[max, (max + min) / 2, min]} threshold={threshold ? { value: threshold.thresholdValue, label: `Current critical ${threshold.thresholdValue} bpm` } : undefined} xLabels={samples.length ? [dateTime(samples[0].recordedAt), dateTime(samples[samples.length - 1].recordedAt)] : []} emptyTitle="No heart-rate samples" emptyDescription="Recorded and live server samples appear here when available." /><Card title="Session progress"><div className={styles.stack}>{session?.exercises?.map((item) => <div className={styles.row} key={item.id}><strong>{item.exerciseName}</strong><span>{metric(item.distanceM, 'm')} · {item.intensity ?? 'Not specified'}</span></div>)}{!session?.exercises?.length && <EmptyState title="No exercise plan returned" />}<p className="text-caption">Current repetition and exercise completion have no approved event fields here; no progress is inferred. The chart retains the latest 300 samples.</p></div></Card></div>
    <div className={styles.stack}><Card title="Alerts"><div className={styles.stack}>{alerts.map((alert) => <AlertBanner key={alert.id} type="danger" title={`CRITICAL · ${metric(alert.metricValue, 'bpm')}`}><p>{dateTime(alert.raisedAt)} · Applied threshold {alert.thresholdApplied} bpm</p><Button variant="tertiary" onClick={() => { setActionError(''); setSelectedAlert(alert.id); }}>View alert {alert.id}</Button>{alert.acknowledgedAt ? <p>Acknowledged {dateTime(alert.acknowledgedAt)}</p> : canAck && <Button disabled={busy} variant="secondary" onClick={() => void action('acknowledge', alert.id)}>Acknowledge alert</Button>}</AlertBanner>)}{current?.warning && <AlertBanner type="warning" title="WARNING · transient alert"><Button variant="tertiary" onClick={() => { setActionError(''); setSelectedAlert('warning'); }}>View warning details</Button></AlertBanner>}{!alerts.length && <EmptyState title={data ? 'No recorded critical alerts' : 'Alert data unavailable'} />}</div></Card><Card title="Thresholds"><div className={styles.stack}>{thresholds.error && <ErrorState title="Threshold unavailable" description={thresholds.error} onRetry={thresholds.reload} />}<KeyValue label="Current effective critical threshold" value={threshold ? `${threshold.thresholdValue} bpm · ${threshold.scope}` : 'Not provided'} /><KeyValue label="Warning threshold" value="Not provided; no formula applied" /><p>Thresholds come from CORE-019. Each recorded alert retains its own thresholdApplied value.</p></div></Card></div></div>
    {canWrite && session && ['IN_PROGRESS', 'PAUSED'].includes(session.status) && <Card title="Trainer actions"><div className={styles.stack}><TextAreaField label="Stop reason" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /><div className={styles.row}><Button disabled={busy || session.status !== 'IN_PROGRESS'} variant="secondary" onClick={() => void action('pause')}>Pause session</Button><Button disabled={busy || session.status !== 'PAUSED' || session.blocked || session.trainingAvailability === 'LOCKED'} variant="secondary" onClick={() => void action('resume')}>Resume session</Button><Button disabled={busy || !reason.trim()} variant="destructive" onClick={() => void action('stop')}>Stop session</Button></div></div></Card>}
    <AlertDetail alert={selectedAlert === 'warning' ? current?.warning : alerts.find((item) => item.id === selectedAlert)} horse={session ? `${session.horse.name} · ${session.horse.horseCode}` : undefined} canAcknowledge={!!canAck} busy={busy} error={actionError} onClose={() => setSelectedAlert(undefined)} onAcknowledge={(id) => void action('acknowledge', id)} />
  </FlowShell>;
}
