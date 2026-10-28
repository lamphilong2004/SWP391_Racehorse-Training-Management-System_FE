import { useCallback, useRef, useState, type FormEvent } from 'react';
import { AlertBanner, Button, Card, ErrorState, LoadingState, Modal, SelectField, TextAreaField, TextField } from '../../design-system';
import { errorMessage } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import type { Intensity } from '../program-creation/programTypes';
import { blocksSession, type createSessionApi, type SessionExerciseInput, type TrainingSession } from './sessionApi';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';
import { clubDate, clubDateTime, parseClubDateTime, sessionPeriodError } from '../../shared/clubCalendar';

const INTENSITIES: Intensity[] = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'];
const local = (iso: string) => clubDateTime(new Date(iso));
type Api = ReturnType<typeof createSessionApi>;

/**
 * DEC-005 session-level adaptation of a SCHEDULED session by its Trainer: schedule/details via
 * PATCH /api/training-sessions/{id} and the exercise plan via PUT …/exercises. The server re-checks
 * phase dates, intensity range, rider conflicts and medical restrictions on every save.
 */
export function EditSession({ api, session, onClose, onSaved }: { api: Api; session: TrainingSession; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), pending = useRef(false);
  const run = async (action: () => Promise<unknown>, fail: (message: string) => void) => {
    if (pending.current) return; pending.current = true; setBusy(true);
    try { await action(); onSaved(); } catch (cause) { fail(errorMessage(cause)); } finally { pending.current = false; setBusy(false); }
  };
  return <Modal open size="lg" title={`Sửa buổi tập ${session.sessionCode}`} dismissible={!busy} onClose={onClose} footer={<Button variant="secondary" disabled={busy} onClick={onClose}>Đóng</Button>}>
    <div className={styles.stack}>
      <p className={styles.muted}>Chỉ sửa được buổi tập đã lên lịch. Chiến lược chương trình và mẫu gốc không bị thay đổi.</p>
      <DetailsForm session={session} busy={busy} save={(body, fail) => run(() => api.update(session.id, body), fail)} />
      <ExercisesForm api={api} session={session} busy={busy} save={(exercises, fail) => run(async () => {
        const check = await api.suitability({ horseProgramPhaseId: session.horseProgramPhaseId, scheduledStart: session.scheduledStart, scheduledEnd: session.scheduledEnd,
          intensity: (session.intensity as Intensity | null) ?? undefined, workRiderUserId: session.workRider?.id, exercises });
        const blocks = blocksSession(check, exercises);
        if (blocks.length) throw new Error(blocks.join(' '));
        return api.replaceExercises(session.id, exercises);
      }, fail)} />
    </div>
  </Modal>;
}

function DetailsForm({ session, busy, save }: { session: TrainingSession; busy: boolean; save: (body: Parameters<Api['update']>[1], fail: (message: string) => void) => Promise<void> }) {
  const minutes = session.scheduledEnd ? Math.round((Date.parse(session.scheduledEnd) - Date.parse(session.scheduledStart)) / 60000) : null;
  const [when, setWhen] = useState(local(session.scheduledStart)), [duration, setDuration] = useState(minutes && minutes > 0 ? String(minutes) : '');
  const [surface, setSurface] = useState(session.surface ?? ''), [focus, setFocus] = useState(session.focus ?? ''), [intensity, setIntensity] = useState(session.intensity ?? '');
  const [error, setError] = useState('');
  const [date = '', time = ''] = when.split('T');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const start = parseClubDateTime(when);
    if (!start) { setError('Chọn ngày và giờ bắt đầu buổi tập.'); return; }
    if (duration && (!Number.isFinite(Number(duration)) || Number(duration) <= 0)) { setError('Thời lượng dự kiến phải lớn hơn 0.'); return; }
    const periodError = sessionPeriodError(start);
    if (periodError) { setError(periodError); return; }
    await save({ scheduledStart: start.toISOString(), scheduledEnd: duration ? new Date(start.getTime() + Number(duration) * 60000).toISOString() : undefined,
      surface: surface.trim() || undefined, focus: focus.trim() || undefined, intensity: (intensity || undefined) as Intensity | undefined }, setError);
  }
  return <Card title="Lịch & thông tin"><form className={styles.stack} onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}><fieldset disabled={busy} className={styles.fieldset}><div className={styles.stack}>
    <div className={styles.fields}>
      <TextField label="Ngày" type="date" required min={clubDate()} value={date} onChange={(event) => setWhen(`${event.target.value}T${time}`)} />
      <TextField label="Giờ bắt đầu" type="time" required helperText="Giờ Việt Nam. Chọn thời điểm ở tương lai." value={time} onChange={(event) => setWhen(`${date}T${event.target.value}`)} />
      <TextField label="Thời lượng dự kiến (phút)" type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} />
      <SelectField label="Cường độ buổi tập" value={intensity} options={[{ value: '', label: 'Giữ nguyên' }, ...INTENSITIES.map((value) => ({ value, label: viLabel(value) }))]} onChange={(event) => setIntensity(event.target.value)} />
      <TextField label="Mặt sân tập" maxLength={50} value={surface} onChange={(event) => setSurface(event.target.value)} />
      <TextField label="Trọng tâm buổi tập" maxLength={200} value={focus} onChange={(event) => setFocus(event.target.value)} />
    </div>
    {error && <AlertBanner type="danger" title="Chưa lưu được thông tin">{error}</AlertBanner>}
    <div className={styles.row}><Button type="submit">{busy ? 'Đang lưu…' : 'Lưu thông tin'}</Button><span className="text-caption">Giữ nguyên Work Rider; hệ thống sẽ từ chối nếu trùng lịch.</span></div>
  </div></fieldset></form></Card>;
}

function ExercisesForm({ api, session, busy, save }: { api: Api; session: TrainingSession; busy: boolean; save: (exercises: SessionExerciseInput[], fail: (message: string) => void) => Promise<void> }) {
  const load = useCallback((signal: AbortSignal) => api.exercises(signal), [api]), catalog = useResource(load);
  const [items, setItems] = useState<SessionExerciseInput[]>(() => [...(session.exercises ?? [])].sort((a, b) => a.exerciseOrder - b.exerciseOrder).map((item, index) => ({
    exerciseDefinitionId: item.exerciseDefinitionId, exerciseOrder: index + 1, distanceM: item.distanceM ?? null, durationMin: item.durationMin ?? null, repetitions: item.repetitions ?? null,
    restIntervalMin: item.restIntervalMin ?? null, intensity: (item.intensity as Intensity | null) ?? null, surface: item.surface ?? null, acknowledgementNote: null })));
  const [error, setError] = useState('');
  const patch = (index: number, value: Partial<SessionExerciseInput>) => { setError(''); setItems(items.map((item, at) => at === index ? { ...item, ...value } : item)); };
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!items.length) { setError('Cần giữ ít nhất một bài tập.'); return; }
    if (items.some((item) => [item.distanceM, item.durationMin, item.repetitions, item.restIntervalMin].some((n) => n != null && (!Number.isFinite(n) || n < 0)) || (item.repetitions != null && !Number.isInteger(item.repetitions)))) { setError('Giá trị bài tập không được âm; số lần lặp phải là số nguyên.'); return; }
    await save(items.map((item, index) => ({ ...item, exerciseOrder: index + 1 })), setError);
  }
  const name = (id: number) => catalog.data?.find((exercise) => exercise.id === id)?.name ?? session.exercises?.find((item) => item.exerciseDefinitionId === id)?.exerciseName ?? `Bài tập ${id}`;
  return <Card title="Kế hoạch bài tập"><form className={styles.stack} onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}><fieldset disabled={busy} className={styles.fieldset}><div className={styles.stack}>
    {catalog.pending && <LoadingState label="Đang tải bài tập…" />}{catalog.error && <ErrorState title="Không tải được thư viện bài tập" description={catalog.error} onRetry={catalog.reload} />}
    <SelectField label="Thêm bài tập" value="" options={[{ value: '', label: 'Chọn bài tập từ thư viện' }, ...(catalog.data?.map((item) => ({ value: String(item.id), label: item.name })) ?? [])]}
      onChange={(event) => { if (event.target.value) setItems([...items, { exerciseDefinitionId: Number(event.target.value), exerciseOrder: items.length + 1 }]); }} />
    {items.map((item, index) => <Card key={`${index}-${item.exerciseDefinitionId}`} title={`${index + 1}. ${name(item.exerciseDefinitionId)}`}
      action={<Button type="button" variant="tertiary" aria-label={`Xóa ${name(item.exerciseDefinitionId)}`} onClick={() => setItems(items.filter((_, at) => at !== index))}>Xóa</Button>}><div className={styles.stack}><div className={styles.fields}>
      {(['distanceM', 'durationMin', 'repetitions', 'restIntervalMin'] as const).map((key) => <TextField key={key} label={{ distanceM: 'Quãng đường (m)', durationMin: 'Thời lượng (phút)', repetitions: 'Số lần lặp', restIntervalMin: 'Thời gian nghỉ (phút)' }[key]} type="number" min="0" step={key === 'repetitions' ? '1' : 'any'} value={item[key] ?? ''} onChange={(event) => patch(index, { [key]: event.target.value === '' ? null : Number(event.target.value) })} />)}
      <SelectField label="Cường độ" value={item.intensity ?? ''} options={[{ value: '', label: 'Chưa xác định' }, ...INTENSITIES.map((value) => ({ value, label: viLabel(value) }))]} onChange={(event) => patch(index, { intensity: (event.target.value || null) as Intensity | null })} />
      <TextField label="Mặt sân" maxLength={50} value={item.surface ?? ''} onChange={(event) => patch(index, { surface: event.target.value })} /></div>
      <TextAreaField label="Xác nhận / lý do giữ lại" maxLength={1000} value={item.acknowledgementNote ?? ''} onChange={(event) => patch(index, { acknowledgementNote: event.target.value })} helperText="Bắt buộc với loại C hoặc D. Không thể bỏ qua chặn bắt buộc do y tế." /></div></Card>)}
    {error && <AlertBanner type="danger" title="Chưa lưu được bài tập">{error}</AlertBanner>}
    <div className={styles.row}><Button type="submit">{busy ? 'Đang kiểm tra…' : 'Kiểm tra & lưu bài tập'}</Button><span className="text-caption">Mức phù hợp được kiểm tra trước khi lưu và kiểm tra lại trên máy chủ.</span></div>
  </div></fieldset></form></Card>;
}
