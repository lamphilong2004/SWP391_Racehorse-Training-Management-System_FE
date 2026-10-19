import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AlertBanner, Button, CandidateCard, Card, Checkbox, EmptyState, ErrorState, KeyValue, LoadingState, SelectField, StatusBadge, TextAreaField, TextField, WizardStepper } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { CandidateList, Intensity } from '../program-creation/programTypes';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { blocksSession, createSessionApi, type CreateSessionInput, type SessionDraft, type SessionExerciseInput, type Suitability } from './sessionApi';
import styles from '../main-flows/flow.module.css';

const INTENSITIES: Intensity[] = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'];
const STEPS = ['Session Info', 'Exercises', 'Work Rider', 'Review'];
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
    const start = new Date(when); if (!Number.isFinite(start.getTime())) throw new Error('Choose the session date and start time.');
    if (!phase || !program.data || program.data.status !== 'ACTIVE') throw new Error('Choose an ACTIVE assigned program and a phase.');
    const localDate = when.slice(0, 10);
    if (localDate < phase.startDate || localDate > phase.endDate) throw new Error('Schedule the session within the approved phase dates.');
    if (duration && (!Number.isFinite(Number(duration)) || Number(duration) <= 0)) throw new Error('Expected duration must be positive.');
    if (intensity && ((phase.intensityMin && INTENSITIES.indexOf(intensity) < INTENSITIES.indexOf(phase.intensityMin)) || (phase.intensityMax && INTENSITIES.indexOf(intensity) > INTENSITIES.indexOf(phase.intensityMax)))) throw new Error('Choose an intensity within the approved phase range.');
    return { horseProgramPhaseId: phase.id, scheduledStart: start.toISOString(), scheduledEnd: duration ? new Date(start.getTime() + Number(duration) * 60000).toISOString() : undefined,
      intensity: intensity || undefined, exercises, workRiderUserId: riderId || undefined };
  }
  async function advance() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const value = draft();
      if (step === 0) { if (availability.data?.availability === 'LOCKED') throw new Error(availability.data.reason || 'This horse is LOCKED.'); setStep(1); return; }
      if (!exercises.length) throw new Error('Select at least one exercise.');
      if (exercises.some((item) => [item.distanceM, item.durationMin, item.repetitions, item.restIntervalMin].some((n) => n != null && (!Number.isFinite(n) || n < 0)) || (item.repetitions != null && !Number.isInteger(item.repetitions)))) throw new Error('Exercise values must be non-negative; repetitions must be whole numbers.');
      const result = await api.suitability(value); setCheck(result);
      const blocks = blocksSession(result, exercises); if (blocks.length) throw new Error(blocks.join(' '));
      if (step === 1) { setRiders(await api.riders(value)); setStep(2); return; }
      if (!rider || rider.hardBlock) throw new Error('Choose an eligible Work Rider.');
      if (rider.warnings.length && !acknowledged) throw new Error('Acknowledge the selected rider’s warnings.');
      if (step === 2) { setStep(3); return; }
      const payload: CreateSessionInput = { ...value, workRiderUserId: riderId, riderWarningAcknowledged: acknowledged, surface: surface || undefined, focus: focus || undefined };
      const saved = await api.create(payload);
      if (!saved?.id) throw new Error('The server did not confirm a scheduled session.');
      navigate(`/training/session/${saved.id}`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <FlowShell title="Create Training Session" description={`Step ${step + 1} of 4 · ${STEPS[step]}`} section="Training Calendar" role="TRAINER" actions={<Link to="/training/calendar">Cancel</Link>}>
    <WizardStepper steps={STEPS} currentStep={step} onStepClick={(value) => { if (!busy) setStep(value); }} />
    {program.data && <Card><div className={styles.row}><strong>{program.data.horse.name}</strong><span>{program.data.horse.horseCode} · {program.data.name} · {phase?.name ?? 'Choose phase'}</span>{availability.data && <StatusBadge family="availability" status={availability.data.availability} />}</div></Card>}
    {error && <AlertBanner type="danger" title="Session not scheduled">{error}</AlertBanner>}
    <form onSubmit={(event) => { event.preventDefault(); void advance(); }}><fieldset disabled={busy} className={styles.fieldset}>
      {step === 0 && <div className={styles.columns}><Card title="Session details"><div className={styles.stack}>
        {programs.error && <ErrorState title="Assigned programs unavailable" description={programs.error} onRetry={programs.reload} />}{program.pending && programId && <LoadingState label="Loading program…" />}{program.error && <ErrorState title="Program unavailable" description={program.error} onRetry={program.reload} />}
        <div className={styles.sessionFields}><SelectField label="Program" required value={programId} options={[{ value: '', label: 'Choose assigned program' }, ...(programs.data?.items.filter((item) => item.status === 'ACTIVE').map((item) => ({ value: String(item.id), label: `${item.horse.name} · ${item.name}` })) ?? [])]} onChange={(event) => { setProgramId(event.target.value); setPhaseId(''); setExercises([]); resetValidation(); }} />
          <SelectField label="Phase" required value={phaseId} options={[{ value: '', label: 'Choose phase' }, ...(program.data?.phases.map((item) => ({ value: String(item.id), label: item.name })) ?? [])]} onChange={(event) => { setPhaseId(event.target.value); resetValidation(); }} />
          <TextField label="Horse · inherited" value={program.data?.horse.name ?? ''} readOnly /><TextField label="Date" type="date" required value={date} onChange={(event) => { setWhen(`${event.target.value}T${time}`); resetValidation(); }} /><TextField label="Start time" type="time" required value={time} onChange={(event) => { setWhen(`${date}T${event.target.value}`); resetValidation(); }} />
          <TextField label="Expected duration (min)" type="number" min="1" value={duration} onChange={(event) => { setDuration(event.target.value); resetValidation(); }} /><TextField label="Training surface" maxLength={50} value={surface} onChange={(event) => setSurface(event.target.value)} />
          <TextField label="Session focus" maxLength={200} value={focus} onChange={(event) => setFocus(event.target.value)} /><TextField label="Trainer · inherited" readOnly value={user?.fullName ?? ''} />
          <SelectField label="Session intensity" value={intensity} options={[{ value: '', label: 'Not specified' }, ...INTENSITIES.map((value) => ({ value, label: value.replaceAll('_', ' ') }))]} onChange={(event) => { setIntensity(event.target.value as Intensity); resetValidation(); }} /></div>
        <p className="text-caption">Program, horse and Trainer come from the assigned Horse Training Program. Session changes do not modify the program strategy or source template.</p>
      </div></Card><div className={styles.stack}><Card title="Training Availability">{availability.error && <ErrorState title="Availability unavailable" description={availability.error} onRetry={availability.reload} />}{availability.pending && program.data && <LoadingState label="Loading availability…" />}{availability.data && <><StatusBadge family="availability" status={availability.data.availability} /><p>{availability.data.reason ?? 'Set by the Veterinarian. Exercises are validated in Step 2.'}</p></>}</Card><Card title="Phase context"><div className={styles.stack}><KeyValue label="Phase goal" value={phase?.objective ?? 'Not provided'} /><KeyValue label="Phase workload" value={phase?.workload ?? 'Not provided'} /><KeyValue label="Permitted intensity" value={`${phase?.intensityMin ?? 'Not specified'} → ${phase?.intensityMax ?? 'Not specified'}`} /><KeyValue label="Phase period" value={phase ? `${phase.startDate} → ${phase.endDate}` : 'Choose phase'} /></div></Card></div></div>}
      {step === 1 && <div className={styles.columns}><Card title="Session exercises"><div className={styles.stack}>{catalog.pending && <LoadingState label="Loading exercises…" />}{catalog.error && <ErrorState title="Exercise library unavailable" description={catalog.error} onRetry={catalog.reload} />}<SelectField label="Add exercise" value="" options={[{ value: '', label: 'Choose exercise from library' }, ...(catalog.data?.map((item) => ({ value: String(item.id), label: item.name })) ?? [])]} onChange={(event) => { if (event.target.value) { resetValidation(); setExercises([...exercises, { exerciseDefinitionId: Number(event.target.value), exerciseOrder: exercises.length + 1 }]); } }} />
        {exercises.map((item, index) => { const outcome = check?.exercises.find((result) => result.exerciseOrder === index + 1); return <Card key={`${index}-${item.exerciseDefinitionId}`} title={`${index + 1}. ${catalog.data?.find((exercise) => exercise.id === item.exerciseDefinitionId)?.name ?? 'Exercise'}`} action={<Button type="button" variant="tertiary" onClick={() => { resetValidation(); setExercises(exercises.filter((_, i) => i !== index).map((value, i) => ({ ...value, exerciseOrder: i + 1 }))); }}>Remove</Button>}><div className={styles.stack}><div className={styles.fields}>{(['distanceM', 'durationMin', 'repetitions', 'restIntervalMin'] as const).map((key) => <TextField key={key} label={{ distanceM: 'Distance (m)', durationMin: 'Duration (min)', repetitions: 'Repetitions', restIntervalMin: 'Rest interval (min)' }[key]} type="number" min="0" step={key === 'repetitions' ? '1' : 'any'} value={item[key] ?? ''} onChange={(event) => patchExercise(index, { [key]: event.target.value === '' ? null : Number(event.target.value) })} />)}<SelectField label="Intensity" value={item.intensity ?? ''} options={[{ value: '', label: 'Not specified' }, ...INTENSITIES.map((value) => ({ value, label: value }))]} onChange={(event) => patchExercise(index, { intensity: (event.target.value || null) as Intensity | null })} /><TextField label="Surface" maxLength={50} value={item.surface ?? ''} onChange={(event) => patchExercise(index, { surface: event.target.value })} /></div>{outcome && <AlertBanner type={outcome.category === 'A' || outcome.category === 'B' ? 'danger' : outcome.category ? 'warning' : 'success'} title={outcome.category ? `Category ${outcome.category}` : 'Suitable'}>{outcome.messages.join(' ')}</AlertBanner>}<TextAreaField label="Acknowledgement / override reason" maxLength={1000} value={item.acknowledgementNote ?? ''} onChange={(event) => patchExercise(index, { acknowledgementNote: event.target.value })} helperText="Required for category C or D. Medical hard blocks cannot be overridden." /></div></Card>; })}
      </div></Card><Card title="Validation categories"><div className={styles.stack}><p>Suitable — proceed normally.</p><p>Caution — acknowledge and give a reason when required.</p><p>Not recommended — retain only with a reason.</p><p>Medical hard block — remove or replace. Schedule conflicts block rider selection.</p><p className="text-caption">The server checks suitability before you continue and again when you save.</p></div></Card></div>}
      {step === 2 && <Card title="Choose the Work Rider"><div className={styles.factGrid}>{riders?.candidates.map((candidate) => <CandidateCard key={candidate.user.id} name={candidate.user.fullName} subtitle={candidate.experienceLevel ?? candidate.label.replaceAll('_', ' ')} tags={candidate.skills ?? []} facts={[...candidate.reasons.map((value) => ({ label: 'Suitability', value })), ...candidate.warnings.map((value) => ({ label: 'Warning', value })), ...(candidate.hardBlock ? [{ label: 'Hard block', value: candidate.hardBlock }] : [])]} actions={<Button type="button" disabled={!!candidate.hardBlock} variant={riderId === candidate.user.id ? 'primary' : 'secondary'} onClick={() => { setRiderId(candidate.user.id); setAcknowledged(false); }}>{riderId === candidate.user.id ? 'Selected' : 'Select Rider'}</Button>} />)}</div>{!riders?.candidates.length && <EmptyState title="No eligible riders returned" description={riders?.emptyReason ?? 'Change the schedule or retry when rider recommendations are available.'} />}{rider && rider.warnings.length > 0 && <Checkbox label="I acknowledge this rider’s warnings" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />}</Card>}
      {step === 3 && <div className={styles.columns}><Card title="Review session"><div className={styles.stack}><KeyValue label="Session" value={`${program.data?.horse.name} · ${program.data?.name} · ${phase?.name}`} /><KeyValue label="Scheduled start" value={when} /><KeyValue label="Expected duration" value={duration ? `${duration} min` : 'Not specified'} /><KeyValue label="Work Rider" value={rider?.user.fullName ?? 'Not selected'} /><KeyValue label="Intensity / surface / focus" value={[intensity, surface, focus].filter(Boolean).join(' · ') || 'Not specified'} /><KeyValue label="Exercises" value={exercises.map((item) => catalog.data?.find((exercise) => exercise.id === item.exerciseDefinitionId)?.name ?? `Exercise ${item.exerciseDefinitionId}`).join(', ')} /><AlertBanner type="info" title="Program stays unchanged">Scheduling this Session does not change the Horse Training Program strategy or source Template.</AlertBanner></div></Card><div className={styles.stack}><Card title="Medical & availability">{check && <StatusBadge family="availability" status={check.trainingAvailability} />}<p>Training Availability is checked again before the session starts.</p></Card><Card title="On Save & Notify"><StatusBadge family="session" status="SCHEDULED" /><p>The server creates the session and notifies the assigned Work Rider. Nothing is scheduled before saving.</p></Card></div></div>}
      <div className={styles.footer}><Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button><span className="text-caption">Nothing is scheduled until Save & Notify in Step 4.</span><Button type="submit">{busy ? 'Checking…' : step === 3 ? 'Save & Notify' : `Next: ${STEPS[step + 1]}`}</Button></div>
    </fieldset></form>
  </FlowShell>;
}
