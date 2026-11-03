import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, Icon, LoadingState, MetricCard, Modal, PresetField, SelectField, TableToolbar, TextAreaField, TextField, UnsavedChangesGuard } from '../../design-system';
import { CARE_TIME_PRESETS, MEAL_PRESETS, UNIT_PRESETS } from '../../shared/formPresets';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { createStableCareApi, type StableCareApi, type Plan, type CareItem, type NutritionItem, type StockItem } from './stableCareApi';
import type { RoleCode } from '../../shared/auth/roles';
import { IncidentReportModal } from '../../shared/incidents';
import type { Task } from './stableCareApi';
import { formatDate } from '../horses/shared/format';
import styles from './stableCare.module.css';

const readers: RoleCode[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN', 'GROOM'];
const labels: Record<string, string> = { CLEANING: 'Vệ sinh chuồng', FEEDING: 'Cho ăn', BATHING: 'Tắm', LEG_SOAKING: 'Chăm sóc chân', OTHER: 'Khác', HAY: 'Cỏ khô', GRAIN: 'Thức ăn hạt', VITAMINS_SUPPLEMENTS: 'Bổ sung', FEED: 'Thức ăn', MEDICINE: 'Thuốc', MEDICAL_SUPPLY: 'Vật tư y tế', TOOL: 'Dụng cụ' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Không thực hiện được thao tác. Hãy thử lại.';
const options = (values: string[]) => values.map(value => ({ value, label: labels[value] ?? value }));
function ReadState({ loading, error, retry }: { loading: boolean; error: unknown; retry: () => void }) {
  if (error) return <ErrorState title="Không tải được dữ liệu" description={errorText(error)} onRetry={retry} />;
  return loading ? <LoadingState label="Đang tải dữ liệu chăm sóc…" /> : null;
}
function useEditorFocus() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'nearest' }); }, []);
  return heading;
}
function EditorProtection({ dirty, discard, onKeep, onDiscard }: { dirty: boolean; discard: boolean; onKeep: () => void; onDiscard: () => void }) {
  return <><UnsavedChangesGuard dirty={dirty} /><Modal open={discard} title="Hủy thay đổi chưa lưu?" onClose={onKeep} footer={<><Button variant="secondary" autoFocus onClick={onKeep}>Tiếp tục chỉnh sửa</Button><Button variant="danger" onClick={onDiscard}>Hủy thay đổi</Button></>}><p>Nội dung đang nhập chưa được lưu. Bạn có muốn bỏ các thay đổi này không?</p></Modal></>;
}
function useAction() {
  const lock = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function run(action: () => Promise<unknown>, confirmed: () => void) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); confirmed(); setNotice('Máy chủ đã xác nhận thao tác.'); }
    catch (cause) { setError(errorText(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, run, feedback: <>{error && <AlertBanner type="danger" title={error} />}{notice && <AlertBanner type="success" title={notice} />}</> };
}
export function StableCarePage() {
  const auth = useAuth(); const { pathname } = useLocation(); const token = authSession.read()?.accessToken;
  const role = auth.user?.roles.find(value => readers.includes(value));
  const api = useMemo(() => token ? createStableCareApi(token, auth.handleApiError) : null, [token, auth.handleApiError]);
  if (!role || !auth.user || !api) return <AlertBanner type="danger" title="Đăng nhập bằng vai trò có quyền chăm sóc chuồng." />;
  const inventory = pathname === '/inventory'; const daily = pathname === '/care/daily';
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role }} breadcrumb={[{ label: 'Chăm sóc chuồng' }, { label: inventory ? 'Kho vật tư' : daily ? 'Công việc theo ngày' : 'Kế hoạch' }]}>
    <section key={`${auth.user.id}:${token}`} className={styles.stack}>
      <header data-page-banner className={styles.header}><div><p className={styles.eyebrow}>Vận hành chuồng · Flow 4</p><h1>{inventory ? 'Kho & bổ sung vật tư' : daily ? 'Chăm sóc hằng ngày' : 'Kế hoạch chăm sóc & dinh dưỡng'}</h1></div>
        <nav aria-label="Chăm sóc chuồng" className={styles.actions}>
          {role !== 'GROOM' && <Link to="/stable" aria-current={!inventory && !daily ? 'page' : undefined}>Kế hoạch</Link>}<Link to="/care/daily" aria-current={daily ? 'page' : undefined}>Công việc theo ngày</Link>{role !== 'HEAD_TRAINER' && <Link to="/inventory" aria-current={inventory ? 'page' : undefined}>Kho vật tư</Link>}
        </nav></header>
      {inventory ? <Inventory api={api} role={role} /> : daily ? <Daily api={api} role={role} /> : <Plans api={api} role={role} />}
    </section>
  </AppShell>;
}
function Daily({ api, role }: { api: StableCareApi; role: RoleCode }) {
  const [date, setDate] = useState(today()); const [editing, setEditing] = useState(false);
  return <><div className={styles.dayHeader}><div><h2>Lịch chăm sóc theo ngày</h2><p>Chọn ngày để xem đúng phân công. Kiểm tra trước buổi tập và điều trị được theo dõi riêng.</p></div><div className={styles.dateActions}><TextField label="Ngày công việc (giờ Việt Nam)" type="date" disabled={editing} value={date} onChange={e => setDate(e.target.value)} /><Button variant="secondary" disabled={editing || date === today()} onClick={() => setDate(today())}>Hôm nay</Button></div></div>{date && <DayTasks key={date} api={api} role={role} date={date} onEditing={setEditing} />}</>;
}
function DayTasks({ api, role, date, onEditing }: { api: StableCareApi; role: RoleCode; date: string; onEditing: (value: boolean) => void }) {
  const data = useSupportingLoad(() => api.tasks(date), [api, date]); const action = useAction();
  const [report, setReport] = useState<Task | null>(null);
  const [edit, setEdit] = useState<{ task: Task; mode: 'cancel' | 'reassign' } | null>(null);
  const [history, setHistory] = useState<Task | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { onEditing(edit !== null || report !== null); return () => onEditing(false); }, [edit, report, onEditing]);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const rows = (data.data ?? []).filter(t => `${t.horseName} ${t.horseCode} ${t.instructions} ${t.groomName}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')) && (!status || (t.cancelledAt ? 'cancelled' : t.completedAt ? 'done' : 'open') === status));
  const counts = data.data && !data.error ? { total: data.data.length, done: data.data.filter(t => t.completedAt).length, cancelled: data.data.filter(t => t.cancelledAt).length, pending: data.data.filter(t => !t.completedAt && !t.cancelledAt).length } : null;
  const canChange = (task: Task) => !task.completedAt && !task.cancelledAt && date >= today() && (role === 'CLUB_MANAGER' || role === 'HEAD_TRAINER' && task.source === 'NUTRITION');
  return <>{action.feedback}{notice && <AlertBanner type="success" title={notice} />}<ReadState loading={!data.data} error={data.error} retry={data.retry} />
    {counts && <section className={styles.summary} aria-label="Tổng hợp công việc trong ngày"><MetricCard className={styles.summaryTotal} label="Tổng công việc" value={String(counts.total)} caption={role === 'GROOM' ? 'Chỉ công việc được giao cho bạn' : 'Trong ngày đã chọn'} /><MetricCard className={styles.summaryPending} label="Cần thực hiện" value={String(counts.pending)} caption={date > today() ? 'Chưa được hoàn thành trước ngày' : 'Chưa hoàn thành và chưa hủy'} captionTone="warning" /><MetricCard className={styles.summaryDone} label="Đã hoàn thành" value={String(counts.done)} caption="Đã có người và thời điểm thực hiện" captionTone="success" /><MetricCard className={styles.summaryCancelled} label="Đã hủy" value={String(counts.cancelled)} caption="Giữ lại lịch sử và lý do" /></section>}
    <div className={styles.dayHeader}><p className={styles.guidance}>Hoàn thành việc không tự trừ kho, gỡ hạn chế y tế hoặc thay thế precheck. Báo bất thường để Veterinarian tiếp nhận.</p><Button variant="secondary" size="sm" disabled={action.busy || !!edit || !!report} onClick={data.retry}>Tải lại công việc</Button></div>
    <TableToolbar label="Lọc công việc đã tải" scope="page" resultCount={data.data && !data.error ? rows.length : undefined} hasFilters={!!search || !!status} onClear={() => { setSearch(''); setStatus(''); }}><TextField label="Tìm ngựa / công việc" value={search} onChange={e => setSearch(e.target.value)} /><SelectField label="Trạng thái" value={status} onChange={e => setStatus(e.target.value)} options={[{ value: '', label: 'Tất cả' }, { value: 'done', label: 'Đã hoàn thành' }, { value: 'open', label: 'Chưa hoàn thành' }, { value: 'cancelled', label: 'Đã hủy' }]} /></TableToolbar>
    <p role="status" className={styles.guidance}>{counts ? `${counts.done}/${counts.total} công việc của ngày đã hoàn thành · ${counts.cancelled} đã hủy · ${counts.pending} còn lại` : 'Chưa có tổng số đã xác minh'}</p>
    {data.data && !data.error && <DataTable rows={rows} rowKey={t => t.id} caption="Công việc chăm sóc theo ngày" empty={<EmptyState title="Không có công việc phù hợp" description="Chọn ngày hoặc xóa bộ lọc để kiểm tra lại." />} columns={[
      { key: 'horse', header: 'Ngựa / chuồng', render: t => <><strong>{t.horseName}</strong><p>{t.horseCode} · {t.boxCode ?? 'Chưa xác định chuồng'}</p></> },
      { key: 'work', header: 'Công việc', render: t => <>{labels[t.taskType] ?? t.taskType} · {t.slot}<p>{t.instructions}</p></> },
      { key: 'groom', header: 'Phân công', render: t => t.groomName },
      { key: 'state', header: 'Trạng thái', render: t => <div className={styles.stateCell}><span className={styles.taskState} data-state={t.cancelledAt ? 'cancelled' : t.completedAt ? 'done' : 'open'}>{t.cancelledAt ? 'Đã hủy' : t.completedAt ? 'Đã hoàn thành' : 'Chưa hoàn thành'}</span>{t.cancelledAt ? <><p>{t.cancellationReason}</p><time dateTime={t.cancelledAt}>{new Date(t.cancelledAt).toLocaleString('vi-VN')}</time></> : t.completedAt ? <time dateTime={t.completedAt}>{new Date(t.completedAt).toLocaleString('vi-VN')}</time> : <small>{date > today() ? 'Chưa đến ngày thực hiện' : date < today() ? 'Công việc chưa ghi nhận trong ngày đã qua' : 'Thực hiện theo phân công hôm nay'}</small>}</div> },
      { key: 'actions', header: 'Thao tác', render: t => <div className={styles.rowActions} role="group" aria-label={`Thao tác cho ${t.horseName}`}>{role === 'GROOM' && <div className={styles.rowMutations}><Button size="sm" disabled={action.busy || !!t.completedAt || !!t.cancelledAt || date > today()} onClick={() => void action.run(() => api.complete(t.id), data.retry)}>Hoàn thành</Button><Button size="sm" variant="secondary" disabled={!!t.cancelledAt || date > today()} onClick={() => setReport(t)}>Báo bất thường</Button></div>}{canChange(t) && <div className={styles.rowMutations}><Button size="sm" variant="secondary" onClick={() => { setNotice(''); setEdit({ task: t, mode: 'reassign' }); }}><Icon name="user" size={14} />Đổi Groom</Button><Button size="sm" variant="danger-outline" onClick={() => { setNotice(''); setEdit({ task: t, mode: 'cancel' }); }}><Icon name="x" size={14} />Hủy công việc</Button></div>}<Button size="sm" variant="secondary" onClick={() => setHistory(t)}><Icon name="history" size={14} />Lịch sử</Button></div> },
    ]} />}
    {report && <IncidentReportModal open source={{ kind: 'groom', horseId: report.horseId, horseLabel: report.horseName, careTaskId: report.id, contextLabel: `${labels[report.taskType]} · ${report.taskDate}` }} onClose={() => setReport(null)} onSubmit={async body => { await api.reportIncident(body); setReport(null); }} />}
    {edit && <TaskEditor api={api} task={edit.task} mode={edit.mode} onClose={() => setEdit(null)} onSaved={() => { setNotice(edit.mode === 'cancel' ? 'Máy chủ đã xác nhận hủy công việc. Lịch sử được giữ nguyên.' : 'Máy chủ đã xác nhận đổi Groom và gửi thông báo.'); setEdit(null); data.retry(); }} />}
    {history && <TaskHistory api={api} task={history} onClose={() => setHistory(null)} />}
  </>;
}
function TaskEditor({ api, task, mode, onClose, onSaved }: { api: StableCareApi; task: Task; mode: 'cancel' | 'reassign'; onClose: () => void; onSaved: () => void }) {
  const action = useAction(); const [reason, setReason] = useState(''); const [groom, setGroom] = useState(''); const [discard, setDiscard] = useState(false);
  const grooms = useSupportingLoad(() => mode === 'reassign' ? api.grooms() : Promise.resolve([]), [api, mode]);
  const dirty = !!reason || !!groom;
  const close = () => { if (!action.busy) { if (dirty) setDiscard(true); else onClose(); } };
  function submit(e: FormEvent) { e.preventDefault(); void action.run(() => mode === 'cancel' ? api.cancel(task.id, task.groomUserId, reason) : api.reassign(task.id, task.groomUserId, Number(groom), reason), onSaved); }
  return <><EditorProtection dirty={dirty && !action.busy} discard={discard} onKeep={() => setDiscard(false)} onDiscard={onClose} /><Modal open title={mode === 'cancel' ? 'Hủy công việc' : 'Đổi Groom phụ trách'} onClose={close}>
    <p><strong>{task.horseName}</strong> · {formatDate(task.taskDate)} · {task.slot}</p><p>Đang giao: {task.groomName}. Chỉ cập nhật công việc này; giữ nguyên các việc khác và lịch sử đã hoàn thành.</p>{action.feedback}
    <form className={styles.stack} onSubmit={submit}><fieldset disabled={action.busy} className={styles.fields}>
      {mode === 'reassign' && <><ReadState loading={!grooms.data} error={grooms.error} retry={grooms.retry} /><SelectField label="Groom thay thế" required disabled={!grooms.data || !!grooms.error} value={groom} onChange={e => setGroom(e.target.value)} options={[{ value: '', label: 'Chọn Groom đang hoạt động' }, ...(!grooms.error ? grooms.data ?? [] : []).filter(g => g.id !== task.groomUserId).map(g => ({ value: String(g.id), label: g.fullName }))]} /></>}
      <TextAreaField label="Lý do thay đổi" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
      <div className={styles.saveActions}><Button variant="secondary" onClick={close}>Quay lại</Button><Button type="submit" variant={mode === 'cancel' ? 'danger' : 'primary'} disabled={action.busy || !reason.trim() || mode === 'reassign' && (!groom || !!grooms.error || !grooms.data?.some(g => String(g.id) === groom))}>{action.busy ? 'Đang gửi…' : mode === 'cancel' ? 'Xác nhận hủy công việc' : 'Lưu phân công'}</Button></div>
    </fieldset></form></Modal></>;
}
function TaskHistory({ api, task, onClose }: { api: StableCareApi; task: Task; onClose: () => void }) {
  const data = useSupportingLoad(() => api.changes(task.id), [api, task.id]);
  return <Modal open title="Lịch sử phân công công việc" onClose={onClose}><p>{task.horseName} · {formatDate(task.taskDate)} · {task.slot}</p><ReadState loading={!data.data} error={data.error} retry={data.retry} />
    {data.data && !data.error && (data.data.length ? <ol className={styles.stack}>{data.data.map(change => <li key={change.id}><strong>{change.changeType === 'CANCEL' ? 'Hủy công việc' : 'Đổi Groom'}</strong><p>{change.previousGroomName}{change.newGroomName && ` → ${change.newGroomName}`}</p><p>{change.reason}</p><time dateTime={change.changedAt}>{new Date(change.changedAt).toLocaleString('vi-VN')} · {change.changedBy}</time></li>)}</ol> : <EmptyState title="Chưa có thay đổi phân công" description="Lịch sử chỉ xuất hiện sau khi máy chủ xác nhận đổi Groom hoặc hủy công việc." />)}
  </Modal>;
}
function Plans({ api, role }: { api: StableCareApi; role: RoleCode }) {
  const horses = useSupportingLoad(api.horses, [api]); const [horseId, setHorseId] = useState(''); const [nutrition, setNutrition] = useState(false); const [editing, setEditing] = useState(false);
  return <><ReadState loading={!horses.data} error={horses.error} retry={horses.retry} /><div className={styles.grid}><SelectField label="Ngựa" disabled={editing} value={horseId} onChange={e => setHorseId(e.target.value)} options={[{ value: '', label: 'Chọn ngựa' }, ...(horses.data ?? []).map(h => ({ value: String(h.id), label: `${h.name} · ${h.horseCode}` }))]} />
    <SelectField label="Loại kế hoạch" disabled={editing} value={nutrition ? 'nutrition' : 'care'} onChange={e => setNutrition(e.target.value === 'nutrition')} options={[{ value: 'care', label: 'Chăm sóc' }, { value: 'nutrition', label: 'Dinh dưỡng' }]} /></div>
    {horseId && <HorsePlans key={`${horseId}:${nutrition}`} api={api} horseId={Number(horseId)} nutrition={nutrition} canWrite={role === 'CLUB_MANAGER' || nutrition && role === 'HEAD_TRAINER'} onEditing={setEditing} />}</>;
}
function HorsePlans({ api, horseId, nutrition, canWrite, onEditing }: { api: StableCareApi; horseId: number; nutrition: boolean; canWrite: boolean; onEditing: (value: boolean) => void }) {
  const data = useSupportingLoad(() => api.plans(horseId, nutrition), [api, horseId, nutrition]); const [edit, setEdit] = useState<Plan | 'new' | null>(null); const [notice, setNotice] = useState('');
  const open = (plan: Plan | 'new') => { setNotice(''); setEdit(plan); onEditing(true); };
  const close = () => { setEdit(null); onEditing(false); };
  return <>{notice && <AlertBanner type="success" title={notice} />}<ReadState loading={!data.data} error={data.error} retry={data.retry} />{canWrite && <p>Để đổi Groom hoặc hủy từng việc chưa thực hiện trong kế hoạch đang chạy, mở <Link to="/care/daily">Công việc theo ngày</Link>. Lịch sử đã hoàn thành được giữ nguyên.</p>}{canWrite && !edit && <div className={styles.actions}><Button onClick={() => open('new')}>Tạo kế hoạch {nutrition ? 'dinh dưỡng' : 'chăm sóc'}</Button></div>}
    {edit && <PlanEditor key={edit === 'new' ? 'new' : edit.id} api={api} horseId={horseId} nutrition={nutrition} plan={edit === 'new' ? undefined : edit} onClose={close} onSaved={() => { close(); setNotice('Đã lưu kế hoạch và cập nhật công việc được giao.'); data.retry(); }} />}
    {data.data?.length === 0 && <EmptyState title="Chưa có kế hoạch" description="Tạo kế hoạch để sinh công việc cho Groom trong khoảng ngày được chọn." />}
    {data.data?.map(p => <Card key={p.id}><div className={styles.header}><h2>{nutrition ? 'Dinh dưỡng' : 'Chăm sóc'} #{p.id}</h2>{canWrite && <Button variant="secondary" disabled={edit !== null} onClick={() => open(p)}>Sửa kế hoạch</Button>}</div><p>{formatDate(p.from)} – {formatDate(p.to)} · {p.notes || 'Không có ghi chú'}</p><ul>{p.careItems.map((i, n) => <li key={n}>{labels[i.taskType]} · {i.timeSlot}: {i.instructions}</li>)}{p.nutritionItems.map((i, n) => <li key={n}>{i.meal} · {labels[i.component]}: {i.quantity} {i.unit}</li>)}</ul></Card>)}
  </>;
}
function PlanEditor({ api, horseId, nutrition, plan, onClose, onSaved }: { api: StableCareApi; horseId: number; nutrition: boolean; plan?: Plan; onClose: () => void; onSaved: () => void }) {
  const heading = useEditorFocus(); const grooms = useSupportingLoad(api.grooms, [api]); const action = useAction();
  const [from, setFrom] = useState(plan?.from ?? today()); const [to, setTo] = useState(plan?.to ?? today()); const [groom, setGroom] = useState(plan ? String(plan.groomUserId) : ''); const [notes, setNotes] = useState(plan?.notes ?? '');
  const [care, setCare] = useState<CareItem[]>(plan?.careItems.length ? plan.careItems : [{ taskType: 'CLEANING', timeSlot: '08:00', instructions: '' }]);
  const [food, setFood] = useState<NutritionItem[]>(plan?.nutritionItems.length ? plan.nutritionItems : [{ meal: '07:00', component: 'HAY', quantity: 0, unit: 'kg' }]);
  const [discard, setDiscard] = useState(false);
  const serialized = JSON.stringify({ from, to, groom, notes, care, food }); const [original] = useState(serialized); const dirty = serialized !== original;
  function submit(e: FormEvent) { e.preventDefault(); void action.run(() => api.savePlan(nutrition, { horseId, groomUserId: Number(groom), from, to, notes, items: nutrition ? food : care }, plan?.id), onSaved); }
  return <Card><EditorProtection dirty={dirty && !action.busy} discard={discard} onKeep={() => setDiscard(false)} onDiscard={onClose} /><h2 ref={heading} tabIndex={-1}>{plan ? 'Sửa' : 'Tạo'} kế hoạch</h2><p>Kế hoạch có việc đã hoàn thành hoặc ngày quá khứ được giữ làm lịch sử; máy chủ từ chối ghi đè.</p>{action.feedback}<ReadState loading={!grooms.data} error={grooms.error} retry={grooms.retry} />
    <form className={styles.stack} onSubmit={submit}><fieldset disabled={action.busy} className={styles.fields}><div className={styles.grid}><TextField label="Từ ngày" type="date" min={today()} required value={from} onChange={e => setFrom(e.target.value)} /><TextField label="Đến ngày" type="date" min={from} required value={to} onChange={e => setTo(e.target.value)} /><SelectField label="Groom phụ trách" required value={groom} onChange={e => setGroom(e.target.value)} options={[{ value: '', label: 'Chọn Groom đang hoạt động' }, ...(grooms.data ?? []).map(g => ({ value: String(g.id), label: g.fullName }))]} /></div>
      <TextAreaField rows={2} label="Ghi chú kế hoạch" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />
      {nutrition ? food.map((i, n) => <div key={n} className={styles.item}><PresetField label={`Bữa ${n + 1}`} required maxLength={50} value={i.meal} options={MEAL_PRESETS} onValueChange={meal => setFood(food.map((v, k) => k === n ? { ...v, meal } : v))} helperText="Giờ gợi ý; có thể nhập lịch riêng, không tự thay đổi khẩu phần." /><SelectField label="Thành phần" value={i.component} onChange={e => setFood(food.map((v, k) => k === n ? { ...v, component: e.target.value } : v))} options={options(['HAY', 'GRAIN', 'VITAMINS_SUPPLEMENTS'])} /><TextField label="Số lượng" type="number" min="0.001" max="9999999.999" step="0.001" required value={i.quantity || ''} onChange={e => setFood(food.map((v, k) => k === n ? { ...v, quantity: Number(e.target.value) } : v))} /><PresetField label="Đơn vị" required maxLength={20} value={i.unit} options={UNIT_PRESETS} onValueChange={unit => setFood(food.map((v, k) => k === n ? { ...v, unit } : v))} helperText="Không tự quy đổi số lượng khi đổi đơn vị." /><Button variant="tertiary" disabled={food.length === 1 || action.busy} onClick={() => setFood(food.filter((_, k) => k !== n))}>Bỏ bữa {n + 1}</Button></div>) : care.map((i, n) => <div key={n} className={styles.item}><SelectField label={`Việc ${n + 1}`} value={i.taskType} onChange={e => setCare(care.map((v, k) => k === n ? { ...v, taskType: e.target.value } : v))} options={options(['CLEANING', 'FEEDING', 'BATHING', 'LEG_SOAKING', 'OTHER'])} /><PresetField label="Khung giờ" required maxLength={50} value={i.timeSlot} options={CARE_TIME_PRESETS} onValueChange={timeSlot => setCare(care.map((v, k) => k === n ? { ...v, timeSlot } : v))} /><TextAreaField rows={2} label="Hướng dẫn" required maxLength={2000} value={i.instructions} onChange={e => setCare(care.map((v, k) => k === n ? { ...v, instructions: e.target.value } : v))} /><Button variant="tertiary" disabled={care.length === 1 || action.busy} onClick={() => setCare(care.filter((_, k) => k !== n))}>Bỏ việc {n + 1}</Button></div>)}
      <div className={styles.actions}><Button variant="secondary" disabled={action.busy || (nutrition ? food.length : care.length) >= 20} onClick={() => nutrition ? setFood([...food, { meal: '', component: 'HAY', quantity: 0, unit: 'kg' }]) : setCare([...care, { taskType: 'CLEANING', timeSlot: '', instructions: '' }])}>Thêm {nutrition ? 'khẩu phần' : 'công việc'}</Button><span className={styles.saveActions}><Button variant="secondary" disabled={action.busy} onClick={() => dirty ? setDiscard(true) : onClose()}>Hủy</Button><Button type="submit" loading={action.busy} disabled={!groom || !grooms.data}>Lưu kế hoạch & giao việc</Button></span></div></fieldset>
    </form></Card>;
}
function Inventory({ api, role }: { api: StableCareApi; role: RoleCode }) {
  const data = useSupportingLoad(api.inventory, [api]); const [query, setQuery] = useState(''); const [editor, setEditor] = useState<StockItem | 'new' | null>(null); const [selected, setSelected] = useState<StockItem | null>(null); const [revision, setRevision] = useState(0); const [notice, setNotice] = useState('');
  const rows = (data.data ?? []).filter(i => `${i.name} ${labels[i.category]}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  return <>{notice && <AlertBanner type="success" title={notice} />}<AlertBanner type="info" title="Sổ kho ghi nhận thực tế">Club Manager ghi nhập/xuất. Chăm sóc hoặc cho ăn không tự trừ kho. Yêu cầu bổ sung chỉ là yêu cầu, không phải đã nhập hàng.</AlertBanner><ReadState loading={!data.data} error={data.error} retry={data.retry} />
    <TableToolbar label="Lọc vật tư đã tải" scope="page" hasFilters={!!query} resultCount={data.data && !data.error ? rows.length : undefined} onClear={() => setQuery('')}><TextField label="Tìm vật tư / nhóm" value={query} onChange={e => setQuery(e.target.value)} /></TableToolbar>
    {role === 'CLUB_MANAGER' && <div className={styles.listActions}><Button disabled={editor !== null || selected !== null} onClick={() => { setSelected(null); setNotice(''); setEditor('new'); }}>Thêm vật tư</Button></div>}
    {editor && <ItemEditor key={editor === 'new' ? 'new' : editor.id} api={api} item={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); data.retry(); setSelected(null); setNotice('Đã lưu thông tin vật tư.'); }} />}
    {data.data && !data.error && <DataTable rows={rows} rowKey={i => i.id} caption="Kho vật tư" empty={<EmptyState title="Không có vật tư phù hợp" description="Thử xóa bộ lọc hoặc thêm vật tư mới." />} columns={[
      { key: 'name', header: 'Vật tư', render: i => <><strong>{i.name}</strong><p>{labels[i.category]}</p></> }, { key: 'quantity', header: 'Tồn thực tế', render: i => `${i.currentQuantity} ${i.unit}` },
      { key: 'threshold', header: 'Ngưỡng nhắc', render: i => <>{i.threshold ?? 'Chưa đặt'} {i.unit}{i.threshold !== null && i.currentQuantity <= i.threshold && <p>Cần kiểm tra bổ sung</p>}</> },
      { key: 'active', header: 'Trạng thái', render: i => i.active ? 'Đang sử dụng' : 'Ngừng sử dụng' },
      { key: 'actions', header: 'Thao tác', render: i => <div className={styles.actions}><Button variant="secondary" disabled={editor !== null || selected !== null} onClick={() => { setNotice(''); setSelected(i); }}>Sổ kho / thao tác</Button>{role === 'CLUB_MANAGER' && <Button variant="tertiary" disabled={editor !== null || selected !== null} onClick={() => { setSelected(null); setNotice(''); setEditor(i); }}>Sửa thông tin</Button>}</div> },
    ]} />}
    {selected && <StockActions key={`${selected.id}:${selected.currentQuantity}`} api={api} item={selected} role={role} onClose={() => setSelected(null)} refresh={() => { setSelected(null); data.retry(); setRevision(value => value + 1); setNotice(role === 'GROOM' ? 'Đã gửi yêu cầu bổ sung. Tồn kho chưa thay đổi.' : 'Đã ghi nhận biến động tồn kho.'); }} />}
    {(role === 'CLUB_MANAGER' || role === 'GROOM') && <Requests key={revision} api={api} />}
  </>;
}
function ItemEditor({ api, item, onClose, onSaved }: { api: StableCareApi; item?: StockItem; onClose: () => void; onSaved: () => void }) {
  const heading = useEditorFocus(); const action = useAction(); const [name, setName] = useState(item?.name ?? ''); const [category, setCategory] = useState(item?.category ?? 'FEED'); const [unit, setUnit] = useState(item?.unit ?? 'kg'); const [threshold, setThreshold] = useState(item?.threshold ?? 0); const [active, setActive] = useState(item?.active ?? true); const [discard, setDiscard] = useState(false);
  const serialized = JSON.stringify({ name, category, unit, threshold, active }); const [original] = useState(serialized); const dirty = serialized !== original;
  return <Card><EditorProtection dirty={dirty && !action.busy} discard={discard} onKeep={() => setDiscard(false)} onDiscard={onClose} /><h2 ref={heading} tabIndex={-1}>{item ? 'Sửa thông tin' : 'Thêm'} vật tư</h2>{action.feedback}<form className={styles.stack} onSubmit={e => { e.preventDefault(); void action.run(() => api.saveItem({ name, category, unit, threshold, active }, item?.id), onSaved); }}><fieldset disabled={action.busy} className={styles.fields}><div className={styles.grid}><TextField label="Tên vật tư" required maxLength={150} value={name} onChange={e => setName(e.target.value)} /><SelectField label="Nhóm" value={category} onChange={e => setCategory(e.target.value)} options={options(['FEED', 'MEDICINE', 'MEDICAL_SUPPLY', 'TOOL'])} /><PresetField label="Đơn vị" required maxLength={20} value={unit} options={UNIT_PRESETS} onValueChange={setUnit} helperText="Chọn đơn vị quản lý thực tế; có thể nhập thêm." /><TextField label="Ngưỡng nhắc bổ sung" required type="number" min="0" max="999999999.999" step="0.001" value={threshold} onChange={e => setThreshold(Number(e.target.value))} /><SelectField label="Trạng thái sử dụng" value={String(active)} onChange={e => setActive(e.target.value === 'true')} options={[{ value: 'true', label: 'Đang sử dụng' }, { value: 'false', label: 'Ngừng sử dụng' }]} /></div><div className={styles.saveActions}><Button variant="secondary" disabled={action.busy} onClick={() => dirty ? setDiscard(true) : onClose()}>Hủy</Button><Button type="submit" loading={action.busy}>Lưu thông tin</Button></div></fieldset></form></Card>;
}
function StockActions({ api, item, role, refresh, onClose }: { api: StableCareApi; item: StockItem; role: RoleCode; refresh: () => void; onClose: () => void }) {
  const heading = useEditorFocus(); const data = useSupportingLoad(() => api.movements(item.id), [api, item.id]); const action = useAction(); const [quantity, setQuantity] = useState(''); const [note, setNote] = useState(''); const [discard, setDiscard] = useState(false); const dirty = !!quantity || !!note;
  let form: ReactNode = null;
  if (role === 'CLUB_MANAGER' || role === 'GROOM') form = <form className={styles.stack} onSubmit={e => { e.preventDefault(); void action.run(() => role === 'CLUB_MANAGER' ? api.move(item.id, Number(quantity), item.currentQuantity, note) : api.request(item.id, Number(quantity), note), refresh); }}><fieldset className={styles.grid} disabled={action.busy}><TextField label={role === 'CLUB_MANAGER' ? `Biến động (${item.unit}): nhập dương, xuất âm` : `Số lượng đề nghị (${item.unit})`} required type="number" step="0.001" min={role === 'GROOM' ? '0.001' : undefined} max="999999999.999" value={quantity} onChange={e => setQuantity(e.target.value)} /><TextAreaField rows={2} label={role === 'GROOM' ? 'Lý do bổ sung' : 'Lý do nhập / xuất'} required maxLength={500} value={note} onChange={e => setNote(e.target.value)} /><Button type="submit" loading={action.busy} disabled={!item.active || !Number(quantity)}>{role === 'GROOM' ? 'Gửi yêu cầu bổ sung' : 'Ghi biến động thực tế'}</Button></fieldset></form>;
  return <Card><EditorProtection dirty={dirty && !action.busy} discard={discard} onKeep={() => setDiscard(false)} onDiscard={onClose} /><div className={styles.header}><h2 ref={heading} tabIndex={-1}>{item.name} · {item.currentQuantity} {item.unit}</h2><Button variant="tertiary" disabled={action.busy} onClick={() => dirty ? setDiscard(true) : onClose()}>Đóng sổ kho</Button></div>{action.feedback}{form}<ReadState loading={!data.data} error={data.error} retry={data.retry} />{data.data && !data.error && <DataTable rows={data.data} rowKey={m => m.id} caption="Lịch sử nhập xuất" empty={<EmptyState title="Chưa có biến động" description="Sổ kho được tạo khi Club Manager ghi nhập hoặc xuất thực tế." />} columns={[{ key: 'when', header: 'Thời điểm', render: m => new Date(m.recordedAt).toLocaleString('vi-VN') }, { key: 'quantity', header: 'Biến động', render: m => `${m.changeQuantity} ${m.unit}` }, { key: 'who', header: 'Người ghi', render: m => m.recordedBy }, { key: 'note', header: 'Lý do', render: m => m.note }]} />}</Card>;
}
function Requests({ api }: { api: StableCareApi }) {
  const data = useSupportingLoad(api.requests, [api]);
  return <Card><h2>Yêu cầu bổ sung đã gửi</h2><ReadState loading={!data.data} error={data.error} retry={data.retry} />{data.data && !data.error && <DataTable rows={data.data} rowKey={r => r.id} caption="Yêu cầu bổ sung" empty={<EmptyState title="Chưa có yêu cầu" description="Groom gửi yêu cầu từ vật tư cần bổ sung." />} columns={[{ key: 'item', header: 'Vật tư', render: r => r.itemName }, { key: 'quantity', header: 'Đề nghị', render: r => `${r.quantity} ${r.unit}` }, { key: 'who', header: 'Người gửi', render: r => r.requestedBy }, { key: 'reason', header: 'Lý do', render: r => r.reason }]} />}</Card>;
}
