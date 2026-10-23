import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { authSession } from '../shared/auth/authSession';
import { type AuthApi } from '../shared/auth/authApi';
import { ROLE_CODES, type RoleCode } from '../shared/auth/roles';
import { sampleUser } from '../shared/data/sampleStore';
import { NAVIGATION } from '../layout/navigation';

function mount(role: RoleCode, path = '/dashboard', signedIn = true) {
  if (signedIn) authSession.save('test-only-integration', 3600, false);
  const api: AuthApi = { currentUser: vi.fn().mockResolvedValue(sampleUser(role)), login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) };
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider api={api}><RouterProvider router={router} /></AuthProvider>);
  return router;
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(ROLE_CODES)('retains the intended dashboard for %s', async (role) => {
  mount(role);
  expect(await screen.findByRole('heading', { name: role === 'CLUB_MANAGER' ? 'Tổng quan Club Manager' : role === 'TRAINER' ? 'Tổng quan Trainer' : NAVIGATION[role].workspaceLabel })).toBeInTheDocument();
  if (role === 'CLUB_MANAGER') {
    expect(await screen.findByRole('link', { name: 'Xem danh sách ngựa' })).toHaveAttribute('href', '/horses');
    expect(screen.getByRole('link', { name: 'Xem ngựa chờ kích hoạt' })).toHaveAttribute('href', '/horses/pending-activation');
    expect(screen.getByRole('link', { name: 'Sự cố chưa xử lý xong' })).toHaveAttribute('href', '/incidents');
    expect(screen.queryByRole('link', { name: 'Tạo người dùng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Management Reports' })).not.toBeInTheDocument();
  }
});

it('navigates dashboard to real read-only audit and back, retaining query pagination', async () => {
  const router = mount('CLUB_MANAGER');
  fireEvent.click(await screen.findByRole('link', { name: /^Xem nhật ký hệ thống$/ }));
  expect(await screen.findByRole('heading', { name: /Nhật ký hệ thống/ })).toBeInTheDocument();
  expect(await screen.findByText('Sample session snapshot: SES-0043 · COMPLETED')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/admin/audit-log');
  await act(() => router.navigate('/admin/audit-log?page=0&size=1'));
  expect(await screen.findByText(/hiển thị 1–1 trên/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Sau$/ }));
  expect(await screen.findByText(/hiển thị 2–2 trên/)).toBeInTheDocument();
  expect(router.state.location.search).toContain('page=1');
  fireEvent.click(screen.getByRole('link', { name: '← Tổng quan' }));
  expect(await screen.findByRole('heading', { name: 'Tổng quan Club Manager' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each(ROLE_CODES.filter((role) => role !== 'CLUB_MANAGER'))('denies %s audit before transport', async (role) => {
  mount(role, '/admin/audit-log');
  expect(await screen.findByText('Tài khoản của bạn không có quyền truy cập trang này.')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['/dashboard', '/admin/audit-log'])('redirects anonymous %s through the canonical login', async (path) => {
  const router = mount('CLUB_MANAGER', path, false);
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
});
