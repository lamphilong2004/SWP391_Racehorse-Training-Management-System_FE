import { useRef, useState } from 'react';
import { AlertBanner, Button, Card, TextAreaField, TextField } from '../../design-system';
import type { GroomTaskInstruction, TreatmentPlanRequest } from './models';
import { medicalErrorMessage } from './errors';
import { validDate } from './groomService';

export function TreatmentPlanEditor({ initial, onSave, onCancel, openedAt }: {
  initial?: Partial<TreatmentPlanRequest>; onSave: (input: TreatmentPlanRequest) => Promise<void>;
  onCancel?: () => void;
  openedAt?: string;
}) {
  const [plan, setPlan] = useState<TreatmentPlanRequest>({
    treatmentMedicationInstructions: initial?.treatmentMedicationInstructions ?? '',
    restInstructions: initial?.restInstructions ?? '',
    careInstructions: initial?.careInstructions ?? '',
    reexaminationDate: initial?.reexaminationDate,
    groomTasks: initial?.groomTasks?.map((task) => ({ ...task })) ?? [],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const tasks = plan.groomTasks ?? [];
  const changeTask = (index: number, patch: Partial<GroomTaskInstruction>) =>
    setPlan({ ...plan, groomTasks: tasks.map((task, i) => i === index ? { ...task, ...patch } : task) });
  return <form className="medical-form" onSubmit={async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!plan.treatmentMedicationInstructions.trim()) return setError('Medication and treatment instructions are required.');
    if ((plan.restInstructions?.trim().length ?? 0) > 100 || (plan.careInstructions?.trim().length ?? 0) > 2000) {
      return setError('Rest instructions must be 100 characters or fewer and care instructions 2000 characters or fewer.');
    }
    if (tasks.some((task) => !Number.isSafeInteger(task.assignedGroomUserId) || task.assignedGroomUserId < 1 || !task.instruction.trim() || !task.taskDate)) {
      return setError('Each Groom task needs an active Groom ID, instruction and task date.');
    }
    if (tasks.some((task) => task.instruction.trim().length > 2000 || (task.scheduledSlot?.trim().length ?? 0) > 50)) {
      return setError('Groom instructions must be 2000 characters or fewer and scheduled slots 50 characters or fewer.');
    }
    if (tasks.some((task) => !validDate(task.taskDate)) || (plan.reexaminationDate && !validDate(plan.reexaminationDate))) return setError('Enter valid task and re-examination dates.');
    submitting.current = true; setSaving(true);
    try { await onSave({
      ...plan,
      treatmentMedicationInstructions: plan.treatmentMedicationInstructions.trim(),
      restInstructions: plan.restInstructions?.trim(),
      careInstructions: plan.careInstructions?.trim(),
      groomTasks: tasks.map((task) => ({ ...task, instruction: task.instruction.trim(), scheduledSlot: task.scheduledSlot?.trim() })),
    }); }
    catch (failure) { setError(medicalErrorMessage(failure, 'Unable to save treatment plan.')); }
    finally { submitting.current = false; setSaving(false); }
  }}>
    <Card title="Plan period"><div className="medical-grid">
      <TextField label="Start (case opened)" value={openedAt ?? 'Not available'} readOnly />
      <TextField label="Re-examination date" type="date" value={plan.reexaminationDate ?? ''} disabled={saving} onChange={(event) => setPlan({ ...plan, reexaminationDate: event.target.value || undefined })} />
    </div></Card>
    <Card title="Treatment & care instructions"><TextAreaField label="Care instructions" value={plan.careInstructions ?? ''} disabled={saving} onChange={(event) => setPlan({ ...plan, careInstructions: event.target.value })} /></Card>
    <Card title="Rest"><TextField label="Rest instructions" value={plan.restInstructions ?? ''} disabled={saving} onChange={(event) => setPlan({ ...plan, restInstructions: event.target.value })} /></Card>
    <Card title="Medication"><TextAreaField label="Treatment and medication instructions" required value={plan.treatmentMedicationInstructions} disabled={saving} onChange={(event) => setPlan({ ...plan, treatmentMedicationInstructions: event.target.value })} /></Card>
    <Card title="Care tasks for the Groom"><fieldset disabled={saving} className="medical-form">
      <legend className="text-h3">Assigned Groom tasks</legend>
      {tasks.map((task, index) => <div className="medical-form" key={index}>
        <TextField label={`Groom user ID ${index + 1}`} type="number" min={1} step={1} value={task.assignedGroomUserId || ''} onChange={(event) => changeTask(index, { assignedGroomUserId: Number(event.target.value) })} />
        <TextAreaField label={`Groom-safe instruction ${index + 1}`} value={task.instruction} onChange={(event) => changeTask(index, { instruction: event.target.value })} />
        <TextField label={`Task date ${index + 1}`} type="date" value={task.taskDate} onChange={(event) => changeTask(index, { taskDate: event.target.value })} />
        <TextField label={`Scheduled slot ${index + 1}`} value={task.scheduledSlot ?? ''} onChange={(event) => changeTask(index, { scheduledSlot: event.target.value || undefined })} />
        <Button type="button" variant="secondary" onClick={() => setPlan({ ...plan, groomTasks: tasks.filter((_, i) => i !== index) })}>Remove task</Button>
      </div>)}
      <Button type="button" variant="secondary" onClick={() => setPlan({ ...plan, groomTasks: [...tasks, { assignedGroomUserId: 0, instruction: '', taskDate: '' }] })}>Add Groom task</Button>
    </fieldset></Card>
    {error && <AlertBanner type="danger" title={error} />}
    <div className="medical-actions">
      {onCancel && <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>}
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save treatment plan'}</Button>
    </div>
  </form>;
}
