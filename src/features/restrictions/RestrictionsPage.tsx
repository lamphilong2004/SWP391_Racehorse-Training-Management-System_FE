import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, Card, DataTable, ErrorState, KeyValue, LoadingState, Modal, SelectField, StatusBadge, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { HorseDetail, Page } from '../horses/api/types';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createRestrictionApi, rulePayload, type Availability, type ExerciseRule, type Restriction } from './restrictionApi';
import { ThresholdOverride } from './ThresholdOverride';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';
import { clubDateTime } from '../../shared/clubCalendar';
import { formatDate } from '../horses/shared/format';

function restrictionDate(value?: string) {
  if (!value) return 'Chưa cung cấp';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return 'Chưa cung cấp';
  const [date, time] = clubDateTime(instant).split('T');
  return `${formatDate(date)} · ${time}`;
}

export function RestrictionsPage() {
  const [params, setParams] = useSearchParams(), { user } = useAuth(), request = useFlowRequest();
  const horseId = params.get('horseId'); const canEdit = user?.roles.includes('VETERINARIAN') ?? false;
  const [page, setPage] = useState(0);
  const api = useMemo(() => createRestrictionApi(request), [request]);
  const loadHorses = useCallback((signal: AbortSignal) => request<Page<HorseDetail>>(`/api/horses?page=${page}&size=20`, { signal }), [request, page]);
  const loadRestrictions = useCallback((signal: AbortSignal) => !horseId ? api.list(signal) : Promise.resolve(null), [api, horseId]);
  const horses = useResource(loadHorses);
  const restrictions = useResource(loadRestrictions);
  return <FlowShell title={!horseId ? 'Hạn chế tập luyện' : canEdit ? 'Đặt khả năng tập luyện' : 'Tình trạng hạn chế tập luyện'} description="Khả năng tập luyện và lý do hạn chế" section="Hạn chế tập luyện" role={canEdit ? 'VETERINARIAN' : user?.roles.find((role) => ['HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER'].includes(role)) ?? 'TRAINER'}>
    <SelectField label="Ngựa" value={horseId ?? ''} options={[{ value: '', label: 'Chọn ngựa' }, ...(horses.data?.items.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.horseCode}` })) ?? []), ...(horseId && !horses.data?.items.some((item) => String(item.id) === horseId) ? [{ value: horseId, label: `Ngựa ${horseId}` }] : [])]} onChange={(event) => setParams(event.target.value ? { horseId: event.target.value } : {})} />
    {horses.error && <ErrorState title="Không tải được danh sách chọn ngựa" description={horses.error} onRetry={horses.reload} />}
    {horseId ? <RestrictionContent key={horseId} horseId={horseId} canEdit={canEdit} /> : <><AlertBanner type="info" title={canEdit ? 'Do Veterinarian kiểm soát' : 'Chỉ xem'}>Chỉ Veterinarian đặt khả năng tập luyện. Ngựa bị Khóa không thể bắt đầu chương trình hay buổi tập; ngựa Hạn chế chỉ tập các bài được phép.</AlertBanner>{horses.pending && <LoadingState label="Đang tải khả năng tập luyện của ngựa…" />}{restrictions.error && <ErrorState title="Không tải được lý do hạn chế" description={restrictions.error} onRetry={restrictions.reload} />}{horses.data && <Card title="Khả năng tập luyện"><div className={styles.row}>{(['AVAILABLE', 'LIMITED', 'LOCKED'] as const).map((status) => <span key={status}><StatusBadge family="availability" status={status} /> {horses.data!.items.filter((item) => item.trainingAvailability === status).length}</span>)}<span className="text-caption">Số lượng trên trang này</span></div><div className={styles.table}><DataTable<HorseDetail> caption="Hạn chế của ngựa" rows={horses.data.items} rowKey={(item) => item.id} columns={[
      { key: 'horse', header: 'Ngựa', render: (item) => <Link to={`/medical/restrictions?horseId=${item.id}`}>{item.name}<br />{item.horseCode}</Link> },
      { key: 'health', header: 'Tình trạng sức khỏe', render: (item) => item.healthStatus ? <StatusBadge family="health" status={item.healthStatus} /> : 'Chờ khám ban đầu' },
      { key: 'availability', header: 'Khả năng tập luyện', render: (item) => <StatusBadge family="availability" status={item.trainingAvailability} /> },
      { key: 'reason', header: 'Lý do hạn chế', render: (item) => restrictions.data?.items?.find((entry) => entry.horseId === item.id && !entry.liftedAt)?.reason ?? (item.trainingAvailability === 'AVAILABLE' ? 'Không có hạn chế' : 'Mở ngựa để xem lý do hiện tại') },
      { key: 'effective', header: 'Hiệu lực', render: (item) => restrictionDate(restrictions.data?.items?.find((entry) => entry.horseId === item.id && !entry.liftedAt)?.effectiveAt) },
      { key: 'review', header: 'Xem lại', render: (item) => restrictionDate(restrictions.data?.items?.find((entry) => entry.horseId === item.id && !entry.liftedAt)?.reviewDate) },
    ]} /></div><div className={styles.footer}><Button variant="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {page + 1}</span><Button variant="secondary" disabled={page + 1 >= horses.data.totalPages} onClick={() => setPage(page + 1)}>Sau</Button></div></Card>}</>}
  </FlowShell>;
}
function RestrictionContent({ horseId, canEdit }: { horseId: string; canEdit: boolean }) {
  const request = useFlowRequest(), api = useMemo(() => createRestrictionApi(request), [request]);
  const load = useCallback((signal: AbortSignal) => api.availability(idOf(horseId), signal), [api, horseId]);
  const availability = useResource(load);
  const activeId = availability.data?.activeRestrictionId;
  const loadRecord = useCallback((signal: AbortSignal) => activeId ? api.find(activeId, signal) : Promise.resolve(null), [api, activeId]);
  const record = useResource(loadRecord);
  const [notice, setNotice] = useState('');
  return <div className={styles.stack}>{availability.pending && <LoadingState label="Đang tải khả năng tập luyện…" />}{availability.error && <ErrorState title="Không tải được khả năng tập luyện" description={availability.error} onRetry={availability.reload} />}
    {notice && <AlertBanner feedback type="success" title={notice} />}
    {availability.data && <>{!canEdit && <AlertBanner type="info" title="Chỉ xem">Khả năng tập luyện và hạn chế do Veterinarian đặt. Bạn được xem nhưng không được thay đổi.</AlertBanner>}
      {record.error && <ErrorState title="Không tải được chi tiết hạn chế" description={record.error} onRetry={record.reload} />}
      {canEdit && <ThresholdOverride horseId={idOf(horseId)} />}
      <div className={canEdit ? styles.stack : styles.fields}><Card title={canEdit ? 'Khả năng tập luyện — do Veterinarian kiểm soát' : 'Hạn chế hiện tại'}><div className={styles.stack}><div className={styles.row}>Hiện tại: <StatusBadge family="availability" status={availability.data.availability} /></div><KeyValue label="Lý do · hiển thị cho Head Trainer và Trainer" value={availability.data.reason ?? (availability.data.availability === 'AVAILABLE' ? 'Không có hạn chế y tế' : 'Không có lý do')} /><div className={styles.fields}><KeyValue label="Hiệu lực" value={restrictionDate(record.data?.effectiveAt)} /><KeyValue label="Lần xem xét tiếp theo" value={restrictionDate(record.data?.reviewDate)} /></div>
        <div className={styles.fields}>{(['ALLOWED', 'PROHIBITED'] as const).map((kind) => <AlertBanner key={kind} type={kind === 'ALLOWED' ? 'success' : 'danger'} title={kind === 'ALLOWED' ? 'Được phép' : 'Bị cấm'}>{availability.data!.exerciseRules?.filter((item) => item.ruleType === kind).map((item, index) => <p key={index}>{item.exerciseTypeNote ?? `Bài tập ${item.exerciseId}`}</p>)}{!availability.data!.exerciseRules?.some((item) => item.ruleType === kind) && <p>Chưa có quy tắc.</p>}</AlertBanner>)}</div>
        {canEdit && !record.pending && <RestrictionEditor key={`${activeId ?? 'new'}:${record.data?.id ?? ''}`} current={availability.data} record={record.data ?? undefined} onSaved={(message) => { setNotice(message); availability.reload(); record.reload(); }} />}
      </div></Card><Card title={canEdit ? 'Ảnh hưởng đến huấn luyện' : 'Hướng dẫn cho Trainer'}><div className={styles.stack}><p>Xóa bài tập bị cấm hoặc thay bằng bài được phép, rồi kiểm tra lại.</p><p>Trainer không thể bỏ qua hạn chế của Veterinarian.</p><p>Khóa sẽ chặn lên lịch và bắt đầu buổi tập. Hạn chế được đối chiếu với các quy tắc Được phép và Bị cấm của hệ thống.</p><p>Ngày xem xét chỉ là nhắc nhở, không tự gỡ hạn chế.</p><ButtonLink to="/training/calendar">Xem ảnh hưởng đến huấn luyện →</ButtonLink></div></Card></div>
    </>}
  </div>;
}
function RestrictionEditor({ current, record, onSaved }: { current: Availability; record?: Restriction; onSaved: (message: string) => void }) {
  const request = useFlowRequest(), api = useMemo(() => createRestrictionApi(request), [request]);
  const [level, setLevel] = useState(current.availability), [reason, setReason] = useState(current.reason ?? '');
  const [effectiveAt, setEffectiveAt] = useState(''), [reviewDate, setReviewDate] = useState('');
  const rulesKnown = current.exerciseRules !== undefined || record?.exerciseRules !== undefined || !current.activeRestrictionId;
  const [rules, setRules] = useState<ExerciseRule[]>(current.exerciseRules ?? record?.exerciseRules ?? []), [created, setCreated] = useState<Restriction>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [liftOpen, setLiftOpen] = useState(false), [liftError, setLiftError] = useState('');
  const pending = useRef(false);
  const activeId = created?.id ?? current.activeRestrictionId;
  async function lift() {
    if (!activeId || pending.current) return;
    pending.current = true; setBusy(true); setLiftError('');
    try {
      await api.lift(activeId);
      setLiftOpen(false);
      onSaved('Đã gỡ hạn chế tập luyện');
    } catch (cause) { setLiftError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function save() {
    if (pending.current || level === 'AVAILABLE') return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (level === 'LIMITED' && !rulesKnown) throw new Error('Chưa có quy tắc bài tập. Hãy tải lại chi tiết hạn chế trước khi thay thế.');
      const checked = rulePayload(rules);
      let restrictionId = activeId;
      if (restrictionId && level !== (created?.level ?? current.availability)) throw new Error('Hãy gỡ hạn chế hiện tại trước khi tạo mức khác. Mỗi ngựa chỉ có một hạn chế đang áp dụng.');
      if (!restrictionId) {
        if (!reason.trim()) throw new Error('Hãy nhập lý do.');
        const effective = new Date(effectiveAt);
        if (!Number.isFinite(effective.getTime()) || effective.getTime() > Date.now()) throw new Error('Thời điểm hiệu lực phải hợp lệ và không muộn hơn hiện tại.');
        const result = await api.create(current.horseId, { level, reason, effectiveAt: effective.toISOString(), reviewDate: reviewDate || undefined });
        if (!result?.id || result.horseId !== current.horseId) throw new Error('Máy chủ chưa xác nhận hạn chế. Hãy tải lại trước khi thử lại.');
        restrictionId = result.id; setCreated(result);
      }
      try { if (level === 'LIMITED') await api.rules(restrictionId, checked.rules); }
      catch (cause) { throw new Error(`Đã có hạn chế ${restrictionId} nhưng chưa xác nhận được quy tắc bài tập. Hãy lưu lại quy tắc hoặc tải lại. ${errorMessage(cause)}`, { cause }); }
      onSaved('Đã lưu khả năng tập luyện và quy tắc bài tập');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <><form onSubmit={(event) => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className={`${styles.fieldset} ${styles.stack}`}>
    {!activeId && <SelectField label="Khả năng tập luyện" placeholder="Chọn mức hạn chế" value={level === 'AVAILABLE' ? '' : level} options={['LIMITED', 'LOCKED'].map((value) => ({ value, label: viLabel(value) }))} onChange={(event) => setLevel(event.target.value ? event.target.value as typeof level : 'AVAILABLE')} />}
    {error && <AlertBanner feedback type="danger" title="Chưa lưu đầy đủ thay đổi">{error}</AlertBanner>}
    {activeId && <div className={styles.row}><Button type="button" variant="secondary" onClick={() => { setLiftError(''); setLiftOpen(true); }}>Gỡ hạn chế</Button></div>}
    {level === 'LIMITED' && !rulesKnown && <AlertBanner type="warning" title="Không tải được quy tắc bài tập">Hãy tải lại chi tiết hạn chế trước khi thay quy tắc. Quy tắc hiện tại vẫn được giữ.</AlertBanner>}
    {level !== 'AVAILABLE' && <>{!activeId && <><TextAreaField label="Lý do" required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} helperText="Nội dung hiển thị cho Trainer; không ghi đơn thuốc hay chẩn đoán." /><div className={styles.fields}><TextField label="Thời điểm hiệu lực" type="datetime-local" required value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} /><TextField label="Lần khám tiếp theo" type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} /></div></>}
      {level === 'LIMITED' && <><h3 className="text-h3">Quy tắc bài tập</h3>{rules.map((item, index) => <div className={styles.row} key={index}><SelectField label="Quy tắc" value={item.ruleType} options={[{ value: 'ALLOWED', label: 'Được phép' }, { value: 'PROHIBITED', label: 'Bị cấm' }]} onChange={(event) => setRules(rules.map((value, i) => i === index ? { ...value, ruleType: event.target.value as ExerciseRule['ruleType'] } : value))} /><TextField label={item.exerciseId ? 'Mã bài tập' : 'Ghi chú loại bài tập'} maxLength={200} readOnly={!!item.exerciseId} value={item.exerciseId ?? item.exerciseTypeNote ?? ''} onChange={(event) => setRules(rules.map((value, i) => i === index ? { ruleType: value.ruleType, exerciseTypeNote: event.target.value } : value))} /><Button type="button" variant="tertiary" onClick={() => setRules(rules.filter((_, i) => i !== index))}>Xóa quy tắc</Button></div>)}<Button type="button" variant="secondary" onClick={() => setRules([...rules, { ruleType: 'PROHIBITED', exerciseTypeNote: '' }])}>Thêm quy tắc bài tập</Button></>}
    </>}
    <div className={styles.row}><ButtonLink variant="secondary" to={`/horses/${current.horseId}`}>Hủy</ButtonLink>{(!activeId || level === 'LIMITED') && <Button type="submit" disabled={level === 'AVAILABLE' || (level === 'LIMITED' && !rulesKnown)}>{busy ? 'Đang lưu…' : activeId ? 'Lưu quy tắc bài tập' : 'Lưu khả năng tập luyện'}</Button>}</div>
  </fieldset></form>
  {liftOpen && <Modal open title="Gỡ hạn chế tập luyện?" dismissible={!busy} onClose={() => { if (!pending.current) setLiftOpen(false); }} footer={<><Button variant="secondary" disabled={busy} onClick={() => setLiftOpen(false)}>Quay lại</Button><Button disabled={busy} onClick={() => void lift()}>{busy ? 'Đang gỡ…' : 'Xác nhận gỡ hạn chế'}</Button></>}>
    <p>Tình trạng sức khỏe vẫn giữ nguyên. Ngựa đang Chấn thương hoặc Cách ly vẫn bị chặn lập giáo án và buổi tập cho đến khi Veterinarian tái khám và ghi nhận Khỏe.</p>
    {liftError && <AlertBanner type="danger" title="Chưa gỡ được hạn chế">{liftError}</AlertBanner>}
  </Modal>}</>;
}
