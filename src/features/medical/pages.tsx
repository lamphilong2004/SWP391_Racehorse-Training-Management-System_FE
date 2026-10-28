import { clubDateTime, parseClubDateTime } from '../../shared/clubCalendar';
import { boxLabel } from '../../shared/stableBox';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ActionBar, AlertBanner, ButtonLink, Button, Card, DataTable, EmptyState, Icon, KeyValue, MetricCard, StatusBadge, TableToolbar, SelectField, TextField, Tabs } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { MEDICAL_ROUTES as ROUTES } from './paths';
import { MedicalForm } from './MedicalForm';
import { TreatmentPlanEditor } from './TreatmentPlanEditor';
import { InjuryMap } from './InjuryMap';
import { regionLabel } from './bodyRegions';
import type { ClinicalSeverity, MedicalCase, MedicalService, RecoveryStatus, TrainingAvailability } from './models';
import { useMedicalRuntime } from './runtimeContext';
import { dateTime } from '../evaluation/models';
import { medicalErrorMessage } from './errors';
import './medical.css';
import { viLabel } from '../../shared/viLabels';
import { formatDate } from '../horses/shared/format';

const casePath = (id: number) => ROUTES.medicalCaseDetail.replace(':caseId', String(id));
const latest = <T extends { examinedAt: string },>(items: T[]) => [...items].sort((a, b) => Date.parse(b.examinedAt) - Date.parse(a.examinedAt))[0];
async function collectCases(service: MedicalService) {
  const first = await service.listCases(0), rows = [...first.items];
  for (let page = 1; page < Math.ceil(first.totalElements / first.size); page++) {
    const next = await service.listCases(page);
    if (next.size !== first.size || next.totalElements !== first.totalElements) throw new Error('Danh sách ca y tế đã thay đổi trong lúc tải. Hãy tải lại.');
    rows.push(...next.items);
  }
  if (rows.length !== first.totalElements || new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error('Tổng quan ca y tế chưa đầy đủ. Hãy tải lại.');
  return rows;
}
/** Registered name and code for a horse id; falls back to the id when identity is unavailable. */
function HorseName({ horseId }: { horseId: number }) {
  const { service } = useMedicalRuntime();
  const { data } = useResource(useCallback(() => service.getHorse(horseId), [service, horseId]));
  return <>{data ? `${data.name} · ${data.horseCode}` : `Ngựa ${horseId}`}</>;
}

function HorseHeading({ horseId, title, description }: { horseId: number; title: string; description: string }) {
  const { service } = useMedicalRuntime();
  const { data, error } = useResource(useCallback(() => service.getHorse(horseId), [service, horseId]));
  return <><PageHeader title={`${title} · ${data?.name ?? `Ngựa ${horseId}`}`} description={data ? `${data.horseCode}${data.currentBoxCode ? ` · ${boxLabel(data.currentBoxCode)}` : ''} · ${description}` : description}
    actions={data && <div className="medical-actions">{data.healthStatus && <StatusBadge family="health" status={data.healthStatus} />}<StatusBadge family="availability" status={data.trainingAvailability} /></div>} />
    {error && <p className="text-caption">Không tải được thông tin nhận dạng ngựa.</p>}</>;
}
function TreatmentCaseSummary({ item }: { item: MedicalCase }) {
  const { service } = useMedicalRuntime();
  const horse = useResource(useCallback(() => service.getHorse(item.horseId), [service, item.horseId]));
  const availability = useResource(useCallback(() => service.getAvailability(item.horseId), [service, item.horseId]));
  const review = latest(item.reexaminations);
  return <Card className="medical-groom-panel" title="Tóm tắt ca"><div className="medical-stack">
    <KeyValue label="Tình trạng sức khỏe" value={horse.data?.healthStatus ? <StatusBadge family="health" status={horse.data.healthStatus} /> : 'Không có'} />
    {availability.data ? <AvailabilityDetails availability={availability.data} /> : <ResourceState error={availability.error} retry={availability.reload} />}
    <KeyValue label="Lần tái khám gần nhất" value={review ? `${dateTime(review.examinedAt)} · ${viLabel(review.recoveryStatus)}` : 'Không có'} />
    <KeyValue label="Lần khám tiếp theo" value={item.treatmentPlan?.reexaminationDate ?? 'Chưa lên lịch'} />
    <p className="text-caption">Khả năng tập luyện được thay đổi riêng. Lưu phác đồ này không làm thay đổi nó.</p>
  </div></Card>;
}
const positiveId = (value: string) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Nhập mã số dương hợp lệ.');
  return id;
};
function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string; source?: () => Promise<T> }>({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    load().then((data) => { if (active) setState({ data, source: load }); })
      .catch((error: unknown) => { if (active) setState({ error: medicalErrorMessage(error, 'Không tải được dữ liệu.'), source: load }); });
    return () => { active = false; };
  }, [load, revision]);
  return { ...(state.source === load ? state : {}), reload: () => { setState({}); setRevision((value) => value + 1); } };
}
function ResourceState({ error, retry }: { error?: string; retry: () => void }) {
  return error ? <div className="medical-stack"><AlertBanner type="danger" title={error} /><Button onClick={retry}>Thử lại</Button></div> : <p role="status">Đang tải dữ liệu y tế…</p>;
}
function History({ children, empty, count }: { children: ReactNode; empty: string; count: number }) {
  return count ? <ul className="medical-history">{children}</ul> : <EmptyState title={empty} />;
}
function AvailabilityCard({ horseId }: { horseId: number }) {
  const { service } = useMedicalRuntime();
  const load = useCallback(() => service.getAvailability(horseId), [service, horseId]);
  const { data, error, reload } = useResource(load);
  return <Card title="Khả năng tập luyện">
    {!data ? <ResourceState error={error} retry={reload} /> :
      <div className="medical-stack"><AvailabilityDetails availability={data} /><p className="text-caption">Hạn chế được quản lý riêng. Đóng ca y tế không tự gỡ hạn chế.</p><ButtonLink to={`/medical/restrictions?horseId=${horseId}`}>Quản lý khả năng tập luyện & hạn chế</ButtonLink></div>}
  </Card>;
}
function AvailabilityDetails({ availability }: { availability: TrainingAvailability }) {
  return <div className="medical-stack"><div className="medical-actions"><StatusBadge family="availability" status={availability.availability} />
    <span>{availability.reason || (availability.availability === 'AVAILABLE' ? 'Không có hạn chế y tế' : 'Không có lý do')}</span></div>
    {availability.exerciseRules?.map((rule, index) => <KeyValue key={index} label={rule.ruleType === 'ALLOWED' ? 'Được phép' : 'Bị cấm'} value={rule.exerciseTypeNote ?? `Bài tập ${rule.exerciseId}`} />)}
  </div>;
}

export function CaseListPage() {
  const { service } = useMedicalRuntime();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const load = useCallback(() => service.listCases(page), [service, page]);
  const { data, error, reload } = useResource(load);
  const rows = data?.items.filter((item) => (!status || item.status === status) && [item.id, item.horseId, item.reason].join(' ').toLowerCase().includes(query.toLowerCase())) ?? [];
  return <><PageHeader title="Ca y tế" description="Theo dõi hồ sơ, lần khám và kế hoạch chăm sóc của từng ca."
    actions={<><ButtonLink to={ROUTES.herdHealth}>Sức khỏe đàn ngựa</ButtonLink><ButtonLink variant="primary" to={ROUTES.medicalCaseNew}>Tạo ca y tế độc lập</ButtonLink></>} />
    <Card title="Danh sách ca"><TableToolbar label="Bộ lọc ca y tế" scope="page" resultCount={data ? rows.length : undefined} hasFilters={Boolean(query || status)} onClear={() => { setQuery(''); setStatus(''); }}><TextField label="Tìm trên trang hiện tại" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /><SelectField label="Trạng thái trên trang" value={status} options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'OPEN', label: 'Đang mở' }, { value: 'CLOSED', label: 'Đã đóng' }]} onChange={(event) => setStatus(event.target.value)} /></TableToolbar>
      {!data ? <ResourceState error={error} retry={reload} /> :
        <div className="medical-stack"><DataTable<MedicalCase> caption="Ca y tế" rows={rows} rowKey={(item) => item.id} empty={<EmptyState title={query || status ? 'Không có ca phù hợp bộ lọc' : 'Chưa có ca y tế'} />} columns={[
          { key: 'id', header: 'Ca', render: (item) => <Link to={casePath(item.id)}>Ca #{item.id}</Link> },
          { key: 'opened', header: 'Ngày mở', render: (item) => dateTime(item.openedAt) },
          { key: 'horse', header: 'Ngựa', render: (item) => <HorseName horseId={item.horseId} /> },
          { key: 'reason', header: 'Lý do', render: (item) => item.reason ?? '—' },
          { key: 'status', header: 'Trạng thái', render: (item) => <StatusBadge family="medicalCase" status={item.status} /> },
        ]} /><div className="medical-actions"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {page + 1} · tổng {data.totalElements}</span><Button variant="secondary" disabled={(page + 1) * data.size >= data.totalElements} onClick={() => setPage(page + 1)}>Sau</Button></div></div>}
    </Card></>;
}

export function CreateCasePage() {
  const { service } = useMedicalRuntime();
  const navigate = useNavigate();
  return <><ButtonLink variant="tertiary" to={ROUTES.medical}>← Quay lại danh sách ca</ButtonLink><PageHeader title="Tạo ca y tế" />
    <Card title="Ca y tế độc lập"><MedicalForm submitLabel="Tạo ca" onCancel={() => navigate(ROUTES.medical)} fields={[
      { name: 'horseId', label: 'Mã ngựa', type: 'number', required: true },
      { name: 'reason', label: 'Lý do', type: 'textarea', required: true, maxLength: 2000 },
    ]} onSave={async (values) => {
      const item = await service.createCase({ horseId: positiveId(values.horseId), reason: values.reason });
      navigate(casePath(item.id));
    }} /><p className="text-caption">Để mở ca từ một sự cố, hãy dùng màn hình xem xét sự cố.</p></Card></>;
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
  return <><PageHeader title="Tổng quan sức khỏe đàn ngựa" description="Tình trạng sức khỏe và khả năng tập luyện được hiển thị riêng" actions={<Button onClick={() => navigate(ROUTES.medical)}>Xem ca y tế</Button>} />
    {!data ? <ResourceState error={error} retry={reload} /> : <div className="medical-stack">
      <p className="text-caption">{data.totalHorses} con ngựa trong câu lạc bộ{data.unassessed ? ` · ${data.unassessed} con chưa có đánh giá sức khỏe (ngựa mới đến, xem ở Tổng quan)` : ''}</p>
      <p className="medical-overline">Tình trạng sức khỏe · toàn câu lạc bộ</p><div className="medical-grid medical-herd-grid">
        {[['Khỏe', data.fit], ['Đang theo dõi', data.monitoring], ['Bị chấn thương', data.injured], ['Đang cách ly', data.quarantined]].map(([label, value]) =>
          <MetricCard key={label} label={String(label)} value={String(value)} />)}
      </div>
    </div>}
    {!horses.data ? <ResourceState error={horses.error} retry={horses.reload} /> : <div className="medical-stack">
      <Card><div className="medical-actions"><span className="medical-overline">Khả năng tập luyện · {horses.data.length} ngựa đang hoạt động</span>
        {(['AVAILABLE', 'LIMITED', 'LOCKED'] as const).map((level) => <span key={level} className="medical-actions"><StatusBadge family="availability" status={level} />{horses.data!.filter((horse) => horse.trainingAvailability === level).length}</span>)}
      </div></Card>
      <div className="medical-actions" role="group" aria-label="Bộ lọc sức khỏe ngựa đang hoạt động">
        {['', 'FIT', 'MONITORING', 'INJURED', 'QUARANTINED', 'UNASSESSED'].map((status) => <button className="medical-chip" key={status} type="button" aria-pressed={health === status} onClick={() => setHealth(status)}>
          {status ? (status === 'UNASSESSED' ? 'Chưa đánh giá' : viLabel(status)) : 'Tất cả'} · {horses.data!.filter((horse) => !status || (status === 'UNASSESSED' ? horse.healthStatus === null : horse.healthStatus === status)).length}
        </button>)}
      </div>
      {cases.error && <div className="medical-actions"><p className="text-caption">Không tải được tóm tắt ca y tế.</p><Button variant="secondary" onClick={cases.reload}>Tải lại tóm tắt ca</Button></div>}
      {!visible.length ? <EmptyState title="Không có ngựa phù hợp bộ lọc" /> : <div className="medical-grid medical-herd-grid">{visible.map((horse) => {
        const open = cases.data?.filter((item) => item.horseId === horse.id && item.status === 'OPEN') ?? [];
        const attention = horse.trainingAvailability === 'LOCKED' || horse.healthStatus === 'INJURED' || horse.healthStatus === 'QUARANTINED' ? 'danger'
          : horse.trainingAvailability === 'LIMITED' || horse.healthStatus === 'MONITORING' || open.length ? 'warning' : undefined;
        return <Card key={horse.id} className={`medical-herd-horse${attention ? ` medical-herd-${attention}` : ''}`}>
          <div className="medical-herd-head"><div><h3 className="text-h3">{horse.name}</h3><p className="text-caption">{horse.horseCode}{horse.currentBoxCode ? ` · ${boxLabel(horse.currentBoxCode)}` : ''}</p></div>
            <Link to={`/horses/${horse.id}`} aria-label={`Xem hồ sơ ${horse.name}`}>Hồ sơ</Link></div>
          <div className="medical-actions medical-herd-badges">{horse.healthStatus ? <StatusBadge family="health" status={horse.healthStatus} /> : <span className="text-caption">Chưa đánh giá sức khỏe</span>}<StatusBadge family="availability" status={horse.trainingAvailability} /></div>
          <div className="medical-herd-foot">
            {cases.data ? open.length ? open.map((item) => <div key={item.id} className="medical-case-preview">
              <p className="medical-herd-case-title">Ca y tế #{item.id} đang mở</p>
              {item.reason && <p className="medical-herd-reason" title={item.reason}>{item.reason}</p>}
              <div className="medical-herd-case-meta"><span className="text-caption">{item.treatmentPlan?.reexaminationDate ? `Tái khám ${formatDate(item.treatmentPlan.reexaminationDate)}` : 'Chưa hẹn tái khám'}</span><Link to={casePath(item.id)}>Mở ca →</Link></div>
            </div>) : <p className="text-caption medical-herd-calm"><Icon name="check-circle" size={16} />Không có ca đang mở</p> : <p className="text-caption">{cases.error ? 'Không tải được tóm tắt ca' : 'Đang tải tóm tắt ca…'}</p>}
          </div>
        </Card>;
      })}</div>}
    </div>}
  </>;
}

export function CaseDetailPage() {
  const { caseId = '' } = useParams();
  const { service } = useMedicalRuntime();
  const id = Number(caseId);
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Mã ca y tế không hợp lệ.');
    return service.getCase(id);
  }, [service, id]);
  const { data, error, reload } = useResource(load);
  if (!Number.isSafeInteger(id) || id < 1) return <EmptyState title="Không tìm thấy ca y tế" />;
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
  return <><ButtonLink variant="tertiary" to={ROUTES.medical}>← Quay lại danh sách ca</ButtonLink>
    <HorseHeading title={'Ca y tế ' + item.id} horseId={item.horseId} description={'Mở lúc ' + dateTime(item.openedAt)} />
    <div className="medical-grid"><Card title="Tổng quan ca"><div className="medical-case-facts">
      <KeyValue label="Trạng thái" value={<StatusBadge family="medicalCase" status={item.status} />} /><KeyValue label="Lý do" value={item.reason ?? '—'} />
      <KeyValue label="Mở lúc" value={dateTime(item.openedAt)} /><KeyValue label="Sự cố liên quan" value={item.incidentIds.join(', ') || 'Không có'} />
    </div></Card><AvailabilityCard horseId={item.horseId} /></div>
    <Tabs label="Các mục của ca y tế" idPrefix="case" value={panel} onChange={setPanel} items={[
      { value: 'record', label: 'Hồ sơ' }, { value: 'examination', label: 'Khám' },
      { value: 'injury', label: 'Chấn thương' }, { value: 'treatment', label: 'Điều trị' },
      { value: 'recovery', label: 'Tái khám' },
    ]} />
    <div role="tabpanel" id="case-panel-record" aria-labelledby="case-tab-record" hidden={panel !== 'record'} className="medical-stack">
      <Card title="Thể trạng hiện tại"><KeyValue label="Chẩn đoán gần nhất" value={latest(item.examinations)?.diagnosis ?? (item.examinations.length ? 'Chưa có chẩn đoán' : 'Đang chờ khám')} />
        <KeyValue label="Hồi phục" value={viLabel(latest(item.reexaminations)?.recoveryStatus, 'Chưa ghi nhận tái khám')} />
        <KeyValue label="Lần khám tiếp theo" value={item.treatmentPlan?.reexaminationDate ?? 'Chưa lên lịch'} /></Card>
      {!closed && <Card className="medical-close-panel" title="Đóng ca y tế"><p>Cần có ít nhất một lần khám hoặc tái khám. Nếu có chấn thương hoặc phác đồ điều trị, lần tái khám gần nhất phải là Đã hồi phục. Mọi công việc điều trị phải hoàn thành, sự cố liên quan đã xử lý xong và hạn chế của ca đã được gỡ.</p>
        {closeError && <AlertBanner type="danger" title={closeError} />}
        {confirmClose ? <ActionBar leading={<span>Đóng ca {item.id}?</span>}><Button variant="secondary" disabled={closing} onClick={() => setConfirmClose(false)}>Hủy</Button><Button disabled={closing} onClick={async () => {
          setClosing(true); setCloseError('');
          try { await service.closeCase(item.id); reload(); } catch (failure) { setCloseError(medicalErrorMessage(failure, 'Không đóng được ca y tế.')); } finally { setClosing(false); }
        }}>{closing ? 'Đang đóng…' : 'Xác nhận đóng'}</Button></ActionBar> :
          <ActionBar leading={<span>Chỉ đóng sau khi hoàn tất các điều kiện của ca.</span>}><Button variant="secondary" onClick={() => setConfirmClose(true)}>Đóng ca</Button></ActionBar>}</Card>}
    </div>
    <div role="tabpanel" id="case-panel-examination" aria-labelledby="case-tab-examination" hidden={panel !== 'examination'} className="medical-stack">
      <Card title="Các lần khám"><History count={item.examinations.length} empty="Chưa có lần khám nào">{item.examinations.map((exam) =>
        <li key={exam.id}><strong>{dateTime(exam.examinedAt)}</strong><p>{exam.symptoms}</p><p>{exam.diagnosis || 'Chưa có chẩn đoán'} · {exam.severity || 'Chưa đặt mức độ'}</p></li>)}</History>
        {!closed && <MedicalForm submitLabel="Lưu lần khám" initial={{ examinedAt: clubDateTime() }} fields={[
          { name: 'examinedAt', label: 'Ngày giờ khám', type: 'datetime-local', required: true },
          { name: 'symptoms', label: 'Triệu chứng và phát hiện', type: 'textarea', required: true },
          { name: 'diagnosis', label: 'Chẩn đoán', type: 'textarea', maxLength: 1000 },
          { name: 'severity', label: 'Mức độ', options: ['MILD', 'MODERATE', 'SEVERE'] },
          { name: 'healthStatus', label: 'Tình trạng sức khỏe của ngựa', options: ['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'] },
        ]} onSave={async (values) => { await service.addExamination(item.id, {
          symptoms: values.symptoms, examinedAt: parseClubDateTime(values.examinedAt)!.toISOString(),
          ...(values.diagnosis ? { diagnosis: values.diagnosis } : {}),
          ...(values.severity ? { severity: values.severity as ClinicalSeverity } : {}),
          ...(values.healthStatus ? { healthStatus: values.healthStatus as 'FIT' | 'MONITORING' | 'INJURED' | 'QUARANTINED' } : {}),
        }); reload(); }} />}</Card>
    </div>
    <div role="tabpanel" id="case-panel-injury" aria-labelledby="case-tab-injury" hidden={panel !== 'injury'} className="medical-stack">
      <InjuryMap injuries={item.injuries} />
      <Card title="Hồ sơ chấn thương"><History count={item.injuries.length} empty="Chưa có chấn thương">{item.injuries.map((injury) =>
        <li key={injury.id}>{regionLabel(injury.bodyRegion)} · {viLabel(injury.severity)} · {viLabel(injury.recoveryStatus)}{injury.position3d && <p>Điểm đánh dấu vị trí: {injury.position3d}</p>}</li>)}</History>
        {!closed && <MedicalForm submitLabel="Lưu chấn thương" fields={[
          { name: 'bodyRegion', label: 'Vùng cơ thể', maxLength: 100, required: true },
          { name: 'severity', label: 'Mức độ', options: ['MILD', 'MODERATE', 'SEVERE'], required: true },
          { name: 'recoveryStatus', label: 'Tình trạng hồi phục', options: ['NOT_RECOVERED', 'IMPROVING', 'RECOVERED'], required: true },
          { name: 'position3d', label: 'Điểm đánh dấu vị trí (không bắt buộc)', maxLength: 100 },
          { name: 'side', label: 'Bên (không bắt buộc)', maxLength: 20 },
        ]} onSave={async (values) => { await service.addInjury(item.id, {
          bodyRegion: values.bodyRegion, severity: values.severity as ClinicalSeverity,
          recoveryStatus: values.recoveryStatus as RecoveryStatus,
          ...(values.position3d ? { position3d: values.position3d } : {}),
          ...(values.side ? { side: values.side } : {}),
        }); reload(); }} />}</Card>
    </div>
    <div role="tabpanel" id="case-panel-treatment" aria-labelledby="case-tab-treatment" hidden={panel !== 'treatment'} className="medical-stack">
      <Card title="Phác đồ điều trị">{item.treatmentPlan ? <div className="medical-stack">
        <KeyValue label="Điều trị và thuốc" value={item.treatmentPlan.treatmentMedicationInstructions} />
        <KeyValue label="Nghỉ ngơi" value={item.treatmentPlan.restInstructions ?? '—'} />
        <KeyValue label="Chăm sóc" value={item.treatmentPlan.careInstructions ?? '—'} />
        <KeyValue label="Ngày tái khám" value={item.treatmentPlan.reexaminationDate ?? 'Chưa lên lịch'} />
      </div> : <EmptyState title="Chưa có phác đồ điều trị" />}
        {!closed && <ButtonLink to={casePath(item.id) + '/treatment-plan'}>Mở trình soạn phác đồ điều trị</ButtonLink>}</Card>
      <CaseTasks caseId={item.id} />
    </div>
    <div role="tabpanel" id="case-panel-recovery" aria-labelledby="case-tab-recovery" hidden={panel !== 'recovery'} className="medical-stack">
      <Card title="Các lần tái khám"><History count={item.reexaminations.length} empty="Chưa có lần tái khám">{item.reexaminations.map((exam) =>
        <li key={exam.id}>{viLabel(exam.recoveryStatus)}<p>{exam.findings}</p><small>{dateTime(exam.examinedAt)}</small></li>)}</History>
        {!closed && <MedicalForm initial={{ examinedAt: clubDateTime() }} submitLabel="Lưu lần tái khám" fields={[
          { name: 'recoveryStatus', label: 'Tình trạng hồi phục', options: ['NOT_RECOVERED', 'IMPROVING', 'RECOVERED'], required: true },
          { name: 'examinedAt', label: 'Ngày giờ tái khám', type: 'datetime-local', required: true },
          { name: 'findings', label: 'Kết quả khám', type: 'textarea', required: true },
          { name: 'healthStatus', label: 'Tình trạng sức khỏe của ngựa', options: ['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'] },
        ]} onSave={async (values) => { await service.addReexamination(item.id, {
          recoveryStatus: values.recoveryStatus as RecoveryStatus, findings: values.findings,
          examinedAt: parseClubDateTime(values.examinedAt)!.toISOString(),
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
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Mã ca y tế không hợp lệ.');
    const medicalCase = await service.getCase(id);
    const tasks = [] as Awaited<ReturnType<typeof service.listCaseTasks>>['items'];
    if (medicalCase.treatmentPlan) {
      let total: number | undefined;
      let size: number | undefined;
      for (let page = 0; ; page += 1) {
        const result = await service.listCaseTasks(id, page);
        total ??= result.totalElements;
        size ??= result.size;
        if (result.totalElements !== total || result.size !== size) throw new Error('Công việc điều trị đã thay đổi trong lúc tải. Hãy tải lại trước khi sửa.');
        tasks.push(...result.items);
        if (tasks.length >= result.totalElements) break;
        if (result.items.length === 0 || result.size < 1) throw new Error('Không tải đủ công việc điều trị. Tạm khóa chỉnh sửa.');
      }
      if (new Set(tasks.map((task) => task.id)).size !== tasks.length || tasks.length !== total) throw new Error('Lịch sử công việc điều trị không nhất quán. Hãy tải lại trước khi sửa.');
    }
    return { medicalCase, tasks };
  }, [service, id]);
  const { data, error, reload } = useResource(load);
  if (!Number.isSafeInteger(id) || id < 1) return <EmptyState title="Không tìm thấy ca y tế" />;
  if (!data) return <ResourceState error={error} retry={reload} />;
  const { medicalCase, tasks } = data;
  const initial = {
    ...medicalCase.treatmentPlan,
    groomTasks: tasks.map((task) => ({ assignedGroomUserId: task.assignedGroomUserId, instruction: task.instruction, taskDate: task.taskDate, scheduledSlot: task.scheduledSlot })),
  };
  return <><ButtonLink variant="tertiary" to={casePath(id)}>← Quay lại ca y tế</ButtonLink>
    <HorseHeading title="Phác đồ điều trị" horseId={medicalCase.horseId} description={'Ca y tế ' + id} />
    {saved && <AlertBanner type="success" title="Đã lưu phác đồ điều trị" />}
    <div className="medical-grid medical-treatment-layout"><div className="medical-stack">
      {medicalCase.status === 'CLOSED' ? <AlertBanner type="danger" title="Không thể sửa ca y tế đã đóng" /> :
        <TreatmentPlanEditor key={medicalCase.treatmentPlan?.id ?? 'new'} openedAt={medicalCase.openedAt} initial={initial} retainedTaskCount={tasks.length} onCancel={() => navigate(casePath(id))} onSave={async (input) => { await service.saveTreatment(id, input); setSaved(true); reload(); }} />}
      <CaseTasks caseId={id} />
    </div><div className="medical-stack">
      <TreatmentCaseSummary item={medicalCase} />
      <Card title="Triển khai phác đồ"><p>Groom chỉ thấy hướng dẫn chăm sóc được giao. Chẩn đoán và chi tiết thuốc vẫn nằm trong hồ sơ thú y.</p></Card>
    </div></div></>;
}
function CaseTasks({ caseId }: { caseId: number }) {
  const { service } = useMedicalRuntime();
  const [page, setPage] = useState(0);
  const load = useCallback(() => service.listCaseTasks(caseId, page), [service, caseId, page]);
  const { data, error, reload } = useResource(load);
  return <Card title="Công việc điều trị đã giao">{!data ? <ResourceState error={error} retry={reload} /> : <div className="medical-stack">
    <History count={data.items.length} empty="Chưa giao công việc điều trị nào">{data.items.map((task) =>
      <li key={task.id}>{formatDate(task.taskDate)} · Groom {task.assignedGroomUserId} · {viLabel(task.status)}<p>{task.instruction}</p></li>)}</History>
    <div className="medical-actions"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {page + 1} · tổng {data.totalElements}</span><Button variant="secondary" disabled={(page + 1) * data.size >= data.totalElements} onClick={() => setPage(page + 1)}>Sau</Button></div>
  </div>}</Card>;
}
