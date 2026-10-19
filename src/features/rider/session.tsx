import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, KeyValue, MetricCard, StatusBadge } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { Exercises } from './assignment';
import { ReadState, RiderShell } from './common';
import { errorMessage, useRiderApi, useRiderSession, value } from './data';
import { IssueDialog, MetricDialog } from './dialogs';
import { isTerminal } from './types';
import styles from './rider.module.css';

export function RiderSessionPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied); const { id = '' } = useParams();
  return <RiderShell>{!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 ? <EmptyState title="Ride not found" /> : <ActiveSession key={id} id={Number(id)} api={api} />}</RiderShell>;
}
function ActiveSession({ id, api }: { id: number; api: RiderApi }) {
  const [busy, setBusy] = useState(false); const pending = useRef(false); const [conflictAt, setConflictAt] = useState<number | null>(null);
  const state = useRiderSession(id, api, !busy);
  const { handleApiError } = useAuth(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<'issue' | 'metric' | null>(null);
  if (!state.session || (state.error instanceof ApiError && (state.error.status === 403 || state.error.status === 404))) return <ReadState error={state.error} loading={!state.session} retry={state.reload} />;
  const session = state.session;
  const conflict = conflictAt !== null && state.snapshotVersion <= conflictAt;
  const terminal = isTerminal(session.status);
  const sample = state.result?.samples?.at(-1);
  const stale = Boolean(state.error);
  async function complete() {
    if (pending.current || conflict || stale || session.status !== 'IN_PROGRESS') return;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.complete(id);
      if (response.id !== id || response.status !== 'COMPLETED') throw new ApiError(200, 'INVALID_RESPONSE', 'Completion could not be confirmed. Reload the ride.');
      navigate(`/rider/sessions/${id}/feedback`);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflictAt(state.snapshotVersion);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  function close() { setDialog(null); state.reload(); }
  return <div className={styles.stack}><Link className={styles.link} to={`/rider/assignments/${id}`}>← Assignment</Link><div className={styles.header}><div><h1 className={styles.heading}>Active Session</h1><p>{session.horse.name} · {session.sessionCode} · {session.surface ?? 'Surface not supplied'}</p><p className={styles.muted}>Trackside / office view. Do not operate this screen while riding.</p></div><div className={styles.actions}>{!terminal && session.status !== 'SCHEDULED' && <><Button variant="secondary" disabled={busy || stale} onClick={() => setDialog('issue')}>Report Issue</Button><Button variant="secondary" disabled={busy || stale} onClick={() => setDialog('metric')}>Add sample</Button></>}{session.status === 'IN_PROGRESS' && <Button disabled={busy || stale || conflict} onClick={complete}>{busy ? 'Finishing…' : 'Finish Session'}</Button>}{terminal && <Link className={styles.link} to={`/rider/sessions/${id}/feedback`}>{session.hasRiderFeedback ? 'View Rider Feedback' : 'Give Rider Feedback'}</Link>}<Button variant="secondary" disabled={busy} onClick={state.reload}>Refresh ride</Button></div></div>
    <div className={`${styles.state} ${styles.stateRow} ${session.status === 'PAUSED' ? styles.paused : session.status === 'INTERRUPTED' ? styles.interrupted : ''}`}><div><h2>{session.status === 'PAUSED' ? 'SESSION PAUSED — BY YOUR TRAINER' : session.status === 'INTERRUPTED' ? 'SESSION INTERRUPTED — NOT COMPLETED' : session.status.replaceAll('_', ' ')}</h2><p>{session.status === 'PAUSED' ? 'Walk safely and wait. Only your Trainer can resume the session.' : session.interruptionReason || 'Follow the assigned training instructions.'}{session.actualStart && Number.isFinite(Date.parse(session.actualStart)) ? ` · Started ${new Date(session.actualStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}` : ''}</p></div>{!terminal && session.actualStart && <Elapsed start={session.actualStart} />}</div>
    <p className={styles.muted}>REST synchronization every 5 seconds · {state.syncedAt ? `Last updated ${new Date(state.syncedAt).toLocaleTimeString()}` : 'Awaiting synchronization'}. WebSocket connection is not established by this screen.</p>
    {stale && <AlertBanner type="danger" title="Synchronization lost — displayed state may be stale">{errorMessage(state.error)} Actions are disabled until a successful refresh.</AlertBanner>}
    {Boolean(state.resultError) && <AlertBanner type="warning" title="Metrics snapshot unavailable">{errorMessage(state.resultError)} Values remain unavailable until the server supplies them.</AlertBanner>}
    {notice && <AlertBanner type="success" title={notice} />}{error && <AlertBanner type="danger" title="Action could not be confirmed">{error}</AlertBanner>}
    {state.result?.actual.simulated && <AlertBanner type="warning" title="SIMULATED DATA — Source: Simulator">These samples come from the simulator, not real training measurements.</AlertBanner>}
    <div className={styles.metrics}><MetricCard label="Duration" value={value(state.result?.actual.durationMin, 'min')} /><MetricCard label="Recorded distance" value={value(state.result?.actual.totalDistanceM, 'm')} /><MetricCard label="Latest speed" value={value(sample?.speedKmh, 'km/h')} /><MetricCard label="Latest heart rate" value={value(sample?.heartRate, 'bpm')} /></div>
    <div className={styles.columns}><Card title="Assigned exercise sequence"><Exercises session={session} /><p className={styles.muted}>Current exercise / repetition progression is not supplied by the approved contract; no progression is inferred from measurements.</p></Card><aside className={styles.stack}><Card title="Trainer controls"><p>Pause, Resume and Stop are the Trainer’s interventions from Live Monitoring. They are not Work Rider actions.</p><p className={styles.muted}>This view refreshes to reflect the state returned by the server.</p></Card><Card title="Recorded session"><div className={styles.smallStack}><StatusBadge family="session" status={session.status} /><KeyValue label="Actual start" value={session.actualStart ?? 'Not supplied'} /><KeyValue label="Actual end" value={session.actualEnd ?? 'Not supplied'} /><KeyValue label="Trainer" value={session.trainer?.fullName ?? 'Not supplied'} /></div></Card></aside></div>
    {dialog === 'issue' && <IssueDialog session={session} api={api} onClose={close} onSaved={(code) => { setNotice(`Issue ${code} submitted`); close(); }} />}
    {dialog === 'metric' && <MetricDialog session={session} api={api} onClose={close} onSaved={() => { setNotice('Manual sample recorded'); close(); }} />}
  </div>;
}

/** Figma WR-D3 elapsed clock: wall-clock time since the server's actualStart; not a training measurement. */
function Elapsed({ start }: { start: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(start)) / 1000));
  if (!Number.isFinite(seconds)) return null;
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <div className={styles.elapsed}><span>Elapsed</span><strong>{text}</strong></div>;
}
