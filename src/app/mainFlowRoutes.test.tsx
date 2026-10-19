import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';

const auth = vi.hoisted(() => ({ status: 'authenticated', user: { id: 2, fullName: 'Route Tester', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' } }));
vi.mock('../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('../features/baseline/BaselinePage', () => ({ BaselinePage: () => <h1>Baseline feature</h1> }));
vi.mock('../features/trainer-session/CreateSessionPage', () => ({ CreateSessionPage: () => <h1>Create session feature</h1> }));
vi.mock('../features/trainer-session/SessionDetailPage', () => ({ SessionDetailPage: () => <h1>Session detail feature</h1> }));
vi.mock('../features/restrictions/RestrictionsPage', () => ({ RestrictionsPage: () => <h1>Restriction feature</h1> }));
vi.mock('../features/live-monitoring/LiveMonitoringPage', () => ({ LiveMonitoringPage: () => <h1>Monitoring feature</h1> }));
it.each([
  ['/horses/7/baseline', 'VETERINARIAN', 'Baseline feature'],
  ['/training/schedule/session/new', 'TRAINER', 'Create session feature'],
  ['/training/session/42', 'HEAD_TRAINER', 'Session detail feature'],
  ['/medical/restrictions', 'VETERINARIAN', 'Restriction feature'],
  ['/medical/restrictions', 'TRAINER', 'Restriction feature'],
  ['/training/monitoring?sessionId=42', 'HEAD_TRAINER', 'Monitoring feature'],
])('mounts the real feature entry at %s for %s', async (path, role, heading) => {
  auth.user.roles = [role]; render(<RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} />);
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
});
it.each(['/horses/7/baseline', '/training/schedule/session/new', '/training/session/42', '/medical/restrictions', '/training/monitoring?sessionId=42'])('blocks Groom before mounting %s', async (path) => {
  auth.user.roles = ['GROOM']; render(<RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} />);
  expect(await screen.findByText('Your account does not have permission to access this page.')).toBeInTheDocument();
});
