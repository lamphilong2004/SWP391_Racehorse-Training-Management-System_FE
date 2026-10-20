import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ApiError } from '../../../shared/auth/authApi';
import { authSession } from '../../../shared/auth/authSession';
import { AssignedProgramsPage } from './AssignedProgramsPage';
import { TrainingCalendarPage } from '../calendar/TrainingCalendarPage';
import { calendarPeriod } from '../calendar/calendarDates';
import { ExerciseLibraryPage } from '../exercises/ExerciseLibraryPage';
import { exerciseErrors, exercisePayload, exerciseSelectionTarget } from '../exercises/exerciseValidation';
import { createSupportingApi, type AssignedProgram, type CalendarSession, type Exercise, type SupportingApi } from './supportingApi';

const auth = vi.hoisted(() => ({ user: { id: 12, fullName: 'Test Trainer', roles: ['TRAINER'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(() => false) }));
vi.mock('../../../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
const program: AssignedProgram = { id: 1001, horse: { id: 7, name: 'Thunder Bolt', horseCode: 'TB-001' }, name: 'Foundation', status: 'ACTIVE', periodStart: '2026-10-01', periodEnd: '2026-12-01', sourceTemplateId: 3, sourceTemplateVersion: 1, currentPhaseName: 'Base', trainingAvailability: 'LIMITED' };
const exercise: Exercise = { id: 21, name: 'Gallop Intervals', exerciseType: 'Gallop', description: 'Repeated fast efforts with safe recovery.', targetMetric: '4 × 400 m' };
function fixtureSession(): CalendarSession { return { id: 44, sessionCode: 'SES-0044', horse: program.horse, programId: program.id, phaseName: 'Base', scheduledStart: new Date().toISOString(), status: 'SCHEDULED', workRider: { id: 13, fullName: 'Test Rider' }, blocked: true, blockedReasons: ['PRE_CHECK_MISSING'] }; }
function api(): SupportingApi {
  return { programs: vi.fn().mockResolvedValue({ items: [program, { ...program, id: 1002, name: 'Locked Program', trainingAvailability: 'LOCKED' }, { ...program, id: 1003, name: 'Finished Program', status: 'COMPLETED' }], page: 0, size: 20, totalItems: 3, totalPages: 1 }), sessions: vi.fn().mockResolvedValue([fixtureSession()]), exercises: vi.fn().mockResolvedValue([exercise]), exercise: vi.fn().mockResolvedValue(exercise), saveExercise: vi.fn().mockResolvedValue(exercise) };
}
function mount(client: SupportingApi, path: string) {
  const router = createMemoryRouter([
    { path: '/training/programs/assigned', element: <AssignedProgramsPage api={client} /> },
    { path: '/training/schedule', element: <TrainingCalendarPage api={client} /> },
    { path: '/training/exercise-library', element: <ExerciseLibraryPage api={client} /> },
    { path: '/training/exercise-library/new', element: <ExerciseLibraryPage api={client} /> },
    { path: '/training/programs/:id', element: <h1>CORE-041 handoff unavailable</h1> },
    { path: '/training/session/:id', element: <h1>CORE-025 session handoff unavailable</h1> },
    { path: '/training/schedule/session/new', element: <h1>CORE-025 wizard handoff unavailable</h1> },
  ], { initialEntries: [path] }); render(<RouterProvider router={router} />); return router;
}
beforeEach(() => { auth.user.roles = ['TRAINER']; auth.handleApiError.mockClear(); authSession.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); });
afterEach(() => { vi.unstubAllEnvs(); });

it('renders assigned programs, keeps locked/completed Add Session unavailable and does not invent percentages', async () => {
  const client = api(); mount(client, '/training/programs/assigned');
  await screen.findByRole('table', { name: 'My assigned programs' });
  expect(screen.getAllByRole('link', { name: '+ Add Session' })).toHaveLength(1);
  expect(screen.getByRole('link', { name: '+ Add Session' })).toHaveAttribute('href', '/training/schedule/session/new?programId=1001');
  // Figma 95:400 draws the unavailable action as a disabled "Add Session" (not a link).
  expect(screen.getAllByText('Add Session').filter((element) => element.closest('[aria-disabled="true"]'))).toHaveLength(2); expect(screen.queryByText(/58%/)).not.toBeInTheDocument();
  expect(screen.getByText('Add Session is available only for ACTIVE programs on horses that are not LOCKED.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search horse or program'), { target: { value: 'Locked' } });
  expect(screen.queryByRole('link', { name: '+ Add Session' })).not.toBeInTheDocument();
});
it('paginates server assigned programs and passes status filters, retaining the canonical owner handoff', async () => {
  const client = api(); vi.mocked(client.programs).mockResolvedValue({ items: [program], page: 0, size: 20, totalItems: 21, totalPages: 2 });
  const router = mount(client, '/training/programs/assigned'); await screen.findByRole('table');
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await waitFor(() => expect(client.programs).toHaveBeenLastCalledWith({ page: 1, status: '', horseId: undefined }));
  fireEvent.change(screen.getByLabelText('Program Status'), { target: { value: 'ACTIVE' } }); await waitFor(() => expect(client.programs).toHaveBeenLastCalledWith({ page: 0, status: 'ACTIVE', horseId: undefined }));
  fireEvent.click(screen.getByRole('link', { name: 'View program Foundation' })); await screen.findByRole('heading', { name: 'CORE-041 handoff unavailable' }); expect(router.state.location.pathname).toBe('/training/programs/1001');
});
it('denies Groom before requesting supporting data', () => {
  auth.user.roles = ['GROOM']; const client = api(); mount(client, '/training/programs/assigned');
  expect(screen.getByText('Your role cannot use this training page.')).toBeInTheDocument(); expect(client.programs).not.toHaveBeenCalled(); expect(client.sessions).not.toHaveBeenCalled();
});
it('shows empty and403 list states without manufactured rows', async () => {
  const client = api(); vi.mocked(client.programs).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Not assigned'));
  mount(client, '/training/programs/assigned'); await screen.findByText('The server denied access to this data. Your session remains active.'); expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('computes calendar periods over local calendar dates including Sunday and month boundaries', () => {
  const week = calendarPeriod(new Date(2026, 9, 18, 8), 'week'); expect(week.days).toHaveLength(7); expect(week.days[0].getDay()).toBe(1); expect(week.days.at(-1)!.getDay()).toBe(0);
  const month = calendarPeriod(new Date(2026, 10, 1), 'month'); expect(month.days).toHaveLength(42); expect(Date.parse(month.to)).toBeGreaterThan(Date.parse(month.from));
});
it('calendar filters derivedBlocked without changing storedstatus and opens the CORE025 detail handoff', async () => {
  const client = api(); const router = mount(client, '/training/schedule');
  const event = await screen.findByRole('button', { name: 'Open SES-0044 Thunder Bolt' }); expect(event).toHaveTextContent('BLOCKED');
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'COMPLETED' } }); expect(screen.queryByRole('button', { name: 'Open SES-0044 Thunder Bolt' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'BLOCKED' } }); fireEvent.click(screen.getByRole('button', { name: 'Open SES-0044 Thunder Bolt' }));
  await screen.findByText('CORE-025 session handoff unavailable'); expect(router.state.location.pathname).toBe('/training/session/44');
});
it('calendar changes week/month and keeps new-session action Trainer-only', async () => {
  auth.user.roles = ['VETERINARIAN']; const client = api(); mount(client, '/training/schedule');
  await screen.findByRole('button', { name: 'Open SES-0044 Thunder Bolt' }); expect(screen.queryByRole('link', { name: '+ New Training Session' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next week' })); await waitFor(() => expect(client.sessions).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('tab', { name: 'Month' })); await waitFor(() => expect(client.sessions).toHaveBeenCalledTimes(3));
  expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
});
it('opens the exercise detail drawer and does not invent surface/intensity/recovery fields', async () => {
  const client = api(); mount(client, '/training/exercise-library');
  fireEvent.click(await screen.findByRole('button', { name: 'View Gallop Intervals' }));
  const drawer = await screen.findByRole('dialog', { name: 'Gallop Intervals' }); await within(drawer).findByText('4 × 400 m');
  expect(within(drawer).getByText('This guidance is not available for this exercise yet.')).toBeInTheDocument();
  fireEvent.click(within(drawer).getByText('Close', { selector: 'button' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(client.exercise).toHaveBeenCalledWith(21);
});
it('searches exercise definitions with approved query keys and supports empty results', async () => {
  const client = api(); mount(client, '/training/exercise-library'); await screen.findByRole('button', { name: 'View Gallop Intervals' });
  vi.mocked(client.exercises).mockResolvedValue([]); fireEvent.change(screen.getByLabelText('Search exercises'), { target: { value: 'No match' } }); fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('No exercises'); expect(client.exercises).toHaveBeenLastCalledWith({ q: 'No match', exerciseType: '' });
});
it('does not expose the Trainer-only builder to HeadTrainer read view', async () => {
  auth.user.roles = ['HEAD_TRAINER']; const client = api(); mount(client, '/training/exercise-library'); await screen.findByRole('button', { name: 'View Gallop Intervals' });
  expect(screen.queryByRole('button', { name: 'New Exercise' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Gallop Intervals' })); await screen.findByRole('dialog', { name: 'Gallop Intervals' }); expect(screen.queryByRole('button', { name: 'Edit Exercise' })).not.toBeInTheDocument();
});
it('validates and saves only approved exercise fields; pending submission cannot duplicate and network retry preserves input', async () => {
  const client = api(); let reject!: (cause: unknown) => void;
  vi.mocked(client.saveExercise).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  mount(client, '/training/exercise-library/new'); const dialog = await screen.findByRole('dialog', { name: 'New Exercise' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save Exercise' })); await within(dialog).findByText('Enter an exercise name of 1–150 characters.'); expect(client.saveExercise).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText('Exercise name'), { target: { value: '  Custom hill work  ' } });
  fireEvent.change(within(dialog).getByLabelText('Purpose'), { target: { value: 'Build endurance' } }); fireEvent.change(within(dialog).getByLabelText('Distance / duration guidance'), { target: { value: '300 m measured' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save Exercise' })); fireEvent.submit(within(dialog).getByLabelText('Purpose').closest('form')!); expect(client.saveExercise).toHaveBeenCalledTimes(1);
  reject(new ApiError(0, 'NETWORK_ERROR', 'Disconnected')); await within(dialog).findByText(/Disconnected/); expect(within(dialog).getByLabelText('Exercise name')).toHaveValue('  Custom hill work  ');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save Exercise' })); await screen.findByText('Exercise Gallop Intervals saved');
  expect(client.saveExercise).toHaveBeenLastCalledWith({ name: 'Custom hill work', exerciseType: null, description: 'Build endurance', targetMetric: '300 m measured' }, undefined);
});
it.each([{ ...exercise, id: 0 }, null])('edits a definition by id, preserves contract fields and rejects malformed success acknowledgement %j', async (acknowledgement) => {
  const client = api(); vi.mocked(client.saveExercise).mockResolvedValue(acknowledgement as Exercise); mount(client, '/training/exercise-library');
  fireEvent.click(await screen.findByRole('button', { name: 'View Gallop Intervals' })); await screen.findByRole('dialog', { name: 'Gallop Intervals' }); fireEvent.click(await screen.findByRole('button', { name: 'Edit Exercise' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Exercise' }); expect(within(dialog).getByLabelText('Purpose')).toHaveValue(exercise.description);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save Exercise' })); await within(dialog).findByText(/Exercise response could not be confirmed/); expect(within(dialog).getByRole('button', { name: 'Save Exercise' })).toBeDisabled(); expect(client.saveExercise).toHaveBeenCalledWith(exercisePayload(exercise), 21);
});
it('retains entered exercise fields and locks submission after a conflict until close and reload', async () => {
  const client = api(); vi.mocked(client.saveExercise).mockRejectedValue(new ApiError(409, 'CONFLICT', 'Exercise was changed by another Trainer.'));
  mount(client, '/training/exercise-library/new'); const dialog = await screen.findByRole('dialog', { name: 'New Exercise' });
  fireEvent.change(within(dialog).getByLabelText('Exercise name'), { target: { value: 'Keep this exercise' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save Exercise' })); await within(dialog).findByText(/Exercise was changed by another Trainer/);
  expect(within(dialog).getByLabelText('Exercise name')).toHaveValue('Keep this exercise'); expect(within(dialog).getByRole('button', { name: 'Save Exercise' })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close and reload library' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(client.saveExercise).toHaveBeenCalledTimes(1);
});
it('limits exercise selection to the approved local session handoff without open redirects', () => {
  expect(exerciseSelectionTarget('https://external.example/training/schedule/session/new')).toBeNull(); expect(exerciseSelectionTarget('http://[')).toBeNull(); expect(exerciseSelectionTarget('/training/schedule/session/new?programId=1001')).toBe('/training/schedule/session/new?programId=1001');
  expect(exerciseErrors({ name: 'ok', targetMetric: 'x'.repeat(101) })).toHaveProperty('targetMetric');
});
it('uses shared bearer identity, canonical assignedToMe and exact exercise payload in real API mode', async () => {
  authSession.save('test-only-token', 3600, false);
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: exercise }), { status: 200 }));
  const client = createSupportingApi({ fetcher, baseUrl: 'https://api.example.test', handleApiError: auth.handleApiError });
  await client.programs({ page: 1, status: 'ACTIVE' }); expect(String(fetcher.mock.calls[0][0])).toBe('https://api.example.test/api/training-programs?assignedToMe=true&page=1&size=20&status=ACTIVE');
  await client.saveExercise({ ...exercise, intensity: 'HIGH' } as Exercise, 21); const init = fetcher.mock.calls[1][1]!;
  expect(init.method).toBe('PUT'); expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-only-token'); expect(JSON.parse(String(init.body))).toEqual({ name: exercise.name, exerciseType: exercise.exerciseType, description: exercise.description, targetMetric: exercise.targetMetric });
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Not assigned', details: [] } }), { status: 403 }));
  await expect(client.exercises()).rejects.toMatchObject({ status: 403 }); expect(auth.handleApiError).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
});
it('keeps a typed exercise definition when Escape is pressed on the dirty builder', async () => {
  mount(api(), '/training/exercise-library/new'); const dialog = await screen.findByRole('dialog', { name: 'New Exercise' });
  fireEvent.change(within(dialog).getByLabelText('Exercise name'), { target: { value: 'Hill repeats' } });
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('dialog', { name: 'New Exercise' })).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Exercise name')).toHaveValue('Hill repeats');
});
