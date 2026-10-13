import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, KeyValue, SelectField, TextField, Tabs } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { ROUTES } from '../../app/routePaths';
import { MedicalForm } from './MedicalForm';
import { TreatmentPlanEditor } from './TreatmentPlanEditor';
import { InjuryMap } from './InjuryMap';
import { BODY_REGIONS } from './bodyRegions';
import type { CaseView, MedicalCase, RecoveryStatus } from './models';
import { useMedicalRuntime } from './runtimeContext';
import './medical.css';

const casePath = (id: string) => ROUTES.medical + '/cases/' + encodeURIComponent(id);
const taskPath = (id: string) => ROUTES.treatmentTasks + '/' + encodeURIComponent(id);
const recoveryOptions = ['NOT_RECOVERED', 'IMPROVING', 'RECOVERED'];
const bodyRegions = BODY_REGIONS;

function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string; source?: () => Promise<T> }>({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    load().then((data) => { if (active) setState({ data, source: load }); })
      .catch((error: unknown) => { if (active) setState({ error: error instanceof Error ? error.message : 'Unable to load data', source: load }); });
    return () => { active = false; };
  }, [load, revision]);
  return { ...(state.source === load ? state : {}), reload: () => { setState((current) => current.data ? current : {}); setRevision((value) => value + 1); } };
}
function ResourceState({ error, retry }: { error?: string; retry: () => void }) {
  return error ? <div className="medical-stack"><AlertBanner type="danger" title={error} /><Button onClick={retry}>Retry</Button></div> : <p role="status">Loading medical data…</p>;
}
function History({ children, empty, count }: { children: ReactNode; empty: string; count: number }) {
  return count ? <ul className="medical-history">{children}</ul> : <EmptyState title={empty} />;
}
export function CaseListPage() {
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.listCases(), [service]);
  const { data, error, reload } = useResource(load);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  return <>
    <PageHeader title="Medical Cases" description="Veterinary examination, treatment and recovery" actions={<Link to={ROUTES.medicalCaseNew}>Create medical case</Link>} />
    <IncidentQueue />
    <div className="medical-actions"><TextField label="Search cases" value={query} onChange={(event) => setQuery(event.target.value)} /><SelectField label="Case state" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="All states" options={['OPEN', 'CLOSED'].map((value) => ({ value, label: value }))} /></div>
    {!data ? <ResourceState error={error} retry={reload} /> : <Card title="Medical case list"><div className="medical-table"><DataTable<MedicalCase> caption="Medical cases" rows={data.filter((item) => (!status || item.status === status) && [item.id, item.horseId, item.reason].join(' ').toLowerCase().includes(query.toLowerCase()))} rowKey={(item) => item.id} empty={<EmptyState title="No medical cases" description="Create a case or adjust your filters." />} columns={[
      { key: 'id', header: 'Case', render: (item) => <Link to={casePath(item.id)}>{item.id}</Link> },
      { key: 'horse', header: 'Horse', render: (item) => item.horseId },
      { key: 'reason', header: 'Reason', render: (item) => item.reason ?? '—' },
      { key: 'status', header: 'State', render: (item) => item.status ?? 'Unspecified' },
    ]} /></div></Card>}
  </>;
}
export function CreateCasePage() {
  const { service } = useMedicalRuntime();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return <><Link to={ROUTES.medical}>Back to medical cases</Link><PageHeader title="Create Medical Case" />
    <Card title="Case information"><MedicalForm submitLabel="Create case" initial={{ horseId: params.get("horseId") ?? "", incidentId: params.get("incidentId") ?? "" }} fields={[
      { name: 'horseId', label: 'Horse ID', required: true }, { name: 'reason', label: 'Reason', type: 'textarea', required: true },
      { name: 'incidentId', label: 'Linked incident ID (optional)' },
    ]} onSave={async (values) => {
      const item = await service.createCase({ horseId: values.horseId, reason: values.reason, ...(values.incidentId ? { incidentId: values.incidentId } : {}) });
      navigate(casePath(item.id));
    }} /></Card></>;
}
export function CaseDetailPage() {
  const { caseId = '' } = useParams();
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.getCase(caseId), [service, caseId]);
  const { data, error, reload } = useResource(load);
  if (!data) return <ResourceState error={error} retry={reload} />;
  return <CaseDetails key={data.id} item={data} reload={reload} />;
}
function CaseDetails({ item, reload }: { item: CaseView; reload: () => void }) {
  const { service } = useMedicalRuntime();
  const [panel, setPanel] = useState('record');
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const closed = item.status === 'CLOSED';
  const treatment = item.treatment;
  return <>
    <Link to={ROUTES.medical}>Back to medical cases</Link>
    <PageHeader title={'Medical Case · ' + item.id} description={item.horseId + ' · ' + (item.reason ?? '')} />
    <Card title="Case overview"><div className="medical-actions"><KeyValue label="State" value={item.status ?? 'Unspecified'} /><KeyValue label="Incident" value={item.incidentId ?? 'None'} /></div></Card>
    {notice && <AlertBanner type="success" title={notice} />}
    {closed && <AlertBanner type="success" title="Case closed" />}
    <Tabs label="Medical record sections" idPrefix="case" value={panel} onChange={setPanel} items={[{ value: "record", label: "Record" }, { value: "examination", label: "Examination" }, { value: "injury", label: "Injury" }, { value: "treatment", label: "Treatment" }, { value: "recovery", label: "Recovery" }]} />
    <div className="medical-stack">
      <div role="tabpanel" id="case-panel-record" aria-labelledby="case-tab-record" hidden={panel !== "record"}><div className="medical-grid">
        <Card title="Current Condition"><div className="medical-stack"><p className="text-h3">{item.examinations.at(-1)?.diagnosis ?? item.reason ?? "Awaiting examination"}</p><KeyValue label="Recovery" value={item.reexaminations.at(-1)?.recoveryStatus ?? "NOT_RECOVERED"} /><KeyValue label="Next Review" value={treatment?.reexaminationDate ?? "Not scheduled"} /></div></Card>
        <Card title="Treatment & Management"><div className="medical-stack"><p>{treatment?.restInstructions ?? "No treatment plan recorded"}</p><Button variant="secondary" onClick={() => setPanel("treatment")}>View treatment plan</Button></div></Card>
      </div></div>
      <div role="tabpanel" id="case-panel-examination" aria-labelledby="case-tab-examination" hidden={panel !== "examination"}><Card title="Examination and diagnosis">
        <History count={item.examinations.length} empty="No examinations">{item.examinations.map((exam) => <li key={exam.id}><p>{exam.symptoms}</p><p>{exam.diagnosis || 'No diagnosis recorded'} · {exam.severity || 'Severity unspecified'}</p></li>)}</History>
        {!closed && <MedicalForm submitLabel="Save examination" fields={[{ name: 'symptoms', label: 'Symptoms', type: 'textarea', required: true }, { name: 'diagnosis', label: 'Diagnosis', type: 'textarea' }, { name: 'severity', label: 'Examination severity' }]} onSave={async (values) => { await service.addExamination(item.id, { symptoms: values.symptoms, diagnosis: values.diagnosis, severity: values.severity }); reload(); }} />}
      </Card></div>
      <div role="tabpanel" id="case-panel-injury" aria-labelledby="case-tab-injury" hidden={panel !== "injury"}><div className="medical-stack"><InjuryMap injuries={item.injuries} /><Card title="Injury records">
        <History count={item.injuries.length} empty="No injuries">{item.injuries.map((injury) => <li key={injury.id}>{injury.bodyRegion} · {injury.severity} · {injury.recoveryStatus ?? 'NOT_RECOVERED'}<p>{injury.clinicalNotes}</p>{injury.position3d && <p>3D position: x {injury.position3d.x}, y {injury.position3d.y}, z {injury.position3d.z}</p>}</li>)}</History>
        <p className="text-caption">Use body regions to record injuries when the 3D model is unavailable.</p>
        <div className="medical-region-list">{bodyRegions.map((region) => <span key={region}>{region}{item.injuries.some((injury) => injury.bodyRegion === region) ? ' · Injury recorded' : ''}</span>)}</div>
        {!closed && <MedicalForm submitLabel="Save injury" fields={[{ name: 'bodyRegion', label: 'Body region', required: true, options: bodyRegions }, { name: 'severity', label: 'Injury severity', required: true }, { name: 'clinicalNotes', label: 'Clinical notes', type: 'textarea' }, ...['x', 'y', 'z'].map((name) => ({ name, label: '3D ' + name + ' (optional)', type: 'number' }))]} onSave={async (values) => {
          const coordinates = [values.x, values.y, values.z];
          if (coordinates.some(Boolean) && !coordinates.every(Boolean)) throw new Error('Provide all three coordinates or leave them empty');
          await service.addInjury(item.id, { bodyRegion: values.bodyRegion, severity: values.severity, clinicalNotes: values.clinicalNotes, ...(coordinates.every(Boolean) ? { position3d: { x: Number(values.x), y: Number(values.y), z: Number(values.z) } } : {}) }); reload();
        }} />}
      </Card></div></div>
      <div role="tabpanel" id="case-panel-treatment" aria-labelledby="case-tab-treatment" hidden={panel !== "treatment"}><Card title="Treatment plan">
        {treatment ? <div className="medical-stack"><p>{treatment.restInstructions || 'No rest instructions'}</p><History count={treatment.medications?.length ?? 0} empty="No medications">{treatment.medications?.map((medication, index) => <li key={index}>{medication.name} · {medication.instructions}</li>)}</History><History count={treatment.groomTasks?.length ?? 0} empty="No care instructions">{treatment.groomTasks?.map((task, index) => <li key={index}>{task.instruction} · {task.dueAt ?? 'No due date'}</li>)}</History><p>Next re-examination: {treatment.reexaminationDate ?? 'Not scheduled'}</p></div> : <EmptyState title="No treatment plan" />}
        {!closed && <TreatmentPlanEditor key={JSON.stringify(treatment)} initial={treatment} onSave={async (input) => { await service.saveTreatment(item.id, input); setNotice('Treatment plan saved'); reload(); }} />}
      </Card></div>
      <div role="tabpanel" id="case-panel-recovery" aria-labelledby="case-tab-recovery" hidden={panel !== "recovery"}><Card title="Re-examination and recovery">
        <History count={item.reexaminations.length} empty="No re-examinations">{item.reexaminations.map((exam) => <li key={exam.id}>{exam.recoveryStatus}<p>{exam.findings}</p></li>)}</History>
        {!closed && <MedicalForm submitLabel="Save re-examination" fields={[{ name: 'recoveryStatus', label: 'Recovery status', required: true, options: recoveryOptions }, { name: 'findings', label: 'Findings', type: 'textarea', required: true }]} onSave={async (values) => { await service.addReexamination(item.id, { recoveryStatus: values.recoveryStatus as RecoveryStatus, findings: values.findings }); reload(); }} />}
      </Card></div>
    </div>
    {!closed && panel === "record" && <Card title="Close medical case">
      <p>Closing this case prevents further edits. Training restrictions are managed separately.</p>
      {closeError && <AlertBanner type="danger" title={closeError} />}
      {confirmClose ? <div className="medical-actions"><p>Confirm closure of {item.id}?</p><Button disabled={closing} onClick={async () => {
        setClosing(true); setCloseError('');
        try { await service.closeCase(item.id); reload(); } catch (error) { setCloseError(error instanceof Error ? error.message : 'Unable to close case'); } finally { setClosing(false); }
      }}>{closing ? 'Closing…' : 'Confirm close'}</Button><Button variant="secondary" disabled={closing} onClick={() => setConfirmClose(false)}>Cancel</Button></div> : <Button variant="secondary" onClick={() => setConfirmClose(true)}>Close case</Button>}
    </Card>}
  </>;
}
function IncidentQueue() {
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.listIncidents(), [service]);
  const { data, error, reload } = useResource(load);
  return <Card title="Incident review"><p>Staff observations for veterinary examination.</p>{!data ? <ResourceState error={error} retry={reload} /> :
    <History count={data.length} empty="No incidents awaiting review">{data.map((incident) => <li key={incident.id}><div className="medical-actions"><span>{incident.id} ? {incident.horseId}</span><span>{incident.status ?? "Unspecified"}</span></div><p>{incident.description}</p><Link to={ROUTES.medicalCaseNew + "?" + new URLSearchParams({ horseId: incident.horseId, incidentId: incident.id }).toString()}>Open case from {incident.id}</Link></li>)}</History>}
  </Card>;
}
export function IncidentListPage() {
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.listIncidents(), [service]);
  const { data, error, reload } = useResource(load);
  return <><PageHeader title="Medical Incidents" description="Review context for opening a medical case" />{!data ? <ResourceState error={error} retry={reload} /> :
    <Card title="Incident list"><History count={data.length} empty="No incidents">{data.map((incident) => <li key={incident.id}><p>{incident.id} · {incident.horseId} · {incident.status}</p><p>{incident.description}</p><Link to={ROUTES.medicalCaseNew + "?" + new URLSearchParams({ horseId: incident.horseId, incidentId: incident.id }).toString()}>Create medical case</Link></li>)}</History></Card>}</>;
}
export function TreatmentTaskListPage() {
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.listTasks(), [service]);
  const { data, error, reload } = useResource(load);
  const [filter, setFilter] = useState("");
  const filtered = data?.filter((task) => !filter || task.status === filter) ?? [];
  const horses = [...new Set(filtered.map((task) => task.horseId))];
  return <><PageHeader title="My Care & Medication Tasks" description="Assigned to you from the veterinarian treatment plans" />
    <SelectField label="Treatment task state" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="All states" options={["PENDING", "COMPLETED"].map((value) => ({ value, label: value }))} />
    {!data ? <ResourceState error={error} retry={reload} /> : <div className="medical-grid">
      <div className="medical-stack">{horses.length ? horses.map((horseId) => <Card key={horseId} title={horseId}><ul className="medical-history">
        {filtered.filter((task) => task.horseId === horseId).map((task) => <li key={task.id}><div className="medical-actions"><Link to={taskPath(task.id)}>{task.id}</Link><span>{task.status ?? "Unspecified"}</span></div><p className="medical-instruction">Instruction: {task.instruction}</p></li>)}
      </ul></Card>) : <EmptyState title="No assigned treatment tasks" />}</div>
      <Card title="What you can do here"><div className="medical-stack"><p>Read the veterinarian instructions and acknowledge completion of your assigned treatment tasks.</p><p>Clinical decisions and plan changes are made by the veterinarian.</p></div></Card>
    </div>}</>;
}
export function TreatmentTaskDetailPage() {
  const { taskId = '' } = useParams();
  const { service } = useMedicalRuntime();
  // The draft has no task-detail GET endpoint: use the server-scoped work list.
  const load = useCallback(() => service.listTasks(), [service]);
  const { data, error, reload } = useResource(load);
  if (!data) return <ResourceState error={error} retry={reload} />;
  const task = data.find((item) => item.id === taskId);
  if (!task) return <EmptyState title="Assigned treatment task not found" />;
  return <><Link to={ROUTES.treatmentTasks}>Back to assigned treatment tasks</Link><PageHeader title={'Treatment Task · ' + task.id} description={task.horseId} />
    <Card title="Treatment instructions"><p>{task.instruction}</p><p>State: {task.status ?? 'Unspecified'}</p>
      {task.status === 'COMPLETED' ? <AlertBanner type="success" title="Treatment acknowledged">{task.completionNotes}</AlertBanner> :
        <MedicalForm submitLabel="Acknowledge completion" fields={[{ name: 'completionNotes', label: 'Completion notes (optional)', type: 'textarea' }]} onSave={async (values) => { await service.completeTask(task.id, { completionNotes: values.completionNotes }); reload(); }} />}
    </Card></>;
}
