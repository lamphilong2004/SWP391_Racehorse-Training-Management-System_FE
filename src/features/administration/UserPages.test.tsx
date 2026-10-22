import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { UserEditorPage } from './UserPages';

const request = vi.hoisted(() => vi.fn());
vi.mock('../main-flows/api', async (load) => ({ ...await load<object>(), useFlowRequest: () => request }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 1, fullName: 'Manager fixture', roles: ['CLUB_MANAGER'] }, handleApiError: vi.fn() }) }));
function mount(path = '/admin/users/new') {
  const router = createMemoryRouter([
    { path: '/admin/users/new', element: <UserEditorPage /> },
    { path: '/admin/users/:id/edit', element: <UserEditorPage /> },
    { path: '/admin/users', element: <h1>Accounts listing</h1> },
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => { request.mockReset(); });
it('submits once, waits for server success and leaves without a false unsaved dialog', async () => {
  let complete!: (value: unknown) => void;
  request.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  mount(); const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/Full name/), 'New Account');
  await user.type(screen.getByLabelText(/^Email/), 'account@example.test');
  const form = screen.getByRole('button', { name: 'Create User' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({ method: 'POST', body: expect.not.stringContaining('password') }));
  expect(screen.queryByText('Accounts listing')).not.toBeInTheDocument();
  complete({ id: 42 });
  expect(await screen.findByRole('heading', { name: 'Accounts listing' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument();
});
it('preserves fields and permits a real retry after a failed write', async () => {
  request.mockRejectedValueOnce(new Error('Backend unavailable')).mockResolvedValueOnce({ id: 42 });
  mount(); const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/Full name/), 'Retry Account');
  await user.type(screen.getByLabelText(/^Email/), 'retry@example.test');
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  expect(await screen.findByText('Backend unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText(/Full name/)).toHaveValue('Retry Account');
  expect(screen.getByLabelText(/^Email/)).toHaveValue('retry@example.test');
  expect(screen.queryByText('Accounts listing')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Create User' }));
  expect(await screen.findByRole('heading', { name: 'Accounts listing' })).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
});
it('does not issue business requests for an invalid user ID', async () => {
  mount('/admin/users/not-an-id/edit');
  await waitFor(() => expect(screen.getByText('Invalid user ID')).toBeInTheDocument());
  expect(request).not.toHaveBeenCalled();
});
