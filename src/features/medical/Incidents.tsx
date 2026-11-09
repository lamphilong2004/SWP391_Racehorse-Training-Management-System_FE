import { boxLabel } from '../../shared/stableBox';
import { UiPreviewNotice } from './UiPreviewNotice';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertBanner, ButtonLink, Button, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, Modal, NextStep, SelectField, StatusBadge, TableToolbar, TextField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { RoleCode } from '../../shared/auth/roles';
import { IncidentReportModal, IncidentReportReceipt, type IncidentCreateRequest } from '../../shared/incidents';
import { MEDICAL_ROUTES } from './paths';
import { createIncidentService, type IncidentService, type OpenCase } from './incidentService';
import { readHorseIdentity } from './horseRead';
import type { Incident } from './models';
import { ApiError, requestApi } from '../../shared/auth/authApi';
import './medical.css';
import { viLabel } from '../../shared/viLabels';
const allowed: RoleCode[] = ['VETERINARIAN', 'HEAD_TRAINER', 'CLUB_MANAGER', 'TRAINER', 'WORK_RIDER', 'GROOM'];
const incidentPath = (id: number) => MEDICAL_ROUTES.incidents + '/' + id;
const casePath = (id: number) => MEDICAL_ROUTES.medicalCaseDetail.replace(':caseId', String(id));
const displayDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const labelType = (value: string) => value === 'OTHER' ? 'Khác' : viLabel(value);
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
  // BR-35: a Groom may report what they observe at the stable for any ACTIVE horse that is in a box today.
  const stableHorses = useMemo(() => token ? () => requestApi<{ items: { id: number; name: string; horseCode: string; currentBoxCode: string | null }[] }>('/api/horses?lifecycle=ACTIVE&size=100', { method: 'GET' }, { token })
    .then((page) => page.items.filter((item) => item.currentBoxCode).map((item) => ({ id: item.id, label: `${item.name} · ${item.horseCode} · ${boxLabel(item.currentBoxCode)}` }))) : undefined, [token]);
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
      {detail ? <IncidentDetailPage service={service} role={role} actorId={actor.id} horse={horse} reporter={reporter} /> : <IncidentListPage service={service} role={role} actorId={actor.id} horse={horse} reporter={reporter} stableHorses={stableHorses} />}
    </div>
  </AppShell>;
}
function useIncidentRead<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0), [state, setState] = useState<{ source?: () => Promise<T>; data?: T; error?: string; forbidden?: boolean }>({});
  useEffect(() => { let active = true; load().then((data) => { if (active) setState({ source: load, data }); }).catch((error: unknown) => { if (active) setState({ source: load, error: safeError(error), forbidden: error instanceof ApiError && error.status === 403 }); }); return () => { active = false; }; }, [load, revision]);
  return { ...(state.source === load ? state : {}), reload: () => { setState({}); setRevision((n) => n + 1); } };
}
function State({ error, reload }: { error?: string; reload: () => void }) { return error ? <ErrorState title="Không tải được sự cố" description={error} onRetry={reload} /> : <LoadingState label="Đang tải sự cố…" />; }
type HorseReader = (id: number) => ReturnType<typeof readHorseIdentity>;
type UserReader = (id: number) => Promise<string>;
const TRIAGE_ROLES: RoleCode[] = ['VETERINARIAN', 'HEAD_TRAINER', 'CLUB_MANAGER'];
const ROLE_NAMES: Record<string, string> = { GROOM: 'Groom', WORK_RIDER: 'Work Rider', TRAINER: 'Trainer', HEAD_TRAINER: 'Head Trainer', VETERINARIAN: 'Veterinarian', CLUB_MANAGER: 'Club Manager', HORSE_OWNER: 'Horse Owner' };
const STATUS_ORDER = { REPORTED: 0, UNDER_REVIEW: 1, RESOLVED: 2 } as const;
const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
type IncidentFocus = '' | 'REPORTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'HIGH_OPEN';

/** Where the report came from, in the words the Veterinarian triages by. */
function incidentSource(item: Pick<Incident, 'preSessionCheckId' | 'trainingSessionId' | 'careTaskId'>) {
  if (item.preSessionCheckId) return { label: 'Kiểm tra trước buổi tập', detail: `Lần kiểm tra #${item.preSessionCheckId} · buổi tập bị chặn` };
  if (item.trainingSessionId) return { label: 'Đang cưỡi · buổi tập đã dừng', detail: `Buổi tập #${item.trainingSessionId}` };
  if (item.careTaskId) return { label: 'Công việc chăm sóc', detail: `Công việc #${item.careTaskId}` };
  return { label: 'Quan sát tại chuồng', detail: 'Ngoài buổi tập' };
}
/** The reporter's role from the API; older responses fall back to the roles the source allows. */
function reporterRole(item: Pick<Incident, 'reportedByRole' | 'preSessionCheckId' | 'trainingSessionId' | 'careTaskId'>) {
  if (item.reportedByRole) return ROLE_NAMES[item.reportedByRole] ?? viLabel(item.reportedByRole);
  return item.preSessionCheckId || item.careTaskId ? 'Groom' : item.trainingSessionId ? 'Work Rider hoặc Trainer' : 'Nhân viên';
}
function Severity({ value }: { value: string }) {
  return <span className={`medical-severity medical-severity-${value.toLowerCase()}`}>{value === 'HIGH' ? 'Mức độ cao' : `Mức độ ${viLabel(value).toLowerCase()}`}</span>;
}

export function IncidentListPage({ service, role, actorId, horse, reporter, stableHorses }: { service: IncidentService; role: RoleCode; actorId: number; horse?: HorseReader; reporter?: UserReader; stableHorses?: () => Promise<{ id: number; label: string }[]> }) {
  const [page, setPage] = useState(0), [query, setQuery] = useState(''), [focus, setFocus] = useState<IncidentFocus>(''), [horseFilter, setHorseFilter] = useState('');
  const [params] = useSearchParams();
  const [report, setReport] = useState(role === 'GROOM' && params.get('report') === '1'), [success, setSuccess] = useState<Incident>();
  const [stable, setStable] = useState<{ id: number; label: string }[]>();
  useEffect(() => { let active = true; if (stableHorses && !stable) stableHorses().then((items) => { if (active) setStable(items); }, () => { if (active) setStable([]); }); return () => { active = false; }; }, [stableHorses, stable]);
  const load = useCallback(() => service.list(page), [service, page]);
  const state = useIncidentRead(load);
  const triage = TRIAGE_ROLES.includes(role);
  const items = state.data?.items ?? [];
  const horses = [...new Set(items.map((item) => item.horseId))];
  const counts = { REPORTED: items.filter((item) => item.status === 'REPORTED').length, UNDER_REVIEW: items.filter((item) => item.status === 'UNDER_REVIEW').length, HIGH_OPEN: items.filter((item) => item.observedSeverity === 'HIGH' && item.status !== 'RESOLVED').length };
  const matchesFocus = (item: Incident) => !focus || (focus === 'HIGH_OPEN' ? item.observedSeverity === 'HIGH' && item.status !== 'RESOLVED' : item.status === focus);
  const rows = items.filter((item) => matchesFocus(item) && (!horseFilter || String(item.horseId) === horseFilter) && [item.incidentCode, item.description, item.reportedByName, labelType(item.incidentType)].join(' ').toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => triage ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || SEVERITY_ORDER[a.observedSeverity] - SEVERITY_ORDER[b.observedSeverity] || Date.parse(b.reportedAt) - Date.parse(a.reportedAt) : 0);
  async function submit(input: IncidentCreateRequest) { try { const created = await service.report(input); setSuccess(created); state.reload(); } catch (error) { throw new Error(safeError(error), { cause: error }); } }
  const description = role === 'VETERINARIAN' ? 'Tiếp nhận báo cáo của Groom, Work Rider và Trainer: mở ca y tế, gắn vào ca đang mở hoặc đóng sự cố.'
    : triage ? 'Theo dõi báo cáo sự cố của đàn ngựa. Veterinarian tiếp nhận và xử lý.' : 'Sự cố bạn đã báo và tiến trình xử lý của Veterinarian.';
  const tiles: { key: 'REPORTED' | 'UNDER_REVIEW' | 'HIGH_OPEN'; label: string; hint: string }[] = [
    { key: 'REPORTED', label: 'Cần tiếp nhận', hint: 'Mới báo, chưa có ca y tế' },
    { key: 'UNDER_REVIEW', label: 'Đang xử lý', hint: 'Đã gắn ca y tế' },
    { key: 'HIGH_OPEN', label: 'Mức độ cao chưa đóng', hint: 'Ưu tiên xem trước' },
  ];
  return <div className="medical-stack">
    <PageHeader title="Sự cố" description={description} actions={role === 'GROOM' ? <Button onClick={() => setReport(true)}>Báo cáo sự cố</Button> : undefined} />
    {success && <IncidentReportReceipt incidentId={success.id} incidentCode={success.incidentCode} />}
    {triage && state.data && <div className="medical-incident-tiles" role="group" aria-label="Lọc nhanh sự cố">{tiles.map((tile) => <button key={tile.key} type="button" aria-pressed={focus === tile.key}
      className={`medical-incident-tile${tile.key === 'HIGH_OPEN' ? ' medical-incident-tile-alert' : ''}`} onClick={() => setFocus(focus === tile.key ? '' : tile.key)}>
      <strong>{counts[tile.key]}</strong><span>{tile.label}</span><small>{tile.hint}</small></button>)}</div>}
    <TableToolbar label="Bộ lọc sự cố" scope="page" resultCount={state.data ? rows.length : undefined} hasFilters={Boolean(query || focus || horseFilter)} onClear={() => { setQuery(''); setFocus(''); setHorseFilter(''); }}><TextField label="Tìm sự cố" placeholder="Mã sự cố, người báo, vấn đề…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <SelectField label="Ngựa" value={horseFilter} placeholder="Tất cả ngựa" options={horses.map((id) => ({ value: String(id), label: stable?.find((item) => item.id === id)?.label.split(' · ').slice(0, 2).join(' · ') ?? `Ngựa ${id}` }))} onChange={(event) => setHorseFilter(event.target.value)} />
      <SelectField label="Trạng thái" value={focus === 'HIGH_OPEN' ? '' : focus} placeholder="Tất cả trạng thái" options={['REPORTED', 'UNDER_REVIEW', 'RESOLVED'].map((value) => ({ value, label: viLabel(value) }))} onChange={(event) => setFocus(event.target.value as IncidentFocus)} />
    </TableToolbar>
    <Card title="Danh sách sự cố">{!state.data ? <State error={state.error} reload={state.reload} /> : <div className="medical-stack"><DataTable caption="Sự cố" rows={rows} rowKey={(item) => item.id} empty={<EmptyState title="Không có sự cố" description="Không có báo cáo phù hợp với bộ lọc này." />} columns={[
      { key: 'problem', header: 'VẤN ĐỀ', render: (item) => <div className="medical-incident-problem"><strong>{labelType(item.incidentType)}</strong><Severity value={item.observedSeverity} /><Link to={incidentPath(item.id)}>{item.incidentCode}</Link></div> },
      { key: 'horse', header: 'NGỰA', render: (item) => <IncidentHorse horseId={item.horseId} read={horse} /> },
      { key: 'reporter', header: 'NGƯỜI BÁO · NGUỒN', render: (item) => <div className="medical-incident-reporter"><strong><IncidentReporter userId={item.reportedByUserId} actorId={actorId} read={item.reportedByName ? undefined : reporter} name={item.reportedByName} /></strong><span>{reporterRole(item)} · {incidentSource(item).label}</span></div> },
      { key: 'reported', header: 'THỜI ĐIỂM BÁO', nowrap: true, render: (item) => <time dateTime={item.reportedAt}>{displayDate(item.reportedAt)}</time> },
      { key: 'status', header: 'TRẠNG THÁI', render: (item) => <StatusBadge family="incident" status={item.status} /> },
      { key: 'action', header: 'THAO TÁC', nowrap: true, render: (item) => <ButtonLink size="sm" variant={role === 'VETERINARIAN' && item.status === 'REPORTED' ? 'primary' : 'secondary'} to={incidentPath(item.id)}>{role === 'VETERINARIAN' && item.status === 'REPORTED' ? 'Tiếp nhận' : 'Xem'}</ButtonLink> },
    ]} /><div className="medical-actions"><Button variant="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {page + 1} · {state.data.totalElements} báo cáo</span><Button variant="secondary" disabled={(page + 1) * state.data.size >= state.data.totalElements} onClick={() => setPage(page + 1)}>Sau</Button></div></div>}</Card>
    {triage && <p className="text-caption">Số liệu và bộ lọc tính trên trang đang tải. Chỉ Veterinarian được chuyển trạng thái sự cố.</p>}
    {report && <IncidentReportModal open source={{ kind: 'groom', contextLabel: 'Quan sát tại chuồng (ngoài buổi tập)' }} horses={stable ?? horses.map((id) => ({ id, label: `Ngựa ${id}` }))} onClose={() => setReport(false)} onSubmit={submit} />}
  </div>;
}
function IncidentHorse({ horseId, read }: { horseId: number; read?: HorseReader }) {
  const load = useCallback(() => read ? read(horseId) : Promise.reject(new Error('No identity projection')), [read, horseId]);
  const state = useIncidentRead(load);
  return state.data ? <span>{state.data.name}<br /><small>{state.data.horseCode}</small></span> : <span>Ngựa {horseId}</span>;
}
function IncidentReporter({ userId, actorId, read, name }: { userId: number; actorId: number; read?: UserReader; name?: string | null }) {
  const load = useCallback(() => read ? read(userId) : Promise.reject(new Error('No user directory access')), [read, userId]);
  const state = useIncidentRead(load);
  return <>{userId === actorId ? 'Bạn' : name || state.data || `Mã người dùng ${userId}`}</>;
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
  const [busy, setBusy] = useState(false), [caseId, setCaseId] = useState(''), [error, setError] = useState(''), [confirmResolve, setConfirmResolve] = useState(false);
  const [openCases, setOpenCases] = useState<OpenCase[]>();
  const locked = useRef(false), mounted = useRef(true), navigate = useNavigate();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const item: Incident | undefined = state.data;
  const canDecide = role === 'VETERINARIAN' && item?.status === 'REPORTED' && !item.medicalCaseId;
  const horseId = item?.horseId;
  useEffect(() => {
    if (!canDecide || horseId === undefined || !service.openCases) return;
    let active = true;
    service.openCases(horseId).then((cases) => { if (active) setOpenCases(cases); }, () => { if (active) setOpenCases([]); });
    return () => { active = false; };
  }, [canDecide, horseId, service]);
  async function review(action: 'OPEN_CASE' | 'LINK_CASE' | 'RESOLVE') {
    const current = state.data;
    if (locked.current || !current || role !== 'VETERINARIAN' || current.status === 'RESOLVED') return;
    if (action !== 'RESOLVE' && (current.status !== 'REPORTED' || current.medicalCaseId)) return;
    const target = Number(caseId);
    if (action === 'LINK_CASE' && (!Number.isSafeInteger(target) || target < 1)) { setError('Chọn một ca y tế đang mở.'); return; }
    locked.current = true; setBusy(true); setError('');
    try { const updated = await service.review(id, action, action === 'LINK_CASE' ? target : undefined); if (!mounted.current) return; setConfirmResolve(false); if (action === 'OPEN_CASE' && updated.medicalCaseId) navigate(casePath(updated.medicalCaseId)); else state.reload(); }
    catch (cause) { if (mounted.current) setError(safeError(cause)); } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  const source = item ? incidentSource(item) : undefined;
  return <div className="medical-stack"><ButtonLink variant="tertiary" to={MEDICAL_ROUTES.incidents}>← Quay lại danh sách sự cố</ButtonLink>
    {!item || !source ? state.forbidden ? <AlertBanner type="warning" title="Không có quyền xem chi tiết sự cố">
      <p>Danh sách sự cố chỉ hiển thị các báo cáo tài khoản của bạn được phép xem.</p>
      {role === 'TRAINER' && <ButtonLink variant="secondary" to="/medical/restrictions">Xem hạn chế tập luyện</ButtonLink>}
    </AlertBanner> : <State error={state.error} reload={state.reload} /> : <>
      <PageHeader title={labelType(item.incidentType)} description={`${item.incidentCode} · báo lúc ${displayDate(item.reportedAt)}`} actions={<StatusBadge family="incident" status={item.status} />} />
      <div className="medical-progress" aria-label="Trạng thái xử lý">{(['REPORTED', 'UNDER_REVIEW', 'RESOLVED'] as const).map((status) => <span key={status} className={status === item.status ? 'medical-progress-active' : ''}><StatusBadge family="incident" status={status} /></span>)}</div>
      <div className="medical-grid medical-treatment-layout"><div className="medical-stack">
        <Card title="Ai báo và báo từ đâu"><div className="medical-incident-who">
          <div className="medical-incident-person"><span className="medical-incident-avatar" aria-hidden="true">{(item.reportedByName || reporterRole(item)).trim().charAt(0).toUpperCase()}</span>
            <div><strong><IncidentReporter userId={item.reportedByUserId} actorId={actorId ?? 0} read={item.reportedByName ? undefined : reporter} name={item.reportedByName} /></strong><span>{reporterRole(item)}</span></div></div>
          <KeyValue label="Nguồn" value={<span><strong>{source.label}</strong><br /><small>{source.detail}</small></span>} />
          <KeyValue label="Phát hiện lúc" value={<time dateTime={item.observedAt}>{displayDate(item.observedAt)}</time>} />
        </div></Card>
        <Card title="Nội dung báo cáo"><div className="medical-stack">
          <div className="medical-incident-details"><KeyValue label="Ngựa" value={<IncidentHorse horseId={item.horseId} read={horse} />} /><KeyValue label="Vấn đề" value={<span className="medical-incident-problem">{labelType(item.incidentType)}<Severity value={item.observedSeverity} /></span>} /></div>
          <blockquote className="medical-incident-quote">{item.description || 'Người báo không ghi mô tả.'}</blockquote>
        </div></Card>
      </div><aside className="medical-stack">
        {role === 'VETERINARIAN' ? <Card title={item.status === 'RESOLVED' ? 'Đã xử lý' : 'Quyết định xử lý'}>
          {error && <AlertBanner feedback type="danger" title={error} />}
          {canDecide ? <div className="medical-incident-options">
            <section className="medical-incident-option medical-incident-option-primary"><h3>Mở ca y tế mới</h3><p>Khám, ghi chẩn đoán, lập phác đồ và đặt hạn chế tập nếu cần.</p><Button disabled={busy} onClick={() => review('OPEN_CASE')}>Mở ca y tế</Button></section>
            <section className="medical-incident-option"><h3>Gắn vào ca đang mở</h3>{openCases === undefined && service.openCases ? <p className="text-caption">Đang tải ca y tế của ngựa…</p>
              : openCases && openCases.length === 0 ? <p className="text-caption">Ngựa này không có ca y tế đang mở.</p>
              : <><SelectField label="Ca y tế của ngựa này" value={caseId} placeholder="Chọn ca y tế" options={(openCases ?? []).map((c) => ({ value: String(c.id), label: `Ca #${c.id} · mở ${displayDate(c.openedAt)}${c.reason ? ` · ${c.reason.slice(0, 40)}` : ''}` }))} onChange={(event) => setCaseId(event.target.value)} />
                <Button variant="secondary" disabled={busy || !caseId} onClick={() => review('LINK_CASE')}>Gắn vào ca</Button></>}</section>
            <section className="medical-incident-option"><h3>Đóng sự cố</h3><p>Không cần theo dõi y tế, ví dụ ngựa đã ổn khi bạn kiểm tra.</p><Button variant="secondary" disabled={busy} onClick={() => setConfirmResolve(true)}>Đóng sự cố</Button></section>
          </div>
          : item.status === 'UNDER_REVIEW' ? <div className="medical-stack">
            <p>Sự cố đang được xử lý trong ca y tế. Khi bạn đóng ca, sự cố này tự đóng theo.</p>
            {item.medicalCaseId && <ButtonLink variant="primary" to={casePath(item.medicalCaseId)}>Mở ca y tế #{item.medicalCaseId}</ButtonLink>}
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmResolve(true)}>Đóng sự cố</Button>
            <p className="text-caption">Đóng sự cố không đóng ca y tế và không gỡ hạn chế tập luyện.</p>
          </div>
          : <div className="medical-stack"><p>Sự cố đã đóng.{item.medicalCaseId ? ' Ca y tế và hạn chế tập được quản lý riêng.' : ''}</p>{item.medicalCaseId && <ButtonLink variant="secondary" to={casePath(item.medicalCaseId)}>Ca y tế #{item.medicalCaseId}</ButtonLink>}</div>}
        </Card> : <Card title="Theo dõi xử lý"><p>{item.status === 'REPORTED' ? 'Báo cáo đã được ghi nhận, đang chờ Veterinarian tiếp nhận.' : item.status === 'UNDER_REVIEW' ? 'Veterinarian đang xử lý trong ca y tế. Theo dõi hạn chế tập và công việc được giao cho bạn.' : 'Veterinarian đã đóng sự cố.'}</p></Card>}
        {item.status === 'RESOLVED' && (item.preSessionCheckId || item.trainingSessionId) && <NextStep title="Lên lịch buổi tập tiếp theo khi ngựa sẵn sàng" owner="Trainer phụ trách ngựa">
          <p>{item.preSessionCheckId ? 'Buổi tập cũ vẫn bị chặn theo kết quả kiểm tra bất thường. Trainer tạo buổi mới; Groom kiểm tra lại trước buổi.' : 'Buổi tập bị gián đoạn được giữ trong lịch sử. Trainer đánh giá phần đã tập rồi tạo buổi mới.'}</p>
        </NextStep>}
        <IncidentHorseStatus horseId={item.horseId} read={horse} />
      </aside></div>
      <Modal open={confirmResolve} title="Đóng sự cố này?" onClose={() => { if (!busy) setConfirmResolve(false); }} footer={<><Button variant="secondary" disabled={busy} onClick={() => setConfirmResolve(false)}>Quay lại</Button><Button disabled={busy} onClick={() => review('RESOLVE')}>{busy ? 'Đang đóng…' : 'Xác nhận đóng sự cố'}</Button></>}>
        <p>{labelType(item.incidentType)} · {item.incidentCode}</p>
        <p>Người báo sẽ thấy sự cố đã được xử lý. Ca y tế, hạn chế tập luyện và kết quả kiểm tra trước buổi tập không thay đổi.</p>
      </Modal>
    </>}
  </div>;
}
