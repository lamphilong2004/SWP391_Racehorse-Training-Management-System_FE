import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from './router';

const auth = vi.hoisted(() => ({
  status: 'anonymous', user: { id: 13, fullName: 'Fixture Rider', roles: ['WORK_RIDER'], accountStatus: 'ACTIVE' },
  handleApiError: vi.fn(() => false), logout: vi.fn(),
}));
vi.mock('../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));

const canonicalEntries = ['/training/my-sessions', '/training/my-rides', '/training/rides/assigned',
  '/training/rides/history', '/training/rides/42', '/training/rides/42/start',
  '/training/rides/42/execute', '/training/rides/42/feedback'];
function mount(path: string) {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => { auth.status = 'anonymous'; auth.user.roles = ['WORK_RIDER']; });

it.each(canonicalEntries)('requires normal authentication at canonical entry %s', async (path) => {
  const router = mount(path);
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
});

it.each(canonicalEntries)('denies an unrelated authenticated role at %s', async (path) => {
  auth.status = 'authenticated'; auth.user.roles = ['HORSE_OWNER'];
  const router = mount(path);
  expect(await screen.findByText('Tài khoản của bạn không có quyền truy cập trang này.')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe(path);
});

it.each(['/training/rides/invalid', '/training/rides/invalid/execute', '/training/rides/invalid/feedback'])(
  'routes an authenticated Rider to safe invalid-ID state at %s', async (path) => {
    auth.status = 'authenticated';
    mount(path);
    expect(await screen.findByText('Không tìm thấy lượt cưỡi', { exact: true })).toBeInTheDocument();
  },
);
