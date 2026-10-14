import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, Checkbox, DataTable, EmptyState, KeyValue, MetricCard, SelectField, StatusBadge, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { useAction, useApi } from '../../shared/hooks/useApi';
import { useSessionStream } from '../../shared/realtime/useSessionStream';
import { ActionError, Grid, Resource, Row, Stack } from '../../shared/ui/common';
import { INTENSITY_LABEL, fmtDateTime } from '../../shared/ui/format';
import { trainingApi, type SessionDetail, type SessionSummary } from '../demoApi';
import { SessionStatusBadge } from '../training/SessionStatusBadge';

/** WR-D1 / WR-D4 / WR-D5: My Rides (assignments) and Riding History. */
export function RiderHomePage({ history = false }: { history?: boolean }) {
  const navigate = useNavigate();
  const rows = useApi(() => (history ? trainingApi.history() : trainingApi.assignments()), [history]);
  return (
    <>
      <PageHeader title={history ? 'Riding History' : 'My Rides'} description={history ? 'Your completed and interrupted rides' : 'Your upcoming and active riding assignments'} />
      <Resource {...rows} label="rides">
        {(list) => (
          <Card>
            <DataTable<SessionSummary> caption="Rides" rows={list} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/rides/sessions/${s.id}`)}
              empty={<EmptyState title={history ? 'No finished rides yet' : 'No assignments'} />}
              columns={[
                { key: 't', header: 'Scheduled', render: (s) => fmtDateTime(s.scheduledStart) },
                { key: 'h', header: 'Horse', render: (s) => `${s.horse.name} · ${s.horse.horseCode}` },
                { key: 'c', header: 'Session', render: (s) => s.sessionCode },
                { key: 'pc', header: 'Pre-check', render: (s) => s.preCheckResult ?? 'Pending' },
                { key: 's', header: 'Status', render: (s) => <SessionStatusBadge session={s} /> },
              ]} />
          </Card>
        )}
      </Resource>
    </>
  );
}

/** WR-D2 Assignment Detail → WR-D8 Start confirmation → WR-D3 Active session → WR-D12/13 Rider Feedback. */
export function RiderSessionPage() {
  const id = Number(useParams().id);
  const session = useApi(() => trainingApi.session(id), [id]);
  const stream = useSessionStream(id, ['metrics', 'state'], () => session.reload());
  return (
    <Resource {...session} label="assignment">
      {(d) => <RiderSessionView detail={d} reload={session.reload} lastMetric={stream.metrics[stream.metrics.length - 1]} />}
    </Resource>
  );
}

function RiderSessionView({ detail, reload, lastMetric }: { detail: SessionDetail; reload: () => void; lastMetric?: ReturnType<typeof useSessionStream>['metrics'][number] }) {
  const s = detail.summary;
  const action = useAction();
  const [confirm, setConfirm] = useState({ horse: false, session: false, tack: false, instructions: false });
  const [hr, setHr] = useState('');
  const [speed, setSpeed] = useState('');
  const [distance, setDistance] = useState('');
  const [issue, setIssue] = useState({ open: false, type: 'HOOF_OR_LEG_PROBLEM', severity: 'MEDIUM', description: '' });
  const act = async (fn: () => Promise<unknown>) => {
    const ok = await action.run(async () => {
      await fn();
      return true;
    });
    if (ok) reload();
    return ok;
  };
  const allConfirmed = Object.values(confirm).every(Boolean);
  const live = s.status === 'IN_PROGRESS' || s.status === 'PAUSED';
  const finished = s.status === 'COMPLETED' || s.status === 'INTERRUPTED';

  const sendMetric = async (e: FormEvent) => {
    e.preventDefault();
    if (!hr && !speed && !distance) return action.setError('Enter at least one value.');
    const ok = await act(() => trainingApi.metric(s.id, { recordedAt: new Date().toISOString(), heartRate: hr ? Number(hr) : null,
      speedKmh: speed ? Number(speed) : null, distanceM: distance ? Number(distance) : null }));
    if (ok) setHr('');
  };

  return (
    <Stack gap="lg">
      <PageHeader title={`${s.horse.name} · ${s.horse.horseCode}`} description={`${s.sessionCode} · ${s.phaseName} · ${fmtDateTime(s.scheduledStart)} · ${s.surface ?? ''}`} />
      <Row>
        <SessionStatusBadge session={s} />
        <StatusBadge family="availability" status={detail.trainingAvailability} />
        {lastMetric?.simulated && <StatusBadge family="simulated" status="SIMULATED" />}
      </Row>
      <ActionError error={action.error} />
      {s.status === 'SCHEDULED' && s.blocked && (
        <AlertBanner type={s.blockedReasons.length === 1 && s.blockedReasons[0] === 'PRE_CHECK_MISSING' ? 'info' : 'danger'}
          title={s.blockedReasons.length === 1 && s.blockedReasons[0] === 'PRE_CHECK_MISSING' ? 'Waiting for the Groom pre-session check' : 'Start BLOCKED'}>
          {s.blockedMessage ?? s.blockedReasons.join(', ')}
        </AlertBanner>
      )}
      {s.status === 'PAUSED' && <AlertBanner type="warning" title="SESSION PAUSED — BY YOUR TRAINER">Walk him and wait for your Trainer. The Trainer resumes the session from Live Monitoring.</AlertBanner>}
      {s.status === 'INTERRUPTED' && <AlertBanner type="danger" title="INTERRUPTED — not completed">{detail.interruptionReason}</AlertBanner>}
      <Grid cols={2}>
        <Card title="Training instructions">
          <Stack gap="sm">
            {detail.exercises.map((e) => (
              <KeyValue key={e.id} label={`${e.exerciseOrder}. ${e.exerciseName}`}
                value={`${e.distanceM ? `${e.repetitions && e.repetitions > 1 ? `${e.repetitions} × ` : ''}${e.distanceM} m` : ''}${e.restIntervalMin ? ` · ${e.restIntervalMin} min rest` : ''} · ${INTENSITY_LABEL[e.intensity ?? ''] ?? '—'}`} />
            ))}
            <KeyValue label="Session intensity" value={INTENSITY_LABEL[s.intensity ?? ''] ?? '—'} />
            <KeyValue label="Pre-session check" value={s.preCheckResult ?? 'Pending'} />
          </Stack>
        </Card>
        {s.status === 'SCHEDULED' && (
          <Card title="Start this session?">
            <Stack gap="sm">
              <Checkbox label={`Correct horse — ${s.horse.name} (${s.horse.horseCode})`} checked={confirm.horse} onChange={(e) => setConfirm((c) => ({ ...c, horse: e.target.checked }))} />
              <Checkbox label={`Correct session — ${s.sessionCode}`} checked={confirm.session} onChange={(e) => setConfirm((c) => ({ ...c, session: e.target.checked }))} />
              <Checkbox label="Tack and equipment ready" checked={confirm.tack} onChange={(e) => setConfirm((c) => ({ ...c, tack: e.target.checked }))} />
              <Checkbox label="Training instructions reviewed" checked={confirm.instructions} onChange={(e) => setConfirm((c) => ({ ...c, instructions: e.target.checked }))} />
              <p>This is your readiness check — not a veterinary clearance.</p>
              <Button disabled={!allConfirmed || action.busy} onClick={() => act(() => trainingApi.start(s.id))}>{action.busy ? 'Starting…' : 'Start session'}</Button>
            </Stack>
          </Card>
        )}
        {live && (
          <Card title="Active session">
            <Stack>
              <Grid cols={3}>
                <MetricCard label="Heart rate" value={lastMetric?.heartRate != null ? `${lastMetric.heartRate} bpm` : '—'} />
                <MetricCard label="Speed" value={lastMetric?.speedKmh != null ? `${Number(lastMetric.speedKmh).toFixed(1)} km/h` : '—'} />
                <MetricCard label="Distance" value={lastMetric?.distanceM != null ? `${Math.round(Number(lastMetric.distanceM))} m` : '—'} />
              </Grid>
              <form onSubmit={sendMetric} noValidate>
                <Row>
                  <TextField label="Heart rate (bpm)" type="number" min="0" value={hr} onChange={(e) => setHr(e.target.value)} />
                  <TextField label="Speed (km/h)" type="number" min="0" value={speed} onChange={(e) => setSpeed(e.target.value)} />
                  <TextField label="Distance (m, cumulative)" type="number" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} />
                  <Button type="submit" variant="secondary" disabled={action.busy}>Record sample</Button>
                </Row>
              </form>
              <Row>
                {s.status === 'IN_PROGRESS' && <Button disabled={action.busy} onClick={() => act(() => trainingApi.complete(s.id))}>Finish session</Button>}
                <Button variant="destructive" disabled={action.busy} onClick={() => setIssue((i) => ({ ...i, open: true }))}>Report issue</Button>
              </Row>
              <p>Pause, Resume and Stop are the Trainer's realtime interventions — not Work Rider actions.</p>
            </Stack>
          </Card>
        )}
      </Grid>
      {issue.open && live && (
        <Card title="Report issue — stop riding now (session becomes INTERRUPTED, never Completed)">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!issue.description.trim()) return action.setError('Describe what you observed.');
            if (await act(() => trainingApi.reportIssue(s.id, { incidentType: issue.type, observedSeverity: issue.severity, description: issue.description.trim() })))
              setIssue((i) => ({ ...i, open: false }));
          }} noValidate>
            <Stack>
              <Row>
                <SelectField label="Type" value={issue.type} onChange={(e) => setIssue((i) => ({ ...i, type: e.target.value }))}
                  options={['OFF_FEED', 'COLIC_SIGNS', 'FEVER', 'HOOF_OR_LEG_PROBLEM', 'OTHER'].map((v) => ({ value: v, label: v.replaceAll('_', ' ') }))} />
                <SelectField label="Observed severity" value={issue.severity} onChange={(e) => setIssue((i) => ({ ...i, severity: e.target.value }))}
                  options={['LOW', 'MEDIUM', 'HIGH'].map((v) => ({ value: v, label: v }))} />
              </Row>
              <TextField label="What did you observe?" value={issue.description} onChange={(e) => setIssue((i) => ({ ...i, description: e.target.value }))} />
              <Row>
                <Button type="submit" variant="destructive" disabled={action.busy}>{action.busy ? 'Reporting…' : 'Report and stop riding'}</Button>
                <Button type="button" variant="secondary" onClick={() => setIssue((i) => ({ ...i, open: false }))}>Cancel</Button>
              </Row>
            </Stack>
          </form>
        </Card>
      )}
      {finished && !detail.hasRiderFeedback && <FeedbackForm sessionId={s.id} interrupted={s.status === 'INTERRUPTED'} onDone={reload} />}
      {finished && detail.hasRiderFeedback && <AlertBanner type="success" title="Rider Feedback submitted">{s.status === 'INTERRUPTED' ? 'The session stays INTERRUPTED — feedback never completes it.' : 'Thank you.'}</AlertBanner>}
    </Stack>
  );
}

function FeedbackForm({ sessionId, interrupted, onDone }: { sessionId: number; interrupted: boolean; onDone: () => void }) {
  const action = useAction();
  const [f, setF] = useState({ horseResponse: '', balance: '', breathing: '', strideFeeling: '', abnormalBehavior: '', preInterruptionDescription: '', notes: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const responses = Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    if (Object.keys(responses).length === 0) return action.setError('Answer at least one prompt.');
    if (await action.run(() => trainingApi.feedback(sessionId, responses))) onDone();
  };
  return (
    <Card title={`Rider Feedback${interrupted ? ' — interrupted session' : ''}`}>
      <form onSubmit={submit} noValidate>
        <Stack>
          <ActionError error={action.error} />
          <Grid cols={2}>
            <TextField label="Horse response" value={f.horseResponse} onChange={set('horseResponse')} />
            <TextField label="Balance" value={f.balance} onChange={set('balance')} />
            <TextField label="Breathing" value={f.breathing} onChange={set('breathing')} />
            <TextField label="Stride feeling" value={f.strideFeeling} onChange={set('strideFeeling')} />
            <TextField label="Abnormal behaviour" value={f.abnormalBehavior} onChange={set('abnormalBehavior')} />
            {interrupted && <TextField label="What happened before the interruption" value={f.preInterruptionDescription} onChange={set('preInterruptionDescription')} />}
            <TextField label="Notes" value={f.notes} onChange={set('notes')} />
          </Grid>
          <Row><Button type="submit" disabled={action.busy}>{action.busy ? 'Submitting…' : 'Submit feedback'}</Button></Row>
        </Stack>
      </form>
    </Card>
  );
}
