import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, ChartContainer, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, MetricCard, StatusBadge, Tabs, UnsavedChangesGuard } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RoleCode } from '../../shared/auth/roles';
import { evaluationApi, type EvaluationApi } from './api';
import { EvaluationForm } from './EvaluationForm';
import { PerformanceHistory } from './PerformanceHistory';
import { clockTime, dateTime, isTerminal, metric, RESULT_LABELS, type SessionResultView } from './models';
import './evaluation.css';

/** Roles routed to /training/session/:id (see router). */
const SESSION_DETAIL_ROLES: RoleCode[] = ['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER'];

const READ_ROLES: RoleCode[] = ['TRAINER', 'HEAD_TRAINER', 'WORK_RIDER', 'CLUB_MANAGER', 'VETERINARIAN'];
const HISTORY_ROLES: RoleCode[] = ['TRAINER', 'HEAD_TRAINER', 'CLUB_MANAGER', 'VETERINARIAN'];
const display = (value: string | null | undefined) => value || 'Not recorded';

export function SessionEvaluationPage({ api = evaluationApi }: { api?: EvaluationApi }) {
  const { id = '' } = useParams();
  const auth = useAuth();
  const sessionId = Number(id);
  const role = READ_ROLES.find((candidate) => auth.user?.roles.includes(candidate));
  if (!auth.user) return null; // RequireAuth owns restore/sign-in/error navigation.
  if (!role) return <AlertBanner type="danger" title="Access denied" children="Your role cannot view session results." />;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(sessionId) || sessionId < 1) return <EmptyState title="Session not found" description="Use a valid session ID." />;
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role }} breadcrumb={[{ label: 'Training' }, { label: 'Session evaluation' }]}>
    <EvaluationContent key={`${auth.user.id}:${sessionId}`} sessionId={sessionId} api={api} />
  </AppShell>;
}

function EvaluationContent({ sessionId, api }: { sessionId: number; api: EvaluationApi }) {
  const { user, handleApiError } = useAuth();
  const [search, setSearch] = useSearchParams();
  const tab = search.get('view') ?? 'result';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data?: SessionResultView; error?: unknown }>({});
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.result(sessionId, controller.signal).then((data) => {
      if (!active) return;
      if (data.session.id !== sessionId) throw new ApiError(200, 'INVALID_RESPONSE', 'The server returned a different session.');
      setState({ data });
    }).catch((error: unknown) => { if (active && !handleApiError(error)) setState({ error }); });
    return () => { active = false; controller.abort(); };
  }, [sessionId, api, attempt, handleApiError]);
  const reload = () => { setState({}); setAttempt(attempt + 1); };
  if (state.error) {
    const error = state.error;
    if (error instanceof ApiError && error.status === 403) return <AlertBanner type="danger" title="Access denied" children="This session is outside your permitted scope. Your session is still active." />;
    if (error instanceof ApiError && error.status === 404) return <EmptyState title="Session not found" />;
    return <ErrorState title="Session result unavailable" description={error instanceof Error ? error.message : 'Unable to load this session.'} onRetry={reload} />;
  }
  if (!state.data) return <LoadingState label="Loading session result…" />;
  const data = state.data;
  const { session, actual } = data;
  const canEvaluate = user?.roles.includes('TRAINER') && isTerminal(session.status);
  const canHistory = HISTORY_ROLES.some((role) => user?.roles.includes(role));
  const changeTab = (view: string) => setSearch((previous) => { const next = new URLSearchParams(previous); next.set('view', view); return next; });
  const selected = ['result', 'comparison', 'evaluation'].includes(tab) ? tab : 'result';
  return <div className="evaluation-stack">
    <UnsavedChangesGuard dirty={dirty && !saved} allowSameRoute />
    <div className="evaluation-actions"><div className="evaluation-stack-sm"><h1 className="text-h1">Session Evaluation · {session.focus || session.sessionCode}</h1><p>{session.horse.name} · {session.horse.horseCode} · {session.sessionCode}</p></div><StatusBadge family="session" status={session.status} />
      {SESSION_DETAIL_ROLES.some((role) => user?.roles.includes(role)) && <Link className="evaluation-link-button" to={`/training/session/${session.id}`}>Session Detail</Link>}
      {canHistory && <Button variant="secondary" disabled={submitting} onClick={() => changeTab(tab === 'history' ? 'result' : 'history')}>{tab === 'history' ? 'Back to evaluation' : 'Performance History'}</Button>}
      <Button variant="secondary" disabled={submitting} onClick={reload}>Reload session</Button>
    </div>
    {session.status === 'INTERRUPTED' ? <AlertBanner type="danger" title="INTERRUPTED — reviewable, not completed" children={`${session.interruptionReason || 'The session was stopped.'} Saving an evaluation keeps the status INTERRUPTED.`} /> : session.status === 'COMPLETED' ? <AlertBanner type="success" title="COMPLETED — review recorded results" children="Record your evaluation and recommendation for this executed session." /> : <AlertBanner type="warning" title="Evaluation unavailable" children="Only COMPLETED or INTERRUPTED sessions can be evaluated." />}
    <Card><div className="evaluation-facts"><KeyValue label="Scheduled start" value={dateTime(session.scheduledStart)} /><KeyValue label="Scheduled end" value={dateTime(session.scheduledEnd)} /><KeyValue label="Session focus" value={display(session.focus)} /><KeyValue label="Surface" value={display(session.surface)} /><KeyValue label="Trainer" value={display(session.trainer?.fullName)} /><KeyValue label="Work Rider" value={session.workRider.fullName} /><KeyValue label="Program / Phase" value={`Program ${session.programId} · ${session.phaseName}`} /></div><p className="text-caption">This evaluation covers this executed session only. It does not change the program strategy or its source template.</p></Card>
    {tab === 'history' && (canHistory ? <PerformanceHistory key={session.horse.id} horseId={session.horse.id} api={api} onError={handleApiError} /> : <AlertBanner type="danger" title="Access denied" children="Your role cannot view horse performance history." />)}
    {/* Kept mounted while History is shown so an unsaved evaluation draft is not lost (UX Playbook v2.1 §1.1). */}
    <div className="evaluation-stack" hidden={tab === 'history'}>
      <Tabs label="Session evaluation" idPrefix="evaluation" value={selected} onChange={changeTab} items={[{ value: 'result', label: 'Result' }, { value: 'comparison', label: 'Planned vs Actual' }, { value: 'evaluation', label: 'Evaluation & Recommendation' }]} />
      {selected !== 'evaluation' && <div role="tabpanel" id={`evaluation-panel-${selected}`} aria-labelledby={`evaluation-tab-${selected}`}>
        {selected === 'result' ? <ResultPanel data={data} /> : <ComparisonPanel data={data} />}
      </div>}
      <div role="tabpanel" id="evaluation-panel-evaluation" aria-labelledby="evaluation-tab-evaluation" hidden={selected !== 'evaluation'}>
          <div className="evaluation-columns"><div className="evaluation-stack">
            {saved && <AlertBanner type="success" title="Evaluation saved" children={`Session status remains ${session.status}.`} />}
            {data.evaluation ? <Card title="Recorded evaluation"><div className="evaluation-stack"><p>{RESULT_LABELS[data.evaluation.result]}</p><KeyValue label="Summary" value={display(data.evaluation.evaluatedSummary)} /><KeyValue label="Professional notes" value={display(data.evaluation.evaluationNotes)} /><KeyValue label="Recommendation" value={display(data.evaluation.recommendation)} /><p className="text-caption">{data.evaluation.evaluatedBy.fullName} · {data.evaluation.evaluatedAt}</p></div></Card> : session.hasEvaluation ? <AlertBanner type="warning" title="Evaluation already recorded" children="Reload the session to retrieve the recorded evaluation. A second submission is not allowed." /> : canEvaluate ?
              <EvaluationForm onPendingChange={setSubmitting} onDirtyChange={setDirty} interrupted={session.status === 'INTERRUPTED'} onSave={async (input) => {
                try {
                  const evaluation = await api.submit(sessionId, input);
                  if (evaluation.sessionId !== sessionId) throw new ApiError(201, 'INVALID_RESPONSE', 'The server returned an evaluation for a different session. Reload before retrying.');
                  setState({ data: { ...data, evaluation } }); setSaved(true);
                } catch (error) { handleApiError(error); throw error; }
              }} /> : <AlertBanner type="warning" title="Read-only result" children="Only the assigned Trainer may submit an evaluation for a terminal session. The server enforces assignment scope." />}
          </div><aside className="evaluation-stack"><Card title="Strategic change needed?"><p>Program goals, source templates, phase strategy and approved workload ranges require Head Trainer approval. Recommendations here do not modify the plan.</p></Card><FeedbackCard data={data} /></aside></div>
      </div>
    </div>
    {actual.simulated && <StatusBadge family="simulated" status="SIMULATED" />}
  </div>;
}

function FeedbackCard({ data }: { data: SessionResultView }) {
  const feedback = data.riderFeedback;
  const labels: Record<string, string> = { horseResponse: 'Horse response', balance: 'Balance', breathing: 'Breathing', strideFeeling: 'Stride feeling', abnormalBehavior: 'Abnormal behavior', preInterruptionDescription: 'Before interruption', notes: 'Notes' };
  return <Card title="Rider Feedback">{feedback ? <div className="evaluation-stack-sm"><p>Submitted by {feedback.submittedBy.fullName} · {dateTime(feedback.submittedAt)}</p>{Object.entries(feedback.responses).map(([key, value]) => value && <KeyValue key={key} label={labels[key] ?? key} value={value} />)}</div> : <EmptyState title="No rider feedback" />}</Card>;
}

function ResultPanel({ data }: { data: SessionResultView }) {
  const { actual, session } = data;
  const samples = data.samples ?? [];
  const completeHeartSeries = samples.length > 0 && samples.every((sample) => typeof sample.heartRate === 'number' && Number.isFinite(sample.heartRate));
  const hearts = completeHeartSeries ? samples.map((sample) => sample.heartRate!) : [];
  const min = Math.floor(Math.min(...hearts, 100) / 20) * 20;
  const max = Math.ceil(Math.max(...hearts, 200) / 20) * 20;
  return <div className="evaluation-columns"><div className="evaluation-stack">
    <div className="evaluation-metrics"><MetricCard label="Distance" value={metric(actual.totalDistanceM, 'm')} caption="Server aggregate" /><MetricCard label="Duration" value={metric(actual.durationMin, 'min')} /><MetricCard label="Peak heart rate" value={metric(actual.maxHeartRate, 'bpm')} /><MetricCard label="Top speed" value={metric(actual.maxSpeedKmh, 'km/h')} /></div>
    <ChartContainer title="Heart rate — recorded session" seriesLabel="Heart rate (bpm), sample order" values={hearts} yTicks={[max, (max + min) / 2, min]} xLabels={hearts.length ? [...new Set([clockTime(samples[0].recordedAt), clockTime(samples.at(-1)!.recordedAt)])] : []} emptyTitle="No complete heart-rate series" emptyDescription="Missing readings are not converted to zero or interpolated. Available readings are listed below." />
    <Card title="Recorded samples"><div className="evaluation-table"><DataTable caption="Recorded session samples" rowKey={(sample) => sample.key} rows={samples.map((sample, index) => ({ ...sample, key: index }))} empty={<EmptyState title="No recorded samples" />} columns={[
      { key: 'time', header: 'Recorded at', render: (sample) => clockTime(sample.recordedAt) }, { key: 'hr', header: 'Heart rate', render: (sample) => metric(sample.heartRate, 'bpm') }, { key: 'speed', header: 'Speed', render: (sample) => metric(sample.speedKmh, 'km/h') }, { key: 'distance', header: 'Distance', render: (sample) => metric(sample.distanceM, 'm') }, { key: 'source', header: 'Source', render: (sample) => sample.source },
    ]} /></div></Card>
    <p className="text-caption">Values are recorded by the server; no distance formula, performance score or recovery time is calculated here.</p>
  </div><aside className="evaluation-stack"><Card title="Trainer evaluation"><p>{data.evaluation ? RESULT_LABELS[data.evaluation.result] : 'Not recorded yet'}</p></Card><Card title="Exercise plan"><ul className="evaluation-list">{session.exercises.map((exercise) => <li key={exercise.id}><strong>{exercise.exerciseName}</strong><p>{metric(exercise.distanceM, 'm')} · {metric(exercise.repetitions, 'reps')} · {display(exercise.intensity)}</p></li>)}</ul><p className="text-caption">Exercise completion and recorded rep splits are not supplied by this contract.</p></Card>
    <Card title="Alerts raised">{data.alerts.length ? <div className="evaluation-stack-sm">{data.alerts.map((alert) => <AlertBanner key={alert.id} type="danger" title={`${alert.severity} · Heart rate ${alert.metricValue} bpm > ${alert.thresholdApplied} bpm`} children={`${clockTime(alert.raisedAt)} · ${alert.acknowledgedAt ? `Acknowledged ${clockTime(alert.acknowledgedAt)}` : 'Not acknowledged'}${alert.actionTaken ? ` · ${alert.actionTaken}` : ''}${alert.escalatedToVetAt ? ` · Escalated to Vet ${clockTime(alert.escalatedToVetAt)}` : ''}`} />)}</div> : <EmptyState title="No recorded critical alerts" />}</Card><FeedbackCard data={data} />
    {(session.status === 'INTERRUPTED' || data.alerts.length > 0) && <Card title="Medical escalation"><AlertBanner type="danger" title="If medically relevant, escalate to the Medical flow">The Veterinarian can open or link a Flow 3 case. This evaluation does not change Training Availability.</AlertBanner></Card>}</aside></div>;
}

function ComparisonPanel({ data }: { data: SessionResultView }) {
  const { actual, session } = data;
  const comparisons = [
    { measure: 'Distance', planned: 'See per-exercise plan below', actual: metric(actual.totalDistanceM, 'm') },
    { measure: 'Duration', planned: 'See per-exercise plan below', actual: metric(actual.durationMin, 'min') },
    { measure: 'Session intensity', planned: display(session.intensity), actual: 'Not supplied by result API' },
    { measure: 'Peak heart rate', planned: 'No session threshold supplied', actual: metric(actual.maxHeartRate, 'bpm') },
    { measure: 'Top speed', planned: 'No target supplied', actual: metric(actual.maxSpeedKmh, 'km/h') },
    { measure: 'Average speed', planned: 'No target supplied', actual: metric(actual.avgSpeedKmh, 'km/h') },
  ];
  return <div className="evaluation-stack"><Card title="Planned vs Actual"><div className="evaluation-table"><DataTable caption="Planned versus actual session values" rows={comparisons} rowKey={(row) => row.measure} columns={[
    { key: 'measure', header: 'Measure', render: (row) => row.measure }, { key: 'planned', header: 'Planned', render: (row) => row.planned }, { key: 'actual', header: 'Actual', render: (row) => row.actual },
  ]} /></div></Card><Card title="Planned exercises"><div className="evaluation-table"><DataTable caption="Planned exercises, wire units" rows={[...session.exercises].sort((a, b) => a.exerciseOrder - b.exerciseOrder)} rowKey={(row) => row.id} empty={<EmptyState title="No exercise plan" />} columns={[
    { key: 'exercise', header: 'Exercise', render: (row) => row.exerciseName }, { key: 'distance', header: 'Distance', render: (row) => metric(row.distanceM, 'm') }, { key: 'duration', header: 'Duration', render: (row) => metric(row.durationMin, 'min') }, { key: 'reps', header: 'Repetitions', render: (row) => metric(row.repetitions, 'reps') }, { key: 'rest', header: 'Rest interval', render: (row) => metric(row.restIntervalMin, 'min') },
  ]} /></div></Card><p className="text-caption">Nullable values remain unmeasured. Planned distances are not summed or multiplied by repetitions while aggregation semantics await approval. This comparison does not modify the plan.</p></div>;
}
