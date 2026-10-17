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
