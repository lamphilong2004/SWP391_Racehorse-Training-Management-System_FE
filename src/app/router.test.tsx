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
  it('opens the authenticated app from / in development', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('keeps the component gallery available at its explicit dev route', async () => {
    const router = renderAt('/dev/components');
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
    expect(paths.filter((path) => path === '/incidents')).toHaveLength(1);
    expect(paths.filter((path) => path === '/incidents/:incidentId')).toHaveLength(1);
    expect(paths).not.toContain('/dev/components');
    const router = renderAt('/dev/components', false);
    expect(await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});
