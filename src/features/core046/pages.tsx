import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, SelectField, StatusBadge, Tabs, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { ROUTES } from '../../app/routePaths';
import { ApiError, collectPages } from './client';
import type { GroomTreatmentTask, Incident, IncidentCreateRequest, IncidentStatus } from './contract';
import { INCIDENT_TYPES } from './contract';
import { useCore046Session } from './session';
import { IncidentReportModal, type IncidentSource } from '../../shared/incidents';
import styles from './core046.module.css';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <ErrorState title="Could not load data" description={message} onRetry={retry} />;
}

function pageError(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 401) return 'Your session has expired. Sign in again.';
  if (cause instanceof ApiError && cause.status === 403) return 'You do not have access to this data.';
  return cause instanceof Error ? cause.message : 'Unknown error.';
}

export function TreatmentTasksPage() {
  const { client } = useCore046Session();
  const [tasks, setTasks] = useState<GroomTreatmentTask[] | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const completingId = useRef<number | null>(null);
  const [tab, setTab] = useState('today');
  const [horse, setHorse] = useState('all');
  const [reportSource, setReportSource] = useState<IncidentSource | null>(null);
  const [reportedCode, setReportedCode] = useState('');
  const load = useCallback(() => {
    setError(''); setTasks(null);
    collectPages((page) => client.listTreatmentTasks(page)).then(setTasks).catch((cause: unknown) => setError(pageError(cause)));
  }, [client]);
  useEffect(() => {
    let active = true;
    collectPages((page) => client.listTreatmentTasks(page)).then((items) => { if (active) setTasks(items); }).catch((cause: unknown) => { if (active) setError(pageError(cause)); });
    return () => { active = false; };
  }, [client]);

  const horses = useMemo(() => [...new Set((tasks || []).map((item) => item.horseId))].sort((a, b) => a - b).map((id) => ({ id, label: `Horse #${id}` })), [tasks]);
  const today = localDay(new Date());
  const filtered = (tasks || []).filter((task) => (horse === 'all' || String(task.horseId) === horse) &&
    (tab === 'completed' ? task.status === 'COMPLETED' : task.status === 'PENDING' && (tab === 'today' ? task.taskDate <= today : task.taskDate > today)));
  const grouped = [...filtered.reduce((groups, task) => {
    const items = groups.get(task.horseId) || [];
    items.push(task);
    groups.set(task.horseId, items);
    return groups;
  }, new Map<number, GroomTreatmentTask[]>())];

  async function complete(id: number) {
    if (completingId.current !== null) return;
    completingId.current = id;
    setBusyId(id); setActionError('');
    try {
      await client.completeTreatmentTask(id);
      setTasks(await collectPages((page) => client.listTreatmentTasks(page)));
    } catch (cause) { setActionError(pageError(cause)); }
    finally { completingId.current = null; setBusyId(null); }
  }

  function openReport(source: IncidentSource) {
    setReportedCode('');
    setReportSource(source);
  }

  return <>
    <PageHeader title="My Care & Medication Tasks" description="Veterinarian instructions assigned to you" />
    {reportedCode && <AlertBanner type="success" title={`Incident ${reportedCode} submitted.`} />}
    <div className={styles.treatmentLayout}><Card title="Treatment tasks">
      <p className={styles.hint}>Only your assigned treatment tasks appear here. Completion time and your identity are recorded by the server.</p>
      {!tasks && !error ? <LoadingState label="Loading assigned tasks…" /> : error ? <ErrorPanel message={error} retry={load} /> : <>
        <div className={styles.filters}><Tabs label="Task period" items={[{ value: 'today', label: `Today · ${tasks!.filter((item) => item.status === 'PENDING' && item.taskDate <= today).length}` }, { value: 'upcoming', label: `Upcoming · ${tasks!.filter((item) => item.status === 'PENDING' && item.taskDate > today).length}` }, { value: 'completed', label: `Completed · ${tasks!.filter((item) => item.status === 'COMPLETED').length}` }]} value={tab} onChange={setTab} idPrefix="treatment-period" />
          <SelectField label="Horse" value={horse} onChange={(event) => setHorse(event.target.value)} options={[{ value: 'all', label: 'All my horses' }, ...horses.map((item) => ({ value: String(item.id), label: item.label }))]} />
        </div>
        {actionError && <AlertBanner type="danger" title="Task completion could not be confirmed">{actionError} <Button variant="secondary" onClick={load}>Refresh tasks</Button></AlertBanner>}
        {filtered.length === 0 ? <EmptyState title="No treatment tasks" description="There are no assigned tasks for this selection." /> : <div className={styles.taskList}>{grouped.map(([horseId, horseTasks]) => <section key={horseId} className={styles.horseGroup} aria-label={`Horse #${horseId} treatment tasks`}>
          <h3>Horse #{horseId}</h3>
          {horseTasks.map((task) => <article key={task.id} className={styles.taskRow}>
            <div className={styles.taskMain}><strong>{task.instruction}</strong><span>{task.taskDate}{task.scheduledSlot ? ` · ${task.scheduledSlot}` : ''}</span></div>
            <div className={styles.taskActions}>
              {task.status === 'COMPLETED' ? <span className={styles.completed}>✓ Completed{task.completedAt ? ` ${formatDate(task.completedAt)}` : ''}</span> : <Button variant="secondary" disabled={busyId !== null} onClick={() => complete(task.id)}>{busyId === task.id ? 'Completing…' : 'Mark complete'}</Button>}
              <Button variant="tertiary" size="sm" aria-label={`Report Incident for task ${task.id} on horse ${task.horseId}`} onClick={() => openReport({ kind: 'groom', horseId: task.horseId, horseLabel: `Horse #${task.horseId}`, careTaskId: task.id, contextLabel: `From treatment task #${task.id} · Horse #${task.horseId} · ${task.taskDate}` })}>Report Incident</Button>
            </div>
          </article>)}
        </section>)}</div>}
      </>}
    </Card>
    <aside className={styles.treatmentSide} aria-label="Treatment guidance">
      <Card title="What you can do here"><p className={styles.hint}>Mark an assigned task complete when you have done it. The server records the completion time and actor.</p><p className={styles.hint}>Follow the Veterinarian’s instructions exactly. Health Status and Training Availability are set by the Veterinarian.</p></Card>
      <Card title="Something looks wrong?"><p className={styles.hint}>Report an incident so the Veterinarian can review it.</p><Button onClick={() => openReport({ kind: 'groom' })}>Report Incident</Button></Card>
    </aside></div>
    {reportSource && <IncidentReportModal open source={reportSource} horses={horses} onClose={() => setReportSource(null)} onSubmit={async (request) => { const created = await client.reportIncident(request); setReportedCode(created.incidentCode); }} />}
  </>;
}

export function IncidentsPage() {
  const { client, user } = useCore046Session();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [horse, setHorse] = useState('all');
  const [status, setStatus] = useState('all');
  const [reported, setReported] = useState('30');
  const [loadedAt] = useState(() => Date.now());
  const [reportOpen, setReportOpen] = useState(false);
  const [submitted, setSubmitted] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const navigate = useNavigate();
  const load = useCallback(() => {
    setError(''); setRefreshError(''); setIncidents(null);
    collectPages((page) => client.listIncidents(page)).then(setIncidents).catch((cause: unknown) => setError(pageError(cause)));
  }, [client]);
  useEffect(() => {
    let active = true;
    collectPages((page) => client.listIncidents(page)).then((items) => { if (active) setIncidents(items); }).catch((cause: unknown) => { if (active) setError(pageError(cause)); });
    return () => { active = false; };
  }, [client]);
  const horses = useMemo(() => [...new Set((incidents || []).map((item) => item.horseId))].sort((a, b) => a - b).map((id) => ({ id, label: `Horse #${id}` })), [incidents]);
  const filtered = (incidents || []).filter((item) => (horse === 'all' || String(item.horseId) === horse) && (status === 'all' || item.status === status) &&
    (reported === 'all' || new Date(item.reportedAt).getTime() >= loadedAt - Number(reported) * 86400000) &&
    `${item.incidentCode} ${item.horseId} ${item.description || ''}`.toLowerCase().includes(query.toLowerCase()));
  const canReport = ['GROOM', 'WORK_RIDER', 'TRAINER', 'HEAD_TRAINER'].includes(user.role);

  async function submit(request: IncidentCreateRequest) {
    const created = await client.reportIncident(request);
    setSubmitted(`Incident ${created.incidentCode} submitted.`);
    try {
      setIncidents(await collectPages((page) => client.listIncidents(page)));
      setRefreshError('');
    } catch (cause) {
      setRefreshError(pageError(cause));
    }
  }

  return <>
    <PageHeader title="Incidents" description={user.role === 'GROOM' ? 'Incidents you reported' : 'Incident reports'} actions={canReport && user.role === 'GROOM' ? <Button onClick={() => setReportOpen(true)}>Report Incident</Button> : undefined} />
    {submitted && <AlertBanner type="success" title={submitted} />}
    {refreshError && <AlertBanner type="warning" title="Incident submitted, but the list could not be refreshed">{refreshError} <Button variant="secondary" onClick={load}>Refresh incidents</Button></AlertBanner>}
    <Card title="Filters"><div className={styles.filters}>
      <TextField label="Search" type="search" placeholder="Search incident or horse ID…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <SelectField label="Horse" value={horse} onChange={(event) => setHorse(event.target.value)} options={[{ value: 'all', label: 'All' }, ...horses.map((item) => ({ value: String(item.id), label: item.label }))]} />
      <SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: 'all', label: 'All' }, ...(['REPORTED', 'UNDER_REVIEW', 'RESOLVED'] as const).map((item) => ({ value: item, label: item.replace('_', ' ') }))]} />
      <SelectField label="Reported" value={reported} onChange={(event) => setReported(event.target.value)} options={[{ value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'all', label: 'All time' }]} />
    </div></Card>
    <Card title="Incident list">
      {!incidents && !error ? <LoadingState label="Loading incidents…" /> : error ? <ErrorPanel message={error} retry={load} /> :
        <DataTable caption="Incidents" rows={filtered} rowKey={(item) => item.id} onRowClick={(item) => navigate(ROUTES.incidentDetail.replace(':incidentId', String(item.id)))} empty={<EmptyState title="No incidents" description="No incident matches these filters." />}
          columns={[{ key: 'incident', header: 'INCIDENT', render: (item) => item.incidentCode }, { key: 'horse', header: 'HORSE', render: (item) => `Horse #${item.horseId}` }, { key: 'observation', header: 'OBSERVATION', render: (item) => <span>{INCIDENT_TYPES.find((type) => type.value === item.incidentType)?.label || item.incidentType}<br /><small>{item.observedSeverity}</small></span> }, { key: 'reporter', header: 'REPORTED BY', render: (item) => `User #${item.reportedByUserId}` }, { key: 'reported', header: 'REPORTED AT', render: (item) => formatDate(item.reportedAt) }, { key: 'status', header: 'STATUS', render: (item) => <StatusBadge family="incident" status={item.status} /> }, { key: 'reviewer', header: 'REVIEWED BY', render: () => '—' }, { key: 'open', header: '', render: () => '›' }]} />}
    </Card>
    {reportOpen && <IncidentReportModal open source={{ kind: 'groom' }} horses={horses} onClose={() => setReportOpen(false)} onSubmit={submit} />}
  </>;
}

export function IncidentDetailPage() {
  const { client } = useCore046Session();
  const { incidentId } = useParams();
  const id = Number(incidentId);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    if (!Number.isSafeInteger(id) || id < 1) { setError('Invalid incident ID.'); return; }
    setError(''); setIncident(null);
    client.getIncident(id).then(setIncident).catch((cause: unknown) => setError(pageError(cause)));
  }, [client, id]);
  useEffect(() => {
    if (!Number.isSafeInteger(id) || id < 1) return;
    let active = true;
    client.getIncident(id).then((item) => { if (active) setIncident(item); }).catch((cause: unknown) => { if (active) setError(pageError(cause)); });
    return () => { active = false; };
  }, [client, id]);
  if (!Number.isSafeInteger(id) || id < 1) return <ErrorState title="Invalid incident ID" description="Open an incident from the list." />;
  return <>
    <PageHeader title={incident ? `Incident ${incident.incidentCode}` : 'Incident detail'} description="Reporter-safe incident details" actions={<Link to={ROUTES.incidents}>Back to incidents</Link>} />
    {!incident && !error ? <LoadingState label="Loading incident…" /> : error ? <ErrorPanel message={error} retry={load} /> : <>
      <Card title="Handling status"><div className={styles.statusRow}><StatusBadge family="incident" status={incident!.status as IncidentStatus} /><span>Only the Veterinarian advances this status.</span></div></Card>
      <Card title="Report"><div className={styles.detailGrid}>
        <KeyValue label="Horse" value={`Horse #${incident!.horseId}`} />
        <KeyValue label="Incident type" value={INCIDENT_TYPES.find((item) => item.value === incident!.incidentType)?.label || incident!.incidentType} />
        <KeyValue label="Observed at" value={formatDate(incident!.observedAt)} />
        <KeyValue label="Severity (reporter)" value={incident!.observedSeverity} />
        <KeyValue label="Description" value={incident!.description || '—'} />
        <KeyValue label="Reported by" value={`User #${incident!.reportedByUserId}`} />
        <KeyValue label="Photos" value="Unavailable until the incident photo API is approved" />
      </div></Card>
      <Card title="Source"><p className={styles.hint}>{incident!.preSessionCheckId ? `Pre-session check #${incident!.preSessionCheckId}` : incident!.trainingSessionId ? `Training session #${incident!.trainingSessionId}` : incident!.careTaskId ? `Care task #${incident!.careTaskId}` : 'Direct report'}</p></Card>
      <Card title="Timeline"><p className={styles.hint}>Reported {formatDate(incident!.reportedAt)} · {incident!.status.replace('_', ' ')}</p></Card>
    </>}
  </>;
}
