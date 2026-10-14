import { useState } from 'react';
import { AlertBanner, Button, TextField } from '../../design-system';
import type { TreatmentPlanRequest } from './models';

function localDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function TreatmentPlanEditor({ initial = {}, onSave }: {
  initial?: TreatmentPlanRequest; onSave: (input: TreatmentPlanRequest) => Promise<void>;
}) {
  const [plan, setPlan] = useState<TreatmentPlanRequest>(structuredClone(initial));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const medications = plan.medications ?? [];
  const tasks = plan.groomTasks ?? [];
  return <form className="medical-form" noValidate onSubmit={async (event) => {
    event.preventDefault();
    if (pending) return;
    setError(''); setSuccess(false);
    if (medications.some((item) => !item.name.trim())) { setError('Every medication needs a name'); return; }
    if (tasks.some((item) => !item.instruction.trim())) { setError('Every care task needs an instruction'); return; }
    setPending(true);
    try {
      await onSave({ ...plan, medications: medications.map((item) => ({ name: item.name.trim(), instructions: item.instructions?.trim() })),
        groomTasks: tasks.map((item) => ({ instruction: item.instruction.trim(), ...(item.dueAt ? { dueAt: new Date(item.dueAt).toISOString() } : {}) })) });
      setSuccess(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save treatment'); }
    finally { setPending(false); }
  }}>
    <TextField label="Re-examination date" type="date" value={plan.reexaminationDate ?? ''} disabled={pending} onChange={(event) => setPlan({ ...plan, reexaminationDate: event.target.value || undefined })} />
    <TextField label="Rest instructions" value={plan.restInstructions ?? ''} disabled={pending} onChange={(event) => setPlan({ ...plan, restInstructions: event.target.value })} />
    <fieldset disabled={pending} className="medical-form"><legend className="text-h3">Medication</legend>
      {medications.map((item, index) => <div className="medical-form" key={index}>
        <TextField label={'Medication name ' + (index + 1)} value={item.name} onChange={(event) => setPlan({ ...plan, medications: medications.map((old, i) => i === index ? { ...old, name: event.target.value } : old) })} />
        <TextField label={'Medication instructions ' + (index + 1)} value={item.instructions ?? ''} onChange={(event) => setPlan({ ...plan, medications: medications.map((old, i) => i === index ? { ...old, instructions: event.target.value } : old) })} />
        <Button variant="secondary" onClick={() => setPlan({ ...plan, medications: medications.filter((_, i) => i !== index) })}>Remove medication {index + 1}</Button>
      </div>)}
      <Button variant="secondary" onClick={() => setPlan({ ...plan, medications: [...medications, { name: '', instructions: '' }] })}>Add medication</Button>
    </fieldset>
    <fieldset disabled={pending} className="medical-form"><legend className="text-h3">Care tasks for the Groom</legend>
      {tasks.map((item, index) => <div className="medical-form" key={index}>
        <TextField label={'Groom treatment instruction ' + (index + 1)} value={item.instruction} onChange={(event) => setPlan({ ...plan, groomTasks: tasks.map((old, i) => i === index ? { ...old, instruction: event.target.value } : old) })} />
        <TextField label={'Task due date ' + (index + 1)} type="datetime-local" value={localDateTime(item.dueAt)} onChange={(event) => setPlan({ ...plan, groomTasks: tasks.map((old, i) => i === index ? { ...old, dueAt: event.target.value ? new Date(event.target.value).toISOString() : undefined } : old) })} />
        <Button variant="secondary" onClick={() => setPlan({ ...plan, groomTasks: tasks.filter((_, i) => i !== index) })}>Remove care task {index + 1}</Button>
      </div>)}
      <Button variant="secondary" onClick={() => setPlan({ ...plan, groomTasks: [...tasks, { instruction: '' }] })}>Add care task</Button>
    </fieldset>
    {error && <AlertBanner type="danger" title={error} />}
    {success && <AlertBanner type="success" title="Treatment plan saved" />}
    <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save treatment plan'}</Button>
  </form>;
}
