import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';
import { AuthProvider } from '../shared/auth/AuthContext';

function renderAt(path: string, includeDevRoutes = true) {
  const router = createMemoryRouter(buildRoutes(includeDevRoutes), { initialEntries: [path] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

describe('router', () => {
  // DEMO INTEGRATION: "/" now resolves to the role landing; anonymous users land on /login.
  it('redirects / to sign-in when not authenticated', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('renders the dev component gallery in development', async () => {
    renderAt('/dev/components');
    expect(await screen.findByRole('heading', { name: 'Racehorse Ops Design System' })).toBeInTheDocument();
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
    expect(paths).not.toContain('/dev/components');
    expect(paths).not.toContain('/dev/shell/:role');
    renderAt('/dev/components', false);
    expect(await screen.findByText('Page not found.')).toBeInTheDocument();
  });
});
