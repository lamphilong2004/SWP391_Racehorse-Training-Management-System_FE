import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../app/router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { roleTestAuthApi } from './roleTestAuthApi';
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import { NAVIGATION } from '../layout/navigation';
import { authSession } from '../shared/auth/authSession';
import { requestApi } from '../shared/auth/authApi';

vi.mock('./stagingMode', () => ({ ROLE_TEST_LOGIN: true }));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubEnv('MODE', 'staging-preview'); vi.stubEnv('VITE_ROLE_TEST_LOGIN', 'true');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('A test identity must never reach the network')));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function mount(path = '/login') {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider api={roleTestAuthApi}><RouterProvider router={router} /></AuthProvider>);
  return router;
}
async function enter(role: RoleCode) {
  const button = await screen.findByRole('button', { name: ROLE_LABELS[role] });
  await act(async () => { fireEvent.click(button); });
  await act(async () => { await vi.dynamicImportSettled(); });
}

it.each(ROLE_CODES)('opens the %s workspace without credentials, network or sample data', async (role) => {
  mount();
  expect(await screen.findByRole('heading', { name: 'Đăng nhập thử theo vai trò' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Mật khẩu')).not.toBeInTheDocument();
  await enter(role);
  expect(await screen.findByRole('heading', { name: role === 'CLUB_MANAGER' ? 'Tổng quan Club Manager' : role === 'TRAINER' ? 'Tổng quan Trainer' : NAVIGATION[role].workspaceLabel })).toBeInTheDocument();
  expect(screen.getByText('Đăng nhập thử được bảo vệ — chỉ để xem giao diện')).toBeInTheDocument();
  expect(authSession.read()?.accessToken).toBe(`role-test:${role}`);
  expect(localStorage.getItem('racehorse.auth.local.v1')).toBeNull();
  expect(sessionStorage.getItem('racehorse.auth.session.v1')).toBeNull();
  expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('shows an explicit server-unavailable state instead of records, and never writes a sample store', async () => {
  mount('/horses'); await enter('CLUB_MANAGER');
  expect(await screen.findByText(/Không thực hiện được thao tác: đăng nhập thử không có quyền truy cập máy chủ\. Hãy đăng nhập bằng tài khoản thật khi hệ thống sẵn sàng\./)).toBeInTheDocument();
  expect(screen.queryByText('Thunder Bolt')).not.toBeInTheDocument();
  expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects every API call made with a test identity before it can reach the backend', async () => {
  for (const path of ['/api/horses', '/api/auth/me', '/api/medical/cases/1']) {
    await expect(requestApi(path, { method: 'GET' }, { token: 'role-test:VETERINARIAN' })).rejects.toMatchObject({ status: 503, code: 'SERVER_UNAVAILABLE' });
  }
  await expect(requestApi('/api/horses', { method: 'POST', body: '{}' }, { token: 'role-test:CLUB_MANAGER' })).rejects.toMatchObject({ status: 503 });
  expect(fetch).not.toHaveBeenCalled();
});

it('keeps role boundaries and returns to the entry after sign-out', async () => {
  const router = mount(); await enter('GROOM');
  await screen.findByRole('heading', { name: 'Không gian Groom' });
  await act(() => router.navigate('/admin/audit-log'));
  expect(await screen.findByText('Tài khoản của bạn không có quyền truy cập trang này.')).toBeInTheDocument();
  await act(() => router.navigate('/dashboard'));
  fireEvent.click(await screen.findByRole('button', { name: 'Menu tài khoản' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
  expect(await screen.findByRole('heading', { name: 'Đăng nhập thử theo vai trò' })).toBeInTheDocument();
  expect(authSession.read()).toBeNull();
});
