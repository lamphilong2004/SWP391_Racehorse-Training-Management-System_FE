import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, ChartContainer, DataTable, EmptyState, KeyValue, MetricCard, SelectField, StatusBadge, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { useAction, useApi } from '../../shared/hooks/useApi';
import { useSessionStream, type AlertFrame } from '../../shared/realtime/useSessionStream';
import { ActionError, Grid, Resource, Row, Stack } from '../../shared/ui/common';
import { INTENSITY_LABEL, INTENSITY_OPTIONS, fmtDateTime, fmtTime } from '../../shared/ui/format';
import { trainingApi, type SessionSummary } from '../demoApi';
import { SessionStatusBadge } from './SessionStatusBadge';

/** SCR-TRAIN-011 Live Monitoring index: the Trainer's live sessions. */
export function MonitoringIndexPage() {
  const navigate = useNavigate();
  const sessions = useApi(() => trainingApi.sessions(''), []);
  return (
    <>
      <PageHeader title="Live Monitoring" description="Sessions in progress or paused" />
      <Resource {...sessions} label="sessions">
        {(rows) => (
          <Card>
            <DataTable<SessionSummary> caption="Live sessions" rows={rows.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'PAUSED')}
              rowKey={(s) => s.id} onRowClick={(s) => navigate(`/training/monitoring/${s.id}`)}
              empty={<EmptyState title="No live session" description="A session appears here when its Work Rider starts it." />}
              columns={[
                { key: 'c', header: 'Session', render: (s) => s.sessionCode },
                { key: 'h', header: 'Horse', render: (s) => s.horse.name },
                { key: 'r', header: 'Work Rider', render: (s) => s.workRider.fullName },
                { key: 's', header: 'Status', render: (s) => <SessionStatusBadge session={s} /> },
              ]} />
          </Card>
        )}
      </Resource>
    </>
  );
}

/**
 * SCR-TRAIN-011 Live Monitoring + SCR-TRAIN-012 alert actions (Trainer). Values and severity come from the backend;
 * the client never computes thresholds. Pause / Resume / Stop are Trainer-only (P-01, P-02).
 */
export function LiveMonitoringPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const session = useApi(() => trainingApi.session(id), [id]);
  const history = useApi(() => trainingApi.result(id), [id]);
  const stream = useSessionStream(id, ['metrics', 'alerts', 'state'], () => session.reload());
  const action = useAction();
  const [stopReason, setStopReason] = useState('');
  const [reduceTo, setReduceTo] = useState('');
  const [simRunning, setSimRunning] = useState(false);

  const samples = useMemo(() => {
    const pastSamples = (history.data?.samples ?? []).filter((s) => s.heartRate !== '');
    const lastPast = pastSamples.length ? new Date(pastSamples[pastSamples.length - 1].recordedAt).getTime() : 0;
    const live = stream.metrics.filter((m) => m.heartRate != null && new Date(m.recordedAt).getTime() > lastPast);
    return [...pastSamples.map((s) => Number(s.heartRate)), ...live.map((m) => m.heartRate as number)].slice(-60);
  }, [history.data, stream.metrics]);
  const last = stream.metrics[stream.metrics.length - 1];
  const openAlert = useMemo(() => {
    const acknowledged = new Set(stream.alerts.filter((a) => a.type === 'CRITICAL_ACKNOWLEDGED').map((a) => a.alertId));
    const fromStream = stream.alerts.find((a) => a.type === 'CRITICAL_RAISED' && !acknowledged.has(a.alertId));
    if (fromStream) return { id: fromStream.alertId as number, value: fromStream.metricValue, threshold: fromStream.thresholdApplied };
    const stored = history.data?.alerts.find((a) => !a.acknowledgedAt && !acknowledged.has(a.id));
    return stored ? { id: stored.id, value: stored.metricValue, threshold: stored.thresholdApplied } : null;
  }, [stream.alerts, history.data]);

  const act = async (fn: () => Promise<unknown>) => {
    const ok = await action.run(async () => {
      await fn();
      return true;
    });
    if (ok) {
      session.reload();
      history.reload();
    }
  };

  return (
    <Resource {...session} label="session">
      {(d) => {
        const s = d.summary;
        const state = last?.realtimeState ?? 'NORMAL';
        const critical = last?.thresholds.critical;
        const warning = last?.thresholds.warning;
        const lowerOptions = INTENSITY_OPTIONS.filter((o) => {
          const order = INTENSITY_OPTIONS.map((x) => x.value);
          return order.indexOf(o.value) < order.indexOf(s.intensity ?? 'HIGH') && order.indexOf(o.value) >= order.indexOf(d.phaseIntensityMin ?? 'LOW');
        });
        return (
          <Stack gap="lg">
            <PageHeader title={`${s.horse.name} · ${s.horse.horseCode}`} description={`${s.sessionCode} — ${s.workRider.fullName} · started ${fmtDateTime(d.actualStart)}`}
              actions={<Button variant="secondary" onClick={() => navigate(`/training/sessions/${s.id}`)}>Session detail</Button>} />
            <Row>
              <SessionStatusBadge session={s} />
              <StatusBadge family="realtime" status={state} />
              {last?.simulated && <StatusBadge family="simulated" status="SIMULATED" />}
              <span>Connection: {stream.connection}</span>
            </Row>
            {last?.simulated && <AlertBanner type="simulated" title="SIMULATED DEMO DATA">Generated by the demo simulator through the same pipeline as manual input.</AlertBanner>}
            <ActionError error={action.error} />
            {openAlert && s.status !== 'INTERRUPTED' && s.status !== 'COMPLETED' && (
              <AlertBanner type="danger" title={`CRITICAL — heart rate ${openAlert.value} bpm ≥ ${openAlert.threshold} bpm`}>
                Acknowledge, and optionally reduce intensity, pause or stop. The Veterinarian is notified if it stays unacknowledged.
                <Row>
                  <Button size="sm" disabled={action.busy} onClick={() => act(() => trainingApi.acknowledge(openAlert.id, { action: 'ACKNOWLEDGE' }))}>Acknowledge</Button>
                  {lowerOptions.length > 0 && (
                    <Button size="sm" variant="secondary" disabled={action.busy}
                      onClick={() => act(() => trainingApi.acknowledge(openAlert.id, { action: 'REDUCE_INTENSITY', intensity: reduceTo || lowerOptions[lowerOptions.length - 1].value }))}>
                      Reduce to {INTENSITY_LABEL[reduceTo || lowerOptions[lowerOptions.length - 1].value]}
                    </Button>
                  )}
                  {s.status === 'IN_PROGRESS' && <Button size="sm" variant="secondary" disabled={action.busy} onClick={() => act(() => trainingApi.acknowledge(openAlert.id, { action: 'PAUSE' }))}>Pause session</Button>}
                </Row>
              </AlertBanner>
            )}
            <Grid cols={4}>
              <MetricCard label="Heart rate" value={last?.heartRate != null ? `${last.heartRate} bpm` : '—'} realtimeState={state.toLowerCase() as 'normal'}
                caption={critical ? `Critical ≥ ${critical} · warning ≥ ${warning}${last?.thresholds.overridden ? ' (Vet override)' : ' (global default)'}` : 'Waiting for data'} />
              <MetricCard label="Speed" value={last?.speedKmh != null ? `${Number(last.speedKmh).toFixed(1)} km/h` : '—'} />
              <MetricCard label="Distance" value={last?.distanceM != null ? `${Math.round(Number(last.distanceM))} m` : '—'} />
              <MetricCard label="Intensity" value={INTENSITY_LABEL[s.intensity ?? ''] ?? '—'} caption={`Phase range ${INTENSITY_LABEL[d.phaseIntensityMin ?? ''] ?? '—'} → ${INTENSITY_LABEL[d.phaseIntensityMax ?? ''] ?? '—'}`} />
            </Grid>
            <ChartContainer title="Heart rate — this session" seriesLabel="Heart rate (bpm)" values={samples} yTicks={[200, 180, 160, 140, 120, 100]}
              xLabels={['oldest', '25%', '50%', '75%', 'latest']} threshold={critical ? { value: critical, label: `Critical ${critical} bpm` } : undefined}
              emptyTitle="No samples yet" emptyDescription="Start the simulator or wait for the Work Rider's manual input." />
            <Grid cols={2}>
              <Card title="Trainer controls">
                <Stack>
                  <Row>
                    {s.status === 'IN_PROGRESS' && !simRunning && <Button variant="secondary" disabled={action.busy} onClick={() => act(async () => { await trainingApi.simStart(s.id); setSimRunning(true); })}>Start demo simulator</Button>}
                    {simRunning && <Button variant="secondary" disabled={action.busy} onClick={() => act(async () => { await trainingApi.simStop(s.id); setSimRunning(false); })}>Stop simulator</Button>}
                    {s.status === 'IN_PROGRESS' && <Button variant="secondary" disabled={action.busy} onClick={() => act(() => trainingApi.pause(s.id))}>Pause session</Button>}
                    {s.status === 'PAUSED' && <Button disabled={action.busy} onClick={() => act(() => trainingApi.resume(s.id))}>Resume session</Button>}
                  </Row>
                  {lowerOptions.length > 0 && (s.status === 'IN_PROGRESS' || s.status === 'PAUSED') && (
                    <Row>
                      <SelectField label="Reduce intensity to" value={reduceTo} onChange={(e) => setReduceTo(e.target.value)} placeholder="Select" options={lowerOptions} />
                      <Button variant="secondary" disabled={action.busy || !reduceTo} onClick={() => act(() => trainingApi.reduce(s.id, reduceTo))}>Reduce intensity</Button>
                    </Row>
                  )}
                  {(s.status === 'IN_PROGRESS' || s.status === 'PAUSED') && (
                    <Row>
                      <TextField label="Stop reason (required)" value={stopReason} onChange={(e) => setStopReason(e.target.value)} />
                      <Button variant="destructive" disabled={action.busy || !stopReason.trim()}
                        onClick={() => act(async () => {
                          if (openAlert) await trainingApi.acknowledge(openAlert.id, { action: 'STOP', stopReason: stopReason.trim() });
                          else await trainingApi.stop(s.id, { reason: stopReason.trim() });
                          await trainingApi.simStop(s.id).catch(() => undefined);
                          setSimRunning(false);
                        })}>Stop session</Button>
                    </Row>
                  )}
                  {(s.status === 'COMPLETED' || s.status === 'INTERRUPTED') && <AlertBanner type="info" title={`Session ${s.status}`}>Open the session detail to review feedback and record the evaluation.</AlertBanner>}
                </Stack>
              </Card>
              <Card title="Alerts">
                {stream.alerts.length === 0 && (history.data?.alerts.length ?? 0) === 0 ? <p>No alerts yet.</p> : (
                  <Stack gap="sm">
                    {stream.alerts.map((a: AlertFrame, i) => (
                      <KeyValue key={`${a.type}-${a.alertId}-${i}`} label={`${a.type.replace('_', ' ')} · ${fmtTime(a.raisedAt)}`}
                        value={`${a.metricValue} bpm (threshold ${a.thresholdApplied})${a.actionTaken ? ` — ${a.actionTaken} by ${a.acknowledgedBy}` : ''}${a.simulated ? ' · simulated' : ''}`} />
                    ))}
                    {history.data?.alerts.filter((h) => !stream.alerts.some((a) => a.alertId === h.id)).map((h) => (
                      <KeyValue key={`h-${h.id}`} label={`CRITICAL · ${fmtTime(h.raisedAt)}`} value={`${h.metricValue} bpm — ${h.acknowledgedAt ? `${h.actionTaken} by ${h.acknowledgedBy}` : 'unacknowledged'}`} />
                    ))}
                  </Stack>
                )}
              </Card>
            </Grid>
          </Stack>
        );
      }}
    </Resource>
  );
}
