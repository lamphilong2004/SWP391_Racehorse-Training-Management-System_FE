import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '../../app/router';
import { AuthProvider, useAuth } from './AuthProvider';
import { ApiError } from './authApi';
import { dashboardFixture } from '../../features/management/management.fixtures';

const user = {
  id: 12,
  userCode: 'U-012',
  fullName: 'Le Quoc Bao',
  email: 'bao@example.com',
  roles: ['HEAD_TRAINER'],
  accountStatus: 'ACTIVE',
};

function envelope(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorEnvelope(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ success: false, error: { code, message, details: [] } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ApiErrorProbe({ error }: { error: ApiError }) {
  const auth = useAuth();
  return <button onClick={() => auth.handleApiError(error)}>Handle API error</button>;
}

function renderApp(path = '/login', probe?: ReactNode) {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(
    <AuthProvider>
      {probe}
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

function savedSession(kind: 'localStorage' | 'sessionStorage', expiresAt = Date.now() + 60_000) {
  const key = kind === 'localStorage' ? 'racehorse.auth.local.v1' : 'racehorse.auth.session.v1';
  window[kind].setItem(key, JSON.stringify({ accessToken: 'fixture-jwt', expiresAt }));
  return key;
}

describe('CORE-008 auth flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('submits LoginRequest, stores the bearer response and routes into the role workspace', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      envelope({
        accessToken: 'new-jwt',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const router = renderApp();
    const actor = userEvent.setup();

    await actor.type(await screen.findByRole('textbox', { name: 'Email' }), 'bao@example.com');
    await actor.type(screen.getByLabelText('Mật khẩu'), 'correct-horse-battery');
    window.sessionStorage.setItem('racehorse.auth.session.v1', JSON.stringify({ accessToken: 'stale-session-jwt', expiresAt: Date.now() + 60_000 }));
    await actor.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('heading', { name: 'Không gian Head Trainer' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'bao@example.com', password: 'correct-horse-battery' }),
      }),
    );
    expect(window.localStorage.getItem('racehorse.auth.local.v1')).toContain('new-jwt');
    expect(window.sessionStorage.getItem('racehorse.auth.session.v1')).toBeNull();
  });

  it('stores a non-remembered login in tab session storage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => envelope({ accessToken: 'tab-jwt', tokenType: 'Bearer', expiresIn: 600, user })));
    renderApp();
    const actor = userEvent.setup();

    await actor.type(await screen.findByRole('textbox', { name: 'Email' }), 'bao@example.com');
    await actor.type(screen.getByLabelText('Mật khẩu'), 'password');
    await actor.click(screen.getByRole('checkbox', { name: 'Ghi nhớ đăng nhập' }));
    window.localStorage.setItem('racehorse.auth.local.v1', JSON.stringify({ accessToken: 'stale-local-jwt', expiresAt: Date.now() + 60_000 }));
    window.sessionStorage.setItem('racehorse.auth.session.v1', JSON.stringify({ accessToken: 'stale-session-jwt', expiresAt: Date.now() + 60_000 }));
    await actor.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await screen.findByRole('heading', { name: 'Không gian Head Trainer' });
    expect(window.localStorage.getItem('racehorse.auth.local.v1')).toBeNull();
    expect(window.sessionStorage.getItem('racehorse.auth.session.v1')).toContain('tab-jwt');
  });

  it.each([
    [401, 'UNAUTHORIZED', 'Invalid email or password.'],
    [403, 'FORBIDDEN', 'Your account is waiting for Club Manager approval.'],
    [403, 'FORBIDDEN', 'Your account is deactivated.'],
  ])('shows the contract %i login error without creating a session', async (status, code, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => errorEnvelope(status, code, message)));
    renderApp();
    const actor = userEvent.setup();

    await actor.type(await screen.findByRole('textbox', { name: 'Email' }), 'bao@example.com');
    await actor.type(screen.getByLabelText('Mật khẩu'), 'wrong-password');
    await actor.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(window.localStorage.getItem('racehorse.auth.local.v1')).toBeNull();
    expect(window.sessionStorage.getItem('racehorse.auth.session.v1')).toBeNull();
  });

  it('restores a saved session through GET /api/auth/me and uses the returned role', async () => {
    savedSession('sessionStorage');
    const fetchMock = vi.fn<typeof fetch>(async () => envelope(user));
    vi.stubGlobal('fetch', fetchMock);
    const router = renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Không gian Head Trainer' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/me',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer fixture-jwt');
  });

  it.each([
    ['CLUB_MANAGER', 'Tổng quan Club Manager', 'Nhân sự & người dùng', '/admin/users'],
    ['HEAD_TRAINER', 'Không gian Head Trainer', 'Chương trình huấn luyện ngựa', '/training/programs'],
    ['TRAINER', 'Tổng quan Trainer', 'Chương trình được giao', '/training/programs/assigned'],
    ['WORK_RIDER', 'Không gian Work Rider', 'Lượt cưỡi của tôi', '/rider'],
    ['VETERINARIAN', 'Không gian Veterinarian', 'Y tế / sức khỏe', '/medical'],
    ['GROOM', 'Không gian Groom', 'Hôm nay', '/groom/today'],
    ['HORSE_OWNER', 'Cổng thông tin Horse Owner', 'Ngựa của tôi', '/owner/horses'],
  ])('uses canonical workspace and navigation for %s', async (role, workspace, navItem, navPath) => {
    savedSession('sessionStorage');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input) => String(input).includes('/api/dashboard/club-manager') ? envelope(dashboardFixture)
      : String(input).includes('/api/horses?') ? envelope({ items: [], page: 0, size: 6, totalItems: 0, totalPages: 0 })
      : envelope({ ...user, roles: [role] })));
    renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: workspace })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: navItem })).toHaveAttribute('href', navPath);
  });

  it('expires a locally expired token without calling the backend', async () => {
    const key = savedSession('localStorage', Date.now() - 1);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const router = renderApp('/dashboard');

    expect(await screen.findByText('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears a restored session on 401 but keeps a 403 session and shows an access error', async () => {
    const expiredKey = savedSession('localStorage');
    vi.stubGlobal('fetch', vi.fn(async () => errorEnvelope(401, 'UNAUTHORIZED', 'Missing, invalid or expired JWT.')));
    const expiredRouter = renderApp('/dashboard');
    expect(await screen.findByText('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.')).toBeInTheDocument();
    expect(expiredRouter.state.location.pathname).toBe('/login');
    expect(window.localStorage.getItem(expiredKey)).toBeNull();

    cleanup();
    const forbiddenKey = savedSession('sessionStorage');
    vi.stubGlobal('fetch', vi.fn(async () => errorEnvelope(403, 'FORBIDDEN', 'Authenticated, but not allowed.')));
    renderApp('/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent('Authenticated, but not allowed.');
    expect(window.sessionStorage.getItem(forbiddenKey)).toContain('fixture-jwt');
  });

  it('clears an inactive session on /me 403 and distinguishes it from ordinary protected 403', async () => {
    const inactiveKey = savedSession('localStorage');
    vi.stubGlobal('fetch', vi.fn(async () => errorEnvelope(403, 'FORBIDDEN', 'Your account is deactivated.')));
    const inactiveRouter = renderApp('/dashboard');
    expect(await screen.findByText('Tài khoản của bạn đã bị vô hiệu hóa. Hãy đăng nhập lại để tiếp tục.')).toBeInTheDocument();
    expect(inactiveRouter.state.location.pathname).toBe('/login');
    expect(window.localStorage.getItem(inactiveKey)).toBeNull();

    cleanup();
    savedSession('sessionStorage');
    vi.stubGlobal('fetch', vi.fn(async () => envelope(user)));
    renderApp('/dashboard', <ApiErrorProbe error={new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.')} />);
    expect(await screen.findByRole('heading', { name: 'Không gian Head Trainer' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Handle API error' }));
    expect(screen.getByRole('heading', { name: 'Không gian Head Trainer' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem('racehorse.auth.session.v1')).toContain('fixture-jwt');
  });

  it('calls POST /api/auth/logout, accepts 204 without JSON and clears both storage locations', async () => {
    savedSession('localStorage');
    window.sessionStorage.setItem('racehorse.auth.session.v1', 'stale');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/auth/me')) return envelope(user);
      if (String(input).endsWith('/api/account')) return envelope({ ...user, lastLoginAt: null, experienceYears: null, experienceLevel: null, skills: [] });
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const router = renderApp('/dashboard');
    const actor = userEvent.setup();

    await actor.click(await screen.findByRole('button', { name: 'Menu tài khoản' }));
    expect(router.state.location.pathname).toBe('/account');
    await actor.click(await screen.findByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(window.localStorage.getItem('racehorse.auth.local.v1')).toBeNull();
    expect(window.sessionStorage.getItem('racehorse.auth.session.v1')).toBeNull();
  });

  it('clears client state after logout network failure and discloses server audit is unconfirmed', async () => {
    savedSession('localStorage');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/auth/me')) return envelope(user);
      if (String(input).endsWith('/api/account')) return envelope({ ...user, lastLoginAt: null, experienceYears: null, experienceLevel: null, skills: [] });
      throw new Error('network unavailable');
    });
    vi.stubGlobal('fetch', fetchMock);
    const router = renderApp('/dashboard');
    const actor = userEvent.setup();

    await actor.click(await screen.findByRole('button', { name: 'Menu tài khoản' }));
    expect(router.state.location.pathname).toBe('/account');
    await actor.click(await screen.findByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByText('Đã đăng xuất trên thiết bị này. Chưa xác nhận được việc đăng xuất trên máy chủ.')).toBeInTheDocument();
    expect(window.localStorage.getItem('racehorse.auth.local.v1')).toBeNull();
    expect(window.sessionStorage.getItem('racehorse.auth.session.v1')).toBeNull();
  });
});
