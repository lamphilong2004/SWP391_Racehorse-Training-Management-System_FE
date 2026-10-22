import { useCallback, useRef, useState, type FormEvent } from 'react';
import { AlertBanner, Button, Card, ErrorState, LoadingState, Modal, SelectField, TextAreaField, TextField } from '../../design-system';
import { errorMessage } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import type { Intensity } from '../program-creation/programTypes';
import { blocksSession, type createSessionApi, type SessionExerciseInput, type TrainingSession } from './sessionApi';
import styles from '../main-flows/flow.module.css';

const INTENSITIES: Intensity[] = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'];
const pad = (value: number) => String(value).padStart(2, '0');
const local = (iso: string) => { const date = new Date(iso); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; };
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
  return <Modal open size="lg" title={`Edit session ${session.sessionCode}`} dismissible={!busy} onClose={onClose} footer={<Button variant="secondary" disabled={busy} onClick={onClose}>Close</Button>}>
    <div className={styles.stack}>
      <p className={styles.muted}>Only a SCHEDULED session can change. The program strategy and source template stay unchanged.</p>
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
    const start = new Date(when);
    if (!Number.isFinite(start.getTime())) { setError('Choose the session date and start time.'); return; }
    if (duration && (!Number.isFinite(Number(duration)) || Number(duration) <= 0)) { setError('Expected duration must be positive.'); return; }
    await save({ scheduledStart: start.toISOString(), scheduledEnd: duration ? new Date(start.getTime() + Number(duration) * 60000).toISOString() : undefined,
      surface: surface.trim() || undefined, focus: focus.trim() || undefined, intensity: (intensity || undefined) as Intensity | undefined }, setError);
  }
  return <Card title="Schedule & details"><form className={styles.stack} onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}><fieldset disabled={busy} className={styles.fieldset}><div className={styles.stack}>
    <div className={styles.fields}>
      <TextField label="Date" type="date" required value={date} onChange={(event) => setWhen(`${event.target.value}T${time}`)} />
      <TextField label="Start time" type="time" required value={time} onChange={(event) => setWhen(`${date}T${event.target.value}`)} />
      <TextField label="Expected duration (min)" type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} />
      <SelectField label="Session intensity" value={intensity} options={[{ value: '', label: 'Keep current' }, ...INTENSITIES.map((value) => ({ value, label: value.replaceAll('_', ' ') }))]} onChange={(event) => setIntensity(event.target.value)} />
      <TextField label="Training surface" maxLength={50} value={surface} onChange={(event) => setSurface(event.target.value)} />
      <TextField label="Session focus" maxLength={200} value={focus} onChange={(event) => setFocus(event.target.value)} />
    </div>
    {error && <AlertBanner type="danger" title="Details not saved">{error}</AlertBanner>}
    <div className={styles.row}><Button type="submit">{busy ? 'Saving…' : 'Save details'}</Button><span className="text-caption">The Work Rider stays assigned; the server rejects schedule conflicts.</span></div>
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
    if (!items.length) { setError('Keep at least one exercise.'); return; }
    if (items.some((item) => [item.distanceM, item.durationMin, item.repetitions, item.restIntervalMin].some((n) => n != null && (!Number.isFinite(n) || n < 0)) || (item.repetitions != null && !Number.isInteger(item.repetitions)))) { setError('Exercise values must be non-negative; repetitions must be whole numbers.'); return; }
    await save(items.map((item, index) => ({ ...item, exerciseOrder: index + 1 })), setError);
  }
  const name = (id: number) => catalog.data?.find((exercise) => exercise.id === id)?.name ?? session.exercises?.find((item) => item.exerciseDefinitionId === id)?.exerciseName ?? `Exercise ${id}`;
  return <Card title="Exercise plan"><form className={styles.stack} onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}><fieldset disabled={busy} className={styles.fieldset}><div className={styles.stack}>
    {catalog.pending && <LoadingState label="Loading exercises…" />}{catalog.error && <ErrorState title="Exercise library unavailable" description={catalog.error} onRetry={catalog.reload} />}
    <SelectField label="Add exercise" value="" options={[{ value: '', label: 'Choose exercise from library' }, ...(catalog.data?.map((item) => ({ value: String(item.id), label: item.name })) ?? [])]}
      onChange={(event) => { if (event.target.value) setItems([...items, { exerciseDefinitionId: Number(event.target.value), exerciseOrder: items.length + 1 }]); }} />
    {items.map((item, index) => <Card key={`${index}-${item.exerciseDefinitionId}`} title={`${index + 1}. ${name(item.exerciseDefinitionId)}`}
      action={<Button type="button" variant="tertiary" aria-label={`Remove ${name(item.exerciseDefinitionId)}`} onClick={() => setItems(items.filter((_, at) => at !== index))}>Remove</Button>}><div className={styles.stack}><div className={styles.fields}>
      {(['distanceM', 'durationMin', 'repetitions', 'restIntervalMin'] as const).map((key) => <TextField key={key} label={{ distanceM: 'Distance (m)', durationMin: 'Duration (min)', repetitions: 'Repetitions', restIntervalMin: 'Rest interval (min)' }[key]} type="number" min="0" step={key === 'repetitions' ? '1' : 'any'} value={item[key] ?? ''} onChange={(event) => patch(index, { [key]: event.target.value === '' ? null : Number(event.target.value) })} />)}
      <SelectField label="Intensity" value={item.intensity ?? ''} options={[{ value: '', label: 'Not specified' }, ...INTENSITIES.map((value) => ({ value, label: value }))]} onChange={(event) => patch(index, { intensity: (event.target.value || null) as Intensity | null })} />
      <TextField label="Surface" maxLength={50} value={item.surface ?? ''} onChange={(event) => patch(index, { surface: event.target.value })} /></div>
      <TextAreaField label="Acknowledgement / override reason" maxLength={1000} value={item.acknowledgementNote ?? ''} onChange={(event) => patch(index, { acknowledgementNote: event.target.value })} helperText="Required for category C or D. Medical hard blocks cannot be overridden." /></div></Card>)}
    {error && <AlertBanner type="danger" title="Exercises not saved">{error}</AlertBanner>}
    <div className={styles.row}><Button type="submit">{busy ? 'Checking…' : 'Check & save exercises'}</Button><span className="text-caption">Suitability is checked before saving and again by the server.</span></div>
  </div></fieldset></form></Card>;
}
