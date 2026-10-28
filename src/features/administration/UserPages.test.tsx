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
  await user.type(await screen.findByLabelText(/Họ và tên/), 'New Account');
  await user.type(screen.getByLabelText(/^Email/), 'account@example.test');
  await user.type(screen.getByLabelText(/^Mật khẩu/), 'Start1234'); await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), 'Start1234');
  const form = screen.getByRole('button', { name: 'Tạo người dùng' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(request).toHaveBeenCalledTimes(1);
  // DEC-012: the Club Manager sets the initial password; it is sent once with its confirmation.
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ password: 'Start1234', confirmPassword: 'Start1234' });
  expect(screen.queryByText('Accounts listing')).not.toBeInTheDocument();
  complete({ id: 42 });
  expect(await screen.findByRole('heading', { name: 'Accounts listing' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Thay đổi chưa lưu' })).not.toBeInTheDocument();
});
it('preserves fields and permits a real retry after a failed write', async () => {
  request.mockRejectedValueOnce(new Error('Backend unavailable')).mockResolvedValueOnce({ id: 42 });
  mount(); const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/Họ và tên/), 'Retry Account');
  await user.type(screen.getByLabelText(/^Email/), 'retry@example.test');
  await user.type(screen.getByLabelText(/^Mật khẩu/), 'Start1234'); await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), 'Start1234');
  await user.click(screen.getByRole('button', { name: 'Tạo người dùng' }));
  expect(await screen.findByText('Backend unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText(/Họ và tên/)).toHaveValue('Retry Account');
  expect(screen.getByLabelText(/^Email/)).toHaveValue('retry@example.test');
  expect(screen.queryByText('Accounts listing')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Tạo người dùng' }));
  expect(await screen.findByRole('heading', { name: 'Accounts listing' })).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
});
it('does not issue business requests for an invalid user ID', async () => {
  mount('/admin/users/not-an-id/edit');
  await waitFor(() => expect(screen.getByText('Mã người dùng không hợp lệ')).toBeInTheDocument());
  expect(request).not.toHaveBeenCalled();
});
it('edits Trainer experience and specializations with the role-matched skill list', async () => {
  const trainer = { id: 5, userCode: 'TR-5', fullName: 'Demo TRAINER', email: 'trainer@example.test', roles: ['TRAINER'], accountStatus: 'ACTIVE', lastLoginAt: null,
    experienceYears: 3, experienceLevel: 'Mid', skills: [{ id: 2, name: 'Endurance', kind: 'TRAINER_SPECIALIZATION' }] };
  request.mockImplementation(async (path: string, init?: RequestInit) => path === '/api/admin/users/5' ? (init?.method === 'PUT' ? trainer : trainer)
    : path === '/api/admin/skills?kind=TRAINER_SPECIALIZATION' ? [{ id: 1, name: 'Sprint', kind: 'TRAINER_SPECIALIZATION' }, { id: 2, name: 'Endurance', kind: 'TRAINER_SPECIALIZATION' }] : undefined);
  mount('/admin/users/5/edit'); const user = userEvent.setup();
  expect(await screen.findByRole('checkbox', { name: 'Endurance' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'Sprint' }));
  await user.clear(screen.getByLabelText('Kinh nghiệm (năm)')); await user.type(screen.getByLabelText('Kinh nghiệm (năm)'), '5');
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/admin/users/5', expect.objectContaining({ method: 'PUT' })));
  const body = JSON.parse(request.mock.calls.find(([path, init]) => path === '/api/admin/users/5' && init?.method === 'PUT')![1].body);
  expect(body).toMatchObject({ roleCode: 'TRAINER', experienceYears: 5, experienceLevel: 'Mid', skillIds: [2, 1] });
});
it('sends no skills or experience for a Horse Owner and clears skills on a role change', async () => {
  request.mockResolvedValue([]);
  mount(); const user = userEvent.setup();
  await user.click(await screen.findByRole('radio', { name: 'Horse Owner' }));
  expect(screen.queryByText('Kinh nghiệm & kỹ năng')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText(/Họ và tên/), 'Owner Account'); await user.type(screen.getByLabelText(/^Email/), 'owner@example.test');
  await user.type(screen.getByLabelText(/^Mật khẩu/), 'Start1234'); await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), 'Start1234');
  await user.click(screen.getByRole('button', { name: 'Tạo người dùng' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/admin/users', expect.anything()));
  expect(JSON.parse(request.mock.calls.find(([path]) => path === '/api/admin/users')![1].body)).toMatchObject({ roleCode: 'HORSE_OWNER', experienceYears: null, experienceLevel: null, skillIds: [] });
});
it('requires a valid matching password before creating a user', async () => {
  mount(); const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/Họ và tên/), 'No Password'); await user.type(screen.getByLabelText(/^Email/), 'nopass@example.test');
  await user.type(screen.getByLabelText(/^Mật khẩu/), 'short'); await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), 'short');
  await user.click(screen.getByRole('button', { name: 'Tạo người dùng' }));
  expect(await screen.findByText('Mật khẩu 8–64 ký tự, có chữ và số, không trùng email.')).toBeInTheDocument();
  await user.clear(screen.getByLabelText(/^Mật khẩu/)); await user.clear(screen.getByLabelText(/^Nhập lại mật khẩu/));
  await user.type(screen.getByLabelText(/^Mật khẩu/), 'Start1234'); await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), 'Start9999');
  await user.click(screen.getByRole('button', { name: 'Tạo người dùng' }));
  expect(await screen.findByText('Mật khẩu nhập lại chưa khớp.')).toBeInTheDocument();
  expect(request).not.toHaveBeenCalledWith('/api/admin/users', expect.anything());
});
