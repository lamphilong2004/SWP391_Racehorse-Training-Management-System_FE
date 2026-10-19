import { useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, RadioGroup, StatusBadge, TextAreaField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { ReadState, RiderShell } from './common';
import { errorMessage, useRiderApi, useRiderSession, when } from './data';
import { isTerminal, type RiderFeedbackInput } from './types';
import styles from './rider.module.css';

export function RiderFeedbackPage({ api: supplied }: { api?: RiderApi }) {
  const api = useRiderApi(supplied); const { id = '' } = useParams();
  return <RiderShell>{!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 ? <EmptyState title="Ride not found" /> : <Feedback key={id} id={Number(id)} api={api} />}</RiderShell>;
}
function Feedback({ id, api }: { id: number; api: RiderApi }) {
  const state = useRiderSession(id, api); const { handleApiError } = useAuth();
  const [responses, setResponses] = useState<NonNullable<RiderFeedbackInput['responses']>>({});
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [saved, setSaved] = useState(false); const [conflictAt, setConflictAt] = useState<number | null>(null); const [error, setError] = useState('');
  if (!state.session || state.error) return <ReadState error={state.error} loading={!state.session} retry={state.reload} />;
  const session = state.session;
  const conflict = conflictAt !== null && state.snapshotVersion <= conflictAt;
  const interrupted = session.status === 'INTERRUPTED';
  const existing = state.result?.riderFeedback;
  const locked = busy || saved || conflict || Boolean(existing) || Boolean(session.hasRiderFeedback);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current || locked || !isTerminal(session.status)) return;
    if (Object.entries(responses).some(([key, text]) => text != null && text.length > (key === 'notes' || key === 'preInterruptionDescription' ? 1000 : 500))) { setError('Feedback text exceeds the approved field limit.'); return; }
    const payload = { responses: Object.fromEntries(Object.entries(responses).filter(([key]) => interrupted || key !== 'preInterruptionDescription').map(([key, text]) => [key, text?.trim() || null])) };
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.feedback(id, payload);
      if (response.sessionId !== id || !Number.isSafeInteger(response.id) || response.id < 1) throw new ApiError(201, 'INVALID_RESPONSE', 'Feedback could not be confirmed. Reload before retrying.');
      setSaved(true);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflictAt(state.snapshotVersion);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  const selected = existing?.responses ?? responses;
  function update(key: keyof RiderFeedbackInput['responses'], text: string) { setResponses((old) => ({ ...old, [key]: text })); }
  return <div className={styles.stack}><Link className={styles.link} to={`/rider/assignments/${id}`}>← Assignment</Link><h1 className={styles.heading}>Rider Feedback</h1><p className={styles.muted}>Submit when safely able — from the trackside workstation or office.</p>{!isTerminal(session.status) ? <AlertBanner type="warning" title="Feedback is not available yet">Finish the session or wait for an interrupted outcome. Current status: {session.status}.</AlertBanner> : <div className={styles.columns}><Card><form onSubmit={submit} className={styles.stack}>
    <RadioGroup label={interrupted ? 'Horse response before the stop' : 'How did he respond?'} value={selected.horseResponse ?? ''} onChange={(text) => update('horseResponse', text)} disabled={locked} options={['Strong', 'Normal', 'Sluggish'].map((text) => ({ value: text, label: text }))} />
    <RadioGroup label={interrupted ? 'Balance and handling before the stop' : 'Balance and handling'} value={selected.balance ?? ''} onChange={(text) => update('balance', text)} disabled={locked} options={['Good', 'Some issues', 'Difficult'].map((text) => ({ value: text, label: text }))} />
    <TextAreaField label="Breathing observations" value={selected.breathing ?? ''} disabled={locked} maxLength={500} onChange={(event) => update('breathing', event.target.value)} />
    <TextAreaField label="Stride feeling" value={selected.strideFeeling ?? ''} disabled={locked} maxLength={500} onChange={(event) => update('strideFeeling', event.target.value)} />
    <TextAreaField label="Anything unusual?" value={selected.abnormalBehavior ?? ''} disabled={locked} maxLength={500} onChange={(event) => update('abnormalBehavior', event.target.value)} />
    {interrupted && <TextAreaField label="What did you notice before the stop?" value={selected.preInterruptionDescription ?? ''} disabled={locked} maxLength={1000} onChange={(event) => update('preInterruptionDescription', event.target.value)} />}
    <TextAreaField label="Notes (optional)" value={selected.notes ?? ''} disabled={locked} maxLength={1000} onChange={(event) => update('notes', event.target.value)} />
    <AlertBanner type="info" title={`The session stays ${session.status}`}>Feedback never completes an interrupted session. Your feedback is available to the Trainer for review.</AlertBanner>
    {(saved || existing || session.hasRiderFeedback) && <AlertBanner type="success" title="Rider Feedback submitted">{existing ? `Submitted ${when(existing.submittedAt)}.` : 'Only one feedback submission is allowed for this ride.'}</AlertBanner>}
    {error && <AlertBanner type="danger" title="Feedback could not be confirmed">{error}</AlertBanner>}
    {conflict ? <Button variant="secondary" onClick={state.reload}>Reload feedback</Button> : !saved && !existing && !session.hasRiderFeedback ? <Button type="submit" disabled={locked}>{busy ? 'Submitting…' : 'Submit Feedback'}</Button> : null}
    </form></Card><Card title={`${session.horse.name} · ${session.focus || session.phaseName}`}><p>{session.sessionCode} · {when(session.scheduledStart)}</p><StatusBadge family="session" status={session.status} /><p>Trainer {session.trainer?.fullName ?? 'Not supplied'} · Rider {session.workRider.fullName}</p>{interrupted && <p>{session.interruptionReason || 'Interruption reason not supplied.'}</p>}{Boolean(state.resultError) && <AlertBanner type="warning" title="Feedback snapshot unavailable">{errorMessage(state.resultError)} The backend still enforces one submission per session.</AlertBanner>}<Link className={styles.link} to="/rider/history">View Riding History</Link></Card></div>}</div>;
}
