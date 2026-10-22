import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TreatmentPlanEditor } from './TreatmentPlanEditor';

it('preserves loaded Groom assignments when saving an existing treatment plan', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<TreatmentPlanEditor initial={{
    treatmentMedicationInstructions: 'Veterinary protocol',
    groomTasks: [{ assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-16' }],
  }} onSave={onSave} />);
  expect(screen.getByLabelText('Groom-safe instruction 1')).toHaveValue('Cold compress');
  fireEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    groomTasks: [{ assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-16' }],
  })));
});

it('retains immutable completed task instructions while allowing plan text changes', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const task = { assignedGroomUserId: 6, instruction: 'Existing completed care', taskDate: '2026-10-16' };
  render(<TreatmentPlanEditor initial={{ treatmentMedicationInstructions: 'Protocol', groomTasks: [task] }} retainedTaskCount={1} onSave={onSave} />);
  expect(screen.getByLabelText('Groom-safe instruction 1')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove task' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: /Treatment and medication instructions/ }), { target: { value: 'Updated protocol' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ treatmentMedicationInstructions: 'Updated protocol', groomTasks: [task] })));
});

it('keeps invalid treatment input and blocks a request exceeding the approved contract', async () => {
  const onSave = vi.fn();
  render(<TreatmentPlanEditor initial={{ treatmentMedicationInstructions: 'Vet instructions', restInstructions: 'x'.repeat(101) }} onSave={onSave} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Rest instructions must be 100 characters or fewer');
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Rest instructions')).toHaveValue('x'.repeat(101));
});

it('keeps a failed save editable and cancels without submitting', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('Clinical state changed'));
  const onCancel = vi.fn();
  render(<TreatmentPlanEditor initial={{ treatmentMedicationInstructions: 'Vet instructions' }} onSave={onSave} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Clinical state changed');
  expect(screen.getByRole('textbox', { name: /Treatment and medication instructions/ })).toHaveValue('Vet instructions');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSave).toHaveBeenCalledOnce();
});

it('sends normalized strings at the exact approved length boundaries', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<TreatmentPlanEditor initial={{ treatmentMedicationInstructions: ' Protocol ', restInstructions: ' ' + 'r'.repeat(100) + ' ', careInstructions: ' ' + 'c'.repeat(2000) + ' ',
    groomTasks: [{ assignedGroomUserId: 6, instruction: ' ' + 'i'.repeat(2000) + ' ', scheduledSlot: ' ' + 's'.repeat(50) + ' ', taskDate: '2026-10-19' }],
  }} onSave={onSave} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save treatment plan' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const payload = onSave.mock.calls[0][0];
  expect(payload.treatmentMedicationInstructions).toBe('Protocol');
  expect(payload.restInstructions).toHaveLength(100);
  expect(payload.careInstructions).toHaveLength(2000);
  expect(payload.groomTasks[0].instruction).toHaveLength(2000);
  expect(payload.groomTasks[0].scheduledSlot).toHaveLength(50);
});
