import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AccountPage } from './AccountPage';

const fixture = vi.hoisted(() => ({ request: vi.fn(), logout: vi.fn(), user: { id: 2, fullName: 'Head Trainer', roles: ['HEAD_TRAINER'], accountStatus: 'ACTIVE' } }));
vi.mock('../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: fixture.user, logout: fixture.logout }) }));
vi.mock('../features/main-flows/api', async (load) => ({ ...await load<object>(), useFlowRequest: () => fixture.request }));
vi.mock('../layout/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
const profile = { ...fixture.user, userCode: 'HT-2', email: 'head@example.test', lastLoginAt: null };
function mount() {
  const router = createMemoryRouter([{ path: '/account', element: <AccountPage /> }, { path: '/dashboard', element: <p>Workspace fixture</p> }], { initialEntries: ['/account'] });
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => { fixture.request.mockReset().mockResolvedValue(profile); fixture.logout.mockReset(); });

it('saves only the trimmed name, keeps a password draft, and guards navigation', async () => {
  fixture.request.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'PUT' ? { ...profile, fullName: 'Updated name' } : profile);
  const router = mount();
  fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: '  Updated name  ' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'TestOnly123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  expect(await screen.findByText(/Đã lưu hồ sơ/)).toBeInTheDocument();
  expect(fixture.request).toHaveBeenCalledWith('/api/account', { method: 'PUT', body: JSON.stringify({ fullName: 'Updated name' }) });
  expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('TestOnly123');
  expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toBeDisabled();
  await act(async () => { await router.navigate('/dashboard'); });
  expect(screen.getByRole('dialog', { name: 'Thay đổi chưa lưu' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('TestOnly123');
});

it('retains profile input when saving fails without showing success', async () => {
  fixture.request.mockImplementation(async (_path: string, init?: RequestInit) => { if (init?.method === 'PUT') throw new Error('Profile unavailable'); return profile; });
  mount(); fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Draft name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  expect(await screen.findByText('Profile unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText('Họ và tên')).toHaveValue('Draft name');
  expect(screen.queryByText(/Đã lưu hồ sơ/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
});

it('rejects a mismatched password before sending any write', async () => {
  mount(); await screen.findByLabelText('Họ và tên');
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'OldTestOnly123' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'NewTestOnly123' } });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'Different123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
  expect(await screen.findByText(/Mật khẩu phải trùng khớp/)).toBeInTheDocument();
  expect(fixture.request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
});

it('keeps password fields on server failure and clears them only after a confirmed retry', async () => {
  let succeed = false;
  fixture.request.mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method !== 'PUT') return profile;
    if (!succeed) throw new Error('Current password incorrect');
  });
  mount(); await screen.findByLabelText('Họ và tên');
  for (const [label, value] of [['Mật khẩu hiện tại', 'OldTestOnly123'], ['Mật khẩu mới', 'NewTestOnly123'], ['Nhập lại mật khẩu mới', 'NewTestOnly123']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
  expect(await screen.findByText('Current password incorrect')).toBeInTheDocument();
  expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('NewTestOnly123');
  succeed = true; fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
  expect(await screen.findByText('Đã đổi mật khẩu.')).toBeInTheDocument();
  expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveValue('');
  expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('');
  expect(screen.getByLabelText('Nhập lại mật khẩu mới')).toHaveValue('');
});
