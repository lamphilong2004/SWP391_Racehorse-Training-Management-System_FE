import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditSession } from './EditSession';
import type { createSessionApi, TrainingSession } from './sessionApi';

const session = { id: 42, sessionCode: 'TS-42', status: 'SCHEDULED', horseProgramPhaseId: 5, scheduledStart: '2026-10-23T01:00:00Z', scheduledEnd: '2026-10-23T02:00:00Z',
  intensity: 'MEDIUM', surface: 'Sand', focus: 'Base', workRider: { id: 9, fullName: 'Rider' }, trainingAvailability: 'AVAILABLE',
  exercises: [{ id: 1, exerciseDefinitionId: 3, exerciseOrder: 1, exerciseName: 'Walk', distanceM: 1200, durationMin: 20 }] } as unknown as TrainingSession;
const clean = { trainingAvailability: 'AVAILABLE', sessionBlocked: false, exercises: [{ exerciseOrder: 1, exerciseDefinitionId: 3, category: null, messages: [] }], sessionIssues: [] };
function setup(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  const api = { exercises: vi.fn().mockResolvedValue([{ id: 3, name: 'Walk' }, { id: 4, name: 'Canter' }]), update: vi.fn().mockResolvedValue(session),
    replaceExercises: vi.fn().mockResolvedValue(session), suitability: vi.fn().mockResolvedValue(clean), ...overrides } as unknown as ReturnType<typeof createSessionApi>;
  const saved = vi.fn();
  render(<EditSession api={api} session={session} onClose={vi.fn()} onSaved={saved} />);
  return { api, saved };
}

it('patches only schedule details and keeps the Work Rider', async () => {
  const { api, saved } = setup();
  fireEvent.change(screen.getByLabelText(/Training surface/), { target: { value: 'Turf' } });
  fireEvent.change(screen.getByLabelText(/Expected duration/), { target: { value: '45' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  const body = vi.mocked(api.update).mock.calls[0][1];
  expect(body).toMatchObject({ surface: 'Turf', focus: 'Base', intensity: 'MEDIUM' });
  expect(Date.parse(body.scheduledEnd!) - Date.parse(body.scheduledStart!)).toBe(45 * 60000);
  expect(body).not.toHaveProperty('workRiderUserId');
});

it('checks suitability before replacing exercises and stops on a medical hard block', async () => {
  const blocked = { ...clean, exercises: [{ exerciseOrder: 1, exerciseDefinitionId: 3, category: 'A', messages: ['Prohibited by restriction.'] }] };
  const { api } = setup({ suitability: vi.fn().mockResolvedValue(blocked) });
  fireEvent.click(screen.getByRole('button', { name: 'Check & save exercises' }));
  expect(await screen.findByText('Prohibited by restriction.')).toBeInTheDocument();
  expect(api.replaceExercises).not.toHaveBeenCalled();
});

it('replaces the exercise plan in order after a clean check', async () => {
  const { api, saved } = setup();
  fireEvent.change(await screen.findByLabelText('Add exercise'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check & save exercises' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(vi.mocked(api.replaceExercises).mock.calls[0]).toEqual([42, [expect.objectContaining({ exerciseDefinitionId: 3, exerciseOrder: 1, distanceM: 1200 }), expect.objectContaining({ exerciseDefinitionId: 4, exerciseOrder: 2 })]]);
  expect(vi.mocked(api.suitability).mock.calls[0][0]).toMatchObject({ horseProgramPhaseId: 5, workRiderUserId: 9 });
});
