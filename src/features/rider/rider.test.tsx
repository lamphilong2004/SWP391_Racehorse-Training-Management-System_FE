import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ApiError } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { createRiderApi, type RiderApi } from './api';
import { RiderAssignmentPage, RiderDashboardPage, RiderFeedbackPage, RiderSessionPage } from './pages';
import { metricInput, startBlocks, type RiderResult, type RiderSession } from './types';

const auth = vi.hoisted(() => ({ user: { id: 9, fullName: 'Test Rider', roles: ['WORK_RIDER'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(() => false) }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
const base: RiderSession = { id: 50, sessionCode: 'SES-0050', horse: { id: 7, name: 'Thunder Bolt', horseCode: 'TB-001' }, programId: 2, phaseName: 'Foundation', scheduledStart: '2020-10-17T01:00:00Z', status: 'SCHEDULED', workRider: { id: 9, fullName: 'Test Rider' }, trainer: { id: 3, fullName: 'Test Trainer' }, preCheckResult: 'ALL_NORMAL', blocked: false, blockedReasons: [], trainingAvailability: 'AVAILABLE', surface: 'Turf', exercises: [{ id: 1, exerciseDefinitionId: 1, exerciseOrder: 1, exerciseName: 'Trot', distanceM: 400, repetitions: 1, durationMin: null }] };
function result(session: RiderSession): RiderResult { return { session, actual: { totalDistanceM: null, durationMin: null, simulated: false }, samples: [{ recordedAt: '2020-10-17T01:01:00Z', speedKmh: 0, heartRate: null, distanceM: null, source: 'MANUAL' }], alerts: [], riderFeedback: null }; }
function api(session = base): RiderApi {
  return { assignments: vi.fn().mockResolvedValue([session]), history: vi.fn().mockResolvedValue({ items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 }), session: vi.fn().mockResolvedValue(session), result: vi.fn().mockResolvedValue(result(session)), start: vi.fn().mockResolvedValue({ ...session, status: 'IN_PROGRESS' }), complete: vi.fn().mockResolvedValue({ ...session, status: 'COMPLETED' }), issue: vi.fn().mockResolvedValue({ incidentId: 90, incidentCode: 'INC-0090', sessionStatus: 'INTERRUPTED' }), feedback: vi.fn().mockResolvedValue({ id: 91, sessionId: 50, responses: {}, submittedBy: session.workRider, submittedAt: '2020-10-17T01:30:00Z' }), metric: vi.fn().mockResolvedValue({ sampleId: 92, realtimeState: 'NORMAL' }) };
}
function mount(client: RiderApi, path: string) {
  const router = createMemoryRouter([{ path: '/rider', element: <RiderDashboardPage api={client} /> }, { path: '/rider/assignments/:id', element: <RiderAssignmentPage api={client} /> }, { path: '/rider/assignments/:id/start', element: <RiderAssignmentPage api={client} /> }, { path: '/rider/sessions/:id/active', element: <RiderSessionPage api={client} /> }, { path: '/rider/sessions/:id/feedback', element: <RiderFeedbackPage api={client} /> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />); return router;
}
beforeEach(() => { auth.user.roles = ['WORK_RIDER']; auth.handleApiError.mockClear(); authSession.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); });
afterEach(() => vi.unstubAllEnvs());

it('uses assigned rides for dashboard navigation and blocks wrong roles without requesting rides', async () => {
  const client = api(); mount(client, '/rider');
  expect((await screen.findAllByRole('link', { name: 'View Assignment' }))[0]).toHaveAttribute('href', '/rider/assignments/50');
});
it('denies Groom before any rider request', () => {
  auth.user.roles = ['GROOM']; const client = api(); mount(client, '/rider/sessions/50/active');
  expect(screen.getByText('Only Work Riders may use this workspace.')).toBeInTheDocument(); expect(client.session).not.toHaveBeenCalled();
});
it('requires normal precheck, server gates and scheduled time; no early start', async () => {
  const future = { ...base, scheduledStart: '2100-01-01T01:00:00Z', preCheckResult: null, blocked: true, blockedReasons: ['PRE_CHECK_MISSING'] };
  expect(startBlocks(future)).toEqual(expect.arrayContaining(['No early start. Your Trainer must reschedule if needed.', 'The Groom pre-session check must be ALL_NORMAL.']));
  const client = api(future); mount(client, '/rider/assignments/50');
  expect(await screen.findByRole('button', { name: 'Ready to Start' })).toBeDisabled(); expect(client.start).not.toHaveBeenCalled();
});
it('requires six readiness confirmations and starts once on the dedicated endpoint', async () => {
  const client = api(); const router = mount(client, '/rider/assignments/50/start');
  const dialog = await screen.findByRole('dialog', { name: 'Start this session?' });
  expect(within(dialog).getByRole('button', { name: 'Start Session' })).toBeDisabled();
  const confirmations = within(dialog).getAllByRole('checkbox'); expect(confirmations).toHaveLength(6);
  confirmations.forEach((checkbox) => fireEvent.click(checkbox));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Start Session' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/rider/sessions/50/active'));
  expect(client.start).toHaveBeenCalledExactlyOnceWith(50);
});
it('shows PAUSED from server without Finish or Trainer Pause/Resume/Stop controls; manual metrics remain possible', async () => {
  const client = api({ ...base, status: 'PAUSED' }); mount(client, '/rider/sessions/50/active');
  await screen.findByRole('heading', { name: 'SESSION PAUSED — BY YOUR TRAINER' });
  expect(screen.queryByRole('button', { name: 'Finish Session' })).not.toBeInTheDocument();
  for (const name of ['Pause', 'Resume', 'Stop']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add sample' })).toBeEnabled();
});
it('finishes only IN_PROGRESS and routes to feedback after server COMPLETED confirmation', async () => {
  const client = api({ ...base, status: 'IN_PROGRESS' }); const router = mount(client, '/rider/sessions/50/active');
  fireEvent.click(await screen.findByRole('button', { name: 'Finish Session' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/rider/sessions/50/feedback'));
  expect(client.complete).toHaveBeenCalledExactlyOnceWith(50);
});
it('INTERRUPTED remains terminal and only offers feedback', async () => {
  const client = api({ ...base, status: 'INTERRUPTED', interruptionReason: 'Trainer stopped for safety' }); mount(client, '/rider/sessions/50/active');
  await screen.findByRole('heading', { name: 'SESSION INTERRUPTED — NOT COMPLETED' });
  expect(screen.getByRole('link', { name: 'Give Rider Feedback' })).toHaveAttribute('href', '/rider/sessions/50/feedback');
  expect(screen.queryByRole('button', { name: 'Finish Session' })).not.toBeInTheDocument(); expect(client.complete).not.toHaveBeenCalled();
});
it('records explicit issue enum/severity/description then refreshes the server interruption', async () => {
  const active = { ...base, status: 'IN_PROGRESS' as const }; const client = api(active); mount(client, '/rider/sessions/50/active');
  fireEvent.click(await screen.findByRole('button', { name: 'Report Issue' }));
  const dialog = await screen.findByRole('dialog', { name: 'Report an issue' });
  fireEvent.change(within(dialog).getByLabelText('What did you notice?'), { target: { value: 'HOOF_OR_LEG_PROBLEM' } });
  fireEvent.change(within(dialog).getByLabelText('Observed severity'), { target: { value: 'HIGH' } });
  fireEvent.change(within(dialog).getByLabelText('Describe what you see'), { target: { value: 'Uneven gait on the left hind' } });
  vi.mocked(client.session).mockResolvedValue({ ...active, status: 'INTERRUPTED' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Submit Issue' }));
  await screen.findByRole('heading', { name: 'SESSION INTERRUPTED — NOT COMPLETED' });
  expect(client.issue).toHaveBeenCalledWith(50, { incidentType: 'HOOF_OR_LEG_PROBLEM', observedSeverity: 'HIGH', description: 'Uneven gait on the left hind', observedAt: expect.any(String) });
});
it('sends metric zero unchanged and nullable blank values without inventing distance', async () => {
  expect(metricInput({ heartRate: '', speedKmh: '0', distanceM: '' }, '2020-01-01T00:00:00Z')).toEqual({ recordedAt: '2020-01-01T00:00:00Z', heartRate: null, speedKmh: 0, distanceM: null });
  expect(() => metricInput({ heartRate: '', speedKmh: '', distanceM: '' })).toThrow('Enter at least one metric.');
  expect(() => metricInput({ heartRate: '1.5', speedKmh: '', distanceM: '' })).toThrow('whole number');
  expect(() => metricInput({ heartRate: '', speedKmh: '-1', distanceM: '' })).toThrow('nonnegative');
  const client = api({ ...base, status: 'PAUSED' }); mount(client, '/rider/sessions/50/active');
  fireEvent.click(await screen.findByRole('button', { name: 'Add sample' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add manual sample' });
  fireEvent.change(within(dialog).getByLabelText('Speed (km/h)'), { target: { value: '0' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Save sample' }));
  await screen.findByText('Manual sample recorded'); expect(client.metric).toHaveBeenCalledWith(50, expect.objectContaining({ speedKmh: 0, heartRate: null, distanceM: null }));
});
it('keeps interrupted feedback input for retry, submits only approved fields and prevents pending duplicates', async () => {
  const client = api({ ...base, status: 'INTERRUPTED' }); let reject!: (error: unknown) => void;
  vi.mocked(client.feedback).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  mount(client, '/rider/sessions/50/feedback');
  fireEvent.change(await screen.findByLabelText('What did you notice before the stop?'), { target: { value: 'Breathing hard' } });
  fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: '  Settled slowly  ' } });
  const submit = screen.getByRole('button', { name: 'Submit Feedback' }); fireEvent.click(submit); fireEvent.click(submit);
  expect(client.feedback).toHaveBeenCalledTimes(1); reject(new ApiError(0, 'NETWORK_ERROR', 'Network unavailable'));
  await screen.findByText('Network unavailable'); expect(screen.getByLabelText('Notes (optional)')).toHaveValue('  Settled slowly  ');
  fireEvent.click(screen.getByRole('button', { name: 'Submit Feedback' })); await screen.findByText('Rider Feedback submitted');
  expect(client.feedback).toHaveBeenLastCalledWith(50, { responses: { preInterruptionDescription: 'Breathing hard', notes: 'Settled slowly' } });
  expect(screen.getByText('The session stays INTERRUPTED')).toBeInTheDocument(); expect(client.complete).not.toHaveBeenCalled();
});
it('locks feedback409 and requests reload rather than blindly retrying', async () => {
  const client = api({ ...base, status: 'COMPLETED' }); vi.mocked(client.feedback).mockRejectedValue(new ApiError(409, 'CONFLICT', 'Feedback already exists'));
  mount(client, '/rider/sessions/50/feedback'); fireEvent.click(await screen.findByRole('button', { name: 'Submit Feedback' }));
  await screen.findByText('Feedback already exists'); expect(screen.queryByRole('button', { name: 'Submit Feedback' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload feedback' })).toBeEnabled();
});
it('uses shared auth/client and exact empty start/feedback/metric payloads without API-error fixture fallback', async () => {
  authSession.save('test-only-token', 3600, false);
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: base }), { status: 200 }));
  const client = createRiderApi({ fetcher, baseUrl: 'https://api.example.test', handleApiError: auth.handleApiError });
  await client.start(50); expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({});
  expect((fetcher.mock.calls[0][1]!.headers as Headers).get('Authorization')).toBe('Bearer test-only-token');
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Outside assigned scope', details: [] } }), { status: 403 }));
  await expect(client.session(50)).rejects.toMatchObject({ status: 403 }); expect(auth.handleApiError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 403 }));
});

it('disables execution actions when REST synchronization fails and hides a newly forbidden ride', async () => {
  const client = api({ ...base, status: 'IN_PROGRESS' }); mount(client, '/rider/sessions/50/active');
  await screen.findByRole('button', { name: 'Finish Session' });
  vi.mocked(client.session).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Disconnected'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh ride' }));
  await screen.findByText('Synchronization lost — displayed state may be stale');
  expect(screen.getByRole('button', { name: 'Finish Session' })).toBeDisabled();
  vi.mocked(client.session).mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Assignment revoked'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh ride' }));
  await screen.findByText('This ride is outside your permitted scope. Your session remains active.');
  expect(screen.queryByRole('button', { name: 'Finish Session' })).not.toBeInTheDocument();
});

it('keeps scheduled readiness review separate from the in-session issue mutation', async () => {
  const client = api(); mount(client, '/rider/assignments/50/start');
  const dialog = await screen.findByRole('dialog', { name: 'Start this session?' });
  expect(within(dialog).getByText(/Ride has not started. Ask the assigned Groom or Trainer/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Not Ready — Back to Assignment' }));
  expect(screen.queryByRole('button', { name: 'Report Issue' })).not.toBeInTheDocument(); expect(client.issue).not.toHaveBeenCalled();
});

it('locks an unconfirmed metric acknowledgement until close and authoritative reload', async () => {
  const client = api({ ...base, status: 'IN_PROGRESS' }); vi.mocked(client.metric).mockResolvedValue({ sampleId: 0, realtimeState: 'NORMAL' });
  mount(client, '/rider/sessions/50/active'); fireEvent.click(await screen.findByRole('button', { name: 'Add sample' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add manual sample' });
  fireEvent.change(within(dialog).getByLabelText('Speed (km/h)'), { target: { value: '0' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Save sample' }));
  await screen.findByText('Sample response could not be confirmed. Close and reload the ride before retrying.');
  expect(within(dialog).getByRole('button', { name: 'Save sample' })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close and reload ride' }));
  await waitFor(() => expect(client.session).toHaveBeenCalledTimes(2)); expect(client.metric).toHaveBeenCalledTimes(1);
});

it('releases a feedback409 lock only after successful fresh authoritative snapshot with no existing feedback', async () => {
  const client = api({ ...base, status: 'COMPLETED', hasRiderFeedback: false }); vi.mocked(client.feedback).mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'Stale feedback state'));
  mount(client, '/rider/sessions/50/feedback'); fireEvent.click(await screen.findByRole('button', { name: 'Submit Feedback' }));
  await screen.findByText('Stale feedback state');
  vi.mocked(client.session).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Still offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Reload feedback' })); await screen.findByText('Still offline');
  expect(screen.queryByRole('button', { name: 'Submit Feedback' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Submit Feedback' })); await screen.findByText('Rider Feedback submitted');
  expect(client.feedback).toHaveBeenCalledTimes(2);
});

it('shows the completed assignment with Your ride and Your Rider Feedback before instructions (Figma WR-D6)', async () => {
  const done: RiderSession = { ...base, status: 'COMPLETED', hasRiderFeedback: true };
  const client = api(done);
  client.result = vi.fn().mockResolvedValue({ ...result(done), riderFeedback: { id: 81, sessionId: 50, submittedBy: { id: 9, fullName: 'Test Rider' }, submittedAt: '2020-10-17T01:30:00Z', responses: { horseResponse: 'Settled and responsive' } } });
  mount(client, '/rider/assignments/50');
  expect(await screen.findByText('“Settled and responsive”')).toBeInTheDocument();
  expect(screen.getByText('Visible to your Trainer in Session Review.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View Riding History' })).toHaveAttribute('href', '/rider/history');
  expect(screen.getByText('Ride completed. Your Rider Feedback has been submitted.')).toBeInTheDocument();
  const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
  expect(headings.indexOf('Your Rider Feedback')).toBeLessThan(headings.indexOf('Training Instructions'));
});
it('keeps typed issue details when Escape is pressed on the dirty Report Issue dialog', async () => {
  const client = api({ ...base, status: 'IN_PROGRESS' }); mount(client, '/rider/sessions/50/active');
  fireEvent.click(await screen.findByRole('button', { name: 'Report Issue' }));
  const dialog = await screen.findByRole('dialog', { name: 'Report an issue' });
  fireEvent.change(within(dialog).getByLabelText('Describe what you see'), { target: { value: 'Short stride on the left fore' } });
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('dialog', { name: 'Report an issue' })).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Describe what you see')).toHaveValue('Short stride on the left fore');
  expect(within(dialog).getByRole('button', { name: 'Close' })).toBeDisabled();
});
