import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GroomAssignment } from './GroomAssignment';
import { ReduceIntensity } from './ReduceIntensity';
import type { createSessionApi, TrainingSession } from './sessionApi';

const session = { id: 42, intensity: 'HIGH', trainingAvailability: 'AVAILABLE' } as TrainingSession;

it('assigns the chosen Groom once and reports a server refusal without claiming a save', async () => {
  const saved = vi.fn(), assignGroom = vi.fn().mockRejectedValue(new Error('Assignment changed; reload.'));
  const api = { groomCandidates: vi.fn().mockResolvedValue([{ id: 7, fullName: 'Assigned Groom' }]), assignGroom } as unknown as ReturnType<typeof createSessionApi>;
  render(<GroomAssignment api={api} session={session} onSaved={saved} />);
  await screen.findByRole('option', { name: 'Assigned Groom' });
  fireEvent.change(screen.getByLabelText('Assign Groom'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Assign & notify Groom' }));
  expect(await screen.findByText('Assignment changed; reload.')).toBeInTheDocument();
  expect(assignGroom).toHaveBeenCalledExactlyOnceWith(42, 7);
  expect(saved).not.toHaveBeenCalled();
});

it('offers only lower intensities and confirms reload only after the real API succeeds', async () => {
  const saved = vi.fn(), reduceIntensity = vi.fn().mockResolvedValue({ ...session, intensity: 'LOW' });
  const api = { reduceIntensity } as unknown as ReturnType<typeof createSessionApi>;
  render(<ReduceIntensity api={api} session={session} onSaved={saved} />);
  expect(screen.queryByRole('option', { name: /^HIGH$/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Lower session intensity'), { target: { value: 'LOW' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reduce intensity' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(reduceIntensity).toHaveBeenCalledExactlyOnceWith(42, 'LOW');
});
