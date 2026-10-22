import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';
import { ROLE_CODES } from '../shared/auth/roles';
import { fireEvent } from '@testing-library/react';

const auth = vi.hoisted(() => ({
  status: 'authenticated', user: { id: 7, fullName: 'Fixture User', roles: ['HEAD_TRAINER'], accountStatus: 'ACTIVE' },
  handleApiError: vi.fn(() => false), logout: vi.fn(),
}));
vi.mock('../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
const request = vi.hoisted(() => vi.fn(async (path: string) => {
  if (path.startsWith('/api/admin/users')) return { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 };
  if (path === '/api/admin/roles') return [{ roleCode: 'CLUB_MANAGER', displayName: 'Club Manager', scoping: 'Club administration' }];
  if (path.startsWith('/api/notifications?')) return { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 };
  if (path === '/api/notifications/unread-count') return { unread: 0 };
  throw new Error(`Unexpected fixture request: ${path}`);
}));
vi.mock('../features/main-flows/api', async (load) => ({ ...await load<object>(), useFlowRequest: () => request }));

const pending = [
  ['/admin/users', 'CLUB_MANAGER', 'Staff & Users'],
  ['/admin/roles', 'CLUB_MANAGER', 'Roles & Permissions'],
] as const;

function mount(path: string) {
  render(<RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} />);
}
beforeEach(() => { auth.status = 'authenticated'; request.mockClear(); });

it.each(pending)('mounts its API-backed required screen at %s', async (path, role, title) => {
  auth.user.roles = [role];
  mount(path);
  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  expect((await screen.findAllByRole('table')).length).toBe(path === '/admin/users' ? 1 : 2);
  expect(request).toHaveBeenCalledWith(expect.stringContaining(path === '/admin/users' ? '/api/admin/users?' : '/api/admin/roles'), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(screen.queryByText('This screen is not available in this build.')).not.toBeInTheDocument();
});

it.each(pending)('keeps role boundaries on the unavailable route %s', async (path) => {
  auth.user.roles = ['GROOM'];
  mount(path);
  expect(await screen.findByText('Your account does not have permission to access this page.')).toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});

it.each(ROLE_CODES)('allows %s to reach the API-backed notification center from the header', async (role) => {
  auth.user.roles = [role];
  mount('/dashboard');
  fireEvent.click(await screen.findByRole('button', { name: /^Notifications$/ }));
  expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
  expect(await screen.findByText('No matching notifications')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('/api/notifications/unread-count', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
