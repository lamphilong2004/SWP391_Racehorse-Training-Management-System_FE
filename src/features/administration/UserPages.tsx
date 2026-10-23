import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, ButtonLink, Card, Checkbox, DataTable, EmptyState, ErrorState, LoadingState, RadioGroup, SelectField, StatusBadge, TableToolbar, TextField, UnsavedChangesGuard } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../../shared/auth/roles';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { accountApi, type SkillKind, type UserDetail, type UserInput } from './accountApi';
import styles from './Administration.module.css';
import { CORE_ROLE_MATRIX } from './approvedRoleMatrix';

const roleOptions = ROLE_CODES.map((value) => ({ value, label: ROLE_LABELS[value] }));
const time = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Chưa bao giờ';
export function UserListPage() {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]);
  const [q, setQ] = useState(''), [role, setRole] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(0);
  const load = useMemo(() => (signal: AbortSignal) => api.list(new URLSearchParams({ q, ...(role ? { role } : {}), ...(status ? { status } : {}), page: String(page), size: '20' }), signal), [api, q, role, status, page]);
  const resource = useResource(load);
  return <FlowShell title="Nhân sự & người dùng" section="Quản trị" role="CLUB_MANAGER" description="Mỗi người một tài khoản. Tài khoản chỉ bị vô hiệu hóa, không bao giờ bị xóa." actions={<div className={styles.actions}><ButtonLink variant="secondary" to="/admin/roles">Vai trò & quyền hạn</ButtonLink><ButtonLink to="/admin/users/new">Tạo người dùng</ButtonLink></div>}>
    <div className={styles.stack}><TableToolbar label="Bộ lọc nhân sự và người dùng" scope="server" resultCount={resource.pending ? undefined : resource.data?.totalItems} hasFilters={Boolean(q || role || status)} onClear={() => { setQ(''); setRole(''); setStatus(''); setPage(0); }}>
      <TextField label="Tìm theo tên, email hoặc mã" type="search" maxLength={100} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <SelectField label="Vai trò" value={role} options={[{ value: '', label: 'Tất cả vai trò' }, ...roleOptions]} onChange={(e) => { setRole(e.target.value); setPage(0); }} />
      <SelectField label="Trạng thái" value={status} options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'INACTIVE', label: 'Ngừng hoạt động' }]} onChange={(e) => { setStatus(e.target.value); setPage(0); }} />
    </TableToolbar>
    {resource.pending && <LoadingState label="Đang tải tài khoản…" />}{resource.error && <ErrorState title="Không tải được danh sách tài khoản" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <><Card><div className={styles.scroll}><DataTable rows={resource.data.items} rowKey={(u) => u.id} caption="Nhân sự và người dùng" empty={<EmptyState title="Không có tài khoản phù hợp" />} columns={[
      { key: 'name', header: 'Họ tên', render: (u) => u.fullName }, { key: 'code', header: 'Mã người dùng', render: (u) => u.userCode },
      { key: 'email', header: 'Email', render: (u) => u.email }, { key: 'role', header: 'Vai trò', render: (u) => u.roles.map((r) => ROLE_LABELS[r]).join(', ') },
      { key: 'status', header: 'Trạng thái', render: (u) => <StatusBadge family="account" status={u.accountStatus} /> },
      { key: 'login', header: 'Lần đăng nhập cuối', render: (u) => time(u.lastLoginAt) }, { key: 'edit', header: 'Thao tác', render: (u) => <ButtonLink size="sm" variant="secondary" to={`/admin/users/${u.id}/edit`} aria-label={`Sửa ${u.fullName}`}>Sửa</ButtonLink> },
    ]} /></div></Card><div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button><span>{resource.data.totalItems} tài khoản · trang {page + 1}</span><Button variant="secondary" disabled={page + 1 >= resource.data.totalPages} onClick={() => setPage(page + 1)}>Sau</Button></div></>}
    </div></FlowShell>;
}
export function UserEditorPage() {
  const { id } = useParams();
  if (id !== undefined && (!Number.isSafeInteger(Number(id)) || Number(id) < 1)) return <FlowShell title="Không tải được người dùng" section="Quản trị" role="CLUB_MANAGER"><ErrorState title="Mã người dùng không hợp lệ" /></FlowShell>;
  return <UserEditorLoader key={id ?? 'new'} id={id === undefined ? undefined : idOf(id)} />;
}
function UserEditorLoader({ id }: { id?: number }) {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]);
  const load = useMemo(() => (signal: AbortSignal) => id === undefined ? Promise.resolve(null) : api.detail(id, signal), [id, api]);
  const resource = useResource(load);
  return <FlowShell title={id ? 'Sửa người dùng' : 'Tạo người dùng'} section="Quản trị" role="CLUB_MANAGER" description="Mỗi người đúng một vai trò; quyền hạn do hệ thống máy chủ kiểm soát.">
    {resource.pending && <LoadingState label="Đang tải người dùng…" />}{resource.error && <ErrorState title="Không tải được người dùng" description={resource.error} onRetry={resource.reload} />}
    {!resource.pending && !resource.error && <UserEditor key={id ?? 'new'} initial={resource.data ?? null} />}
  </FlowShell>;
}
function UserEditor({ initial }: { initial: UserDetail | null }) {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]), { user } = useAuth(), navigate = useNavigate();
  const [name, setName] = useState(initial?.fullName ?? ''), [email, setEmail] = useState(initial?.email ?? ''), [role, setRole] = useState<RoleCode>(initial?.roles[0] ?? 'GROOM');
  const [current, setCurrent] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(''); const inFlight = useRef(false);
  const [saved, setSaved] = useState(false);
  const initialSkills = useMemo(() => initial?.skills.map((skill) => skill.id) ?? [], [initial]);
  const [years, setYears] = useState(initial?.experienceYears == null ? '' : String(initial.experienceYears)), [level, setLevel] = useState(initial?.experienceLevel ?? '');
  const [skillIds, setSkillIds] = useState<number[]>(initialSkills);
  useEffect(() => { if (saved) void navigate('/admin/users'); }, [saved, navigate]);
  const staff = role !== 'HORSE_OWNER', kind = SKILL_KIND[role];
  const yearsError = years !== '' && !(/^\d+$/.test(years) && Number(years) <= 32767) ? 'Nhập số năm nguyên từ 0 đến 32767.' : undefined;
  const dirty = name !== (initial?.fullName ?? '') || email !== (initial?.email ?? '') || role !== (initial?.roles[0] ?? 'GROOM')
    || years !== (initial?.experienceYears == null ? '' : String(initial.experienceYears)) || level !== (initial?.experienceLevel ?? '') || skillIds.join() !== initialSkills.join();
  // Skills belong to one role (Trainer specialization / Work Rider skill); a role change starts from that role's saved skills.
  const changeRole = (next: RoleCode) => { setRole(next); setSkillIds(next === initial?.roles[0] ? initialSkills : []); };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (inFlight.current || yearsError) return; inFlight.current = true; setBusy(true); setError('');
    const input: UserInput = { fullName: name.trim(), email: email.trim(), roleCode: role, experienceYears: staff && years !== '' ? Number(years) : null,
      experienceLevel: staff && level.trim() ? level.trim() : null, skillIds: kind ? skillIds : [] };
    try { if (initial) await api.update(initial.id, input); else await api.create(input); setSaved(true); }
    catch (failure) { setError(errorMessage(failure)); } finally { inFlight.current = false; setBusy(false); }
  }
  async function changeStatus() {
    if (!current || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { setCurrent(await api.status(current.id, current.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')); }
    catch (failure) { setError(errorMessage(failure)); } finally { inFlight.current = false; setBusy(false); }
  }
  return <><UnsavedChangesGuard dirty={!saved && (dirty || busy)} /><form onSubmit={(e) => { void submit(e); }} className={styles.stack}>
    <div className={styles.columns}><div className={styles.stack}><Card title="Hồ sơ"><div className={styles.filters}>
      <TextField label="Họ và tên" required maxLength={150} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /><TextField label="Email" type="email" required maxLength={254} value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
    </div><p className={styles.muted}>{initial ? `Không thể thay đổi mã người dùng ${initial.userCode}.` : 'Mã người dùng được cấp tự động. Trạng thái ban đầu là Đang hoạt động.'}</p></Card>
    <Card title="Vai trò"><RadioGroup label="Vai trò trong hệ thống" required value={role} disabled={busy} options={roleOptions} onChange={(value) => changeRole(value as RoleCode)} helperText="Đổi vai trò sẽ đổi quyền truy cập; dữ liệu lịch sử vẫn được giữ. Không có vai trò tùy chỉnh." /></Card>
    {staff && <Card title="Kinh nghiệm & kỹ năng"><div className={styles.stack}><div className={styles.filters}>
      <TextField label="Kinh nghiệm (năm)" type="number" min={0} max={32767} step={1} inputMode="numeric" value={years} error={yearsError} disabled={busy} onChange={(e) => setYears(e.target.value)} />
      <TextField label="Cấp độ kinh nghiệm" maxLength={50} value={level} disabled={busy} onChange={(e) => setLevel(e.target.value)} helperText="Nhập tự do, ví dụ: Lâu năm." />
    </div>{kind ? <SkillPicker kind={kind} value={skillIds} disabled={busy} onChange={setSkillIds} /> : <p className={styles.muted}>Kỹ năng chỉ áp dụng cho Trainer (chuyên môn) và Work Rider (kỹ năng cưỡi).</p>}
      <p className={styles.muted}>Dùng cho gợi ý của Head Trainer; gợi ý không bao giờ tự quyết định.</p></div></Card>}
    {current && <Card title="Trạng thái tài khoản"><StatusBadge family="account" status={current.accountStatus} /><p>Tài khoản ngừng hoạt động không thể đăng nhập. Dữ liệu của họ vẫn được giữ.</p><Button type="button" className={styles.statusAction} variant={current.accountStatus === 'ACTIVE' ? 'danger' : 'secondary'} disabled={busy || current.id === user?.id} onClick={() => { void changeStatus(); }}>{current.accountStatus === 'ACTIVE' ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản'}</Button></Card>}
    </div><Card title="Vai trò này được truy cập gì"><p>{ROLE_LABELS[role]}</p><p>Quyền hạn cố định theo vai trò đã duyệt và phạm vi dữ liệu của hệ thống.</p><ButtonLink variant="secondary" to="/admin/roles">Xem vai trò & quyền hạn</ButtonLink><p>Horse Owner chỉ thấy ngựa của mình. Người quản lý không đặt mật khẩu cho người dùng.</p></Card></div>
    {error && <AlertBanner type="danger" title="Chưa lưu được người dùng">{error}</AlertBanner>}
    <div className={styles.actions}>{busy ? <Button type="button" variant="secondary" disabled>Hủy</Button> : <ButtonLink variant="secondary" to="/admin/users">Hủy</ButtonLink>}<Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Tạo người dùng'}</Button></div>
  </form></>;
}
const SKILL_KIND: Partial<Record<RoleCode, SkillKind>> = { TRAINER: 'TRAINER_SPECIALIZATION', WORK_RIDER: 'RIDER_SKILL' };
function SkillPicker({ kind, value, disabled, onChange }: { kind: SkillKind; value: number[]; disabled: boolean; onChange: (ids: number[]) => void }) {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]);
  const load = useMemo(() => (signal: AbortSignal) => api.skills(kind, signal), [api, kind]), resource = useResource(load);
  const legend = kind === 'TRAINER_SPECIALIZATION' ? 'Chuyên môn của Trainer' : 'Kỹ năng của Work Rider';
  return <fieldset className={styles.skills}><legend>{legend}</legend>
    {resource.pending && <LoadingState label="Đang tải kỹ năng…" />}{resource.error && <ErrorState title="Không tải được kỹ năng" description={resource.error} onRetry={resource.reload} />}
    {resource.data && (resource.data.length ? <div className={styles.skillGrid}>{resource.data.map((skill) => <Checkbox key={skill.id} label={skill.name} checked={value.includes(skill.id)} disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.checked ? [...value, skill.id] : value.filter((id) => id !== skill.id))} />)}</div> : <p className={styles.muted}>Chưa có {legend.toLowerCase()} nào được cấu hình.</p>)}
  </fieldset>;
}
export function RolesPage() {
  const request = useFlowRequest(), api = useMemo(() => accountApi(request), [request]);
  const load = useMemo(() => (signal: AbortSignal) => api.roles(signal), [api]), resource = useResource(load);
  return <FlowShell title="Vai trò & quyền hạn" section="Quản trị" role="CLUB_MANAGER" description="Danh mục vai trò chỉ để xem. Không thể chỉnh quyền riêng cho từng người." actions={<ButtonLink variant="secondary" to="/admin/users">Xem người dùng</ButtonLink>}>
    {resource.pending && <LoadingState label="Đang tải vai trò…" />}{resource.error && <ErrorState title="Không tải được vai trò" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <div className={styles.stack}>
      <AlertBanner type="info" title="Bảng quyền đã duyệt (chỉ xem)">V xem · C tạo · E sửa · D vô hiệu hóa/xóa mềm · X thực hiện. Phạm vi phân công và sở hữu vẫn do hệ thống máy chủ kiểm soát. Các phân hệ hoãn lại không được liệt kê.</AlertBanner>
      <Card><div className={styles.scroll}><DataTable rows={[...CORE_ROLE_MATRIX]} rowKey={(r) => r.id} caption="Ma trận quyền các chức năng cốt lõi đã duyệt (Figma 290:3537)" columns={[
        { key: 'feature', header: 'Chức năng', render: (r) => `${r.feature} · ${r.id}` },
        ...ROLE_CODES.map((r, index) => ({ key: r, header: ROLE_LABELS[r], render: (row: (typeof CORE_ROLE_MATRIX)[number]) => row.access[index] })),
      ]} /></div></Card>
      <Card title="Danh mục vai trò hiện tại của hệ thống"><DataTable rows={resource.data} rowKey={(r) => r.roleCode} caption="Vai trò và phạm vi dữ liệu của hệ thống" columns={[{ key: 'role', header: 'Vai trò', render: (r) => r.displayName }, { key: 'scope', header: 'Phạm vi', render: (r) => r.scoping }]} /></Card>
    </div>}
  </FlowShell>;
}
