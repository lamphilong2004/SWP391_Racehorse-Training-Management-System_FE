import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ApiError } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { createPrecheckApi, type PrecheckApi } from './api';
import { GroomTodayPage, PrecheckPage } from './pages';
import { CHECK_ITEMS, type Checklist, type PrecheckSession, type PreSessionCheck } from './types';

const actor = vi.hoisted(() => ({ user: { id: 8, fullName: 'Test Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(() => false) }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => actor }));
const session: PrecheckSession = { id: 40, sessionCode: 'SES-0040', horse: { id: 7, horseCode: 'TB-001', name: 'Thunder Bolt' }, programId: 2, phaseName: 'Foundation', scheduledStart: '2026-10-17T02:00:00Z', status: 'SCHEDULED', workRider: { id: 9, fullName: 'Test Rider' }, blocked: true, blockedReasons: ['PRE_CHECK_MISSING'], trainingAvailability: 'AVAILABLE' };
const checks = Object.fromEntries(CHECK_ITEMS.map(({ key }) => [key, { result: 'NORMAL' }])) as Checklist;
const saved = (abnormal = false): PreSessionCheck => ({ id: 91, sessionId: 40, checks: { ...checks, LEGS_HOOVES: { result: abnormal ? 'ABNORMAL' : 'NORMAL' } }, overallResult: abnormal ? 'ABNORMAL' : 'ALL_NORMAL', performedBy: { id: 8, fullName: 'Test Groom' }, performedAt: '2026-10-17T01:50:00Z' });
function api(): PrecheckApi {
  return { sessions: vi.fn().mockResolvedValue([session]), session: vi.fn().mockResolvedValue(session), submit: vi.fn().mockResolvedValue(saved()), reportIncident: vi.fn().mockResolvedValue({ id: 3, incidentCode: 'INC-0003' }), treatmentTasks: vi.fn().mockResolvedValue([]), incidents: vi.fn().mockResolvedValue([]) };
}
function mount(client: PrecheckApi, path = '/training/my-sessions/40/pre-check') {
  return render(<RouterProvider router={createMemoryRouter([{ path: '/training/my-sessions/:id/pre-check', element: <PrecheckPage api={client} /> }, { path: '/groom/today', element: <GroomTodayPage api={client} /> }], { initialEntries: [path] })} />);
}
async function chooseAll(abnormal = false) {
  await screen.findByRole('heading', { name: 'Observation checklist' });
  for (const item of CHECK_ITEMS) fireEvent.click(within(screen.getByRole('radiogroup', { name: item.label })).getByRole('radio', { name: abnormal && item.key === 'LEGS_HOOVES' ? 'Abnormal' : 'Normal' }));
}
beforeEach(() => { actor.user.roles = ['GROOM']; actor.handleApiError.mockClear(); authSession.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); });
afterEach(() => { vi.unstubAllEnvs(); });

it('renders assigned Groom sessions and navigation without optional care modules', async () => {
  mount(api(), '/groom/today');
  expect(await screen.findByRole('link', { name: 'Start Pre-Session Check' })).toHaveAttribute('href', '/training/my-sessions/40/pre-check');
  expect(screen.getByRole('link', { name: 'View Treatment Tasks' })).toHaveAttribute('href', '/medical/my-tasks');
  expect(screen.queryByText('Preventive Healthcare')).not.toBeInTheDocument();
});
it('denies other roles before any feature request', async () => {
  actor.user.roles = ['WORK_RIDER']; const client = api(); mount(client);
  expect(screen.getByText('Only the assigned Groom may access pre-session checks.')).toBeInTheDocument();
  expect(client.session).not.toHaveBeenCalled();
});
it('requires all five results before submitting', async () => {
  const client = api(); mount(client); await screen.findByRole('heading', { name: 'Observation checklist' });
  fireEvent.click(screen.getByRole('button', { name: 'Complete Pre-Session Check' }));
  expect(screen.getByText('Choose Normal or Abnormal for all five checks.')).toBeInTheDocument(); expect(client.submit).not.toHaveBeenCalled();
});
it('records all normal without starting the session or creating an incident', async () => {
  const client = api(); mount(client); await chooseAll();
  fireEvent.click(screen.getByRole('button', { name: 'Complete Pre-Session Check' }));
  expect(await screen.findByText('ALL NORMAL — pre-session check recorded')).toBeInTheDocument();
  expect(client.submit).toHaveBeenCalledWith(40, checks); expect(client.reportIncident).not.toHaveBeenCalled();
  expect(screen.getByText(/The session remains SCHEDULED/)).toBeInTheDocument();
});
it('records abnormal then opens the shared explicit report; never auto-creates an incident', async () => {
  const client = api(); vi.mocked(client.submit).mockResolvedValue(saved(true)); mount(client); await chooseAll(true);
  fireEvent.change(screen.getByLabelText('Legs & hooves observation (optional)'), { target: { value: 'Warm left hind fetlock' } });
  fireEvent.click(screen.getByRole('button', { name: 'Report Incident' }));
  const dialog = await screen.findByRole('dialog', { name: 'Report Incident' });
  expect(client.submit).toHaveBeenCalledTimes(1); expect(client.reportIncident).not.toHaveBeenCalled();
  expect(within(dialog).getByText('From pre-session check #91 · SES-0040')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('ABNORMAL — this session must not start')).toBeInTheDocument();
  expect(client.reportIncident).not.toHaveBeenCalled();
});
it('keeps observations after a network error and retries without duplicate pending submits', async () => {
  const client = api(); let reject!: (cause: unknown) => void;
  vi.mocked(client.submit).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  mount(client); await chooseAll(); fireEvent.change(screen.getByLabelText('General condition observation (optional)'), { target: { value: 'Alert and calm' } });
  const submit = screen.getByRole('button', { name: 'Complete Pre-Session Check' }); fireEvent.click(submit); fireEvent.click(submit);
  expect(client.submit).toHaveBeenCalledTimes(1);
  reject(new ApiError(0, 'NETWORK_ERROR', 'Network unavailable'));
  expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText('General condition observation (optional)')).toHaveValue('Alert and calm');
  fireEvent.click(screen.getByRole('button', { name: 'Complete Pre-Session Check' }));
  await screen.findByText('ALL NORMAL — pre-session check recorded'); expect(client.submit).toHaveBeenCalledTimes(2);
});
it('locks duplicate409 and reloads the existing recorded check without resubmitting', async () => {
  const client = api(); vi.mocked(client.submit).mockRejectedValue(new ApiError(409, 'CONFLICT', 'Check exists'));
  mount(client); await chooseAll(); fireEvent.click(screen.getByRole('button', { name: 'Complete Pre-Session Check' }));
  await screen.findByText(/A check may already be recorded/);
  expect(screen.queryByRole('button', { name: 'Complete Pre-Session Check' })).not.toBeInTheDocument();
  vi.mocked(client.session).mockResolvedValue({ ...session, preSessionCheck: saved() });
  fireEvent.click(screen.getByRole('button', { name: 'Reload session' }));
  await screen.findByText('ALL NORMAL — pre-session check recorded'); expect(client.submit).toHaveBeenCalledTimes(1);
});
it('shows access error and delegates403 to shared auth without data fallback', async () => {
  const client = api(); vi.mocked(client.session).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Outside assigned scope'));
  mount(client); await screen.findByText('Outside assigned scope'); expect(actor.handleApiError).toHaveBeenCalled();
  expect(client.submit).not.toHaveBeenCalled();
});
it('unlocks a409 only after successful reload confirms no existing check and keeps the observations', async () => {
  const client = api(); vi.mocked(client.submit).mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'State changed'));
  mount(client); await chooseAll();
  fireEvent.change(screen.getByLabelText('General condition observation (optional)'), { target: { value: 'Kept after conflict' } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete Pre-Session Check' }));
  await screen.findByText(/A check may already be recorded/);
  vi.mocked(client.session).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Reload unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Reload session' }));
  await screen.findByText('Reload unavailable'); expect(client.submit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  const retry = await screen.findByRole('button', { name: 'Complete Pre-Session Check' });
  expect(screen.getByLabelText('General condition observation (optional)')).toHaveValue('Kept after conflict');
  fireEvent.click(retry); await screen.findByText('ALL NORMAL — pre-session check recorded');
  expect(client.submit).toHaveBeenCalledTimes(2);
});
it('sends exact checklist-only payload with canonical token and propagates the shared error handler', async () => {
  authSession.save('test-only-token', 3600, false);
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: saved() }), { status: 201 })).mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Not assigned', details: [] } }), { status: 403 }));
  const client = createPrecheckApi({ fetcher, baseUrl: 'https://api.example.test', handleApiError: actor.handleApiError });
  await client.submit(40, checks);
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({ checks });
  expect((fetcher.mock.calls[0][1]!.headers as Headers).get('Authorization')).toBe('Bearer test-only-token');
  await expect(client.session(40)).rejects.toMatchObject({ status: 403 });
  await waitFor(() => expect(actor.handleApiError).toHaveBeenCalledTimes(1));
});
it('guards unsubmitted observations and focuses the first unanswered check', async () => {
  const client = api(); mount(client); await screen.findByRole('heading', { name: 'Observation checklist' });
  fireEvent.click(within(screen.getByRole('radiogroup', { name: CHECK_ITEMS[0].label })).getByRole('radio', { name: 'Normal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Complete Pre-Session Check' }));
  await waitFor(() => expect(within(screen.getByRole('radiogroup', { name: CHECK_ITEMS[1].label })).getAllByRole('radio')[0]).toHaveFocus());
  fireEvent.click(screen.getByRole('link', { name: '← Back to Today' }));
  expect(await screen.findByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue editing' }));
  expect(within(screen.getByRole('radiogroup', { name: CHECK_ITEMS[0].label })).getByRole('radio', { name: 'Normal' })).toBeChecked();
});
