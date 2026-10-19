import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, KeyValue, MetricCard, StatusBadge, TextField, Tabs } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { MEDICAL_ROUTES as ROUTES } from './paths';
import { MedicalForm } from './MedicalForm';
import { TreatmentPlanEditor } from './TreatmentPlanEditor';
import { InjuryMap } from './InjuryMap';
import type { ClinicalSeverity, MedicalCase, MedicalService, RecoveryStatus, TrainingAvailability } from './models';
import { useMedicalRuntime } from './runtimeContext';
import { medicalErrorMessage } from './errors';
import './medical.css';

const casePath = (id: number) => ROUTES.medicalCaseDetail.replace(':caseId', String(id));
const latest = <T extends { examinedAt: string },>(items: T[]) => [...items].sort((a, b) => Date.parse(b.examinedAt) - Date.parse(a.examinedAt))[0];
async function collectCases(service: MedicalService) {
  const first = await service.listCases(0), rows = [...first.items];
  for (let page = 1; page < Math.ceil(first.totalElements / first.size); page++) {
    const next = await service.listCases(page);
    if (next.size !== first.size || next.totalElements !== first.totalElements) throw new Error('Medical cases changed while loading. Reload to retry.');
    rows.push(...next.items);
  }
  if (rows.length !== first.totalElements || new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error('Medical case overview is incomplete. Reload to retry.');
  return rows;
}
function HorseHeading({ horseId, title, description }: { horseId: number; title: string; description: string }) {
  const { service } = useMedicalRuntime();
  const { data, error } = useResource(useCallback(() => service.getHorse(horseId), [service, horseId]));
  return <><PageHeader title={`${title} · ${data?.name ?? `Horse ${horseId}`}`} description={data ? `${data.horseCode}${data.currentBoxCode ? ` · Box ${data.currentBoxCode}` : ''} · ${description}` : description}
    actions={data && <div className="medical-actions">{data.healthStatus && <StatusBadge family="health" status={data.healthStatus} />}<StatusBadge family="availability" status={data.trainingAvailability} /></div>} />
    {error && <p className="text-caption">Horse identity details are unavailable.</p>}</>;
}
function TreatmentCaseSummary({ item }: { item: MedicalCase }) {
  const { service } = useMedicalRuntime();
  const horse = useResource(useCallback(() => service.getHorse(item.horseId), [service, item.horseId]));
  const availability = useResource(useCallback(() => service.getAvailability(item.horseId), [service, item.horseId]));
  const review = latest(item.reexaminations);
  return <Card className="medical-groom-panel" title="Case summary"><div className="medical-stack">
    <KeyValue label="Health status" value={horse.data?.healthStatus ? <StatusBadge family="health" status={horse.data.healthStatus} /> : 'Unavailable'} />
    {availability.data ? <AvailabilityDetails availability={availability.data} /> : <ResourceState error={availability.error} retry={availability.reload} />}
    <KeyValue label="Last re-examination" value={review ? `${review.examinedAt} · ${review.recoveryStatus}` : 'None'} />
    <KeyValue label="Next review" value={item.treatmentPlan?.reexaminationDate ?? 'Not scheduled'} />
    <p className="text-caption">Training Availability is changed separately. Saving this plan does not change it.</p>
  </div></Card>;
}
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
  return <div className="medical-stack"><div className="medical-actions"><StatusBadge family="availability" status={availability.availability} />
    <span>{availability.reason || (availability.availability === 'AVAILABLE' ? 'No active medical restriction' : 'Reason unavailable')}</span></div>
    {availability.exerciseRules?.map((rule, index) => <KeyValue key={index} label={rule.ruleType === 'ALLOWED' ? 'Permitted' : 'Prohibited'} value={rule.exerciseTypeNote ?? `Exercise ${rule.exerciseId}`} />)}
  </div>;
}

export function CaseListPage() {
  const { service } = useMedicalRuntime();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const load = useCallback(() => service.listCases(page), [service, page]);
  const { data, error, reload } = useResource(load);
  const rows = data?.items.filter((item) => [item.id, item.horseId, item.reason].join(' ').toLowerCase().includes(query.toLowerCase())) ?? [];
  return <><PageHeader title="Medical Cases" description="Veterinary case records" />
    <div className="medical-actions"><Link to={ROUTES.medicalCaseNew}>Create independent case</Link><Link to={ROUTES.herdHealth}>Herd health</Link></div>
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
  const navigate = useNavigate();
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.getHerdHealth(), [service]);
  const { data, error, reload } = useResource(load);
  const horses = useResource(useCallback(() => service.listHerdHorses(), [service]));
  const cases = useResource(useCallback(() => collectCases(service), [service]));
  const [health, setHealth] = useState('');
  const visible = horses.data?.filter((horse) => !health || (health === 'UNASSESSED' ? horse.healthStatus === null : horse.healthStatus === health)) ?? [];
  return <><PageHeader title="Herd Health Overview" description="Health Status and Training Availability are shown separately" actions={<Button onClick={() => navigate(ROUTES.medical)}>View Medical Cases</Button>} />
    {!data ? <ResourceState error={error} retry={reload} /> : <div className="medical-stack">
      <p className="text-caption">{data.totalHorses} horses · {data.unassessed} unassessed</p>
      <p className="medical-overline">Health Status · club totals</p><div className="medical-grid medical-herd-grid">
        {[['Fit', data.fit], ['Monitoring', data.monitoring], ['Injured', data.injured], ['Quarantined', data.quarantined]].map(([label, value]) =>
          <MetricCard key={label} label={String(label)} value={String(value)} />)}
      </div>
    </div>}
    {!horses.data ? <ResourceState error={horses.error} retry={horses.reload} /> : <div className="medical-stack">
      <Card><div className="medical-actions"><span className="medical-overline">Training availability · {horses.data.length} active horses</span>
        {(['AVAILABLE', 'LIMITED', 'LOCKED'] as const).map((level) => <span key={level} className="medical-actions"><StatusBadge family="availability" status={level} />{horses.data!.filter((horse) => horse.trainingAvailability === level).length}</span>)}
      </div></Card>
      <div className="medical-actions" role="group" aria-label="Active horse health filters">
        {['', 'FIT', 'MONITORING', 'INJURED', 'QUARANTINED', 'UNASSESSED'].map((status) => <button className="medical-chip" key={status} type="button" aria-pressed={health === status} onClick={() => setHealth(status)}>
          {status || 'All'} · {horses.data!.filter((horse) => !status || (status === 'UNASSESSED' ? horse.healthStatus === null : horse.healthStatus === status)).length}
        </button>)}
      </div>
      {cases.error && <div className="medical-actions"><p className="text-caption">Case summaries are unavailable.</p><Button variant="secondary" onClick={cases.reload}>Retry case summaries</Button></div>}
      {!visible.length ? <EmptyState title="No active horses for this filter" /> : <div className="medical-grid medical-herd-grid">{visible.map((horse) => <Card key={horse.id} className="medical-herd-horse">
        <h3 className="text-h3">{horse.name}</h3><p className="text-caption">{horse.horseCode}{horse.currentBoxCode ? ` · Box ${horse.currentBoxCode}` : ''}</p>
        <div className="medical-actions">{horse.healthStatus ? <StatusBadge family="health" status={horse.healthStatus} /> : <span className="text-caption">{horse.healthStatus === null ? 'Unassessed' : 'Health status unavailable'}</span>}<StatusBadge family="availability" status={horse.trainingAvailability} /></div>
        {cases.data ? cases.data.filter((item) => item.horseId === horse.id && item.status === 'OPEN').length ? cases.data.filter((item) => item.horseId === horse.id && item.status === 'OPEN').map((item) => <div key={item.id} className="medical-case-preview">
          <p>Open case · {item.reason ?? `Case ${item.id}`}</p><p className="text-caption">{item.treatmentPlan?.reexaminationDate ? `Next review ${item.treatmentPlan.reexaminationDate}` : 'Review not scheduled'}</p><Link to={casePath(item.id)}>Open case →</Link>
        </div>) : <p className="text-caption">No open case</p> : <p className="text-caption">{cases.error ? 'Case summary unavailable' : 'Loading case summary…'}</p>}
      </Card>)}</div>}
    </div>}
  </>;
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
      <Card title="Current condition"><KeyValue label="Latest diagnosis" value={latest(item.examinations)?.diagnosis ?? (item.examinations.length ? 'No diagnosis recorded' : 'Awaiting examination')} />
        <KeyValue label="Recovery" value={latest(item.reexaminations)?.recoveryStatus ?? 'Not assessed'} />
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
          { name: 'bodyRegion', label: 'Body region', maxLength: 100, required: true },
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
      let total: number | undefined;
      let size: number | undefined;
      for (let page = 0; ; page += 1) {
        const result = await service.listCaseTasks(id, page);
        total ??= result.totalElements;
        size ??= result.size;
        if (result.totalElements !== total || result.size !== size) throw new Error('Treatment tasks changed while loading. Reload before editing.');
        tasks.push(...result.items);
        if (tasks.length >= result.totalElements) break;
        if (result.items.length === 0 || result.size < 1) throw new Error('Treatment tasks could not be loaded completely. Editing is unavailable.');
      }
      if (new Set(tasks.map((task) => task.id)).size !== tasks.length || tasks.length !== total) throw new Error('Treatment task history is inconsistent. Reload before editing.');
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
    <HorseHeading title="Treatment Plan" horseId={medicalCase.horseId} description={'Medical case ' + id} />
    {saved && <AlertBanner type="success" title="Treatment plan saved" />}
    <div className="medical-grid medical-treatment-layout"><div className="medical-stack">
      {medicalCase.status === 'CLOSED' ? <AlertBanner type="danger" title="Closed cases cannot be edited" /> :
        <TreatmentPlanEditor key={medicalCase.treatmentPlan?.id ?? 'new'} openedAt={medicalCase.openedAt} initial={initial} onCancel={() => navigate(casePath(id))} onSave={async (input) => { await service.saveTreatment(id, input); setSaved(true); reload(); }} />}
      <CaseTasks caseId={id} />
    </div><div className="medical-stack">
      <TreatmentCaseSummary item={medicalCase} />
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
