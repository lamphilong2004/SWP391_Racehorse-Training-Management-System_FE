import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('router', () => {
  it('redirects / to the design system reference', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Racehorse Ops Design System' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/design-system');
  });

  it('renders the shell preview for a valid role', async () => {
    renderAt('/design-system/shell/VETERINARIAN');
    expect(await screen.findByText('Veterinary Workspace')).toBeInTheDocument();
  });

  it('falls back to not found for unknown roles and paths', async () => {
    renderAt('/design-system/shell/SYSTEM');
    expect(await screen.findByText('Page not found.')).toBeInTheDocument();
  });
});
