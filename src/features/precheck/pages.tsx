import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, ErrorState, KeyValue, LoadingState, MetricCard, RadioGroup, StatusBadge, TextField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { IncidentReportModal } from '../../shared/incidents';
import { createPrecheckApi, type PrecheckApi } from './api';
import { CHECK_ITEMS, type CheckKey, type Checklist, type PrecheckSession, type PreSessionCheck } from './types';
import styles from './precheck.module.css';

function localDay() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function when(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function message(error: unknown) { return error instanceof Error ? error.message : 'Unable to load the requested data.'; }
function GroomShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.user?.roles.includes('GROOM')) return <AlertBanner type="danger" title="Access denied">Only the assigned Groom may access pre-session checks.</AlertBanner>;
  return <AppShell user={{ fullName: auth.user.fullName, role: 'GROOM' }} breadcrumb={[{ label: 'Stable Care', to: '/groom/today' }, { label: 'Pre-session checks' }]}>{children}</AppShell>;
}

export function GroomTodayPage({ api: suppliedApi }: { api?: PrecheckApi }) {
  const auth = useAuth();
  const api = useMemo(() => suppliedApi ?? createPrecheckApi({ handleApiError: auth.handleApiError }), [suppliedApi, auth.handleApiError]);
  return <GroomShell><GroomToday api={api} /></GroomShell>;
}

function GroomToday({ api }: { api: PrecheckApi }) {
  const { handleApiError, user } = useAuth();
  const [date, setDate] = useState(localDay);
  const [attempt, setAttempt] = useState(0);
  const [sessions, setSessions] = useState<PrecheckSession[] | null>(null);
  const [error, setError] = useState<unknown>();
  const [summary, setSummary] = useState<{ tasks?: number; incidents?: number; unavailable?: boolean }>({});
  useEffect(() => {
    let active = true;
    api.sessions(date).then((items) => { if (active) setSessions(items); }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    Promise.allSettled([api.treatmentTasks(), api.incidents()]).then(([tasks, incidents]) => {
      if (!active) return;
      if (tasks.status === 'rejected') handleApiError(tasks.reason);
      if (incidents.status === 'rejected') handleApiError(incidents.reason);
      setSummary({ tasks: tasks.status === 'fulfilled' ? tasks.value.filter((task) => task.status === 'PENDING').length : undefined, incidents: incidents.status === 'fulfilled' ? incidents.value.length : undefined, unavailable: tasks.status === 'rejected' || incidents.status === 'rejected' });
    });
    return () => { active = false; };
  }, [api, date, attempt, handleApiError]);
  const retry = () => { setSessions(null); setError(undefined); setAttempt((value) => value + 1); };
  return <div className={styles.stack}>
    <div className={styles.header}><div><h1 className={styles.heading}>Good morning, {user?.fullName}</h1><p className={styles.muted}>Your assigned pre-session checks, treatment tasks and incidents</p></div><Link className={styles.link} to="/incidents">View Incidents</Link></div>
    <TextField label="Session date" type="date" value={date} onChange={(event) => { setSessions(null); setError(undefined); setDate(event.target.value); }} />
    <div className={styles.metrics}><MetricCard label="Pre-session checks" value={sessions ? String(sessions.length) : '—'} /><MetricCard label="Open treatment tasks" value={summary.tasks === undefined ? '—' : String(summary.tasks)} /><MetricCard label="My reported incidents" value={summary.incidents === undefined ? '—' : String(summary.incidents)} /></div>
    {summary.unavailable && <AlertBanner type="warning" title="Some summaries are unavailable">Open the treatment or incident screen to retry. Pre-session checks remain available.</AlertBanner>}
    <div className={styles.columns}><Card title="Pre-session checks">
      {error ? <ErrorState title={error instanceof ApiError && error.status === 403 ? 'Access denied' : 'Could not load your sessions'} description={message(error)} onRetry={retry} /> : !sessions ? <LoadingState label="Loading assigned sessions…" /> : sessions.length === 0 ? <EmptyState title="No assigned pre-session checks" description="There are no sessions assigned to you for this date." /> : [...sessions].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)).map((session) => <article key={session.id} className={styles.session}>
        <div className={styles.sessionInfo}><h3>{session.horse.name} · {session.horse.horseCode}</h3><p>{when(session.scheduledStart)} · {session.focus || session.phaseName}</p><p className={styles.muted}>Work Rider {session.workRider.fullName}{session.trainer ? ` · Trainer ${session.trainer.fullName}` : ''}</p><StatusBadge family="session" status={session.status} /> <span>{session.preCheckResult ? session.preCheckResult === 'ALL_NORMAL' ? 'Check cleared' : 'Abnormal — start blocked' : 'Check pending'}</span></div>
        <Link className={styles.link} to={`/training/my-sessions/${session.id}/pre-check`}>{session.preCheckResult ? 'View Pre-Session Check' : 'Start Pre-Session Check'}</Link>
      </article>)}
      <p className={styles.muted}>Record observations only. If anything is abnormal, the session stays scheduled and blocked until reviewed.</p>
    </Card><aside className={styles.stack}><Card title="Treatment tasks"><p>Follow the Veterinarian’s instructions and record completion only.</p><Link className={styles.link} to="/medical/my-tasks">View Treatment Tasks</Link></Card><Card title="My incidents"><p>View the handling status of incidents you reported.</p><Link className={styles.link} to="/incidents">View Incidents</Link></Card></aside></div>
  </div>;
}

export function PrecheckPage({ api: suppliedApi }: { api?: PrecheckApi }) {
  const auth = useAuth();
  const { id = '' } = useParams();
  const api = useMemo(() => suppliedApi ?? createPrecheckApi({ handleApiError: auth.handleApiError }), [suppliedApi, auth.handleApiError]);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return <GroomShell><EmptyState title="Session not found" /></GroomShell>;
  return <GroomShell><PrecheckContent key={`${auth.user?.id}:${id}`} id={Number(id)} api={api} /></GroomShell>;
}

function PrecheckContent({ id, api }: { id: number; api: PrecheckApi }) {
  const { handleApiError } = useAuth();
  const [session, setSession] = useState<PrecheckSession>();
  const [check, setCheck] = useState<PreSessionCheck>();
  const [draft, setDraft] = useState<Partial<Checklist>>({});
  const [error, setError] = useState<unknown>();
  const [actionError, setActionError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [incidentCode, setIncidentCode] = useState('');
  useEffect(() => {
    let active = true;
    api.session(id).then((data) => {
      if (!active) return;
      if (data.id !== id) throw new ApiError(200, 'INVALID_RESPONSE', 'The server returned a different session.');
      setSession(data); setCheck(data.preSessionCheck ?? undefined);
      setConflict(false); setActionError('');
      if (data.preSessionCheck) setDraft(data.preSessionCheck.checks);
    }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    return () => { active = false; };
  }, [id, api, attempt, handleApiError]);
  const reload = () => { setSession(undefined); setError(undefined); setAttempt((value) => value + 1); };
  const abnormal = CHECK_ITEMS.some(({ key }) => draft[key]?.result === 'ABNORMAL');
  const locked = busy || Boolean(check) || conflict || session?.status !== 'SCHEDULED';
  const startGate = check ? 'Reload the session to confirm the remaining start gates.' : session?.blocked ? session.blockedMessage || session.blockedReasons.join(', ') || 'Blocked' : 'No reported block';
  async function save() {
    if (pending.current || check || conflict) return;
    if (CHECK_ITEMS.some(({ key }) => !draft[key]?.result)) { setActionError('Choose Normal or Abnormal for all five checks.'); return; }
    if (CHECK_ITEMS.some(({ key }) => (draft[key]?.observation?.length ?? 0) > 1000)) { setActionError('Each observation must be at most 1000 characters.'); return; }
    pending.current = true; setBusy(true); setActionError('');
    try {
      const saved = await api.submit(id, draft as Checklist);
      if (saved.sessionId !== id || !Number.isSafeInteger(saved.id) || saved.id < 1) throw new ApiError(201, 'INVALID_RESPONSE', 'Check response could not be confirmed. Reload before retrying.');
      setCheck(saved);
      if (saved.overallResult === 'ABNORMAL') setReportOpen(true);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflict(true);
        setActionError(cause instanceof ApiError && cause.status === 409 ? 'A check may already be recorded. Reload the session before continuing; your observations have been kept.' : message(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  function update(key: CheckKey, change: Partial<Checklist[CheckKey]>) {
    setDraft((old) => ({ ...old, [key]: { ...old[key], ...change } }));
  }
  if (error) return <ErrorState title={error instanceof ApiError && error.status === 403 ? 'Access denied' : 'Pre-session check unavailable'} description={message(error)} onRetry={reload} />;
  if (!session) return <LoadingState label="Loading pre-session check…" />;
  return <div className={styles.stack}>
    <Link className={styles.link} to="/groom/today">← Back to Today</Link>
    <div className={styles.header}><div><h1 className={styles.heading}>Pre-Session Check · {session.horse.name}</h1><p className={styles.muted}>{session.horse.horseCode} · {session.sessionCode} · {when(session.scheduledStart)} · Work Rider {session.workRider.fullName}</p></div><StatusBadge family="session" status={session.status} /></div>
    {incidentCode && <AlertBanner type="success" title={`Incident ${incidentCode} submitted`}>The Veterinarian can review this report. The check does not change Training Availability.</AlertBanner>}
    <div className={styles.columns}><Card title="Observation checklist"><p className={styles.muted}>Record what you observe. Choose Abnormal for anything unusual — you do not need to decide what is wrong.</p>
      {CHECK_ITEMS.map(({ key, label, hint }) => <div key={key} className={`${styles.item} ${draft[key]?.result === 'ABNORMAL' ? styles.abnormal : ''}`}><RadioGroup label={label} helperText={hint} value={draft[key]?.result ?? ''} onChange={(result) => update(key, { result: result as 'NORMAL' | 'ABNORMAL' })} options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'ABNORMAL', label: 'Abnormal' }]} disabled={locked} className={styles.checkRow} /><TextField label={`${label} observation (optional)`} placeholder="Observation" value={draft[key]?.observation ?? ''} maxLength={1000} disabled={locked} onChange={(event) => update(key, { observation: event.target.value })} className={styles.observation} /></div>)}
    </Card><aside className={styles.stack}><Card title="Readiness context (read-only)"><div className={styles.summary}><KeyValue label="Training Availability" value={session.trainingAvailability ?? 'Not supplied'} /><KeyValue label="Start gate" value={startGate} /><KeyValue label="Trainer" value={session.trainer?.fullName ?? 'Not supplied'} /></div></Card><AlertBanner type="info" title="Observation only">Diagnosis, Health Status, Training Availability and restrictions are decided by the Veterinarian.</AlertBanner></aside></div>
    {check ? <AlertBanner type={check.overallResult === 'ABNORMAL' ? 'danger' : 'success'} title={check.overallResult === 'ABNORMAL' ? 'ABNORMAL — this session must not start' : 'ALL NORMAL — pre-session check recorded'}>Checked {when(check.performedAt)} by {check.performedBy.fullName}. {check.overallResult === 'ABNORMAL' ? 'Report an incident so a veterinarian can review. No incident is created until you submit the report.' : 'The Work Rider can start from the assignment when the remaining start gates are clear.'} The session remains {session.status}.</AlertBanner> : abnormal ? <AlertBanner type="danger" title="This horse is not fit to train right now. Report an incident so a veterinarian can review.">Record the abnormal check before reporting. The session stays SCHEDULED and blocked; no incident is automatically created.</AlertBanner> : <AlertBanner type="info" title="Complete all five observations">Completing a normal check clears this gate; it does not start the session.</AlertBanner>}
    {actionError && <AlertBanner type="danger" title="Check could not be confirmed">{actionError}</AlertBanner>}
    <div className={styles.actions}><Link className={styles.link} to="/groom/today">Back to Today</Link><div className={styles.actions}>{conflict && <Button variant="secondary" onClick={reload} disabled={busy}>Reload session</Button>}{check?.overallResult === 'ABNORMAL' && !incidentCode ? <Button onClick={() => setReportOpen(true)}>Report Incident</Button> : !check && !conflict && session.status === 'SCHEDULED' ? <Button disabled={busy} onClick={save}>{busy ? 'Recording…' : abnormal ? 'Report Incident' : 'Complete Pre-Session Check'}</Button> : null}</div></div>
    {reportOpen && check?.overallResult === 'ABNORMAL' && <IncidentReportModal open source={{ kind: 'groom', horseId: session.horse.id, horseLabel: `${session.horse.name} · ${session.horse.horseCode}`, preSessionCheckId: check.id, contextLabel: `From pre-session check #${check.id} · ${session.sessionCode}` }} onClose={() => setReportOpen(false)} onSubmit={async (body) => { const incident = await api.reportIncident(body); setIncidentCode(incident.incidentCode); setReportOpen(false); }} />}
  </div>;
}
