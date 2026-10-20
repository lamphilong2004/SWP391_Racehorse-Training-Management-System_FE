import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { RoleCode } from '../../shared/auth/roles';
import type { SessionResultView, SessionStatus } from './models';

// Fixtures exist only in tests. Requests exercise the real CORE-008 envelope/client/session adapter.
const user = { id: 12, fullName: 'Test Trainer', userCode: 'TEST-12', email: 'trainer@example.test', accountStatus: 'ACTIVE', roles: ['TRAINER'] as RoleCode[] };
function result(status: SessionStatus = 'INTERRUPTED'): SessionResultView {
  return { session: { id: 42, sessionCode: 'SES-0042', horse: { id: 7, name: 'Test Horse', horseCode: 'TEST-7' }, programId: 3, phaseName: 'Speed', scheduledStart: '2026-10-17T06:00:00Z', status, workRider: { id: 13, fullName: 'Test Rider' }, trainer: user, exercises: [{ id: 1, exerciseDefinitionId: 9, exerciseOrder: 1, exerciseName: 'Gallop', distanceM: 400, repetitions: 4, durationMin: null, restIntervalMin: 3 }], interruptionReason: 'Trainer stopped the session', hasEvaluation: false }, actual: { totalDistanceM: 0, durationMin: 21.5, maxHeartRate: null, maxSpeedKmh: 44, simulated: false }, samples: [{ recordedAt: '2026-10-17T06:00:00Z', source: 'MANUAL', heartRate: null, speedKmh: 0, distanceM: null }], alerts: [], evaluation: null, riderFeedback: null };
}
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } });
const failed = (status: number, message: string, details: { field: string; message: string }[] = []) => new Response(JSON.stringify({ success: false, error: { code: status === 400 ? 'VALIDATION_ERROR' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : 'UNAUTHORIZED', message, details } }), { status });
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let current = result();
function renderAt(path = '/training/sessions/42/evaluation', roles: RoleCode[] = ['TRAINER'], signedIn = true) {
  if (signedIn) authSession.save('fixture-only-token', 3600, false);
  fetcher = vi.fn<typeof fetch>(async (url) => String(url).endsWith('/api/auth/me') ? ok({ ...user, roles }) : ok(current));
  vi.stubGlobal('fetch', fetcher);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return router;
}
const evaluationCalls = () => fetcher.mock.calls.filter(([url]) => String(url).endsWith('/evaluation'));
async function openForm() { await userEvent.click(await screen.findByRole('tab', { name: 'Evaluation & Recommendation' })); }
async function chooseAssessment() { await userEvent.click(screen.getByRole('radio', { name: 'Did not meet target' })); }

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); current = result(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('CORE-033 production route and auth boundary', () => {
  it('redirects anonymous users without making result requests', async () => {
    const router = renderAt(undefined, ['TRAINER'], false);
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('denies Groom before requesting clinical/training result data', async () => {
    renderAt(undefined, ['GROOM']); expect(await screen.findByText('Your role cannot view session results.')).toBeInTheDocument();
    expect(fetcher.mock.calls).toHaveLength(1);
  });
  it('rejects malformed IDs before making result requests', async () => {
    renderAt('/training/sessions/no-id/evaluation'); expect(await screen.findByText('Session not found')).toBeInTheDocument(); expect(fetcher.mock.calls).toHaveLength(1);
  });
  it.each(['COMPLETED', 'INTERRUPTED'] as const)('shows server terminal state %s and preserves null, zero and units', async (status) => {
    current = result(status); renderAt();
    expect(await screen.findByRole('heading', { name: /Session Evaluation/ })).toBeInTheDocument();
    expect(screen.getByText(status, { selector: '[data-tone], span' })).toBeInTheDocument();
    expect(screen.getAllByText('0 m').length).toBeGreaterThan(0); expect(screen.getByText('21.5 min')).toBeInTheDocument();
    expect(screen.getAllByText('Not measured').length).toBeGreaterThan(0); expect(screen.getByText('44 km/h')).toBeInTheDocument();
    expect(screen.queryByText('SIMULATED')).not.toBeInTheDocument();
    const call = fetcher.mock.calls.find(([url]) => String(url).endsWith('/42/result'))!;
    expect(call[0]).toBe('http://localhost:8080/api/training-sessions/42/result');
    expect(new Headers(call[1]?.headers).get('Authorization')).toBe('Bearer fixture-only-token');
  });
  it('shows planned numeric values without multiplying distance by reps', async () => {
    renderAt(); await userEvent.click(await screen.findByRole('tab', { name: 'Planned vs Actual' }));
    expect(screen.getByText('400 m')).toBeInTheDocument(); expect(screen.getByText('4 reps')).toBeInTheDocument();
    expect(screen.queryByText('1,600 m')).not.toBeInTheDocument();
  });
  it('read roles cannot submit and Work Rider cannot request horse history', async () => {
    renderAt('/training/sessions/42/evaluation?view=history', ['WORK_RIDER']);
    expect(await screen.findByText('Your role cannot view horse performance history.')).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/performance'))).toBe(false);
  });
  it('keeps Head Trainer evaluation read-only', async () => {
    renderAt(undefined, ['HEAD_TRAINER']); await openForm(); expect(screen.getByText('Read-only result')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Save Evaluation' })).not.toBeInTheDocument();
  });
  it('does not evaluate a session in progress', async () => {
    current = result('IN_PROGRESS'); renderAt(); await openForm(); expect(screen.getByText('Evaluation unavailable')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Save Evaluation' })).not.toBeInTheDocument();
  });
  it('ordinary server 403 preserves shared session', async () => {
    renderAt(); fetcher.mockImplementation(async (url) => String(url).endsWith('/me') ? ok(user) : failed(403, 'Out of scope'));
    expect(await screen.findByText(/This session is outside/)).toBeInTheDocument(); expect(authSession.read()).not.toBeNull();
  });
  it.each([401, 403])('clears shared session for expired/inactive response %s', async (status) => {
    const router = renderAt(); fetcher.mockImplementation(async (url) => String(url).endsWith('/me') ? ok(user) : failed(status, status === 403 ? 'Your account is deactivated.' : 'Expired'));
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument(); expect(authSession.read()).toBeNull(); expect(router.state.location.pathname).toBe('/login');
  });
  it('shows 404 and retries result network errors without runtime fixtures', async () => {
    renderAt(); fetcher.mockImplementation(async (url) => { if (String(url).endsWith('/me')) return ok(user); throw new TypeError('offline'); });
    expect(await screen.findByText('Session result unavailable')).toBeInTheDocument();
    fetcher.mockImplementation(async () => failed(404, 'Not found'));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(await screen.findByText('Session not found')).toBeInTheDocument();
  });
});

describe('evaluation payload, validation and retry', () => {
  it('requires result, limits text length and keeps form data', async () => {
    renderAt(); await openForm(); await userEvent.click(screen.getByRole('button', { name: 'Save Evaluation' }));
    expect(screen.getByText('Choose an assessment.')).toBeInTheDocument(); expect(evaluationCalls()).toHaveLength(0);
    await chooseAssessment(); fireEvent.change(screen.getByLabelText('Professional notes'), { target: { value: 'x'.repeat(2001) } });
    await userEvent.click(screen.getByRole('button', { name: 'Save Evaluation' })); expect(screen.getByText('Use at most 2000 characters.')).toBeInTheDocument(); expect(evaluationCalls()).toHaveLength(0);
  });
  it.each(['INTERRUPTED', 'COMPLETED'] as const)('submits exact contract payload once, then keeps %s', async (status) => {
    current = result(status); renderAt(); await openForm(); await chooseAssessment();
    fireEvent.change(screen.getByLabelText('Professional notes'), { target: { value: '  Review recorded effort  ' } });
    fireEvent.change(screen.getByLabelText('Recommendation note'), { target: { value: 'Rest before next session' } });
    let finish!: (response: Response) => void;
    fetcher.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const save = screen.getByRole('button', { name: 'Save Evaluation' });
    fireEvent.submit(save.closest('form')!); fireEvent.submit(save.closest('form')!);
    await waitFor(() => expect(evaluationCalls()).toHaveLength(1)); expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reload session' })).toBeDisabled();
    await userEvent.click(screen.getByRole('tab', { name: 'Result' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Evaluation & Recommendation' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByLabelText('Professional notes')).toHaveValue('  Review recorded effort  ');
    expect(evaluationCalls()).toHaveLength(1);
    const input = JSON.parse(evaluationCalls()[0][1]!.body as string);
    expect(input).toEqual({ result: 'NOT_MET', evaluatedSummary: null, evaluationNotes: 'Review recorded effort', recommendation: 'Rest before next session' });
    expect(input).not.toHaveProperty('status'); expect(input).not.toHaveProperty('evaluationLabel');
    await act(async () => finish(ok({ ...input, id: 90, sessionId: 42, evaluatedBy: user, evaluatedAt: '2026-10-17T07:00:00Z' }, 201)));
    expect(await screen.findByText('Evaluation saved')).toBeInTheDocument(); expect(screen.getByText(`Session status remains ${status}.`)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Save Evaluation' })).not.toBeInTheDocument();
  });
  it('retains input on server validation and network errors, then permits retry', async () => {
    renderAt(); await openForm(); await chooseAssessment(); fireEvent.change(screen.getByLabelText('Professional notes'), { target: { value: 'Keep my notes' } });
    fetcher.mockResolvedValueOnce(failed(400, 'Invalid evaluation', [{ field: 'evaluationNotes', message: 'Please clarify your notes.' }]));
    await userEvent.click(screen.getByRole('button', { name: 'Save Evaluation' })); expect(await screen.findByText('Please clarify your notes.')).toBeInTheDocument();
    fetcher.mockRejectedValueOnce(new TypeError('offline'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Evaluation' })); expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument(); expect(screen.getByLabelText('Professional notes')).toHaveValue('Keep my notes');
    fetcher.mockImplementation(async () => ok({ id: 90, sessionId: 42, result: 'NOT_MET', evaluatedBy: user, evaluatedAt: '2026-10-17T07:00:00Z' }, 201));
    await userEvent.click(screen.getByRole('button', { name: 'Save Evaluation' })); expect(await screen.findByText('Evaluation saved')).toBeInTheDocument(); expect(evaluationCalls()).toHaveLength(3);
  });
  it('blocks duplicate submission after a server409 until reload', async () => {
    renderAt(); await openForm(); await chooseAssessment(); fetcher.mockResolvedValueOnce(failed(409, 'Already evaluated'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Evaluation' })); expect(await screen.findByText('Already evaluated')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Save Evaluation' })).toBeDisabled(); expect(evaluationCalls()).toHaveLength(1);
  });
});

describe('performance history contract', () => {
  it('loads horse-scoped history, retains null and filters by from/to', async () => {
    renderAt(); await screen.findByRole('tab', { name: 'Result' });
    fetcher.mockImplementation(async () => ok([{ sessionId: 42, sessionCode: 'SES-0042', date: '2026-10-17', status: 'INTERRUPTED', totalDistanceM: null, durationMin: 0, maxHeartRate: 185, avgSpeedKmh: 0, result: null }]));
    await userEvent.click(screen.getByRole('button', { name: 'Performance History' }));
    const table = await screen.findByRole('table', { name: 'Session history, newest first' }); expect(within(table).getByText('Not measured')).toBeInTheDocument(); expect(within(table).getByText('0 km/h')).toBeInTheDocument(); expect(within(table).getByText('Pending review')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } }); fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-17' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' })); await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/api/horses/7/performance?from=2026-10-01&to=2026-10-17'))).toBe(true));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } }); await userEvent.click(screen.getByRole('button', { name: 'Apply dates' })); expect(screen.getByText(/From must not be after To/)).toBeInTheDocument();
  });
  it('shows history network error, then an empty response on retry', async () => {
    renderAt(); await screen.findByRole('tab', { name: 'Result' }); fetcher.mockRejectedValueOnce(new TypeError('offline'));
    await userEvent.click(screen.getByRole('button', { name: 'Performance History' })); expect(await screen.findByText('History unavailable')).toBeInTheDocument(); fetcher.mockResolvedValueOnce(ok([]));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(await screen.findByText('No performance history')).toBeInTheDocument();
  });
});
describe('evaluation draft resilience', () => {
  it('keeps an unsaved evaluation through Performance History and back without a leave prompt', async () => {
    renderAt(); await openForm(); await chooseAssessment();
    fireEvent.change(screen.getByLabelText(/Evaluation summary/), { target: { value: 'Faded after rep three' } });
    await userEvent.click(screen.getByRole('button', { name: 'Performance History' }));
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Back to evaluation' }));
    await openForm();
    expect(screen.getByRole('radio', { name: 'Did not meet target' })).toBeChecked();
    expect(screen.getByLabelText(/Evaluation summary/)).toHaveValue('Faded after rep three');
  });
});
