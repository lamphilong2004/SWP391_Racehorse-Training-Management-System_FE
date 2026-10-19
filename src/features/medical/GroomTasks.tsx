import { ROUTES } from '../../app/routePaths';
import { UiPreviewNotice } from './UiPreviewNotice';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AlertBanner, Button, Card, Checkbox, EmptyState, Icon, SelectField, StatusBadge } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { ApiError } from '../../shared/auth/authApi';
import { collectAssignedTasks, createGroomService, type GroomService, type GroomTreatmentTask } from './groomService';
import type { HorseIdentity } from './horseRead';
import './medical.css';

function groomError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again.';
    if (error.status === 403) return 'Access denied. Only your assigned treatment tasks can be accessed.';
    if (error.status === 409) return 'Task changed or was already completed. Refresh assigned tasks before retrying.';
    if (error.status === 404) return 'Treatment task service or task is unavailable.';
    if (error.code === 'INVALID_RESPONSE') return 'Treatment task data does not match the authorized contract. Reload to retry.';
  }
  return 'Unable to confirm treatment task data. Retry or refresh assigned tasks.';
}

export function GroomTreatmentAccess() {
  const auth = useAuth(), actor = auth.user, token = authSession.read()?.accessToken;
  const service = useMemo(() => actor && token ? createGroomService(token, actor.id, auth.handleApiError) : null,
    [actor, token, auth.handleApiError]);
  if (auth.status !== 'authenticated' || actor?.accountStatus !== 'ACTIVE' || !actor.roles.includes('GROOM')) return <AlertBanner type="danger" title="Access denied" />;
  if (!service) return <AlertBanner type="danger" title="Sign in again to access assigned tasks" />;
  return <AppShell user={{ fullName: actor.fullName, role: 'GROOM' }} breadcrumb={[{ label: 'Stable Care' }, { label: 'Care Tasks' }]}>
    <UiPreviewNotice />
    <GroomTasks key={`${actor.id}:${auth.expiresAt}`} service={service} />
  </AppShell>;
}

export function GroomTasks({ service }: { service: GroomService }) {
  const [state, setState] = useState<{ tasks?: GroomTreatmentTask[]; error?: string }>({});
  const [identities, setIdentities] = useState<{ source?: GroomTreatmentTask[]; rows: Record<number, HorseIdentity>; error?: string }>({ rows: {} });
  const [revision, setRevision] = useState(0), [filter, setFilter] = useState('today'), [horse, setHorse] = useState('');
  const [busy, setBusy] = useState<number | null>(null), [action, setAction] = useState<{ success?: string; error?: string }>({});
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    collectAssignedTasks(service).then((tasks) => { if (active) setState({ tasks }); })
      .catch((error: unknown) => { if (active) setState({ error: groomError(error) }); });
    return () => { active = false; };
  }, [service, revision]);
  useEffect(() => {
    let active = true;
    if (state.tasks && service.horse) {
      const source = state.tasks;
      const ids = [...new Set(source.map((task) => task.horseId))];
      Promise.allSettled(ids.map((id) => service.horse!(id))).then((responses) => {
        if (!active) return;
        const rows: Record<number, HorseIdentity> = {};
        responses.forEach((r) => { if (r.status === 'fulfilled') rows[r.value.id] = r.value; });
        setIdentities({ source, rows, ...(responses.some((r) => r.status === 'rejected') ? { error: 'Some horse details are unavailable. Assigned task instructions remain visible.' } : {}) });
      });
    }
    return () => { active = false; };
  }, [state.tasks, service]);
  const reload = useCallback(() => { setState({}); setRevision((v) => v + 1); }, []);
  // Date-only taskDate is a calendar day; do not shift it by interpreting it as a UTC timestamp.
  const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const tasks = useMemo(() => state.tasks ?? [], [state.tasks]);
  const filtered = tasks.filter((t) => (!horse || t.horseId === Number(horse)) &&
    (filter === 'completed' ? t.status === 'COMPLETED' : filter === 'upcoming' ? t.status === 'PENDING' && t.taskDate > today : filter === 'all' ? true : t.taskDate === today));
  const horseIds = [...new Set(tasks.map((t) => t.horseId))];
  const names = identities.source === state.tasks ? identities.rows : {};
  const handleComplete = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const taskId = Number(event.currentTarget.value);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (pending.current || task.status !== 'PENDING') return;
    pending.current = true; setBusy(task.id); setAction({});
    try {
      await service.complete(task.id);
      if (!mounted.current) return;
      setAction({ success: `Task ${task.id} completed.` });
      reload();
    } catch (error) { if (mounted.current) setAction({ error: groomError(error) }); }
    finally { pending.current = false; if (mounted.current) setBusy(null); }
  }, [tasks, service, reload]);
  return <div className="medical-stack">
    <PageHeader title="My Care & Medication Tasks" description="Assigned to you from the Veterinarian’s treatment plans" />
    {action.success && <AlertBanner type="success" title={action.success} />}
    {action.error && <AlertBanner type="danger" title={action.error} />}
    {identities.source === state.tasks && identities.error && <AlertBanner type="warning" title={identities.error} />}
    <div className="medical-groom-filters">
      <div className="medical-actions" role="group" aria-label="Task filters">{[['today', 'Today'], ['upcoming', 'Upcoming'], ['completed', 'Completed'], ['all', 'All assigned']].map(([value, label]) =>
        <button key={value} type="button" className="medical-chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <SelectField label="Horse" placeholder="All my horses" value={horse} options={horseIds.map((id) => ({ value: String(id), label: names[id]?.name ?? `Horse ${id}` }))} onChange={(e) => setHorse(e.target.value)} />
    </div>
    <div className="medical-grid medical-treatment-layout"><div className="medical-stack">
      {!state.tasks ? state.error ? <><AlertBanner type="danger" title={state.error} /><Button onClick={reload}>Retry</Button></> : <p role="status">Loading assigned treatment tasks…</p> :
        !filtered.length ? <EmptyState title="No assigned tasks for this filter" /> :
          [...new Set(filtered.map((t) => t.horseId))].map((horseId) => <Card key={horseId} className="medical-groom-panel" title={names[horseId] ? `${names[horseId].name} · ${names[horseId].horseCode}${names[horseId].currentBoxCode ? ` · Box ${names[horseId].currentBoxCode}` : ''}` : `Horse ${horseId}`}>
            {names[horseId] && <div className="medical-actions">{names[horseId].healthStatus && <StatusBadge family="health" status={names[horseId].healthStatus} />}<StatusBadge family="availability" status={names[horseId].trainingAvailability} /></div>}
            <div className="medical-stack">{filtered.filter((t) => t.horseId === horseId).map((task) => <article key={task.id} className="medical-groom-task">
              <div className="medical-groom-task-row">
                <Checkbox className={task.status === 'COMPLETED' ? 'medical-completed-checkbox' : undefined} label="" aria-label={`Complete task ${task.id}`} value={task.id} checked={task.status === 'COMPLETED'} disabled={busy !== null || task.status === 'COMPLETED'} onChange={handleComplete} />
                <div><strong>{task.instruction}</strong><p className="text-caption">Horse {task.horseId} · {task.taskDate}</p></div>
                {task.scheduledSlot && <span className="medical-slot"><Icon name="clock" size={14} />{task.scheduledSlot}</span>}
                <p className="text-caption">{task.completedAt ? <>Completed <time dateTime={task.completedAt}>{new Date(task.completedAt).toLocaleString()}</time></> : busy === task.id ? 'Completing…' : 'Not completed'}</p>
              </div>
              <p className="medical-instruction"><Icon name="file-text" size={14} />Instruction: {task.instruction}</p>
            </article>)}</div>
          </Card>)}
    </div><aside className="medical-stack">
      <Card className="medical-groom-panel" title="What you can do here"><div className="medical-help"><p>Mark an assigned task complete — the server records the time and your identity.</p><p>Read the Veterinarian’s instruction for each task.</p><p className="text-caption">Diagnosis, treatment plans and prescriptions are not shown or editable here.</p><p className="text-caption">Health Status and Training Availability are set by the Veterinarian only.</p></div></Card>
      <Card className="medical-groom-panel" title="Something looks wrong?"><p>If a horse looks worse while you do a task, report it so the Veterinarian can review.</p><a href={ROUTES.incidents}>Report Incident →</a></Card>
    </aside></div>
  </div>;
}
