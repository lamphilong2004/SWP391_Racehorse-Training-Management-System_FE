import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { authSession } from '../shared/auth/authSession';
import { type AuthApi } from '../shared/auth/authApi';
import { ROLE_CODES, type RoleCode } from '../shared/auth/roles';
import { sampleUser } from '../shared/data/sampleStore';
import { NAVIGATION } from '../layout/navigation';

function mount(role: RoleCode, path = '/dashboard', signedIn = true) {
  if (signedIn) authSession.save('test-only-integration', 3600, false);
  const api: AuthApi = { currentUser: vi.fn().mockResolvedValue(sampleUser(role)), login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) };
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider api={api}><RouterProvider router={router} /></AuthProvider>);
  return router;
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(ROLE_CODES)('retains the intended dashboard for %s', async (role) => {
  mount(role);
  expect(await screen.findByRole('heading', { name: role === 'CLUB_MANAGER' ? 'Club Manager Dashboard' : NAVIGATION[role].workspaceLabel })).toBeInTheDocument();
  if (role === 'CLUB_MANAGER') {
    expect(await screen.findByRole('link', { name: 'View horses' })).toHaveAttribute('href', '/horses');
    expect(screen.getByRole('link', { name: 'View pending activations' })).toHaveAttribute('href', '/horses/pending-activation');
    expect(screen.getByRole('link', { name: 'Open incidents' })).toHaveAttribute('href', '/incidents');
    expect(screen.queryByRole('link', { name: 'Create User' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Management Reports' })).not.toBeInTheDocument();
  }
});

it('navigates dashboard to real read-only audit and back, retaining query pagination', async () => {
  const router = mount('CLUB_MANAGER');
  fireEvent.click(await screen.findByRole('link', { name: /^View Audit Log$/ }));
  expect(await screen.findByRole('heading', { name: /Audit Log/ })).toBeInTheDocument();
  expect(await screen.findByText('Sample session snapshot: SES-0043 · COMPLETED')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/admin/audit-log');
  await act(() => router.navigate('/admin/audit-log?page=0&size=1'));
  expect(await screen.findByText(/Showing 1–1 of/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
  expect(await screen.findByText(/Showing 2–2 of/)).toBeInTheDocument();
  expect(router.state.location.search).toContain('page=1');
  fireEvent.click(screen.getByRole('link', { name: '← Dashboard' }));
  expect(await screen.findByRole('heading', { name: 'Club Manager Dashboard' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each(ROLE_CODES.filter((role) => role !== 'CLUB_MANAGER'))('denies %s audit before transport', async (role) => {
  mount(role, '/admin/audit-log');
  expect(await screen.findByText('Your account does not have permission to access this page.')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['/dashboard', '/admin/audit-log'])('redirects anonymous %s through the canonical login', async (path) => {
  const router = mount('CLUB_MANAGER', path, false);
  expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
});
