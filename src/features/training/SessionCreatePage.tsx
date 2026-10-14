import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, SelectField, TextField, ValidationNotice } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { useAction, useApi } from '../../shared/hooks/useApi';
import { ActionError, Grid, Resource, Row, Stack } from '../../shared/ui/common';
import { INTENSITY_LABEL, INTENSITY_OPTIONS, localInputNow } from '../../shared/ui/format';
import { trainingApi, type Suitability } from '../demoApi';
import styles from './training.module.css';

interface ExerciseRow { exerciseDefinitionId: string; distanceM: string; durationMin: string; repetitions: string; restIntervalMin: string; intensity: string }

const emptyRow = (): ExerciseRow => ({ exerciseDefinitionId: '', distanceM: '', durationMin: '', repetitions: '', restIntervalMin: '', intensity: '' });
const num = (v: string) => (v.trim() === '' ? null : Number(v));

/**
 * SCR-TRAIN-006 Create Training Session (condensed): basics → exercises (4-category suitability check; a Medical
 * Hard Block can only be removed or replaced) → Work Rider (schedule conflict = hard block) → schedule.
 */
export function SessionCreatePage() {
  const programId = Number(useParams().id);
  const navigate = useNavigate();
  const program = useApi(() => trainingApi.program(programId), [programId]);
  const exercises = useApi(() => trainingApi.exercises(), []);
  const [phaseId, setPhaseId] = useState('');
  const [start, setStart] = useState(localInputNow(2));
  const [durationMin, setDurationMin] = useState('60');
  const [surface, setSurface] = useState('Turf Track');
  const [focus, setFocus] = useState('Speed Development');
  const [intensity, setIntensity] = useState('');
  const [rows, setRows] = useState<ExerciseRow[]>([
    { ...emptyRow(), distanceM: '800', intensity: 'LOW' },
    { ...emptyRow(), distanceM: '400', repetitions: '4', restIntervalMin: '3', intensity: 'MEDIUM' },
  ]);
  const [riderId, setRiderId] = useState('');
  const [suitability, setSuitability] = useState<Suitability | null>(null);
  const action = useAction();
  const startIso = start ? new Date(start).toISOString() : '';
  const endIso = start ? new Date(new Date(start).getTime() + (Number(durationMin) || 60) * 60000).toISOString() : '';
  const riders = useApi(() => (startIso ? trainingApi.riders({ scheduledStart: startIso, scheduledEnd: endIso }) : Promise.resolve([])), [startIso, endIso]);

  const exerciseInputs = () =>
    rows.filter((r) => r.exerciseDefinitionId).map((r, i) => ({
      exerciseDefinitionId: Number(r.exerciseDefinitionId), exerciseOrder: i + 1, distanceM: num(r.distanceM), durationMin: num(r.durationMin),
      repetitions: num(r.repetitions), restIntervalMin: num(r.restIntervalMin), intensity: r.intensity || null, surface,
    }));

  const check = async () => {
    const list = exerciseInputs();
    if (!phaseId || list.length === 0) return action.setError('Choose a phase and at least one exercise.');
    const result = await action.run(() => trainingApi.suitability({ horseProgramPhaseId: Number(phaseId), exercises: list }));
    if (result) setSuitability(result);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const list = exerciseInputs();
    if (!phaseId || !start || !riderId || list.length === 0) return action.setError('Phase, start time, Work Rider and at least one exercise are required.');
    if (rows.some((r) => [r.distanceM, r.durationMin, r.repetitions, r.restIntervalMin].some((v) => v !== '' && Number(v) < 0)))
      return action.setError('Distance, duration, repetitions and rest cannot be negative.');
    const created = await action.run(() =>
      trainingApi.createSession({ horseProgramPhaseId: Number(phaseId), scheduledStart: startIso, scheduledEnd: endIso, surface, focus,
        intensity: intensity || null, workRiderUserId: Number(riderId), exercises: list }),
    );
    if (created) navigate(`/training/sessions/${created.summary.id}`, { replace: true });
  };

  const setRow = (i: number, k: keyof ExerciseRow, v: string) => {
    setSuitability(null);
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  };

  return (
    <Resource {...program} label="program">
      {(p) => {
        const phase = p.phases.find((ph) => String(ph.id) === phaseId);
        const range = phase ? INTENSITY_OPTIONS.filter((o) => {
          const order = INTENSITY_OPTIONS.map((x) => x.value);
          return order.indexOf(o.value) >= order.indexOf(phase.intensityMin ?? 'LOW') && order.indexOf(o.value) <= order.indexOf(phase.intensityMax ?? 'HIGH');
        }) : INTENSITY_OPTIONS;
        return (
          <form onSubmit={submit} noValidate>
            <Stack gap="lg">
              <PageHeader title="Create training session" description={`${p.horse.name} · ${p.horse.horseCode} — ${p.name}`} />
              {p.trainingAvailability === 'LOCKED' && <AlertBanner type="danger" title="Training LOCKED">The Veterinarian has locked training. Scheduling is blocked (BR-D20).</AlertBanner>}
              {p.trainingAvailability === 'LIMITED' && <AlertBanner type="warning" title="Horse is LIMITED">Each exercise is checked against the Veterinarian allow/forbid list.</AlertBanner>}
              <ActionError error={action.error} />
              <Card title="1 · Basics">
                <Grid cols={3}>
                  <SelectField label="Phase" value={phaseId} onChange={(e) => { setPhaseId(e.target.value); setIntensity(''); }} placeholder="Select phase"
                    options={p.phases.map((ph) => ({ value: String(ph.id), label: `${ph.phaseOrder}. ${ph.name} (${INTENSITY_LABEL[ph.intensityMin ?? '']}–${INTENSITY_LABEL[ph.intensityMax ?? '']})` }))} />
                  <TextField label="Start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                  <TextField label="Duration (min)" type="number" min="10" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
                  <TextField label="Surface" value={surface} onChange={(e) => setSurface(e.target.value)} />
                  <TextField label="Focus" value={focus} onChange={(e) => setFocus(e.target.value)} />
                  <SelectField label="Session intensity" value={intensity} onChange={(e) => setIntensity(e.target.value)} placeholder="Within phase range" options={range} />
                </Grid>
              </Card>
              <Card title="2 · Exercises">
                <Resource {...exercises} label="exercises">
                  {(ex) => (
                    <Stack>
                      {rows.map((r, i) => (
                        <div key={i} className={styles.exerciseRow}>
                          <SelectField label={`Exercise ${i + 1}`} value={r.exerciseDefinitionId} onChange={(e) => setRow(i, 'exerciseDefinitionId', e.target.value)}
                            placeholder="Select" options={ex.map((x) => ({ value: String(x.id), label: x.name }))} />
                          <TextField label="Distance (m)" type="number" min="0" value={r.distanceM} onChange={(e) => setRow(i, 'distanceM', e.target.value)} />
                          <TextField label="Duration (min)" type="number" min="0" value={r.durationMin} onChange={(e) => setRow(i, 'durationMin', e.target.value)} />
                          <TextField label="Reps" type="number" min="0" value={r.repetitions} onChange={(e) => setRow(i, 'repetitions', e.target.value)} />
                          <TextField label="Rest (min)" type="number" min="0" value={r.restIntervalMin} onChange={(e) => setRow(i, 'restIntervalMin', e.target.value)} />
                          <SelectField label="Intensity" value={r.intensity} onChange={(e) => setRow(i, 'intensity', e.target.value)} placeholder="—" options={INTENSITY_OPTIONS} />
                          <Button type="button" variant="tertiary" onClick={() => { setSuitability(null); setRows((rs) => rs.filter((_, j) => j !== i)); }}>Remove</Button>
                        </div>
                      ))}
                      <Row>
                        <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, emptyRow()])}>Add exercise</Button>
                        <Button type="button" variant="secondary" onClick={check} disabled={action.busy}>Run suitability check</Button>
                      </Row>
                      {suitability?.exercises.filter((s) => s.category === 'A').map((s, i) => (
                        <ValidationNotice key={`${s.exerciseDefinitionId}-${i}`} category="a"
                          title={`${s.exerciseName}: MEDICAL HARD BLOCK`}
                          lockNote="Only the Veterinarian can change the restriction">
                          {s.messages.join(' ')}
                        </ValidationNotice>
                      ))}
                      {suitability && suitability.exercises.some((s) => s.category !== 'A') && (
                        <AlertBanner type="success" title="Suitable">
                          {suitability.exercises.filter((s) => s.category !== 'A').map((s) => `${s.exerciseName} — ${s.messages.join(' ')}`).join(' · ')}
                        </AlertBanner>
                      )}
                      {suitability && !suitability.canSchedule && <AlertBanner type="danger" title="Cannot schedule">Remove or replace every MEDICAL HARD BLOCK exercise.</AlertBanner>}
                    </Stack>
                  )}
                </Resource>
              </Card>
              <Card title="3 · Work Rider">
                <Resource {...riders} label="riders">
                  {(list) => (
                    <SelectField label="Work Rider" value={riderId} onChange={(e) => setRiderId(e.target.value)} placeholder="Select a Work Rider"
                      options={list.filter((r) => !r.hardBlock).map((r) => ({ value: String(r.item.id), label: `${r.item.fullName} — ${r.label.replaceAll('_', ' ')}${r.reasons.length ? ` (${r.reasons.join('; ')})` : ''}` }))} />
                  )}
                </Resource>
              </Card>
              <Row>
                <Button type="submit" disabled={action.busy}>{action.busy ? 'Scheduling…' : 'Schedule session'}</Button>
                <Button type="button" variant="secondary" onClick={() => navigate(`/training/programs/${programId}`)}>Cancel</Button>
              </Row>
            </Stack>
          </form>
        );
      }}
    </Resource>
  );
}
