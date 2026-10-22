import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';
import { AuthProvider } from '../shared/auth/AuthProvider';

function renderAt(path: string, includeDevRoutes = true) {
  const router = createMemoryRouter(buildRoutes(includeDevRoutes), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return router;
}

describe('router', () => {
  it('redirects / to the dev component gallery in development', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Racehorse Ops Design System' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dev/components');
  });

  it('opens the public Landing page at / in production and links both ways with Login', async () => {
    const router = renderAt('/', false);
    expect(await screen.findByRole('heading', { name: /Precision in/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Access the Platform/ })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByText('No public sign-up', { exact: false })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    router.navigate('/login');
    expect(await screen.findByRole('link', { name: /Back to overview/ })).toHaveAttribute('href', '/');
  });

  it('renders the dev shell preview for a valid role', async () => {
    renderAt('/dev/shell/VETERINARIAN');
    expect(await screen.findByText('Veterinary Workspace')).toBeInTheDocument();
  });

  it('falls back to not found for unknown roles', async () => {
    renderAt('/dev/shell/SYSTEM');
    expect(await screen.findByText('Page not found.')).toBeInTheDocument();
  });

  it('does not register the dev-only routes in production', async () => {
    const paths = buildRoutes(false).map((route) => route.path);
    expect(paths).toEqual(['/', '/login', '/dashboard', '/admin/audit-log', '/account', '/admin/users', '/admin/users/new', '/admin/users/:id/edit', '/admin/roles', '/notifications', '/register', '/admin/registrations', '/owner/horses', '/owner/horses/:horseId', '/my-horses', '/my-horses/:id', undefined, '/training/programs/new', '/training/templates',
      '/horses/:id/baseline', '/medical/restrictions', '/training/monitoring', '/training/programs/assigned', '/training/schedule', '/training/calendar', '/training/exercise-library', '/training/exercise-library/new', '/training/exercises',
      '/training/programs/:id', '/training/session/:id', '/training/schedule/session/new',
      '/training/sessions/:id/evaluation', '/training/performance', '/groom/today', '/training/my-sessions/:id/pre-check',
      '/rider', '/rider/assignments', '/rider/assignments/:id', '/rider/assignments/:id/start', '/rider/sessions/:id/active', '/rider/sessions/:id/feedback', '/rider/history',
      '/training/my-sessions', '/training/my-rides', '/training/rides/assigned', '/training/rides/history', '/training/rides/:id', '/training/rides/:id/start', '/training/rides/:id/execute', '/training/rides/:id/feedback',
      '/rides', '/rides/assignments', '/rides/history', '/rides/report-issue', '/medical', '/medical/cases/new', '/medical/cases/:caseId', '/medical/cases/:caseId/treatment-plan', '/medical/herd-health', '/medical/summary', '/care/tasks', '/medical/my-tasks', '/incidents', '/incidents/:incidentId',
      '/training/programs', '*']);
    const router = renderAt('/dev/components', false);
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});
