import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';
import { ROLE_CODES } from '../shared/auth/roles';
import { fireEvent } from '@testing-library/react';
import { NotificationsProvider } from '../shared/notifications/NotificationsProvider';
import { authSession } from '../shared/auth/authSession';

const auth = vi.hoisted(() => ({
  status: 'authenticated', user: { id: 7, fullName: 'Fixture User', roles: ['HEAD_TRAINER'], accountStatus: 'ACTIVE' },
  handleApiError: vi.fn(() => false), logout: vi.fn(), expiresAt: 0,
}));
vi.mock('../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
const request = vi.hoisted(() => vi.fn(async (path: string) => {
  if (path.startsWith('/api/admin/users')) return { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 };
  if (path === '/api/admin/roles') return [{ roleCode: 'CLUB_MANAGER', displayName: 'Club Manager', scoping: 'Club administration' }];
  if (path.startsWith('/api/notifications?')) return { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 };
  if (path === '/api/notifications/unread-count') return { unread: 0 };
  throw new Error(`Unexpected fixture request: ${path}`);
}));
vi.mock('../features/main-flows/api', async (load) => ({ ...await load<object>(), useFlowRequest: () => request }));

const pending = [
  ['/admin/users', 'CLUB_MANAGER', 'Nhân sự & người dùng'],
  ['/admin/roles', 'CLUB_MANAGER', 'Vai trò & quyền hạn'],
] as const;

function mount(path: string) {
  render(<NotificationsProvider><RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} /></NotificationsProvider>);
}
beforeEach(() => {
  auth.status = 'authenticated'; request.mockClear();
  auth.expiresAt = authSession.save('fixture-router-jwt', 3600, false).expiresAt;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url) => {
    const parsed = new URL(String(url));
    return new Response(JSON.stringify({ success: true, data: await request(parsed.pathname + parsed.search) }), { status: 200 });
  }));
});
afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); });

it.each(pending)('mounts its API-backed required screen at %s', async (path, role, title) => {
  auth.user.roles = [role];
  mount(path);
  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  expect((await screen.findAllByRole('table')).length).toBe(path === '/admin/users' ? 1 : 2);
  expect(request).toHaveBeenCalledWith(expect.stringContaining(path === '/admin/users' ? '/api/admin/users?' : '/api/admin/roles'), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(screen.queryByText('Màn hình này chưa có trong phiên bản hiện tại.')).not.toBeInTheDocument();
});

it.each(pending)('keeps role boundaries on the unavailable route %s', async (path) => {
  auth.user.roles = ['GROOM'];
  mount(path);
  expect(await screen.findByText('Tài khoản của bạn không có quyền truy cập trang này.')).toBeInTheDocument();
  expect(request.mock.calls.every(([path]) => path === '/api/notifications/unread-count')).toBe(true);
});

it.each(ROLE_CODES)('allows %s to reach the API-backed notification center from the header', async (role) => {
  auth.user.roles = [role];
  mount('/dashboard');
  fireEvent.click(await screen.findByRole('button', { name: /^Thông báo(?:, đang kiểm tra số chưa đọc)?$/ }));
  const drawer = await screen.findByRole('dialog', { name: 'Thông báo' });
  expect(await within(drawer).findByRole('heading', { name: 'Thông báo', level: 2 })).toBeInTheDocument();
  expect(await within(drawer).findByText('Không có thông báo phù hợp')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('/api/notifications/unread-count');
});
