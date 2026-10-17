import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, Checkbox, EmptyState, KeyValue, Modal, StatusBadge } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { ReadState, RiderShell } from './common';
import { errorMessage, useRiderApi, useRiderSession, value, when } from './data';
import { IssueDialog } from './dialogs';
import { isTerminal, startBlocks, type RiderSession } from './types';
import styles from './rider.module.css';

export function RiderAssignmentPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied); const { id = '' } = useParams();
  return <RiderShell>{!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 ? <EmptyState title="Ride not found" /> : <Assignment key={id} id={Number(id)} api={api} />}</RiderShell>;
}
function Assignment({ id, api }: { id: number; api: RiderApi }) {
  const state = useRiderSession(id, api);
  const { handleApiError } = useAuth();
  const navigate = useNavigate(); const location = useLocation();
  const [confirmations, setConfirmations] = useState<boolean[]>(Array(6).fill(false));
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [conflictAt, setConflictAt] = useState<number | null>(null); const [report, setReport] = useState(false); const [reported, setReported] = useState('');
  const startOpen = location.pathname.endsWith('/start');
  if (!state.session || state.error) return <ReadState error={state.error} loading={!state.session} retry={state.reload} />;
  const session = state.session;
  const conflict = conflictAt !== null && state.snapshotVersion <= conflictAt;
  const gates = startBlocks(session);
  const feedback = state.result?.riderFeedback ?? null;
  async function start() {
    if (pending.current || conflict) return;
    const blocks = startBlocks(session);
    if (blocks.length || !confirmations.every(Boolean)) { setError(blocks.join(' ') || 'Confirm all six readiness checks.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.start(id);
      if (response.id !== id || response.status !== 'IN_PROGRESS') throw new ApiError(200, 'INVALID_RESPONSE', 'Start could not be confirmed. Reload the assignment.');
      navigate(`/rider/sessions/${id}/active`);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflictAt(state.snapshotVersion);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  return <div className={styles.stack}><Link className={styles.link} to="/rider/assignments">← My Riding Assignments</Link><div className={styles.header}><div><h1 className={styles.heading}>{session.horse.name} · {session.horse.horseCode}</h1><p>{session.focus || session.phaseName} · {session.sessionCode} · {when(session.scheduledStart)}</p><StatusBadge family="session" status={session.status} /></div><div className={styles.actions}>{(session.status === 'IN_PROGRESS' || session.status === 'PAUSED') && <Button variant="secondary" onClick={() => setReport(true)}>Report Issue</Button>}{session.status === 'SCHEDULED' ? <Button disabled={gates.length > 0 || conflict} onClick={() => navigate(`/rider/assignments/${id}/start`)}>Ready to Start</Button> : session.status === 'IN_PROGRESS' || session.status === 'PAUSED' ? <Link className={styles.link} to={`/rider/sessions/${id}/active`}>Open Active Session</Link> : (session.hasRiderFeedback || state.result?.riderFeedback ? <Link className={styles.link} to="/rider/history">View Riding History</Link> : <Link className={styles.link} to={`/rider/sessions/${id}/feedback`}>Give Rider Feedback</Link>)}</div></div>
    {reported && <AlertBanner type="success" title={`Issue ${reported} submitted`}>The server records the session outcome. Review the updated status before continuing.</AlertBanner>}
    {session.status === 'SCHEDULED' ? <AlertBanner type={gates.length ? 'warning' : 'success'} title={gates.length ? 'Session is not ready to start' : 'Ready to ride'}>{gates.length ? gates.join(' ') : 'Groom pre-session check cleared. Start gates are checked again by the backend.'}</AlertBanner> : isTerminal(session.status) ? <AlertBanner type={session.status === 'INTERRUPTED' ? 'danger' : 'success'} title={session.status === 'INTERRUPTED' ? 'INTERRUPTED — not completed' : 'COMPLETED'}>{session.interruptionReason || (feedback ? 'Ride completed. Your Rider Feedback has been submitted.' : 'Ride completed. Submit your Rider Feedback when safely able.')}</AlertBanner> : null}
    <div className={styles.columns}><div className={styles.stack}>{isTerminal(session.status) && <YourRide state={state} />}{isTerminal(session.status) && <YourFeedback id={id} feedback={feedback} />}<Card title="Training Instructions"><p className={styles.muted}>Ride the Trainer’s plan. You cannot change exercises, intensity or distance.</p><Exercises session={session} /></Card></div><aside className={styles.stack}><Card title="Session"><div className={styles.smallStack}><KeyValue label="Date · time" value={when(session.scheduledStart)} /><KeyValue label="Surface" value={session.surface ?? 'Not supplied'} /><KeyValue label="Session focus" value={session.focus ?? session.phaseName} /><KeyValue label="Trainer" value={session.trainer?.fullName ?? 'Not supplied'} /><KeyValue label="Work Rider" value={session.workRider.fullName} /><KeyValue label="Training Availability" value={session.trainingAvailability ?? 'Not supplied'} /></div></Card><Card title="Program context"><p>Program #{session.programId} · {session.phaseName}</p><p className={styles.muted}>Program, phase and intensity range are set by the Head Trainer and Trainer.</p></Card></aside></div>
    {startOpen && <Modal open title="Start this session?" onClose={busy ? () => undefined : () => navigate(`/rider/assignments/${id}`)} footer={<><Button variant="secondary" disabled={busy} onClick={() => navigate(`/rider/assignments/${id}`)}>Not Ready — Back to Assignment</Button><Button disabled={busy || conflict || gates.length > 0 || !confirmations.every(Boolean)} onClick={start}>{busy ? 'Starting…' : 'Start Session'}</Button></>}><div className={styles.smallStack}><p>{session.horse.name} · {session.sessionCode} · {session.surface ?? 'Surface not supplied'}</p>{[`Correct horse — ${session.horse.name}`, `Correct session — ${session.sessionCode}`, `Surface — ${session.surface ?? 'review the assigned surface'}`, 'Tack and equipment ready', 'Horse settled and ready to work', 'Training Instructions reviewed'].map((label, index) => <Checkbox key={label} label={label} checked={confirmations[index]} disabled={busy} onChange={(event) => setConfirmations((old) => old.map((checked, position) => position === index ? event.target.checked : checked))} />)}<p className={styles.muted}>This is your readiness check — not a veterinary clearance.</p><p>Ride has not started. Ask the assigned Groom or Trainer to review readiness if you are not ready.</p>{gates.length > 0 && <AlertBanner type="warning" title="Start blocked">{gates.join(' ')}</AlertBanner>}{error && <AlertBanner type="danger" title="Could not start session">{error}</AlertBanner>}{conflict && <Button variant="secondary" onClick={() => { state.reload(); navigate(`/rider/assignments/${id}`); }}>Reload assignment</Button>}</div></Modal>}
    {report && <IssueDialog session={session} api={api} onClose={() => { setReport(false); state.reload(); }} onSaved={(code) => { setReported(code); setReport(false); state.reload(); }} />}
  </div>;
}
/** Figma WR-D6 "Your ride": server-recorded values only; nothing is calculated here. */
function YourRide({ state }: { state: ReturnType<typeof useRiderSession> }) {
  return <Card title="Your ride"><div className={styles.facts}><KeyValue label="Distance" value={value(state.result?.actual.totalDistanceM, 'm')} /><KeyValue label="Duration" value={value(state.result?.actual.durationMin, 'min')} /><KeyValue label="Peak heart rate" value={value(state.result?.actual.maxHeartRate, 'bpm')} /></div>{Boolean(state.resultError) && <AlertBanner type="warning" title="Result metrics unavailable">{errorMessage(state.resultError)}</AlertBanner>}</Card>;
}
/** Figma WR-D6 "Your Rider Feedback" card. */
function YourFeedback({ id, feedback }: { id: number; feedback: NonNullable<ReturnType<typeof useRiderSession>['result']>['riderFeedback'] | null }) {
  const quote = feedback && [feedback.responses.horseResponse, feedback.responses.strideFeeling, feedback.responses.notes].find((text) => typeof text === 'string' && text.trim());
  return <Card title="Your Rider Feedback" action={feedback ? <span className={styles.chip}>SUBMITTED {new Date(feedback.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span> : undefined}>{feedback ? <div className={styles.smallStack}>{quote && <p>“{quote}”</p>}<p className={styles.muted}>Visible to your Trainer in Session Review.</p></div> : <div className={styles.smallStack}><p className={styles.muted}>Not submitted yet.</p><Link className={styles.link} to={`/rider/sessions/${id}/feedback`}>Give Rider Feedback</Link></div>}</Card>;
}
export function Exercises({ session }: { session: RiderSession }) {
  return <div className={styles.smallStack}>{session.exercises.map((exercise) => <article key={exercise.id} className={styles.exercise}><h3>{exercise.exerciseOrder}. {exercise.exerciseName}</h3><p>{value(exercise.distanceM, 'm')} · {exercise.repetitions === null || exercise.repetitions === undefined ? 'Repetitions not supplied' : `${exercise.repetitions} rep(s)`} · {exercise.intensity ?? 'Intensity not supplied'}</p><p className={styles.muted}>Duration {value(exercise.durationMin, 'min')} · Rest {value(exercise.restIntervalMin, 'min')} · {exercise.surface ?? session.surface ?? 'Surface not supplied'}</p></article>)}</div>;
}
