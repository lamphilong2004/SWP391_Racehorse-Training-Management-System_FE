import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../app/router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { roleTestAuthApi } from './roleTestAuthApi';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import { NAVIGATION } from '../layout/navigation';
import { authSession } from '../shared/auth/authSession';
import { requestApi } from '../shared/auth/authApi';

vi.mock('./stagingMode', () => ({ ROLE_TEST_LOGIN: true }));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubEnv('MODE', 'staging-preview'); vi.stubEnv('VITE_ROLE_TEST_LOGIN', 'true');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('A test identity must never reach the network')));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function mount(path = '/login') {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider api={roleTestAuthApi}><RouterProvider router={router} /></AuthProvider>);
  return router;
}
async function enter(role: RoleCode) {
  const button = await screen.findByRole('button', { name: ROLE_LABELS[role] });
  await act(async () => { fireEvent.click(button); });
  await act(async () => { await vi.dynamicImportSettled(); });
}

it.each(ROLE_CODES)('opens the %s workspace without credentials, network or sample data', async (role) => {
  mount();
  expect(await screen.findByRole('heading', { name: 'Role test sign-in' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  await enter(role);
  expect(await screen.findByRole('heading', { name: role === 'CLUB_MANAGER' ? 'Club Manager Dashboard' : role === 'TRAINER' ? 'Trainer Dashboard' : NAVIGATION[role].workspaceLabel })).toBeInTheDocument();
  expect(screen.getByText('Protected test sign-in — UI inspection only')).toBeInTheDocument();
  expect(authSession.read()?.accessToken).toBe(`role-test:${role}`);
  expect(localStorage.getItem('racehorse.auth.local.v1')).toBeNull();
  expect(sessionStorage.getItem('racehorse.auth.session.v1')).toBeNull();
  expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('shows an explicit server-unavailable state instead of records, and never writes a sample store', async () => {
  mount('/horses'); await enter('CLUB_MANAGER');
  expect(await screen.findByText(/test sign-in has no server access/)).toBeInTheDocument();
  expect(screen.queryByText('Thunder Bolt')).not.toBeInTheDocument();
  expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects every API call made with a test identity before it can reach the backend', async () => {
  for (const path of ['/api/horses', '/api/auth/me', '/api/medical/cases/1']) {
    await expect(requestApi(path, { method: 'GET' }, { token: 'role-test:VETERINARIAN' })).rejects.toMatchObject({ status: 503, code: 'SERVER_UNAVAILABLE' });
  }
  await expect(requestApi('/api/horses', { method: 'POST', body: '{}' }, { token: 'role-test:CLUB_MANAGER' })).rejects.toMatchObject({ status: 503 });
  expect(fetch).not.toHaveBeenCalled();
});

it('keeps role boundaries and returns to the entry after sign-out', async () => {
  const router = mount(); await enter('GROOM');
  await screen.findByRole('heading', { name: 'Stable Care Workspace' });
  await act(() => router.navigate('/admin/audit-log'));
  expect(await screen.findByText('Your account does not have permission to access this page.')).toBeInTheDocument();
  await act(() => router.navigate('/dashboard'));
  fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Role test sign-in' })).toBeInTheDocument();
  expect(authSession.read()).toBeNull();
});
