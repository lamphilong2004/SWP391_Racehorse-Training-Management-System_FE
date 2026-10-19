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
    expect(paths).toEqual(['/', '/login', '/dashboard', '/admin/audit-log', '/account', '/register', '/admin/registrations', '/owner/horses', '/owner/horses/:horseId', '/my-horses', '/my-horses/:id', undefined, '/training/programs/new',
      '/horses/:id/baseline', '/medical/restrictions', '/training/monitoring', '/training/programs/assigned', '/training/schedule', '/training/calendar', '/training/exercise-library', '/training/exercise-library/new', '/training/exercises',
      '/training/programs/:id', '/training/session/:id', '/training/schedule/session/new',
      '/training/sessions/:id/evaluation', '/training/performance', '/groom/today', '/training/my-sessions/:id/pre-check',
      '/rider', '/rider/assignments', '/rider/assignments/:id', '/rider/assignments/:id/start', '/rider/sessions/:id/active', '/rider/sessions/:id/feedback', '/rider/history',
      '/training/my-sessions', '/training/my-rides', '/training/rides/assigned', '/training/rides/history', '/training/rides/:id', '/training/rides/:id/start', '/training/rides/:id/execute', '/training/rides/:id/feedback',
      '/rides', '/rides/assignments', '/rides/history', '/rides/report-issue', '/medical', '/medical/cases/new', '/medical/cases/:caseId', '/medical/cases/:caseId/treatment-plan', '/medical/herd-health', undefined, undefined,
      '/training/programs', '/training/templates', '/medical/summary',
      '/admin/users', '/admin/roles', '/notifications', '*']);
    const router = renderAt('/dev/components', false);
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});
