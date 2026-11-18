// CORE-046 — giao diện Groom làm công việc được giao từ phác đồ Vet.
// Đây là việc điều trị, khác checklist kiểm tra trước buổi tập trong features/precheck.
// Groom đọc instruction và đánh dấu hoàn thành; không sửa chẩn đoán, thuốc hay hạn chế tập luyện.
// GroomTreatmentAccess kiểm tra role GROOM và tạo service theo actor hiện tại.
// collectAssignedTasks lấy các trang việc mà JWT này được phép thấy, không lấy toàn bộ rồi giấu bớt.
// Các bộ lọc Hôm nay/Sắp tới/Đã hoàn thành/Tất cả chỉ lọc dữ liệu đã được API cấp quyền.
// Hôm nay dùng lịch CLB; việc quá hạn chưa xong cũng hiện trong nhóm cần làm hôm nay.
// Checkbox không phải nút tự lưu vào database trên trình duyệt: phải đợi API complete thành công.

import { boxLabel } from '../../shared/stableBox';
import { ROUTES } from '../../app/routePaths';
import { UiPreviewNotice } from './UiPreviewNotice';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AlertBanner, Button, Card, Checkbox, EmptyState, Icon, SelectField, StatusBadge } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { ApiError } from '../../shared/auth/authApi';
import { collectAssignedTasks, createGroomService, type GroomService, type GroomTreatmentTask } from './groomService';
import type { HorseIdentity } from './horseRead';
import './medical.css';
import { useClubToday } from '../../shared/useClubToday';
import { formatDate } from '../horses/shared/format';
import { dateTime } from '../evaluation/models';

function groomError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
    if (error.status === 403) return 'Không có quyền truy cập. Bạn chỉ xem được công việc điều trị được giao cho mình.';
    if (error.status === 409) return 'Công việc đã thay đổi hoặc đã hoàn thành. Hãy làm mới danh sách trước khi thử lại.';
    if (error.status === 404) return 'Không truy cập được công việc điều trị.';
    if (error.code === 'INVALID_RESPONSE') return 'Dữ liệu công việc điều trị không hợp lệ. Hãy tải lại để thử lại.';
  }
  return 'Không xác nhận được dữ liệu công việc điều trị. Hãy thử lại hoặc làm mới danh sách.';
}

export function GroomTreatmentAccess() {
  const auth = useAuth(), actor = auth.user, token = authSession.read()?.accessToken;
  const service = useMemo(() => actor && token ? createGroomService(token, actor.id, auth.handleApiError) : null,
    [actor, token, auth.handleApiError]);
  if (auth.status !== 'authenticated' || actor?.accountStatus !== 'ACTIVE' || !actor.roles.includes('GROOM')) return <AlertBanner type="danger" title="Không có quyền truy cập" />;
  if (!service) return <AlertBanner type="danger" title="Đăng nhập lại để xem công việc được giao" />;
  return <AppShell user={{ fullName: actor.fullName, role: 'GROOM' }} breadcrumb={[{ label: 'Chăm sóc chuồng trại' }, { label: 'Công việc điều trị' }]}>
    <UiPreviewNotice />
    <GroomTasks key={`${actor.id}:${auth.expiresAt}`} service={service} />
  </AppShell>;
}

export function GroomTasks({ service }: { service: GroomService }) {
  // state chứa dữ liệu/lỗi tải danh sách; identities chứa tên/mã ngựa để đọc dễ hơn.
  // Tên ngựa tải lỗi không làm mất hướng dẫn công việc: màn có thể dùng mã ngựa tạm thời.
  // revision tăng khi reload để effect đọc lại dữ liệu mới từ server.
  const [state, setState] = useState<{ tasks?: GroomTreatmentTask[]; error?: string }>({});
  const [identities, setIdentities] = useState<{ source?: GroomTreatmentTask[]; rows: Record<number, HorseIdentity>; error?: string }>({ rows: {} });
  const [revision, setRevision] = useState(0), [filter, setFilter] = useState('today'), [horse, setHorse] = useState('');
  const [busy, setBusy] = useState<number | null>(null), [action, setAction] = useState<{ success?: string; error?: string }>({});
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    collectAssignedTasks(service).then((tasks) => { if (active) setState({ tasks }); })
      .catch((error: unknown) => { if (active) setState({ error: groomError(error) }); });
    return () => { active = false; };
  }, [service, revision]);
  useEffect(() => {
    let active = true;
    if (state.tasks && service.horse) {
      const source = state.tasks;
      const ids = [...new Set(source.map((task) => task.horseId))];
      Promise.allSettled(ids.map((id) => service.horse!(id))).then((responses) => {
        if (!active) return;
        const rows: Record<number, HorseIdentity> = {};
        responses.forEach((r) => { if (r.status === 'fulfilled') rows[r.value.id] = r.value; });
        setIdentities({ source, rows, ...(responses.some((r) => r.status === 'rejected') ? { error: 'Một số thông tin ngựa không tải được. Hướng dẫn công việc vẫn hiển thị.' } : {}) });
      });
    }
    return () => { active = false; };
  }, [state.tasks, service]);
  const reload = useCallback(() => { setState({}); setRevision((v) => v + 1); }, []);
  // Date-only taskDate is a calendar day; do not shift it by interpreting it as a UTC timestamp.
  const today = useClubToday();
  const tasks = useMemo(() => state.tasks ?? [], [state.tasks]);
  const isOverdue = (task: GroomTreatmentTask) => task.status === 'PENDING' && task.taskDate < today;
  const filtered = tasks.filter((t) => (!horse || t.horseId === Number(horse)) &&
    (filter === 'completed' ? t.status === 'COMPLETED' : filter === 'upcoming' ? t.status === 'PENDING' && t.taskDate > today : filter === 'all' ? true : t.taskDate === today || isOverdue(t)));
  const horseIds = [...new Set(tasks.map((t) => t.horseId))];
  const names = identities.source === state.tasks ? identities.rows : {};
  // Đọc id từ checkbox và tìm task đang có trong danh sách được giao.
  // pending khóa ngay lần nhấp đầu; status phải PENDING. Khi request lỗi không tự tick hoàn tất.
  // Sau API thành công, reload lấy trạng thái/thời gian mà server đã ghi; mounted ngăn
  // cập nhật màn đã rời. Ngày/giờ/người làm không được FE tự khai thay Backend.
  const handleComplete = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const taskId = Number(event.currentTarget.value);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (pending.current || task.status !== 'PENDING') return;
    pending.current = true; setBusy(task.id); setAction({});
    try {
      await service.complete(task.id);
      if (!mounted.current) return;
      setAction({ success: `Đã hoàn thành công việc ${task.id}.` });
      reload();
    } catch (error) { if (mounted.current) setAction({ error: groomError(error) }); }
    finally { pending.current = false; if (mounted.current) setBusy(null); }
  }, [tasks, service, reload]);
  return <div className="medical-stack">
    <PageHeader title="Công việc điều trị của tôi" description="Được giao từ phác đồ điều trị của Veterinarian" />
    {action.success && <AlertBanner feedback type="success" title={action.success} />}
    {action.error && <AlertBanner feedback type="danger" title={action.error} />}
    {identities.source === state.tasks && identities.error && <AlertBanner type="warning" title={identities.error} />}
    <div className="medical-groom-filters">
      <div className="medical-actions" role="group" aria-label="Bộ lọc công việc">{[['today', 'Hôm nay'], ['upcoming', 'Sắp tới'], ['completed', 'Đã hoàn thành'], ['all', 'Tất cả được giao']].map(([value, label]) =>
        <button key={value} type="button" className="medical-chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <SelectField label="Ngựa" placeholder="Tất cả ngựa của tôi" value={horse} options={horseIds.map((id) => ({ value: String(id), label: names[id]?.name ?? `Ngựa ${id}` }))} onChange={(e) => setHorse(e.target.value)} />
    </div>
    <div className="medical-grid medical-treatment-layout"><div className="medical-stack">
      {!state.tasks ? state.error ? <><AlertBanner type="danger" title={state.error} /><Button onClick={reload}>Thử lại</Button></> : <p role="status">Đang tải công việc điều trị được giao…</p> :
        !filtered.length ? <EmptyState title="Không có công việc nào với bộ lọc này" /> :
          [...new Set(filtered.map((t) => t.horseId))].map((horseId) => <Card key={horseId} className="medical-groom-panel" title={names[horseId] ? `${names[horseId].name} · ${names[horseId].horseCode}${names[horseId].currentBoxCode ? ` · ${boxLabel(names[horseId].currentBoxCode)}` : ''}` : `Ngựa ${horseId}`}>
            {names[horseId] && <div className="medical-actions">{names[horseId].healthStatus && <StatusBadge family="health" status={names[horseId].healthStatus} />}<StatusBadge family="availability" status={names[horseId].trainingAvailability} /></div>}
            <div className="medical-stack">{filtered.filter((t) => t.horseId === horseId).map((task) => <article key={task.id} className="medical-groom-task">
              <div className="medical-groom-task-row">
                <Checkbox className={task.status === 'COMPLETED' ? 'medical-completed-checkbox' : undefined} label="" aria-label={`Hoàn thành công việc ${task.id}`} value={task.id} checked={task.status === 'COMPLETED'} disabled={busy !== null || task.status === 'COMPLETED'} onChange={handleComplete} />
                <div><strong>{task.instruction}</strong><p className="text-caption">Ngày thực hiện {formatDate(task.taskDate)}</p></div>
                {task.scheduledSlot && <span className="medical-slot"><Icon name="clock" size={14} />{task.scheduledSlot}</span>}
                <p className="text-caption">{task.completedAt ? <>Đã hoàn thành <time dateTime={task.completedAt}>{dateTime(task.completedAt)}</time></> : busy === task.id ? 'Đang hoàn thành…' : isOverdue(task) ? <span className="medical-slot medical-task-overdue"><Icon name="clock" size={14} />Quá hạn</span> : 'Chưa hoàn thành'}</p>
              </div>
            </article>)}</div>
          </Card>)}
    </div><aside className="medical-stack">
      <Card className="medical-groom-panel" title="Bạn có thể làm gì ở đây"><div className="medical-help"><p>Đánh dấu hoàn thành công việc được giao — hệ thống ghi lại thời gian và người thực hiện.</p><p>Đọc hướng dẫn của Veterinarian cho từng công việc.</p><p className="text-caption">Chẩn đoán, phác đồ điều trị và đơn thuốc không hiển thị và không sửa được ở đây.</p><p className="text-caption">Chỉ Veterinarian mới đặt tình trạng sức khỏe và khả năng tập luyện.</p></div></Card>
      <Card className="medical-groom-panel" title="Thấy có gì bất thường?"><p>Nếu ngựa có dấu hiệu xấu đi khi bạn làm việc, hãy báo cáo để Veterinarian xem xét.</p><a href={ROUTES.incidents}>Báo cáo sự cố →</a></Card>
    </aside></div>
  </div>;
}
