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
