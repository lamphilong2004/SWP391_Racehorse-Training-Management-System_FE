import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, KeyValue, SelectField, StatusBadge, TextField, Tabs } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { ROUTES } from '../../app/routePaths';
import { MedicalForm } from './MedicalForm';
import { TreatmentPlanEditor } from './TreatmentPlanEditor';
import { InjuryMap } from './InjuryMap';
import { BODY_REGIONS } from './bodyRegions';
import type { ClinicalSeverity, Incident, MedicalCase, RecoveryStatus, TrainingAvailability } from './models';
import { useMedicalRuntime } from './runtimeContext';
import { medicalErrorMessage } from './errors';
import './medical.css';

const casePath = (id: number) => ROUTES.medicalCaseDetail.replace(':caseId', String(id));
const incidentPath = (id: number) => ROUTES.incidents + '/' + id;
const positiveId = (value: string) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Enter a valid positive numeric ID.');
  return id;
};
function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string; source?: () => Promise<T> }>({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    load().then((data) => { if (active) setState({ data, source: load }); })
      .catch((error: unknown) => { if (active) setState({ error: medicalErrorMessage(error, 'Unable to load data.'), source: load }); });
    return () => { active = false; };
  }, [load, revision]);
  return { ...(state.source === load ? state : {}), reload: () => { setState({}); setRevision((value) => value + 1); } };
}
function ResourceState({ error, retry }: { error?: string; retry: () => void }) {
  return error ? <div className="medical-stack"><AlertBanner type="danger" title={error} /><Button onClick={retry}>Retry</Button></div> : <p role="status">Loading medical data…</p>;
}
function History({ children, empty, count }: { children: ReactNode; empty: string; count: number }) {
  return count ? <ul className="medical-history">{children}</ul> : <EmptyState title={empty} />;
}
function AvailabilityCard({ horseId }: { horseId: number }) {
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.getAvailability(horseId), [service, horseId]);
  const { data, error, reload } = useResource(load);
  return <Card title="Training availability">
    {!data ? <ResourceState error={error} retry={reload} /> :
      <div className="medical-stack"><AvailabilityDetails availability={data} /><p className="text-caption">Restrictions are managed separately. Closing a case does not lift one.</p></div>}
  </Card>;
}
function AvailabilityDetails({ availability }: { availability: TrainingAvailability }) {
  return <div className="medical-actions"><StatusBadge family="availability" status={availability.availability} />
    <span>{availability.reason || 'No active medical restriction'}</span></div>;
}

export function CaseListPage() {
  const { service } = useMedicalRuntime();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const load = useCallback(() => service.listCases(page), [service, page]);
  const { data, error, reload } = useResource(load);
  const rows = data?.items.filter((item) => [item.id, item.horseId, item.reason].join(' ').toLowerCase().includes(query.toLowerCase())) ?? [];
  return <><PageHeader title="Medical Cases" description="Veterinary case records" />
    <div className="medical-actions"><Link to={ROUTES.medicalCaseNew}>Create independent case</Link><Link to={ROUTES.herdHealth}>Herd health</Link><Link to={ROUTES.incidents}>Incidents</Link></div>
    <Card title="Cases"><TextField label="Search current page" value={query} onChange={(event) => setQuery(event.target.value)} />
      {!data ? <ResourceState error={error} retry={reload} /> :
        <div className="medical-stack"><DataTable<MedicalCase> caption="Medical cases" rows={rows} rowKey={(item) => item.id} empty={<EmptyState title="No medical cases" />} columns={[
          { key: 'id', header: 'Case', render: (item) => <Link to={casePath(item.id)}>{item.id}</Link> },
          { key: 'horse', header: 'Horse', render: (item) => item.horseId },
          { key: 'reason', header: 'Reason', render: (item) => item.reason ?? '—' },
          { key: 'status', header: 'Status', render: (item) => item.status },
        ]} /><div className="medical-actions"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} · {data.totalElements} total</span><Button variant="secondary" disabled={(page + 1) * data.size >= data.totalElements} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
    </Card></>;
}

export function CreateCasePage() {
  const { service } = useMedicalRuntime();
  const navigate = useNavigate();
  return <><Link to={ROUTES.medical}>Back to cases</Link><PageHeader title="Create Medical Case" />
    <Card title="Independent case"><MedicalForm submitLabel="Create case" onCancel={() => navigate(ROUTES.medical)} fields={[
      { name: 'horseId', label: 'Horse ID', type: 'number', required: true },
      { name: 'reason', label: 'Reason', type: 'textarea', required: true, maxLength: 2000 },
    ]} onSave={async (values) => {
      const item = await service.createCase({ horseId: positiveId(values.horseId), reason: values.reason });
      navigate(casePath(item.id));
    }} /><p className="text-caption">To open a case from an incident, use Incident review.</p></Card></>;
}

export function HerdHealthPage() {
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.getHerdHealth(), [service]);
  const { data, error, reload } = useResource(load);
  return <><div className="medical-actions medical-page-heading"><PageHeader title="Herd Health Overview" description="Health Status and Training Availability are separate" /><Link to={ROUTES.medical}>View Medical Cases</Link></div>
    {!data ? <ResourceState error={error} retry={reload} /> : <div className="medical-stack">
      <p className="text-caption">{data.totalHorses} horses · {data.unassessed} unassessed</p>
      <div className="medical-grid medical-herd-grid">
        {[['Fit', data.fit], ['Monitoring', data.monitoring], ['Injured', data.injured], ['Quarantined', data.quarantined]].map(([label, value]) =>
          <Card key={label} title={String(label)}><p className="medical-metric">{value}</p></Card>)}
      </div>
      <Card title="Training availability"><p>Availability is derived separately per horse. Open a medical case or incident to view the current availability and restriction reason.</p></Card>
    </div>}</>;
}

export function CaseDetailPage() {
  const { caseId = '' } = useParams();
  const { service } = useMedicalRuntime();
  const id = Number(caseId);
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid medical case ID.');
    return service.getCase(id);
  }, [service, id]);
  const { data, error, reload } = useResource(load);
  if (!Number.isSafeInteger(id) || id < 1) return <EmptyState title="Medical case not found" />;
  if (!data) return <ResourceState error={error} retry={reload} />;
  return <CaseDetails item={data} reload={reload} />;
}
function CaseDetails({ item, reload }: { item: MedicalCase; reload: () => void }) {
  const { service } = useMedicalRuntime();
  const [panel, setPanel] = useState('record');
  const [closeError, setCloseError] = useState('');
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const closed = item.status === 'CLOSED';
  return <><Link to={ROUTES.medical}>Back to cases</Link>
    <PageHeader title={'Medical Case · ' + item.id} description={'Horse ' + item.horseId} />
    <div className="medical-grid"><Card title="Case overview"><div className="medical-stack">
      <KeyValue label="Status" value={item.status} /><KeyValue label="Reason" value={item.reason ?? '—'} />
      <KeyValue label="Opened" value={item.openedAt} /><KeyValue label="Linked incidents" value={item.incidentIds.join(', ') || 'None'} />
    </div></Card><AvailabilityCard horseId={item.horseId} /></div>
    <Tabs label="Medical case sections" idPrefix="case" value={panel} onChange={setPanel} items={[
      { value: 'record', label: 'Record' }, { value: 'examination', label: 'Examination' },
      { value: 'injury', label: 'Injury' }, { value: 'treatment', label: 'Treatment' },
      { value: 'recovery', label: 'Re-examination' },
    ]} />
    <div role="tabpanel" id="case-panel-record" aria-labelledby="case-tab-record" hidden={panel !== 'record'} className="medical-stack">
      <Card title="Current condition"><KeyValue label="Latest diagnosis" value={item.examinations.at(-1)?.diagnosis ?? 'Awaiting examination'} />
        <KeyValue label="Recovery" value={item.reexaminations.at(-1)?.recoveryStatus ?? 'Not assessed'} />
        <KeyValue label="Next review" value={item.treatmentPlan?.reexaminationDate ?? 'Not scheduled'} /></Card>
      {!closed && <Card title="Close medical case"><p>The server requires an examination or re-examination. If an injury or treatment plan exists, the latest re-examination must be RECOVERED. Treatment tasks must be complete, linked incidents resolved and case restrictions lifted.</p>
        {closeError && <AlertBanner type="danger" title={closeError} />}
        {confirmClose ? <div className="medical-actions"><span>Close case {item.id}?</span><Button disabled={closing} onClick={async () => {
          setClosing(true); setCloseError('');
          try { await service.closeCase(item.id); reload(); } catch (failure) { setCloseError(medicalErrorMessage(failure, 'Unable to close case.')); } finally { setClosing(false); }
        }}>{closing ? 'Closing…' : 'Confirm close'}</Button><Button variant="secondary" onClick={() => setConfirmClose(false)}>Cancel</Button></div> :
          <Button variant="secondary" onClick={() => setConfirmClose(true)}>Close case</Button>}</Card>}
    </div>
    <div role="tabpanel" id="case-panel-examination" aria-labelledby="case-tab-examination" hidden={panel !== 'examination'} className="medical-stack">
      <Card title="Examinations"><History count={item.examinations.length} empty="No examinations">{item.examinations.map((exam) =>
        <li key={exam.id}><strong>{exam.examinedAt}</strong><p>{exam.symptoms}</p><p>{exam.diagnosis || 'No diagnosis'} · {exam.severity || 'Severity not set'}</p></li>)}</History>
        {!closed && <MedicalForm submitLabel="Save examination" fields={[
          { name: 'symptoms', label: 'Symptoms and findings', type: 'textarea', required: true },
          { name: 'diagnosis', label: 'Diagnosis', type: 'textarea', maxLength: 1000 },
          { name: 'severity', label: 'Severity', options: ['MILD', 'MODERATE', 'SEVERE'] },
          { name: 'healthStatus', label: 'Horse health status', options: ['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'] },
        ]} onSave={async (values) => { await service.addExamination(item.id, {
          symptoms: values.symptoms, examinedAt: new Date().toISOString(),
          ...(values.diagnosis ? { diagnosis: values.diagnosis } : {}),
          ...(values.severity ? { severity: values.severity as ClinicalSeverity } : {}),
          ...(values.healthStatus ? { healthStatus: values.healthStatus as 'FIT' | 'MONITORING' | 'INJURED' | 'QUARANTINED' } : {}),
        }); reload(); }} />}</Card>
    </div>
    <div role="tabpanel" id="case-panel-injury" aria-labelledby="case-tab-injury" hidden={panel !== 'injury'} className="medical-stack">
      <InjuryMap injuries={item.injuries} />
      <Card title="Injury records"><History count={item.injuries.length} empty="No injuries">{item.injuries.map((injury) =>
        <li key={injury.id}>{injury.bodyRegion} · {injury.severity} · {injury.recoveryStatus}{injury.position3d && <p>Position marker: {injury.position3d}</p>}</li>)}</History>
        {!closed && <MedicalForm submitLabel="Save injury" fields={[
          { name: 'bodyRegion', label: 'Body region', options: BODY_REGIONS, required: true },
          { name: 'severity', label: 'Severity', options: ['MILD', 'MODERATE', 'SEVERE'], required: true },
          { name: 'recoveryStatus', label: 'Recovery status', options: ['NOT_RECOVERED', 'IMPROVING', 'RECOVERED'], required: true },
          { name: 'position3d', label: 'Position marker (optional)', maxLength: 100 },
          { name: 'side', label: 'Side (optional)', maxLength: 20 },
        ]} onSave={async (values) => { await service.addInjury(item.id, {
          bodyRegion: values.bodyRegion, severity: values.severity as ClinicalSeverity,
          recoveryStatus: values.recoveryStatus as RecoveryStatus,
          ...(values.position3d ? { position3d: values.position3d } : {}),
          ...(values.side ? { side: values.side } : {}),
        }); reload(); }} />}</Card>
    </div>
    <div role="tabpanel" id="case-panel-treatment" aria-labelledby="case-tab-treatment" hidden={panel !== 'treatment'} className="medical-stack">
      <Card title="Treatment plan">{item.treatmentPlan ? <div className="medical-stack">
        <KeyValue label="Treatment and medication" value={item.treatmentPlan.treatmentMedicationInstructions} />
        <KeyValue label="Rest" value={item.treatmentPlan.restInstructions ?? '—'} />
        <KeyValue label="Care" value={item.treatmentPlan.careInstructions ?? '—'} />
        <KeyValue label="Re-examination" value={item.treatmentPlan.reexaminationDate ?? 'Not scheduled'} />
      </div> : <EmptyState title="No treatment plan" />}
        {!closed && <Link to={casePath(item.id) + '/treatment-plan'}>Open treatment plan editor</Link>}</Card>
      <CaseTasks caseId={item.id} />
    </div>
    <div role="tabpanel" id="case-panel-recovery" aria-labelledby="case-tab-recovery" hidden={panel !== 'recovery'} className="medical-stack">
      <Card title="Re-examinations"><History count={item.reexaminations.length} empty="No re-examinations">{item.reexaminations.map((exam) =>
        <li key={exam.id}>{exam.recoveryStatus}<p>{exam.findings}</p><small>{exam.examinedAt}</small></li>)}</History>
        {!closed && <MedicalForm submitLabel="Save re-examination" fields={[
          { name: 'recoveryStatus', label: 'Recovery status', options: ['NOT_RECOVERED', 'IMPROVING', 'RECOVERED'], required: true },
          { name: 'findings', label: 'Findings', type: 'textarea', required: true },
          { name: 'healthStatus', label: 'Horse health status', options: ['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'] },
        ]} onSave={async (values) => { await service.addReexamination(item.id, {
          recoveryStatus: values.recoveryStatus as RecoveryStatus, findings: values.findings,
          examinedAt: new Date().toISOString(),
          ...(values.healthStatus ? { healthStatus: values.healthStatus as 'FIT' | 'MONITORING' | 'INJURED' | 'QUARANTINED' } : {}),
        }); reload(); }} />}</Card>
    </div>
  </>;
}
export function TreatmentPlanPage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const { service } = useMedicalRuntime();
  const id = Number(caseId);
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid medical case ID.');
    const medicalCase = await service.getCase(id);
    const tasks = [] as Awaited<ReturnType<typeof service.listCaseTasks>>['items'];
    if (medicalCase.treatmentPlan) {
      for (let page = 0; ; page += 1) {
        const result = await service.listCaseTasks(id, page);
        tasks.push(...result.items);
        if (tasks.length >= result.totalElements) break;
        if (result.items.length === 0 || result.size < 1) throw new Error('Treatment tasks could not be loaded completely. Editing is unavailable.');
      }
    }
    return { medicalCase, tasks };
  }, [service, id]);
  const { data, error, reload } = useResource(load);
  if (!Number.isSafeInteger(id) || id < 1) return <EmptyState title="Medical case not found" />;
  if (!data) return <ResourceState error={error} retry={reload} />;
  const { medicalCase, tasks } = data;
  const initial = {
    ...medicalCase.treatmentPlan,
    groomTasks: tasks.filter((task) => task.status === 'PENDING').map((task) => ({ assignedGroomUserId: task.assignedGroomUserId, instruction: task.instruction, taskDate: task.taskDate, scheduledSlot: task.scheduledSlot })),
  };
  return <><Link to={casePath(id)}>Back to medical case</Link>
    <PageHeader title={'Treatment Plan · Horse ' + medicalCase.horseId} description={'Medical case ' + id} />
    {saved && <AlertBanner type="success" title="Treatment plan saved" />}
    <div className="medical-grid medical-treatment-layout"><div className="medical-stack">
      <Card title="Plan period"><KeyValue label="Case opened" value={medicalCase.openedAt} /><KeyValue label="Next re-examination" value={medicalCase.treatmentPlan?.reexaminationDate ?? 'Not scheduled'} /></Card>
      {medicalCase.status === 'CLOSED' ? <AlertBanner type="danger" title="Closed cases cannot be edited" /> :
        <TreatmentPlanEditor key={medicalCase.treatmentPlan?.id ?? 'new'} initial={initial} onCancel={() => navigate(casePath(id))} onSave={async (input) => { await service.saveTreatment(id, input); setSaved(true); reload(); }} />}
      <CaseTasks caseId={id} />
    </div><div className="medical-stack">
      <Card title="Case summary"><KeyValue label="Status" value={medicalCase.status} /><KeyValue label="Reason" value={medicalCase.reason ?? '—'} />
        <KeyValue label="Latest re-examination" value={medicalCase.reexaminations.at(-1)?.examinedAt ?? 'None'} /></Card>
      <AvailabilityCard horseId={medicalCase.horseId} />
      <Card title="Plan delivery"><p>Groom sees assigned care instructions only. Clinical diagnosis and medication details stay in the veterinary record.</p></Card>
    </div></div></>;
}
function CaseTasks({ caseId }: { caseId: number }) {
  const { service } = useMedicalRuntime();
  const [page, setPage] = useState(0);
  const load = useCallback(() => service.listCaseTasks(caseId, page), [service, caseId, page]);
  const { data, error, reload } = useResource(load);
  return <Card title="Assigned treatment tasks">{!data ? <ResourceState error={error} retry={reload} /> : <div className="medical-stack">
    <History count={data.items.length} empty="No assigned treatment tasks">{data.items.map((task) =>
      <li key={task.id}>{task.taskDate} · Groom {task.assignedGroomUserId} · {task.status}<p>{task.instruction}</p></li>)}</History>
    <div className="medical-actions"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} · {data.totalElements} total</span><Button variant="secondary" disabled={(page + 1) * data.size >= data.totalElements} onClick={() => setPage(page + 1)}>Next</Button></div>
  </div>}</Card>;
}

export function IncidentListPage() {
  const { service } = useMedicalRuntime();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const load = useCallback(() => service.listIncidents(page), [service, page]);
  const { data, error, reload } = useResource(load);
  const rows = data?.items.filter((item) => (!status || item.status === status) &&
    [item.incidentCode, item.horseId, item.description].join(' ').toLowerCase().includes(query.toLowerCase())) ?? [];
  return <><PageHeader title="Incidents" description="Reported observations for veterinary review" />
    <Card title="Incident list"><div className="medical-actions"><TextField label="Search current page" value={query} onChange={(event) => setQuery(event.target.value)} />
      <SelectField label="Status" value={status} placeholder="All statuses" options={['REPORTED', 'UNDER_REVIEW', 'RESOLVED'].map((value) => ({ value, label: value }))} onChange={(event) => setStatus(event.target.value)} /></div>
      {!data ? <ResourceState error={error} retry={reload} /> :
      <div className="medical-stack"><DataTable<Incident> caption="Incidents" rows={rows} rowKey={(item) => item.id} empty={<EmptyState title="No incidents" />} columns={[
        { key: 'code', header: 'Incident', render: (item) => <Link to={incidentPath(item.id)}>{item.incidentCode}</Link> },
        { key: 'horse', header: 'Horse', render: (item) => item.horseId },
        { key: 'observation', header: 'Observation', render: (item) => <span>{item.incidentType} · {item.observedSeverity}</span> },
        { key: 'reporter', header: 'Reported by', render: (item) => item.reportedByUserId },
        { key: 'status', header: 'Status', render: (item) => <StatusBadge family="incident" status={item.status} /> },
        { key: 'reported', header: 'Reported', render: (item) => item.reportedAt },
      ]} /><div className="medical-actions"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} · {data.totalElements} total</span><Button variant="secondary" disabled={(page + 1) * data.size >= data.totalElements} onClick={() => setPage(page + 1)}>Next</Button></div></div>}</Card></>;
}
/** Vet-only review view for the canonical /incidents/:incidentId route. */
export function VetIncidentReview() {
  const { incidentId = '' } = useParams();
  const { service } = useMedicalRuntime();
  const navigate = useNavigate();
  const id = Number(incidentId);
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid incident ID.');
    return service.getIncident(id);
  }, [service, id]);
  const { data, error, reload } = useResource(load);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkCaseId, setLinkCaseId] = useState('');
  if (!Number.isSafeInteger(id) || id < 1) return <EmptyState title="Incident not found" />;
  if (!data) return <ResourceState error={error} retry={reload} />;
  const review = async (action: 'OPEN_CASE' | 'RESOLVE' | 'LINK_CASE') => {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      const updated = await service.reviewIncident(data.id, action, action === 'LINK_CASE' ? positiveId(linkCaseId) : undefined);
      if (action === 'OPEN_CASE' && updated.medicalCaseId) navigate(casePath(updated.medicalCaseId));
      else reload();
    } catch (failure) { setActionError(medicalErrorMessage(failure, 'Unable to review incident.')); }
    finally { setBusy(false); }
  };
  return <><Link to={ROUTES.incidents}>Back to incidents</Link><PageHeader title={'Incident · ' + data.incidentCode} description={'Horse ' + data.horseId} />
    <div className="medical-progress" aria-label="Incident review progress"><span className="medical-progress-active">Reported</span><span className={data.status !== 'REPORTED' ? 'medical-progress-active' : ''}>Under review</span><span className={data.status === 'RESOLVED' ? 'medical-progress-active' : ''}>Resolved</span></div>
    <div className="medical-grid medical-treatment-layout"><div className="medical-stack"><Card title="Observation"><div className="medical-stack">
      <div className="medical-actions"><span>Status</span><StatusBadge family="incident" status={data.status} /></div><KeyValue label="Type" value={data.incidentType} />
      <KeyValue label="Observed severity" value={data.observedSeverity} /><KeyValue label="Observed at" value={data.observedAt} />
      <KeyValue label="Reported at" value={data.reportedAt} /><KeyValue label="Reporter ID" value={data.reportedByUserId} /><p>{data.description || 'No description supplied.'}</p>
      {data.medicalCaseId && <Link to={casePath(data.medicalCaseId)}>Medical case {data.medicalCaseId}</Link>}
    </div></Card>
      <Card title="Source and timeline"><div className="medical-stack">
        <KeyValue label="Pre-session check" value={data.preSessionCheckId ?? 'Not linked'} />
        <KeyValue label="Training session" value={data.trainingSessionId ?? 'Not linked'} />
        <KeyValue label="Care task" value={data.careTaskId ?? 'Not linked'} />
        <KeyValue label="Observed" value={data.observedAt} /><KeyValue label="Reported" value={data.reportedAt} />
      </div></Card></div><div className="medical-stack"><Card title="Horse status"><KeyValue label="Horse ID" value={data.horseId} /><KeyValue label="Incident" value={data.status} /></Card><AvailabilityCard horseId={data.horseId} /></div></div>
    {data.status !== 'RESOLVED' && <Card title="Veterinary review"><p>Opening or linking a case changes the incident to UNDER_REVIEW. Resolve explicitly after review.</p>
      {actionError && <AlertBanner type="danger" title={actionError} />}
      <div className="medical-actions">
        {data.status === 'REPORTED' && !data.medicalCaseId && <><Button disabled={busy} onClick={() => review('OPEN_CASE')}>Open medical case</Button>
          <TextField label="Existing open case ID" type="number" min={1} step={1} value={linkCaseId} onChange={(event) => setLinkCaseId(event.target.value)} />
          <Button variant="secondary" disabled={busy || !linkCaseId} onClick={() => review('LINK_CASE')}>Link case</Button></>}
        <Button variant="secondary" disabled={busy} onClick={() => review('RESOLVE')}>Resolve incident</Button>
      </div></Card>}
  </>;
}
