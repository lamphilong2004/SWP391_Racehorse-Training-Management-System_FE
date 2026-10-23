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
import { ApiError, requestApi } from '../../shared/auth/authApi';
import './medical.css';
import { viLabel } from '../../shared/viLabels';
const allowed: RoleCode[] = ['VETERINARIAN', 'HEAD_TRAINER', 'CLUB_MANAGER', 'TRAINER', 'WORK_RIDER', 'GROOM'];
const incidentPath = (id: number) => MEDICAL_ROUTES.incidents + '/' + id;
const casePath = (id: number) => MEDICAL_ROUTES.medicalCaseDetail.replace(':caseId', String(id));
const displayDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const labelType = (value: string) => { if (viLabel(value) !== value) return viLabel(value); const text = value.toLowerCase().replaceAll('_', ' '); return text.charAt(0).toUpperCase() + text.slice(1); };
function safeError(error: unknown) {
  if (error instanceof ApiError && error.status === 403) return 'Không có quyền truy cập. Tài khoản của bạn không xem được sự cố này.';
  if (error instanceof ApiError && error.status === 404) return 'Không tìm thấy sự cố.';
  if (error instanceof ApiError && error.status === 409) return 'Sự cố đã thay đổi hoặc xung đột với thao tác này. Hãy làm mới và thử lại.';
  return 'Không tải hoặc cập nhật được báo cáo này. Hãy thử lại.';
}
export function IncidentAccess({ detail = false }: { detail?: boolean }) {
  const auth = useAuth(), actor = auth.user, token = authSession.read()?.accessToken;
  const role = actor?.roles.find((r) => allowed.includes(r));
  const service = useMemo(() => token && actor ? createIncidentService(token, actor, auth.handleApiError) : null, [token, actor, auth.handleApiError]);
  const horse = useMemo(() => token ? (id: number) => readHorseIdentity(token, id, auth.handleApiError) : undefined, [token, auth.handleApiError]);
  // Only the Club Manager may read the staff directory (GET /api/admin/users/{id}); other roles see the reporter id.
  const manager = actor?.roles.includes('CLUB_MANAGER') ?? false;
  const reporter = useMemo<UserReader | undefined>(() => {
    if (!token || !manager) return undefined;
    const names = new Map<number, Promise<string>>();
    return (id: number) => {
      if (!names.has(id)) names.set(id, requestApi<{ fullName?: unknown }>(`/api/admin/users/${id}`, { method: 'GET' }, { token }).then((user) => {
        if (typeof user?.fullName !== 'string' || !user.fullName.trim()) throw new Error('Name unavailable');
        return user.fullName;
      }));
      return names.get(id)!;
    };
  }, [token, manager]);
  if (auth.status !== 'authenticated' || !actor || actor.accountStatus !== 'ACTIVE' || !role || !service) return <AlertBanner type="danger" title="Không có quyền truy cập" />;
  return <AppShell user={{ fullName: actor.fullName, role }} breadcrumb={[{ label: 'Sự cố', to: MEDICAL_ROUTES.incidents }]}>
    <UiPreviewNotice />
    <div className="medical-stack" key={`${actor.id}:${auth.expiresAt}`}>
      {detail ? <IncidentDetailPage service={service} role={role} actorId={actor.id} horse={horse} reporter={reporter} /> : <IncidentListPage service={service} role={role} actorId={actor.id} horse={horse} reporter={reporter} />}
    </div>
  </AppShell>;
}
function useIncidentRead<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0), [state, setState] = useState<{ source?: () => Promise<T>; data?: T; error?: string }>({});
  useEffect(() => { let active = true; load().then((data) => { if (active) setState({ source: load, data }); }).catch((error: unknown) => { if (active) setState({ source: load, error: safeError(error) }); }); return () => { active = false; }; }, [load, revision]);
  return { ...(state.source === load ? state : {}), reload: () => { setState({}); setRevision((n) => n + 1); } };
}
function State({ error, reload }: { error?: string; reload: () => void }) { return error ? <ErrorState title="Không tải được sự cố" description={error} onRetry={reload} /> : <LoadingState label="Đang tải sự cố…" />; }
type HorseReader = (id: number) => ReturnType<typeof readHorseIdentity>;
type UserReader = (id: number) => Promise<string>;
export function IncidentListPage({ service, role, actorId, horse, reporter }: { service: IncidentService; role: RoleCode; actorId: number; horse?: HorseReader; reporter?: UserReader }) {
  const [page, setPage] = useState(0), [query, setQuery] = useState(''), [status, setStatus] = useState(''), [horseFilter, setHorseFilter] = useState('');
  const [report, setReport] = useState(false), [success, setSuccess] = useState('');
  const load = useCallback(() => service.list(page), [service, page]);
  const state = useIncidentRead(load);
  const horses = [...new Set(state.data?.items.map((item) => item.horseId) ?? [])];
  const rows = state.data?.items.filter((item) => (!status || item.status === status) && (!horseFilter || String(item.horseId) === horseFilter) && [item.incidentCode, item.horseId, item.description].join(' ').toLowerCase().includes(query.toLowerCase())) ?? [];
  async function submit(input: IncidentCreateRequest) { try { const created = await service.report(input); setSuccess(`Đã gửi sự cố ${created.incidentCode}.`); state.reload(); } catch (error) { throw new Error(safeError(error), { cause: error }); } }
  return <div className="medical-stack">
    <PageHeader title="Sự cố" description={role === 'GROOM' ? 'Sự cố bạn đã báo' : 'Báo cáo sự cố'} actions={role === 'GROOM' ? <Button onClick={() => setReport(true)}>Báo cáo sự cố</Button> : undefined} />
    {success && <AlertBanner type="success" title={success}>Đã ghi nhận báo cáo. Chỉ Veterinarian được thay đổi trạng thái xử lý.</AlertBanner>}
    <div className="medical-incident-filters"><TextField label="Tìm trên trang hiện tại" placeholder="Tìm mã sự cố hoặc mã ngựa…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <SelectField label="Ngựa (trang hiện tại)" value={horseFilter} placeholder="Tất cả ngựa" options={horses.map((id) => ({ value: String(id), label: `Ngựa ${id}` }))} onChange={(event) => setHorseFilter(event.target.value)} />
      <SelectField label="Trạng thái (trang hiện tại)" value={status} placeholder="Tất cả trạng thái" options={['REPORTED', 'UNDER_REVIEW', 'RESOLVED'].map((value) => ({ value, label: viLabel(value) }))} onChange={(event) => setStatus(event.target.value)} />
    </div>
    <Card title="Danh sách sự cố">{!state.data ? <State error={state.error} reload={state.reload} /> : <div className="medical-stack"><DataTable caption="Sự cố" rows={rows} rowKey={(item) => item.id} empty={<EmptyState title="Không có sự cố" description="Không có báo cáo phù hợp với trang và bộ lọc này." />} columns={[
      { key: 'code', header: 'SỰ CỐ', render: (item) => <Link to={incidentPath(item.id)}>{item.incidentCode}</Link> },
      { key: 'horse', header: 'NGỰA', render: (item) => <IncidentHorse horseId={item.horseId} read={horse} /> },
      { key: 'observation', header: 'QUAN SÁT', render: (item) => <span>{labelType(item.incidentType)}<br /><small>{viLabel(item.observedSeverity)}</small></span> },
      { key: 'reporter', header: 'NGƯỜI BÁO', render: (item) => <IncidentReporter userId={item.reportedByUserId} actorId={actorId} read={reporter} /> },
      { key: 'reported', header: 'THỜI ĐIỂM BÁO', nowrap: true, render: (item) => <time dateTime={item.reportedAt}>{displayDate(item.reportedAt)}</time> },
      { key: 'status', header: 'TRẠNG THÁI', render: (item) => <StatusBadge family="incident" status={item.status} /> },
      { key: 'reviewer', header: 'NGƯỜI XEM XÉT', render: () => 'Không có' },
    ]} /><div className="medical-actions"><Button variant="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {page + 1} · {state.data.totalElements} báo cáo</span><Button variant="secondary" disabled={(page + 1) * state.data.size >= state.data.totalElements} onClick={() => setPage(page + 1)}>Sau</Button></div></div>}</Card>
    <p className="text-caption">Bộ lọc áp dụng cho trang hiện tại. Chỉ Veterinarian được chuyển trạng thái sự cố.</p>
    {report && <IncidentReportModal open source={{ kind: 'groom' }} horses={horses.map((id) => ({ id, label: `Ngựa ${id}` }))} onClose={() => setReport(false)} onSubmit={submit} />}
  </div>;
}
function IncidentHorse({ horseId, read }: { horseId: number; read?: HorseReader }) {
  const load = useCallback(() => read ? read(horseId) : Promise.reject(new Error('No identity projection')), [read, horseId]);
  const state = useIncidentRead(load);
  return state.data ? <span>{state.data.name}<br /><small>{state.data.horseCode}</small></span> : <span>Ngựa {horseId}</span>;
}
function IncidentReporter({ userId, actorId, read }: { userId: number; actorId: number; read?: UserReader }) {
  const load = useCallback(() => read ? read(userId) : Promise.reject(new Error('No user directory access')), [read, userId]);
  const state = useIncidentRead(load);
  return <>{userId === actorId ? 'Bạn' : state.data ?? `Người dùng ${userId}`}</>;
}
function IncidentHorseStatus({ horseId, read }: { horseId: number; read?: HorseReader }) {
  const load = useCallback(() => read ? read(horseId) : Promise.reject(new Error('Identity unavailable')), [read, horseId]);
  const state = useIncidentRead(load);
  return <Card title="Tình trạng ngựa hiện tại">{state.data ? <div className="medical-stack"><KeyValue label="Tình trạng sức khỏe" value={state.data.healthStatus ? <StatusBadge family="health" status={state.data.healthStatus} /> : 'Chưa đánh giá'} /><KeyValue label="Khả năng tập luyện" value={<StatusBadge family="availability" status={state.data.trainingAvailability} />} /><p className="text-caption">Báo cáo sự cố không thay đổi các trạng thái này. Chỉ đội thú y được cập nhật.</p></div> : <p>Không tải được tình trạng ngựa.</p>}</Card>;
}
export function IncidentDetailPage({ service, role, actorId, horse, reporter }: { service: IncidentService; role: RoleCode; actorId?: number; horse?: HorseReader; reporter?: UserReader }) {
  const { incidentId = '' } = useParams(); const id = Number(incidentId);
  if (!/^\d+$/.test(incidentId) || !Number.isSafeInteger(id) || id < 1) return <div className="medical-stack"><ButtonLink variant="tertiary" to={MEDICAL_ROUTES.incidents}>← Quay lại danh sách sự cố</ButtonLink><EmptyState title="Không tìm thấy sự cố" /></div>;
  return <IncidentDetail key={id} id={id} service={service} role={role} actorId={actorId} horse={horse} reporter={reporter} />;
}
function IncidentDetail({ id, service, role, actorId, horse, reporter }: { id: number; service: IncidentService; role: RoleCode; actorId?: number; horse?: HorseReader; reporter?: UserReader }) {
  const load = useCallback(() => service.get(id), [service, id]), state = useIncidentRead(load);
  const [busy, setBusy] = useState(false), [caseId, setCaseId] = useState(''), [error, setError] = useState('');
  const locked = useRef(false), mounted = useRef(true), navigate = useNavigate();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function review(action: 'OPEN_CASE' | 'LINK_CASE' | 'RESOLVE') {
    const current = state.data;
    if (locked.current || !current || role !== 'VETERINARIAN' || current.status === 'RESOLVED') return;
    if (action !== 'RESOLVE' && (current.status !== 'REPORTED' || current.medicalCaseId)) return;
    const target = Number(caseId);
    if (action === 'LINK_CASE' && (!Number.isSafeInteger(target) || target < 1)) { setError('Nhập mã ca y tế là số dương hợp lệ.'); return; }
    locked.current = true; setBusy(true); setError('');
    try { const updated = await service.review(id, action, action === 'LINK_CASE' ? target : undefined); if (!mounted.current) return; if (action === 'OPEN_CASE' && updated.medicalCaseId) navigate(casePath(updated.medicalCaseId)); else state.reload(); }
    catch (cause) { if (mounted.current) setError(safeError(cause)); } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  const item: Incident | undefined = state.data;
  return <div className="medical-stack"><ButtonLink variant="tertiary" to={MEDICAL_ROUTES.incidents}>← Quay lại danh sách sự cố</ButtonLink>
    {!item ? <State error={state.error} reload={state.reload} /> : <>
      <PageHeader title={item.incidentCode} description={`${labelType(item.incidentType)} · ${displayDate(item.reportedAt)}`} actions={<StatusBadge family="incident" status={item.status} />} />
      <div className="medical-progress" aria-label="Trạng thái xử lý">{(['REPORTED', 'UNDER_REVIEW', 'RESOLVED'] as const).map((status) => <span key={status} className={status === item.status ? 'medical-progress-active' : ''}><StatusBadge family="incident" status={status} /></span>)}<p>Chỉ Veterinarian được chuyển trạng thái này.</p></div>
      <div className="medical-grid medical-treatment-layout"><div className="medical-stack">
        <Card title="Báo cáo"><div className="medical-incident-details"><KeyValue label="Ngựa" value={<IncidentHorse horseId={item.horseId} read={horse} />} /><KeyValue label="Thời điểm phát hiện" value={<time dateTime={item.observedAt}>{displayDate(item.observedAt)}</time>} /><KeyValue label="Loại" value={labelType(item.incidentType)} /><KeyValue label="Mức độ (người báo)" value={viLabel(item.observedSeverity)} /><KeyValue label="Mô tả" value={item.description || 'Không có mô tả.'} /><KeyValue label="Người báo" value={<IncidentReporter userId={item.reportedByUserId} actorId={actorId ?? 0} read={reporter} />} /></div></Card>
        <Card title="Nguồn"><p>{item.preSessionCheckId ? `Kiểm tra trước buổi tập ${item.preSessionCheckId}` : item.trainingSessionId ? `Buổi tập ${item.trainingSessionId}` : item.careTaskId ? `Công việc chăm sóc ${item.careTaskId}` : 'Báo cáo trực tiếp'}</p></Card>
        <Card title="Diễn biến"><p><time dateTime={item.reportedAt}>{displayDate(item.reportedAt)}</time> · Đã báo cáo</p><p>Trạng thái hiện tại: {viLabel(item.status)}</p></Card>
      </div><aside className="medical-stack"><IncidentHorseStatus horseId={item.horseId} read={horse} /><Card title="Xử lý">
        {item.medicalCaseId && role === 'VETERINARIAN' && <ButtonLink to={casePath(item.medicalCaseId)}>Ca y tế {item.medicalCaseId}</ButtonLink>}
        {role !== 'VETERINARIAN' ? <p>Chế độ chỉ xem cho người báo. Hồ sơ y tế chỉ dành cho đội thú y.</p> : item.status === 'RESOLVED' ? <p>Sự cố đã được xử lý xong. Không còn thao tác nào khác.</p> : <div className="medical-stack">
          {error && <AlertBanner type="danger" title={error} />}
          {item.status === 'REPORTED' && !item.medicalCaseId && <><Button disabled={busy} onClick={() => review('OPEN_CASE')}>Mở ca y tế</Button><TextField label="Mã ca y tế đang mở" type="number" min={1} step={1} value={caseId} onChange={(event) => setCaseId(event.target.value)} /><Button variant="secondary" disabled={busy || !caseId} onClick={() => review('LINK_CASE')}>Liên kết ca y tế</Button></>}
          <Button variant="secondary" disabled={busy} onClick={() => review('RESOLVE')}>Đóng sự cố</Button>
        </div>}
      </Card></aside></div>
    </>}
  </div>;
}
