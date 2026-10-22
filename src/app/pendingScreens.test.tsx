import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';
import { ROLE_CODES } from '../shared/auth/roles';
import { fireEvent } from '@testing-library/react';

const auth = vi.hoisted(() => ({
  status: 'authenticated', user: { id: 7, fullName: 'Fixture User', roles: ['HEAD_TRAINER'], accountStatus: 'ACTIVE' },
  handleApiError: vi.fn(() => false), logout: vi.fn(),
}));
vi.mock('../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));

const pending = [
  ['/training/templates', 'HEAD_TRAINER', 'Program Templates'],
  ['/admin/users', 'CLUB_MANAGER', 'Staff & Users'],
  ['/admin/roles', 'CLUB_MANAGER', 'Roles & Permissions'],
] as const;

function mount(path: string) {
  render(<RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} />);
}
beforeEach(() => { auth.status = 'authenticated'; });

it.each(pending)('shows an explicit unavailable state instead of a 404 at %s', async (path, role, title) => {
  auth.user.roles = [role];
  mount(path);
  expect(await screen.findByText(`${title} unavailable`)).toBeInTheDocument();
  expect(screen.getByText('This screen is not available in this build.')).toBeInTheDocument();
  const main = screen.getByRole('main');
  expect(within(main).queryByRole('button')).not.toBeInTheDocument();
  expect(within(main).getByRole('link', { name: 'Back to workspace' })).toHaveAttribute('href', '/dashboard');
});

it.each(pending)('keeps role boundaries on the unavailable route %s', async (path) => {
  auth.user.roles = ['GROOM'];
  mount(path);
  expect(await screen.findByText('Your account does not have permission to access this page.')).toBeInTheDocument();
});

it.each(ROLE_CODES)('allows %s to reach its explicit notification handoff from the header', async (role) => {
  auth.user.roles = [role];
  mount('/dashboard');
  fireEvent.click(await screen.findByRole('button', { name: /^Notifications$/ }));
  expect(await screen.findByText('Notifications unavailable', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to workspace' })).toHaveAttribute('href', '/dashboard');
});
