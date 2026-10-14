import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, KeyValue, MetricCard, SelectField, StatusBadge, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { primaryRole, useAuth } from '../../shared/auth/authState';
import { useAction, useApi } from '../../shared/hooks/useApi';
import { useSessionStream } from '../../shared/realtime/useSessionStream';
import { ActionError, Grid, Resource, Row, Stack } from '../../shared/ui/common';
import { INTENSITY_LABEL, fmtDateTime } from '../../shared/ui/format';
import { trainingApi, type SessionExercise, type SessionResult } from '../demoApi';
import { SessionStatusBadge } from './SessionStatusBadge';

const EVALUATION = [
  { value: 'MET', label: 'Met target' },
  { value: 'PARTIALLY_MET', label: 'Partially met target' },
  { value: 'NOT_MET', label: 'Did not meet target' },
];

/** SCR-TRAIN-020 Session Detail hub + SCR-TRAIN-009 Session Evaluation (Trainer, after COMPLETED or INTERRUPTED). */
export function SessionDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user ? primaryRole(user) : null;
  const session = useApi(() => trainingApi.session(id), [id]);
  const result = useApi(() => trainingApi.result(id), [id]);
  const refresh = () => {
    session.reload();
    result.reload();
  };
  useSessionStream(id, ['state'], refresh);

  return (
    <Resource {...session} label="session">
      {(d) => {
        const s = d.summary;
        const live = s.status === 'IN_PROGRESS' || s.status === 'PAUSED';
        const finished = s.status === 'COMPLETED' || s.status === 'INTERRUPTED';
        return (
          <Stack gap="lg">
            <PageHeader
              title={`${s.sessionCode} · ${s.horse.name}`}
              description={`${s.programName} — ${s.phaseName} · ${fmtDateTime(s.scheduledStart)}`}
              actions={
                <Row>
                  {live && role === 'TRAINER' && <Button onClick={() => navigate(`/training/monitoring/${s.id}`)}>Open Live Monitoring</Button>}
                  <Button variant="secondary" onClick={() => navigate(`/training/programs/${s.programId}`)}>Program</Button>
                </Row>
              }
            />
            <Row>
              <SessionStatusBadge session={s} />
              <StatusBadge family="availability" status={d.trainingAvailability} />
            </Row>
            {s.blocked && s.status === 'SCHEDULED' && (
              <AlertBanner type={s.blockedReasons.includes('PRE_CHECK_MISSING') && s.blockedReasons.length === 1 ? 'info' : 'danger'}
                title={s.blockedReasons.includes('PRE_CHECK_MISSING') && s.blockedReasons.length === 1 ? 'Waiting for the Groom pre-session check' : 'Start is BLOCKED'}>
                {s.blockedMessage ?? s.blockedReasons.join(', ')}
              </AlertBanner>
            )}
            {s.status === 'INTERRUPTED' && <AlertBanner type="danger" title="INTERRUPTED — never completed">{d.interruptionReason}</AlertBanner>}
            <Grid cols={2}>
              <Card title="Session">
                <Stack gap="sm">
                  <KeyValue label="Work Rider" value={s.workRider.fullName} />
                  <KeyValue label="Trainer" value={s.trainer?.fullName ?? '—'} />
                  <KeyValue label="Surface" value={s.surface ?? '—'} />
                  <KeyValue label="Focus" value={s.focus ?? '—'} />
                  <KeyValue label="Intensity" value={INTENSITY_LABEL[s.intensity ?? ''] ?? '—'} />
                  <KeyValue label="Pre-session check" value={d.preSessionCheck ? `${d.preSessionCheck.overallResult} — ${d.preSessionCheck.performedBy.fullName}, ${fmtDateTime(d.preSessionCheck.performedAt)}` : 'Pending'} />
                  <KeyValue label="Actual" value={`${fmtDateTime(d.actualStart)} → ${fmtDateTime(d.actualEnd)}`} />
                </Stack>
              </Card>
              <Card title="Exercises">
                <DataTable<SessionExercise> caption="Exercises" rows={d.exercises} rowKey={(e) => e.id} columns={[
                  { key: 'o', header: '#', render: (e) => e.exerciseOrder },
                  { key: 'n', header: 'Exercise', render: (e) => e.exerciseName },
                  { key: 'd', header: 'Distance', render: (e) => (e.distanceM ? `${e.repetitions && e.repetitions > 1 ? `${e.repetitions} × ` : ''}${e.distanceM} m` : '—') },
                  { key: 'r', header: 'Rest', render: (e) => (e.restIntervalMin ? `${e.restIntervalMin} min` : '—') },
                  { key: 'i', header: 'Intensity', render: (e) => INTENSITY_LABEL[e.intensity ?? ''] ?? '—' },
                ]} />
              </Card>
            </Grid>
            {finished && (
              <Resource {...result} label="result">
                {(r) => <ResultSection result={r} canEvaluate={role === 'TRAINER' && !r.evaluation} sessionId={s.id} onSaved={refresh} />}
              </Resource>
            )}
          </Stack>
        );
      }}
    </Resource>
  );
}

function ResultSection({ result, canEvaluate, sessionId, onSaved }: { result: SessionResult; canEvaluate: boolean; sessionId: number; onSaved: () => void }) {
  const action = useAction();
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label || !notes.trim()) return action.setError('Assessment and professional notes are required.');
    if (await action.run(() => trainingApi.evaluate(sessionId, { evaluationLabel: label, evaluationNotes: notes.trim(), recommendation: recommendation.trim() || null }))) onSaved();
  };
  const a = result.actual;
  return (
    <Stack gap="lg">
      <Grid cols={4}>
        <MetricCard label="Distance" value={a.totalDistanceM != null ? `${Math.round(Number(a.totalDistanceM))} m` : '—'} />
        <MetricCard label="Peak heart rate" value={a.maxHeartRate != null ? `${a.maxHeartRate} bpm` : '—'} />
        <MetricCard label="Top speed" value={a.maxSpeedKmh != null ? `${Number(a.maxSpeedKmh).toFixed(1)} km/h` : '—'} />
        <MetricCard label="Samples" value={String(a.sampleCount)} caption={a.simulatedCount ? `${a.simulatedCount} simulated` : 'Manual input'} />
      </Grid>
      <Grid cols={2}>
        <Card title="Alerts raised">
          {result.alerts.length === 0 ? <p>No CRITICAL alert in this session.</p> : (
            <Stack gap="sm">
              {result.alerts.map((al) => (
                <KeyValue key={al.id} label={`CRITICAL ${fmtDateTime(al.raisedAt)}`}
                  value={`${al.metricValue} bpm ≥ ${al.thresholdApplied} — ${al.acknowledgedAt ? `acknowledged by ${al.acknowledgedBy} (${al.actionTaken})` : 'unacknowledged'}${al.escalatedToVetAt ? ' · escalated to Veterinarian' : ''}`} />
              ))}
            </Stack>
          )}
        </Card>
        <Card title="Rider Feedback">
          {result.riderFeedback ? (
            <Stack gap="sm">
              <KeyValue label="Submitted" value={`${result.riderFeedback.submittedBy} · ${fmtDateTime(result.riderFeedback.submittedAt)}`} />
              {Object.entries(result.riderFeedback.responses).map(([k, v]) => <KeyValue key={k} label={k} value={String(v)} />)}
            </Stack>
          ) : <p>Not submitted yet.</p>}
        </Card>
      </Grid>
      {result.evaluation ? (
        <Card title="Trainer evaluation">
          <Stack gap="sm">
            <KeyValue label="Assessment" value={EVALUATION.find((e) => e.value === result.evaluation?.evaluationLabel)?.label ?? result.evaluation.evaluationLabel} />
            <KeyValue label="Professional notes" value={result.evaluation.evaluationNotes} />
            <KeyValue label="Recommendation" value={result.evaluation.recommendation || '—'} />
            <KeyValue label="Evaluated" value={`${result.evaluation.evaluatedBy} · ${fmtDateTime(result.evaluation.evaluatedAt)}`} />
          </Stack>
        </Card>
      ) : canEvaluate ? (
        <Card title="Trainer evaluation">
          <form onSubmit={submit} noValidate>
            <Stack>
              <ActionError error={action.error} />
              <SelectField label="Assessment" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Select" options={EVALUATION} />
              <TextField label="Professional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <TextField label="Recommendation — next sessions" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
              <Row><Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save evaluation'}</Button></Row>
            </Stack>
          </form>
        </Card>
      ) : null}
    </Stack>
  );
}
