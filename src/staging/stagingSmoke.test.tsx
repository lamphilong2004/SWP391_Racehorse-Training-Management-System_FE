import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../app/router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { stagingAuthApi } from './stagingAuthApi';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import { NAVIGATION } from '../layout/navigation';
import { authSession } from '../shared/auth/authSession';
import { readSamples } from '../shared/data/sampleStore';
import { requestApi } from '../shared/auth/authApi';

vi.mock('./stagingMode', () => ({ STAGING_SAMPLE: true }));

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('MODE', 'staging-sample'); vi.stubEnv('VITE_STAGING_SAMPLE', 'true'); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No network permitted'))); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function mount(path = '/login') {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider api={stagingAuthApi}><RouterProvider router={router} /></AuthProvider>);
  return router;
}
async function enter(role: RoleCode) {
  const button = await screen.findByRole('button', { name: ROLE_LABELS[role] });
  await act(async () => { fireEvent.click(button); });
  // Wait for the real route chunks triggered by sign-in, not filesystem-transform timing.
  await act(async () => { await vi.dynamicImportSettled(); });
}

it.each(ROLE_CODES)('opens %s via staging entry without credentials, dev controls or network', async (role) => {
  mount();
  expect(await screen.findByRole('heading', { name: 'Explore sample workspace' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  await enter(role);
  expect(await screen.findByRole('heading', { name: role === 'CLUB_MANAGER' ? 'Club Manager Dashboard' : NAVIGATION[role].workspaceLabel })).toBeInTheDocument();
  expect(screen.getByText('Staging sample — no backend connection')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'UI demo controls' })).not.toBeInTheDocument();
  expect(authSession.read()?.accessToken).toBe(`staging-sample:${role}`);
  expect(localStorage.getItem('racehorse.auth.local.v1')).toBeNull();
  expect(sessionStorage.getItem('racehorse.auth.session.v1')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('Horse journey: deep link → sample entry → draft save through shared adapter', async () => {
  const router = mount('/horses/new');
  await enter('CLUB_MANAGER');
  expect(await screen.findByRole('heading', { name: 'Register Horse' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Horse name *'), { target: { value: 'Staging Arrival' } });
  fireEvent.change(screen.getByLabelText('Horse ID *'), { target: { value: 'STG-900' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft & Continue' }));
  expect(await screen.findByRole('heading', { name: 'Pedigree & Ownership · Staging Arrival' })).toBeInTheDocument();
  expect(router.state.location.pathname).toMatch(/^\/horses\/\d+\/edit$/);
  expect(readSamples().horseRegistry!.records.find((horse) => horse.horseCode === 'STG-900')?.lifecycle).toBe('DRAFT');
  expect(fetch).not.toHaveBeenCalled();
});

it('Training journey: Interrupted result → evaluation → history preserves terminal state', async () => {
  const router = mount('/training/sessions/42/evaluation'); await enter('TRAINER');
  await screen.findByRole('tab', { name: 'Evaluation & Recommendation' });
  fireEvent.click(screen.getByRole('tab', { name: 'Evaluation & Recommendation' }));
  fireEvent.click(await screen.findByRole('radio', { name: 'Did not meet target' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Evaluation' }));
  expect(await screen.findByText('Evaluation saved')).toBeInTheDocument();
  expect(readSamples().sessions.find(({ session }) => session.id === 42)?.session.status).toBe('INTERRUPTED');
  await act(() => router.navigate('/training/performance'));
  expect(await screen.findByRole('link', { name: 'SES-0042' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it('Medical journey: Vet enters case list/detail and uses local availability without clinical fallback', async () => {
  const router = mount('/medical'); await enter('VETERINARIAN');
  expect(await screen.findByRole('heading', { name: 'Medical Cases' })).toBeInTheDocument();
  await act(() => router.navigate('/medical/cases/501'));
  expect(await screen.findByRole('tab', { name: 'Examination' })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('Loading medical data…')).not.toBeInTheDocument());
  expect(fetch).not.toHaveBeenCalled();
});

it('CM Audit journey has read-only samples; denial retains identity; sign-out returns entry', async () => {
  const router = mount(); await enter('CLUB_MANAGER');
  fireEvent.click(await screen.findByRole('link', { name: /^View Audit Log$/ }));
  expect(await screen.findByRole('table', { name: 'Audit log, newest first' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  await enter('GROOM');
  await waitFor(() => expect(authSession.read()?.accessToken).toBe('staging-sample:GROOM'));
  // The normal auth boundary restores the account deep link after signing out there.
  fireEvent.click(await screen.findByRole('link', { name: 'Back to workspace' }));
  await screen.findByRole('heading', { name: 'Stable Care Workspace' });
  await act(() => router.navigate('/admin/audit-log'));
  expect(await screen.findByText('Your account does not have permission to access this page.')).toBeInTheDocument();
  expect(authSession.read()).not.toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('never sends sample identity to an arbitrary network path and rejects missing APIs honestly', async () => {
  await expect(requestApi('/outside-api', {}, { token: 'staging-sample:TRAINER' })).rejects.toMatchObject({ status: 401 });
  mount(); await enter('TRAINER'); await screen.findByRole('heading', { name: 'Trainer Workspace' });
  await expect(requestApi('/api/not-implemented')).rejects.toMatchObject({ status: 404 });
  expect(fetch).not.toHaveBeenCalled();
});
