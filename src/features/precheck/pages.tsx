import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, Card, EmptyState, ErrorState, KeyValue, LoadingState, MetricCard, RadioGroup, StatusBadge, TextField, UnsavedChangesGuard } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { IncidentReportModal } from '../../shared/incidents';
import { createPrecheckApi, type PrecheckApi } from './api';
import { CHECK_ITEMS, type CheckKey, type Checklist, type PrecheckSession, type PreSessionCheck } from './types';
import styles from './precheck.module.css';
import { greeting } from '../../shared/greeting';
import { viLabel } from '../../shared/viLabels';

function localDay() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function when(value: string) { return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }); }
function message(error: unknown) { return error instanceof Error ? error.message : 'Không tải được dữ liệu yêu cầu.'; }
function GroomShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.user?.roles.includes('GROOM')) return <AlertBanner type="danger" title="Không có quyền truy cập">Chỉ Groom được phân công mới được kiểm tra trước buổi tập.</AlertBanner>;
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role: 'GROOM' }} breadcrumb={[{ label: 'Chăm sóc chuồng trại', to: '/groom/today' }, { label: 'Kiểm tra trước buổi tập' }]}>{children}</AppShell>;
}

export function GroomTodayPage({ api: suppliedApi }: { api?: PrecheckApi }) {
  const auth = useAuth();
  const api = useMemo(() => suppliedApi ?? createPrecheckApi({ handleApiError: auth.handleApiError }), [suppliedApi, auth.handleApiError]);
  return <GroomShell><GroomToday api={api} /></GroomShell>;
}

function GroomToday({ api }: { api: PrecheckApi }) {
  const { handleApiError, user } = useAuth();
  const [date, setDate] = useState(localDay);
  const [attempt, setAttempt] = useState(0);
  const [sessions, setSessions] = useState<PrecheckSession[] | null>(null);
  const [error, setError] = useState<unknown>();
  const [summary, setSummary] = useState<{ tasks?: number; incidents?: number; unavailable?: boolean }>({});
  useEffect(() => {
    let active = true;
    api.sessions(date).then((items) => { if (active) setSessions(items); }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    Promise.allSettled([api.treatmentTasks(), api.incidents()]).then(([tasks, incidents]) => {
      if (!active) return;
      if (tasks.status === 'rejected') handleApiError(tasks.reason);
      if (incidents.status === 'rejected') handleApiError(incidents.reason);
      setSummary({ tasks: tasks.status === 'fulfilled' ? tasks.value.filter((task) => task.status === 'PENDING').length : undefined, incidents: incidents.status === 'fulfilled' ? incidents.value.length : undefined, unavailable: tasks.status === 'rejected' || incidents.status === 'rejected' });
    });
    return () => { active = false; };
  }, [api, date, attempt, handleApiError]);
  const retry = () => { setSessions(null); setError(undefined); setAttempt((value) => value + 1); };
  return <div className={styles.stack}>
    <div className={styles.header}><div><h1 className={styles.heading}>{greeting()}, {user?.fullName}</h1><p className={styles.muted}>Các buổi kiểm tra trước buổi tập, công việc điều trị và sự cố của bạn</p></div><ButtonLink to="/incidents">Xem sự cố</ButtonLink></div>
    <TextField className={styles.dateField} label="Ngày tập" type="date" value={date} onChange={(event) => { setSessions(null); setError(undefined); setDate(event.target.value); }} />
    <div className={styles.metrics}><MetricCard label="Kiểm tra trước buổi tập" value={sessions ? String(sessions.length) : '—'} /><MetricCard label="Công việc điều trị chưa xong" value={summary.tasks === undefined ? '—' : String(summary.tasks)} /><MetricCard label="Sự cố tôi đã báo" value={summary.incidents === undefined ? '—' : String(summary.incidents)} /></div>
    {summary.unavailable && <AlertBanner type="warning" title="Một số tóm tắt không tải được">Mở màn hình điều trị hoặc sự cố để thử lại. Kiểm tra trước buổi tập vẫn dùng được.</AlertBanner>}
    <div className={styles.columns}><Card title="Kiểm tra trước buổi tập">
      {error ? <ErrorState title={error instanceof ApiError && error.status === 403 ? 'Không có quyền truy cập' : 'Không tải được buổi tập của bạn'} description={message(error)} onRetry={retry} /> : !sessions ? <LoadingState label="Đang tải buổi tập được giao…" /> : sessions.length === 0 ? <EmptyState title="Không có buổi kiểm tra nào được giao" description="Bạn không có buổi tập nào trong ngày này." /> : [...sessions].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)).map((session) => <article key={session.id} className={styles.session}>
        <div className={styles.sessionInfo}><h3>{session.horse.name} · {session.horse.horseCode}</h3><p>Mã buổi: {session.sessionCode} · {when(session.scheduledStart)} · {session.focus || session.phaseName}</p><p className={styles.muted}>Work Rider {session.workRider.fullName}{session.trainer ? ` · Trainer ${session.trainer.fullName}` : ''}</p><StatusBadge family="session" status={session.status} /> <span>{session.preCheckResult ? session.preCheckResult === 'ALL_NORMAL' ? 'Kiểm tra đạt' : 'Bất thường — chặn bắt đầu' : 'Chưa kiểm tra'}</span></div>
        <ButtonLink variant="primary" to={`/training/my-sessions/${session.id}/pre-check`}>{session.preCheckResult ? 'Xem kiểm tra trước buổi tập' : 'Bắt đầu kiểm tra trước buổi tập'}</ButtonLink>
      </article>)}
      <p className={styles.muted}>Chỉ ghi lại quan sát. Nếu có gì bất thường, buổi tập vẫn giữ lịch và bị chặn cho đến khi được xem xét.</p>
    </Card><aside className={styles.stack}><Card title="Công việc điều trị"><p>Làm theo hướng dẫn của Veterinarian và chỉ ghi nhận khi hoàn thành.</p><ButtonLink to="/medical/my-tasks">Xem công việc điều trị</ButtonLink></Card><Card title="Sự cố của tôi"><p>Xem trạng thái xử lý các sự cố bạn đã báo.</p><ButtonLink to="/incidents">Xem sự cố</ButtonLink></Card></aside></div>
  </div>;
}

export function PrecheckPage({ api: suppliedApi }: { api?: PrecheckApi }) {
  const auth = useAuth();
  const { id = '' } = useParams();
  const api = useMemo(() => suppliedApi ?? createPrecheckApi({ handleApiError: auth.handleApiError }), [suppliedApi, auth.handleApiError]);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return <GroomShell><EmptyState title="Không tìm thấy buổi tập" /></GroomShell>;
  return <GroomShell><PrecheckContent key={`${auth.user?.id}:${id}`} id={Number(id)} api={api} /></GroomShell>;
}

function PrecheckContent({ id, api }: { id: number; api: PrecheckApi }) {
  const { handleApiError } = useAuth();
  const [session, setSession] = useState<PrecheckSession>();
  const [check, setCheck] = useState<PreSessionCheck>();
  const [draft, setDraft] = useState<Partial<Checklist>>({});
  const checklist = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<unknown>();
  const [actionError, setActionError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [incidentCode, setIncidentCode] = useState('');
  useEffect(() => {
    let active = true;
    api.session(id).then((data) => {
      if (!active) return;
      if (data.id !== id) throw new ApiError(200, 'INVALID_RESPONSE', 'Máy chủ trả về một buổi tập khác.');
      setSession(data); setCheck(data.preSessionCheck ?? undefined);
      setConflict(false); setActionError('');
      if (data.preSessionCheck) setDraft(data.preSessionCheck.checks);
    }).catch((cause: unknown) => { if (active && !handleApiError(cause)) setError(cause); });
    return () => { active = false; };
  }, [id, api, attempt, handleApiError]);
  const reload = () => { setSession(undefined); setError(undefined); setAttempt((value) => value + 1); };
  const abnormal = CHECK_ITEMS.some(({ key }) => draft[key]?.result === 'ABNORMAL');
  const locked = busy || Boolean(check) || conflict || session?.status !== 'SCHEDULED';
  const startGate = check ? 'Tải lại buổi tập để xác nhận các điều kiện bắt đầu còn lại.' : session?.blocked ? session.blockedMessage || session.blockedReasons.map((reason) => viLabel(reason)).join(', ') || 'Bị chặn' : 'Không có điểm chặn';
  async function save() {
    if (pending.current || check || conflict) return;
    if (CHECK_ITEMS.some(({ key }) => !draft[key]?.result)) {
      setActionError('Chọn Bình thường hoặc Bất thường cho cả năm mục kiểm tra.');
      // Focus the first unanswered check (UX Playbook v2.1 §2).
      const unanswered = [...(checklist.current?.querySelectorAll<HTMLElement>('[role="radiogroup"]') ?? [])].find((group) => !group.querySelector('input:checked'));
      unanswered?.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    if (CHECK_ITEMS.some(({ key }) => (draft[key]?.observation?.length ?? 0) > 1000)) { setActionError('Mỗi quan sát tối đa 1000 ký tự.'); return; }
    pending.current = true; setBusy(true); setActionError('');
    try {
      const saved = await api.submit(id, draft as Checklist);
      if (saved.sessionId !== id || !Number.isSafeInteger(saved.id) || saved.id < 1) throw new ApiError(201, 'INVALID_RESPONSE', 'Chưa xác nhận được kết quả kiểm tra. Hãy tải lại trước khi thử lại.');
      setCheck(saved);
      if (saved.overallResult === 'ABNORMAL') setReportOpen(true);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflict(true);
        setActionError(cause instanceof ApiError && cause.status === 409 ? 'Có thể đã có kết quả kiểm tra. Hãy tải lại buổi tập trước khi tiếp tục; các quan sát của bạn vẫn được giữ.' : message(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  function update(key: CheckKey, change: Partial<Checklist[CheckKey]>) {
    setDraft((old) => ({ ...old, [key]: { ...old[key], ...change } }));
  }
  if (error) return <ErrorState title={error instanceof ApiError && error.status === 403 ? 'Không có quyền truy cập' : 'Không tải được kiểm tra trước buổi tập'} description={message(error)} onRetry={reload} />;
  if (!session) return <LoadingState label="Đang tải kiểm tra trước buổi tập…" />;
  // Observations stay in memory only; leaving before the server records the check asks first.
  const dirty = !check && session.status === 'SCHEDULED' && CHECK_ITEMS.some(({ key }) => Boolean(draft[key]?.result || draft[key]?.observation));
  return <div className={styles.stack}>
    <UnsavedChangesGuard dirty={dirty} />
    <ButtonLink to="/groom/today">← Quay lại hôm nay</ButtonLink>
    <div className={styles.header}><div><h1 className={styles.heading}>Kiểm tra trước buổi tập · {session.horse.name}</h1><p className={styles.muted}>{session.horse.horseCode} · {session.sessionCode} · {when(session.scheduledStart)} · Work Rider {session.workRider.fullName}</p></div><StatusBadge family="session" status={session.status} /></div>
    {incidentCode && <AlertBanner type="success" title={`Đã gửi sự cố ${incidentCode}`}>Veterinarian có thể xem xét báo cáo này. Việc kiểm tra không thay đổi khả năng tập luyện.</AlertBanner>}
    <div className={styles.columns}><Card title="Danh mục quan sát"><p className={styles.muted}>Ghi lại những gì bạn quan sát. Chọn Bất thường cho mọi dấu hiệu lạ — bạn không cần xác định nguyên nhân.</p>
      <div ref={checklist}>{CHECK_ITEMS.map(({ key, label, hint }) => <div key={key} className={`${styles.item} ${draft[key]?.result === 'ABNORMAL' ? styles.abnormal : ''}`}><RadioGroup label={label} helperText={hint} value={draft[key]?.result ?? ''} onChange={(result) => update(key, { result: result as 'NORMAL' | 'ABNORMAL' })} options={[{ value: 'NORMAL', label: 'Bình thường' }, { value: 'ABNORMAL', label: 'Bất thường' }]} disabled={locked} className={styles.checkRow} /><TextField label={`Quan sát ${label} (không bắt buộc)`} placeholder="Quan sát" value={draft[key]?.observation ?? ''} maxLength={1000} disabled={locked} onChange={(event) => update(key, { observation: event.target.value })} className={styles.observation} /></div>)}</div>
    </Card><aside className={styles.stack}><Card title="Thông tin sẵn sàng (chỉ xem)"><div className={styles.summary}><KeyValue label="Khả năng tập luyện" value={viLabel(session.trainingAvailability, 'Chưa cung cấp')} /><KeyValue label="Điều kiện bắt đầu" value={startGate} /><KeyValue label="Trainer" value={session.trainer?.fullName ?? 'Chưa cung cấp'} /></div></Card><AlertBanner type="info" title="Chỉ quan sát">Chẩn đoán, tình trạng sức khỏe, khả năng tập luyện và hạn chế do Veterinarian quyết định.</AlertBanner></aside></div>
    {check ? <AlertBanner type={check.overallResult === 'ABNORMAL' ? 'danger' : 'success'} title={check.overallResult === 'ABNORMAL' ? 'BẤT THƯỜNG — không được bắt đầu buổi tập này' : 'TẤT CẢ BÌNH THƯỜNG — đã ghi kiểm tra trước buổi tập'}>Đã kiểm tra {when(check.performedAt)} bởi {check.performedBy.fullName}. {check.overallResult === 'ABNORMAL' ? 'Hãy báo cáo sự cố để bác sĩ thú y xem xét. Sự cố chỉ được tạo khi bạn gửi báo cáo.' : 'Work Rider có thể bắt đầu từ lịch phân công khi các điều kiện còn lại đều đạt.'} Buổi tập vẫn ở trạng thái {viLabel(session.status)}.</AlertBanner> : abnormal ? <AlertBanner type="danger" title="Ngựa này hiện chưa đủ điều kiện tập. Hãy báo cáo sự cố để bác sĩ thú y xem xét.">Ghi kết quả bất thường trước khi báo cáo. Buổi tập vẫn giữ lịch và bị chặn; hệ thống không tự tạo sự cố.</AlertBanner> : <AlertBanner type="info" title="Hoàn tất cả năm mục quan sát">Kiểm tra bình thường sẽ mở điều kiện này; việc này không tự bắt đầu buổi tập.</AlertBanner>}
    {actionError && <AlertBanner type="danger" title="Chưa xác nhận được kết quả kiểm tra">{actionError}</AlertBanner>}
    <div className={styles.actions}><ButtonLink to="/groom/today">Quay lại hôm nay</ButtonLink><div className={styles.actions}>{conflict && <Button variant="secondary" onClick={reload} disabled={busy}>Tải lại buổi tập</Button>}{check?.overallResult === 'ABNORMAL' && !incidentCode ? <Button onClick={() => setReportOpen(true)}>Báo cáo sự cố</Button> : !check && !conflict && session.status === 'SCHEDULED' ? <Button disabled={busy} onClick={save}>{busy ? 'Đang ghi…' : abnormal ? 'Báo cáo sự cố' : 'Hoàn tất kiểm tra trước buổi tập'}</Button> : null}</div></div>
    {reportOpen && check?.overallResult === 'ABNORMAL' && <IncidentReportModal open source={{ kind: 'groom', horseId: session.horse.id, horseLabel: `${session.horse.name} · ${session.horse.horseCode}`, preSessionCheckId: check.id, contextLabel: `Từ kiểm tra trước buổi tập #${check.id} · ${session.sessionCode}` }} onClose={() => setReportOpen(false)} onSubmit={async (body) => { const incident = await api.reportIncident(body); setIncidentCode(incident.incidentCode); setReportOpen(false); }} />}
  </div>;
}
