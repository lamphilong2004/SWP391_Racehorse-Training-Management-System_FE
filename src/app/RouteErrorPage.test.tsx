import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RouteErrorPage } from './RouteErrorPage';
import { buildRoutes } from './router';

function Thrower({ message }: { message: string }): never { throw new Error(message); }
function mount(message: string) {
  const router = createMemoryRouter([{ path: '/', element: <Thrower message={message} />, errorElement: <RouteErrorPage /> }]);
  render(<RouterProvider router={router} />);
}
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); });

it('explains a stale or failed screen chunk and offers reload without developer details', async () => {
  mount('Unable to preload CSS for /assets/rider-Duvd6XO3.css');
  expect(await screen.findByText('This screen could not load')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
  expect(screen.queryByText(/rider-Duvd6XO3/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
});
it('shows a generic recoverable state for other render failures without the error text', async () => {
  mount('secret internal detail');
  expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
});
it('protects every top-level application route with the recoverable error boundary', () => {
  for (const route of buildRoutes(false)) expect(route.errorElement).toBeTruthy();
});
