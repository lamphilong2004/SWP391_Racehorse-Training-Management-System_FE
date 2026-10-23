import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, CandidateCard, Card, Checkbox, EmptyState, ErrorState, KeyValue, LoadingState, SelectField, StatusBadge, TextAreaField, TextField, WizardStepper } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { CandidateList, Intensity } from '../program-creation/programTypes';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { blocksSession, createSessionApi, type CreateSessionInput, type SessionDraft, type SessionExerciseInput, type Suitability } from './sessionApi';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';

const INTENSITIES: Intensity[] = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'];
const STEPS = ['Thông tin buổi tập', 'Bài tập', 'Work Rider', 'Xem lại'];
export function CreateSessionPage() {
  const [params] = useSearchParams(), navigate = useNavigate(), { user } = useAuth();
  const request = useFlowRequest(), api = useMemo(() => createSessionApi(request), [request]);
  const [programId, setProgramId] = useState(params.get('programId') ?? ''), [phaseId, setPhaseId] = useState('');
  const [when, setWhen] = useState(''), [duration, setDuration] = useState(''), [surface, setSurface] = useState(''), [focus, setFocus] = useState('');
  const [date = '', time = ''] = when.split('T');
  const [intensity, setIntensity] = useState<Intensity | ''>(''), [exercises, setExercises] = useState<SessionExerciseInput[]>([]);
  const [riderId, setRiderId] = useState(0), [acknowledged, setAcknowledged] = useState(false), [step, setStep] = useState(0);
  const [check, setCheck] = useState<Suitability>(), [riders, setRiders] = useState<CandidateList>();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false); const pending = useRef(false);
  const loadPrograms = useCallback((signal: AbortSignal) => api.programs(signal), [api]);
  const loadProgram = useCallback((signal: AbortSignal) => programId ? api.program(Number(programId), signal) : Promise.resolve(null), [api, programId]);
  const loadExercises = useCallback((signal: AbortSignal) => api.exercises(signal), [api]);
  const programs = useResource(loadPrograms), program = useResource(loadProgram), catalog = useResource(loadExercises);
  const loadAvailability = useCallback((signal: AbortSignal) => program.data ? api.availability(program.data.horse.id, signal) : Promise.resolve(null), [api, program.data]);
  const availability = useResource(loadAvailability);
  const phase = program.data?.phases.find((item) => item.id === Number(phaseId));
  const rider = riders?.candidates.find((item) => item.user.id === riderId);
  const resetValidation = () => { setCheck(undefined); setRiders(undefined); setRiderId(0); setAcknowledged(false); setError(''); };
  const patchExercise = (index: number, patch: Partial<SessionExerciseInput>) => { resetValidation(); setExercises(exercises.map((item, i) => i === index ? { ...item, ...patch } : item)); };
  function draft(): SessionDraft {
    const start = new Date(when); if (!Number.isFinite(start.getTime())) throw new Error('Chọn ngày và giờ bắt đầu buổi tập.');
    if (!phase || !program.data || program.data.status !== 'ACTIVE') throw new Error('Chọn một chương trình đang hoạt động được giao và một giai đoạn.');
    const localDate = when.slice(0, 10);
    if (localDate < phase.startDate || localDate > phase.endDate) throw new Error('Lên lịch buổi tập trong thời gian của giai đoạn đã duyệt.');
    if (duration && (!Number.isFinite(Number(duration)) || Number(duration) <= 0)) throw new Error('Thời lượng dự kiến phải lớn hơn 0.');
    if (intensity && ((phase.intensityMin && INTENSITIES.indexOf(intensity) < INTENSITIES.indexOf(phase.intensityMin)) || (phase.intensityMax && INTENSITIES.indexOf(intensity) > INTENSITIES.indexOf(phase.intensityMax)))) throw new Error('Chọn cường độ trong khoảng của giai đoạn đã duyệt.');
    return { horseProgramPhaseId: phase.id, scheduledStart: start.toISOString(), scheduledEnd: duration ? new Date(start.getTime() + Number(duration) * 60000).toISOString() : undefined,
      intensity: intensity || undefined, exercises, workRiderUserId: riderId || undefined };
  }
  async function advance() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const value = draft();
      if (step === 0) { if (availability.data?.availability === 'LOCKED') throw new Error(availability.data.reason || 'Ngựa này đang bị khóa tập luyện.'); setStep(1); return; }
      if (!exercises.length) throw new Error('Chọn ít nhất một bài tập.');
      if (exercises.some((item) => [item.distanceM, item.durationMin, item.repetitions, item.restIntervalMin].some((n) => n != null && (!Number.isFinite(n) || n < 0)) || (item.repetitions != null && !Number.isInteger(item.repetitions)))) throw new Error('Giá trị bài tập không được âm; số lần lặp phải là số nguyên.');
      const result = await api.suitability(value); setCheck(result);
      const blocks = blocksSession(result, exercises); if (blocks.length) throw new Error(blocks.join(' '));
      if (step === 1) { setRiders(await api.riders(value)); setStep(2); return; }
      if (!rider || rider.hardBlock) throw new Error('Chọn một Work Rider đủ điều kiện.');
      if (rider.warnings.length && !acknowledged) throw new Error('Hãy xác nhận các cảnh báo về người cưỡi đã chọn.');
      if (step === 2) { setStep(3); return; }
      const payload: CreateSessionInput = { ...value, workRiderUserId: riderId, riderWarningAcknowledged: acknowledged, surface: surface || undefined, focus: focus || undefined };
      const saved = await api.create(payload);
      if (!saved?.id) throw new Error('Máy chủ chưa xác nhận đã lên lịch buổi tập.');
      navigate(`/training/session/${saved.id}`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <FlowShell title="Tạo buổi tập" description={`Bước ${step + 1}/4 · ${STEPS[step]}`} section="Lịch tập" role="TRAINER" actions={<ButtonLink to="/training/calendar">Hủy</ButtonLink>}>
    <WizardStepper steps={STEPS} currentStep={step} onStepClick={(value) => { if (!busy) setStep(value); }} />
    {program.data && <Card><div className={styles.row}><strong>{program.data.horse.name}</strong><span>{program.data.horse.horseCode} · {program.data.name} · {phase?.name ?? 'Chọn giai đoạn'}</span>{availability.data && <StatusBadge family="availability" status={availability.data.availability} />}</div></Card>}
    {error && <AlertBanner type="danger" title="Chưa lên lịch được buổi tập">{error}</AlertBanner>}
    <form onSubmit={(event) => { event.preventDefault(); void advance(); }}><fieldset disabled={busy} className={styles.fieldset}>
      {step === 0 && <div className={styles.columns}><Card title="Thông tin buổi tập"><div className={styles.stack}>
        {programs.error && <ErrorState title="Không tải được chương trình được giao" description={programs.error} onRetry={programs.reload} />}{program.pending && programId && <LoadingState label="Đang tải chương trình…" />}{program.error && <ErrorState title="Không tải được chương trình" description={program.error} onRetry={program.reload} />}
        <div className={styles.sessionFields}><SelectField label="Chương trình" required value={programId} options={[{ value: '', label: 'Chọn chương trình được giao' }, ...(programs.data?.items.filter((item) => item.status === 'ACTIVE').map((item) => ({ value: String(item.id), label: `${item.horse.name} · ${item.name}` })) ?? [])]} onChange={(event) => { setProgramId(event.target.value); setPhaseId(''); setExercises([]); resetValidation(); }} />
          <SelectField label="Giai đoạn" required value={phaseId} options={[{ value: '', label: 'Chọn giai đoạn' }, ...(program.data?.phases.map((item) => ({ value: String(item.id), label: item.name })) ?? [])]} onChange={(event) => { setPhaseId(event.target.value); resetValidation(); }} />
          <TextField label="Ngựa · kế thừa" value={program.data?.horse.name ?? ''} readOnly /><TextField label="Ngày" type="date" required value={date} onChange={(event) => { setWhen(`${event.target.value}T${time}`); resetValidation(); }} /><TextField label="Giờ bắt đầu" type="time" required value={time} onChange={(event) => { setWhen(`${date}T${event.target.value}`); resetValidation(); }} />
          <TextField label="Thời lượng dự kiến (phút)" type="number" min="1" value={duration} onChange={(event) => { setDuration(event.target.value); resetValidation(); }} /><TextField label="Mặt sân tập" maxLength={50} value={surface} onChange={(event) => setSurface(event.target.value)} />
          <TextField label="Trọng tâm buổi tập" maxLength={200} value={focus} onChange={(event) => setFocus(event.target.value)} /><TextField label="Trainer · kế thừa" readOnly value={user?.fullName ?? ''} />
          <SelectField label="Cường độ buổi tập" value={intensity} options={[{ value: '', label: 'Chưa xác định' }, ...INTENSITIES.map((value) => ({ value, label: viLabel(value) }))]} onChange={(event) => { setIntensity(event.target.value as Intensity); resetValidation(); }} /></div>
        <p className="text-caption">Chương trình, ngựa và Trainer lấy từ chương trình huấn luyện được giao. Thay đổi buổi tập không làm thay đổi chiến lược chương trình hay mẫu gốc.</p>
      </div></Card><div className={styles.stack}><Card title="Khả năng tập luyện">{availability.error && <ErrorState title="Không tải được khả năng tập luyện" description={availability.error} onRetry={availability.reload} />}{availability.pending && program.data && <LoadingState label="Đang tải khả năng tập luyện…" />}{availability.data && <><StatusBadge family="availability" status={availability.data.availability} /><p>{availability.data.reason ?? 'Do Veterinarian đặt. Bài tập được kiểm tra ở Bước 2.'}</p></>}</Card><Card title="Thông tin giai đoạn"><div className={styles.stack}><KeyValue label="Mục tiêu giai đoạn" value={phase?.objective ?? 'Chưa cung cấp'} /><KeyValue label="Khối lượng giai đoạn" value={phase?.workload ?? 'Chưa cung cấp'} /><KeyValue label="Cường độ cho phép" value={`${viLabel(phase?.intensityMin)} → ${viLabel(phase?.intensityMax)}`} /><KeyValue label="Thời gian giai đoạn" value={phase ? `${phase.startDate} → ${phase.endDate}` : 'Chọn giai đoạn'} /></div></Card></div></div>}
      {step === 1 && <div className={styles.columns}><Card title="Bài tập của buổi"><div className={styles.stack}>{catalog.pending && <LoadingState label="Đang tải bài tập…" />}{catalog.error && <ErrorState title="Không tải được thư viện bài tập" description={catalog.error} onRetry={catalog.reload} />}<SelectField label="Thêm bài tập" value="" options={[{ value: '', label: 'Chọn bài tập từ thư viện' }, ...(catalog.data?.map((item) => ({ value: String(item.id), label: item.name })) ?? [])]} onChange={(event) => { if (event.target.value) { resetValidation(); setExercises([...exercises, { exerciseDefinitionId: Number(event.target.value), exerciseOrder: exercises.length + 1 }]); } }} />
        {exercises.map((item, index) => { const outcome = check?.exercises.find((result) => result.exerciseOrder === index + 1); return <Card key={`${index}-${item.exerciseDefinitionId}`} title={`${index + 1}. ${catalog.data?.find((exercise) => exercise.id === item.exerciseDefinitionId)?.name ?? 'Bài tập'}`} action={<Button type="button" variant="tertiary" onClick={() => { resetValidation(); setExercises(exercises.filter((_, i) => i !== index).map((value, i) => ({ ...value, exerciseOrder: i + 1 }))); }}>Xóa</Button>}><div className={styles.stack}><div className={styles.fields}>{(['distanceM', 'durationMin', 'repetitions', 'restIntervalMin'] as const).map((key) => <TextField key={key} label={{ distanceM: 'Quãng đường (m)', durationMin: 'Thời lượng (phút)', repetitions: 'Số lần lặp', restIntervalMin: 'Thời gian nghỉ (phút)' }[key]} type="number" min="0" step={key === 'repetitions' ? '1' : 'any'} value={item[key] ?? ''} onChange={(event) => patchExercise(index, { [key]: event.target.value === '' ? null : Number(event.target.value) })} />)}<SelectField label="Cường độ" value={item.intensity ?? ''} options={[{ value: '', label: 'Chưa xác định' }, ...INTENSITIES.map((value) => ({ value, label: viLabel(value) }))]} onChange={(event) => patchExercise(index, { intensity: (event.target.value || null) as Intensity | null })} /><TextField label="Mặt sân" maxLength={50} value={item.surface ?? ''} onChange={(event) => patchExercise(index, { surface: event.target.value })} /></div>{outcome && <AlertBanner type={outcome.category === 'A' || outcome.category === 'B' ? 'danger' : outcome.category ? 'warning' : 'success'} title={outcome.category ? `Loại ${outcome.category}` : 'Phù hợp'}>{outcome.messages.join(' ')}</AlertBanner>}<TextAreaField label="Xác nhận / lý do giữ lại" maxLength={1000} value={item.acknowledgementNote ?? ''} onChange={(event) => patchExercise(index, { acknowledgementNote: event.target.value })} helperText="Bắt buộc với loại C hoặc D. Không thể bỏ qua chặn bắt buộc do y tế." /></div></Card>; })}
      </div></Card><Card title="Các loại kiểm tra"><div className={styles.stack}><p>Phù hợp — tiếp tục bình thường.</p><p>Thận trọng — xác nhận và nêu lý do khi được yêu cầu.</p><p>Không khuyến nghị — chỉ giữ lại khi có lý do.</p><p>Chặn bắt buộc do y tế — phải xóa hoặc thay. Trùng lịch sẽ chặn việc chọn người cưỡi.</p><p className="text-caption">Hệ thống kiểm tra mức phù hợp trước khi bạn tiếp tục và khi lưu.</p></div></Card></div>}
      {step === 2 && <Card title="Chọn Work Rider"><div className={styles.factGrid}>{riders?.candidates.map((candidate) => <CandidateCard key={candidate.user.id} name={candidate.user.fullName} subtitle={candidate.experienceLevel ?? candidate.label.replaceAll('_', ' ')} tags={candidate.skills ?? []} facts={[...candidate.reasons.map((value) => ({ label: 'Mức phù hợp', value })), ...candidate.warnings.map((value) => ({ label: 'Cảnh báo', value })), ...(candidate.hardBlock ? [{ label: 'Chặn bắt buộc', value: candidate.hardBlock }] : [])]} actions={<Button type="button" disabled={!!candidate.hardBlock} variant={riderId === candidate.user.id ? 'primary' : 'secondary'} aria-pressed={riderId === candidate.user.id} aria-label={`${riderId === candidate.user.id ? 'Đã chọn' : 'Chọn'} ${candidate.user.fullName}`} onClick={() => { setRiderId(candidate.user.id); setAcknowledged(false); }}>{riderId === candidate.user.id ? 'Đã chọn' : 'Chọn người cưỡi'}</Button>} />)}</div>{!riders?.candidates.length && <EmptyState title="Không có người cưỡi đủ điều kiện" description={riders?.emptyReason ?? 'Hãy đổi lịch hoặc thử lại khi có gợi ý người cưỡi.'} />}{rider && rider.warnings.length > 0 && <Checkbox label="Tôi đã đọc các cảnh báo về người cưỡi này" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />}</Card>}
      {step === 3 && <div className={styles.columns}><Card title="Xem lại buổi tập"><div className={styles.stack}><KeyValue label="Buổi tập" value={`${program.data?.horse.name} · ${program.data?.name} · ${phase?.name}`} /><KeyValue label="Giờ bắt đầu dự kiến" value={when} /><KeyValue label="Thời lượng dự kiến" value={duration ? `${duration} phút` : 'Chưa xác định'} /><KeyValue label="Work Rider" value={rider?.user.fullName ?? 'Chưa chọn'} /><KeyValue label="Cường độ / mặt sân / trọng tâm" value={[intensity, surface, focus].filter(Boolean).join(' · ') || 'Chưa xác định'} /><KeyValue label="Bài tập" value={exercises.map((item) => catalog.data?.find((exercise) => exercise.id === item.exerciseDefinitionId)?.name ?? `Bài tập ${item.exerciseDefinitionId}`).join(', ')} /><AlertBanner type="info" title="Chương trình không bị thay đổi">Lên lịch buổi tập không thay đổi chiến lược chương trình huấn luyện hay mẫu gốc.</AlertBanner></div></Card><div className={styles.stack}><Card title="Y tế & khả năng tập luyện">{check && <StatusBadge family="availability" status={check.trainingAvailability} />}<p>Khả năng tập luyện được kiểm tra lại trước khi buổi tập bắt đầu.</p></Card><Card title="Khi Lưu & thông báo"><StatusBadge family="session" status="SCHEDULED" /><p>Hệ thống tạo buổi tập và thông báo cho Work Rider được phân công. Chưa có gì được lên lịch trước khi lưu.</p></Card></div></div>}
      <div className={styles.footer}><Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Quay lại</Button><span className="text-caption">Chưa có gì được lên lịch cho đến khi bấm Lưu & thông báo ở Bước 4.</span><Button type="submit">{busy ? 'Đang kiểm tra…' : step === 3 ? 'Lưu & thông báo' : `Tiếp: ${STEPS[step + 1]}`}</Button></div>
    </fieldset></form>
  </FlowShell>;
}
