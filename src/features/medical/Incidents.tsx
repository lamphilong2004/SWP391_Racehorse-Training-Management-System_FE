import { UiPreviewNotice } from './UiPreviewNotice';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertBanner, ButtonLink, Button, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, SelectField, StatusBadge, TextField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { RoleCode } from '../../shared/auth/roles';
import { IncidentReportModal, type IncidentCreateRequest } from '../../shared/incidents';
import { MEDICAL_ROUTES } from './paths';
import { createIncidentService, type IncidentService } from './incidentService';
import { readHorseIdentity } from './horseRead';
import type { Incident } from './models';
import { ApiError } from '../../shared/auth/authApi';
import './medical.css';
const allowed: RoleCode[] = ['VETERINARIAN', 'HEAD_TRAINER', 'CLUB_MANAGER', 'TRAINER', 'WORK_RIDER', 'GROOM'];
const incidentPath = (id: number) => MEDICAL_ROUTES.incidents + '/' + id;
const casePath = (id: number) => MEDICAL_ROUTES.medicalCaseDetail.replace(':caseId', String(id));
const displayDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const labelType = (value: string) => value.toLowerCase().replaceAll('_', ' ');
function safeError(error: unknown) {
  if (error instanceof ApiError && error.status === 403) return 'Access denied. This incident is not available to your account.';
  if (error instanceof ApiError && error.status === 404) return 'Incident not found.';
  if (error instanceof ApiError && error.status === 409) return 'The incident changed or conflicts with this action. Refresh and try again.';
  return 'Unable to load or update this report. Please try again.';
}
export function IncidentAccess({ detail = false }: { detail?: boolean }) {
  const auth = useAuth(), actor = auth.user, token = authSession.read()?.accessToken;
  const role = actor?.roles.find((r) => allowed.includes(r));
  const service = useMemo(() => token && actor ? createIncidentService(token, actor, auth.handleApiError) : null, [token, actor, auth.handleApiError]);
  const horse = useMemo(() => token ? (id: number) => readHorseIdentity(token, id, auth.handleApiError) : undefined, [token, auth.handleApiError]);
  if (auth.status !== 'authenticated' || !actor || actor.accountStatus !== 'ACTIVE' || !role || !service) return <AlertBanner type="danger" title="Access denied" />;
  return <AppShell user={{ fullName: actor.fullName, role }} breadcrumb={[{ label: 'Incidents', to: MEDICAL_ROUTES.incidents }]}>
    <UiPreviewNotice />
    <div className="medical-stack" key={`${actor.id}:${auth.expiresAt}`}>
      {detail ? <IncidentDetailPage service={service} role={role} horse={horse} /> : <IncidentListPage service={service} role={role} actorId={actor.id} horse={horse} />}
    </div>
  </AppShell>;
}
function useIncidentRead<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0), [state, setState] = useState<{ source?: () => Promise<T>; data?: T; error?: string }>({});
  useEffect(() => { let active = true; load().then((data) => { if (active) setState({ source: load, data }); }).catch((error: unknown) => { if (active) setState({ source: load, error: safeError(error) }); }); return () => { active = false; }; }, [load, revision]);
  return { ...(state.source === load ? state : {}), reload: () => { setState({}); setRevision((n) => n + 1); } };
}
function State({ error, reload }: { error?: string; reload: () => void }) { return error ? <ErrorState title="Incident unavailable" description={error} onRetry={reload} /> : <LoadingState label="Loading incidents…" />; }
type HorseReader = (id: number) => ReturnType<typeof readHorseIdentity>;
export function IncidentListPage({ service, role, actorId, horse }: { service: IncidentService; role: RoleCode; actorId: number; horse?: HorseReader }) {
  const [page, setPage] = useState(0), [query, setQuery] = useState(''), [status, setStatus] = useState(''), [horseFilter, setHorseFilter] = useState('');
  const [report, setReport] = useState(false), [success, setSuccess] = useState('');
  const load = useCallback(() => service.list(page), [service, page]);
  const state = useIncidentRead(load);
  const horses = [...new Set(state.data?.items.map((item) => item.horseId) ?? [])];
  const rows = state.data?.items.filter((item) => (!status || item.status === status) && (!horseFilter || String(item.horseId) === horseFilter) && [item.incidentCode, item.horseId, item.description].join(' ').toLowerCase().includes(query.toLowerCase())) ?? [];
  async function submit(input: IncidentCreateRequest) { try { const created = await service.report(input); setSuccess(`Incident ${created.incidentCode} submitted.`); state.reload(); } catch (error) { throw new Error(safeError(error), { cause: error }); } }
  return <div className="medical-stack">
    <PageHeader title="Incidents" description={role === 'GROOM' ? 'Incidents you reported' : 'Incident reports'} actions={role === 'GROOM' ? <Button onClick={() => setReport(true)}>Report Incident</Button> : undefined} />
    {success && <AlertBanner type="success" title={success}>Recorded report. Only the Veterinarian changes its handling status.</AlertBanner>}
    <div className="medical-incident-filters"><TextField label="Search current page" placeholder="Search incident or horse ID…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <SelectField label="Horse (current page)" value={horseFilter} placeholder="All horses" options={horses.map((id) => ({ value: String(id), label: `Horse ${id}` }))} onChange={(event) => setHorseFilter(event.target.value)} />
      <SelectField label="Status (current page)" value={status} placeholder="All statuses" options={['REPORTED', 'UNDER_REVIEW', 'RESOLVED'].map((value) => ({ value, label: value.replace('_', ' ') }))} onChange={(event) => setStatus(event.target.value)} />
    </div>
    <Card title="Incident list">{!state.data ? <State error={state.error} reload={state.reload} /> : <div className="medical-stack"><DataTable caption="Incidents" rows={rows} rowKey={(item) => item.id} empty={<EmptyState title="No incidents" description="No reports match this page and these filters." />} columns={[
      { key: 'code', header: 'INCIDENT', render: (item) => <Link to={incidentPath(item.id)}>{item.incidentCode}</Link> },
      { key: 'horse', header: 'HORSE', render: (item) => <IncidentHorse horseId={item.horseId} read={horse} /> },
      { key: 'observation', header: 'OBSERVATION', render: (item) => <span className="medical-capitalize">{labelType(item.incidentType)}<br /><small>{item.observedSeverity}</small></span> },
      { key: 'reporter', header: 'REPORTED BY', render: (item) => item.reportedByUserId === actorId ? 'You' : `User ${item.reportedByUserId}` },
      { key: 'reported', header: 'REPORTED AT', render: (item) => <time dateTime={item.reportedAt}>{displayDate(item.reportedAt)}</time> },
      { key: 'status', header: 'STATUS', render: (item) => <StatusBadge family="incident" status={item.status} /> },
      { key: 'reviewer', header: 'REVIEWED BY', render: () => 'Unavailable' },
    ]} /><div className="medical-actions"><Button variant="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} · {state.data.totalElements} reports</span><Button variant="secondary" disabled={(page + 1) * state.data.size >= state.data.totalElements} onClick={() => setPage(page + 1)}>Next</Button></div></div>}</Card>
    <p className="text-caption">Filters apply to the current page. Only the Veterinarian advances incident status.</p>
    {report && <IncidentReportModal open source={{ kind: 'groom' }} horses={horses.map((id) => ({ id, label: `Horse ${id}` }))} onClose={() => setReport(false)} onSubmit={submit} />}
  </div>;
}
function IncidentHorse({ horseId, read }: { horseId: number; read?: HorseReader }) {
  const load = useCallback(() => read ? read(horseId) : Promise.reject(new Error('No identity projection')), [read, horseId]);
  const state = useIncidentRead(load);
  return state.data ? <span>{state.data.name}<br /><small>{state.data.horseCode}</small></span> : <span>Horse {horseId}</span>;
}
function IncidentHorseStatus({ horseId, read }: { horseId: number; read?: HorseReader }) {
  const load = useCallback(() => read ? read(horseId) : Promise.reject(new Error('Identity unavailable')), [read, horseId]);
  const state = useIncidentRead(load);
  return <Card title="Horse status now">{state.data ? <div className="medical-stack"><KeyValue label="Health Status" value={state.data.healthStatus ? <StatusBadge family="health" status={state.data.healthStatus} /> : 'Not assessed'} /><KeyValue label="Training Availability" value={<StatusBadge family="availability" status={state.data.trainingAvailability} />} /><p className="text-caption">Reporting an incident does not change these statuses. Only the veterinary team updates them.</p></div> : <p>Horse status details are unavailable.</p>}</Card>;
}
export function IncidentDetailPage({ service, role, horse }: { service: IncidentService; role: RoleCode; horse?: HorseReader }) {
  const { incidentId = '' } = useParams(); const id = Number(incidentId);
  if (!/^\d+$/.test(incidentId) || !Number.isSafeInteger(id) || id < 1) return <div className="medical-stack"><ButtonLink variant="tertiary" to={MEDICAL_ROUTES.incidents}>← Back to incidents</ButtonLink><EmptyState title="Incident not found" /></div>;
  return <IncidentDetail key={id} id={id} service={service} role={role} horse={horse} />;
}
function IncidentDetail({ id, service, role, horse }: { id: number; service: IncidentService; role: RoleCode; horse?: HorseReader }) {
  const load = useCallback(() => service.get(id), [service, id]), state = useIncidentRead(load);
  const [busy, setBusy] = useState(false), [caseId, setCaseId] = useState(''), [error, setError] = useState('');
  const locked = useRef(false), mounted = useRef(true), navigate = useNavigate();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function review(action: 'OPEN_CASE' | 'LINK_CASE' | 'RESOLVE') {
    const current = state.data;
    if (locked.current || !current || role !== 'VETERINARIAN' || current.status === 'RESOLVED') return;
    if (action !== 'RESOLVE' && (current.status !== 'REPORTED' || current.medicalCaseId)) return;
    const target = Number(caseId);
    if (action === 'LINK_CASE' && (!Number.isSafeInteger(target) || target < 1)) { setError('Enter a valid positive case ID.'); return; }
    locked.current = true; setBusy(true); setError('');
    try { const updated = await service.review(id, action, action === 'LINK_CASE' ? target : undefined); if (!mounted.current) return; if (action === 'OPEN_CASE' && updated.medicalCaseId) navigate(casePath(updated.medicalCaseId)); else state.reload(); }
    catch (cause) { if (mounted.current) setError(safeError(cause)); } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  const item: Incident | undefined = state.data;
  return <div className="medical-stack"><ButtonLink variant="tertiary" to={MEDICAL_ROUTES.incidents}>← Back to incidents</ButtonLink>
    {!item ? <State error={state.error} reload={state.reload} /> : <>
      <PageHeader title={item.incidentCode} description={`${labelType(item.incidentType)} · ${displayDate(item.reportedAt)}`} actions={<StatusBadge family="incident" status={item.status} />} />
      <div className="medical-progress" aria-label="Handling status">{(['REPORTED', 'UNDER_REVIEW', 'RESOLVED'] as const).map((status) => <span key={status} className={status === item.status ? 'medical-progress-active' : ''}><StatusBadge family="incident" status={status} /></span>)}<p>Only the Veterinarian advances this status.</p></div>
      <div className="medical-grid medical-treatment-layout"><div className="medical-stack">
        <Card title="Report"><div className="medical-incident-details"><KeyValue label="Horse" value={<IncidentHorse horseId={item.horseId} read={horse} />} /><KeyValue label="Observed at" value={<time dateTime={item.observedAt}>{displayDate(item.observedAt)}</time>} /><KeyValue label="Type" value={labelType(item.incidentType)} /><KeyValue label="Severity (reporter)" value={item.observedSeverity} /><KeyValue label="Description" value={item.description || 'No description supplied.'} /><KeyValue label="Reported by" value={`User ${item.reportedByUserId}`} /></div></Card>
        <Card title="Source"><p>{item.preSessionCheckId ? `Pre-session check ${item.preSessionCheckId}` : item.trainingSessionId ? `Training session ${item.trainingSessionId}` : item.careTaskId ? `Care task ${item.careTaskId}` : 'Direct report'}</p></Card>
        <Card title="Timeline"><p><time dateTime={item.reportedAt}>{displayDate(item.reportedAt)}</time> · Reported</p><p>Current status: {item.status.replace('_', ' ')}</p></Card>
      </div><aside className="medical-stack"><IncidentHorseStatus horseId={item.horseId} read={horse} /><Card title="Handling">
        {item.medicalCaseId && role === 'VETERINARIAN' && <ButtonLink to={casePath(item.medicalCaseId)}>Medical case {item.medicalCaseId}</ButtonLink>}
        {role !== 'VETERINARIAN' ? <p>Reporter-safe read-only view. Clinical records are restricted to the veterinary team.</p> : item.status === 'RESOLVED' ? <p>This incident is resolved. No further handling actions are available.</p> : <div className="medical-stack">
          {error && <AlertBanner type="danger" title={error} />}
          {item.status === 'REPORTED' && !item.medicalCaseId && <><Button disabled={busy} onClick={() => review('OPEN_CASE')}>Open medical case</Button><TextField label="Existing open case ID" type="number" min={1} step={1} value={caseId} onChange={(event) => setCaseId(event.target.value)} /><Button variant="secondary" disabled={busy || !caseId} onClick={() => review('LINK_CASE')}>Link case</Button></>}
          <Button variant="secondary" disabled={busy} onClick={() => review('RESOLVE')}>Resolve incident</Button>
        </div>}
      </Card></aside></div>
    </>}
  </div>;
}
