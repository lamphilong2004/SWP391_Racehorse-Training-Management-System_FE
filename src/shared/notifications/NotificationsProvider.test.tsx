import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { authSession } from '../auth/authSession';
import type { AuthApi, CurrentUser } from '../auth/authApi';
import { ROLE_CODES } from '../auth/roles';
import { NotificationsProvider, useNotifications } from './NotificationsProvider';
import { AppShell } from '../../layout/AppShell';
import { NotificationsPage } from '../../features/administration/NotificationsPage';

const first: CurrentUser = { id: 1, userCode: 'FIX-1', fullName: 'First fixture', email: 'first@example.test', roles: ['CLUB_MANAGER'], accountStatus: 'ACTIVE' };
const second: CurrentUser = { ...first, id: 2, userCode: 'FIX-2', fullName: 'Second fixture', email: 'second@example.test' };
const notice = { id: 11, category: 'ALERTS', notificationType: 'FIXTURE', title: 'Fixture notice', message: 'Test-only message',
  readAt: null as string | null, targetType: null, targetId: null, isSimulated: false, createdAt: '2026-10-22T01:00:00Z' };
const page = (items = [notice]) => ({ items, page: 0, size: 20, totalItems: items.length, totalPages: items.length ? 1 : 0 });
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = (status: number, message = 'Fixture failure') => new Response(JSON.stringify({ success: false, error: {
  code: status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message, details: [],
} }), { status });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
const pathOf = (url: RequestInfo | URL) => new URL(String(url), 'http://localhost:8080').pathname;

function Harness() {
  const auth = useAuth(), notifications = useNotifications();
  return <>
    <button onClick={() => { void auth.login('first', 'fixture-only', false); }}>Sign in first</button>
    <button onClick={() => { void auth.login('second', 'fixture-only', false); }}>Switch account</button>
    <button onClick={() => { void auth.logout(); }}>Sign out fixture</button>
    <button onClick={() => { void notifications?.refresh(); }}>Refresh count fixture</button>
    {auth.status === 'authenticated' && auth.user ? <Routes>
      <Route path="/" element={<AppShell unreadCount={88} user={{ fullName: auth.user.fullName, role: auth.user.roles[0] }} breadcrumb={[]}>
        <Link to="/notifications">Open center fixture</Link><p>Workspace fixture</p>
      </AppShell>} />
      <Route path="/notifications" element={<NotificationsPage />} />
    </Routes> : <p>Signed out fixture</p>}
  </>;
}
function mount(actor = first, strict = false) {
  const api: AuthApi = {
    login: vi.fn<AuthApi['login']>(async ({ email }) => ({ accessToken: email === 'second' ? 'fixture-second-jwt' : 'fixture-first-jwt', tokenType: 'Bearer', expiresIn: 3600, user: email === 'second' ? second : actor })),
    currentUser: vi.fn(async () => actor), logout: vi.fn(async () => undefined),
  };
  const root = <AuthProvider api={api}><NotificationsProvider><MemoryRouter><Harness /></MemoryRouter></NotificationsProvider></AuthProvider>;
  const rendered = render(strict ? <StrictMode>{root}</StrictMode> : root);
  return { ...rendered, api };
}
async function signIn() { await userEvent.click(await screen.findByRole('button', { name: 'Sign in first' })); }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

it.each(ROLE_CODES)('loads the real unread endpoint for %s without trusting an AppShell prop', async (role) => {
  const fetcher = vi.fn<typeof fetch>(async () => ok({ unread: 3 })); vi.stubGlobal('fetch', fetcher);
  mount({ ...first, roles: [role] });
  expect(fetcher).not.toHaveBeenCalled();
  await signIn();
  expect(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
  expect(screen.queryByText('88')).not.toBeInTheDocument();
  expect(pathOf(fetcher.mock.calls[0][0]!)).toBe('/api/notifications/unread-count');
});

it('synchronizes center and header only after confirmed read and read-all, then reads the authoritative count', async () => {
  let count = 3, readAt: string | null = null;
  const mutation = deferred<Response>();
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    const path = pathOf(url);
    if (path.endsWith('/unread-count')) return ok({ unread: count });
    if (path.endsWith('/11/read')) return mutation.promise;
    if (path.endsWith('/read-all')) { count = 0; return ok({ unread: 0 }); }
    if (path === '/api/notifications') return ok(page([{ ...notice, readAt }]));
    throw new Error(`Unexpected fixture endpoint ${path} ${init?.method}`);
  });
  vi.stubGlobal('fetch', fetcher); mount(); await signIn();
  await screen.findByRole('button', { name: 'Notifications, 3 unread' });
  await userEvent.click(screen.getByRole('link', { name: 'Open center fixture' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as read' }));
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Notifications, 2 unread' })).not.toBeInTheDocument();
  count = 2; readAt = '2026-10-22T02:00:00Z';
  await act(async () => mutation.resolve(ok({ ...notice, readAt })));
  expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
  expect(await screen.findByText('2 unread')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
  expect(await screen.findByText('0 unread')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url, init]) => pathOf(url).endsWith('/11/read') && init?.method === 'PATCH')).toBe(true);
  expect(fetcher.mock.calls.some(([url, init]) => pathOf(url).endsWith('/read-all') && init?.method === 'POST')).toBe(true);
  expect(fetcher.mock.calls.filter(([url]) => pathOf(url).endsWith('/unread-count')).length).toBeGreaterThanOrEqual(3);
});

it('updates the shared header after a drawer mutation', async () => {
  let count = 1, readAt: string | null = null;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url) => {
    if (pathOf(url).endsWith('/unread-count')) return ok({ unread: count });
    if (pathOf(url).endsWith('/11/read')) { count = 0; readAt = '2026-10-22T02:00:00Z'; return ok({ ...notice, readAt }); }
    return ok(page([{ ...notice, readAt }]));
  }));
  mount(); await signIn();
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  const drawer = await screen.findByRole('dialog', { name: 'Notifications' });
  await userEvent.click(await within(drawer).findByRole('button', { name: 'Mark as read' }));
  expect(await within(drawer).findByText('0 unread')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
});

it('preserves a real count after denied mutation and does not fake a decrement', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url) => {
    if (pathOf(url).endsWith('/unread-count')) return ok({ unread: 2 });
    if (pathOf(url).endsWith('/read-all')) return fail(403);
    return ok(page());
  }));
  mount(); await signIn(); await screen.findByRole('button', { name: 'Notifications, 2 unread' });
  await userEvent.click(screen.getByRole('link', { name: 'Open center fixture' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
  expect(await screen.findByText('Fixture failure')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
  expect(screen.queryByText('Signed out fixture')).not.toBeInTheDocument();
});

it.each([-1, 0.5, '4', null])('fails closed on malformed count %s and supports a genuine retry', async (unread) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(ok({ unread })).mockImplementation(async () => ok({ unread: 4 }));
  vi.stubGlobal('fetch', fetcher); mount(); await signIn();
  expect(await screen.findByRole('button', { name: 'Notifications, unread count unavailable' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh count fixture' }));
  expect(await screen.findByRole('button', { name: 'Notifications, 4 unread' })).toBeInTheDocument();
});

it('does not replace a failed count with zero or retain an earlier successful count', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(ok({ unread: 6 })).mockRejectedValueOnce(new Error('Network down')).mockResolvedValue(ok({ unread: 5 }));
  vi.stubGlobal('fetch', fetcher); mount(); await signIn();
  await screen.findByRole('button', { name: 'Notifications, 6 unread' });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh count fixture' }));
  expect(await screen.findByRole('button', { name: 'Notifications, unread count unavailable' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Notifications, 6 unread' })).not.toBeInTheDocument();
  fireEvent(window, new Event('online'));
  expect(await screen.findByRole('button', { name: 'Notifications, 5 unread' })).toBeInTheDocument();
});

it('ignores a superseded unread response even when the transport ignores abort', async () => {
  const old = deferred<Response>();
  const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(old.promise).mockResolvedValue(ok({ unread: 2 }));
  vi.stubGlobal('fetch', fetcher); mount(); await signIn();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh count fixture' }));
  await screen.findByRole('button', { name: 'Notifications, 2 unread' });
  await act(async () => old.resolve(ok({ unread: 99 })));
  expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
});

it.each([200, 401])('discards an old account response (%s) and never clears or populates the new session', async (status) => {
  const old = deferred<Response>();
  const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(old.promise).mockResolvedValue(ok({ unread: 7 }));
  vi.stubGlobal('fetch', fetcher); mount(); await signIn();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await userEvent.click(screen.getByRole('button', { name: 'Switch account' }));
  await screen.findByRole('button', { name: 'Notifications, 7 unread' });
  await act(async () => old.resolve(status === 200 ? ok({ unread: 99 }) : fail(401)));
  expect(screen.getByRole('button', { name: 'Notifications, 7 unread' })).toBeInTheDocument();
  expect(screen.queryByText('Signed out fixture')).not.toBeInTheDocument();
  expect(authSession.read()?.accessToken).toBe('fixture-second-jwt');
});

it('aborts pending requests on logout and does not retain the prior badge on re-login', async () => {
  const old = deferred<Response>(); const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(old.promise).mockResolvedValue(ok({ unread: 1 }));
  vi.stubGlobal('fetch', fetcher); mount(); await signIn();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  const signal = fetcher.mock.calls[0][1]?.signal;
  await userEvent.click(screen.getByRole('button', { name: 'Sign out fixture' }));
  await screen.findByText('Signed out fixture'); expect(signal?.aborted).toBe(true);
  await act(async () => old.resolve(ok({ unread: 99 })));
  expect(screen.queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
  await signIn(); expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
});

it.each([[401, 'Expired'], [403, 'Your account is deactivated.']])('retains canonical auth handling for %s %s', async (status, message) => {
  vi.stubGlobal('fetch', vi.fn(async () => fail(status as number, message as string))); mount(); await signIn();
  await waitFor(() => expect(authSession.read()).toBeNull());
  expect(screen.getByText('Signed out fixture')).toBeInTheDocument();
});

it('mounts safely under StrictMode and ignores aborted development replay requests', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ok({ unread: 3 }))); mount(first, true); await signIn();
  expect(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
});

it('coalesces duplicate read actions and rejects a malformed success response without faking a count', async () => {
  const pending = deferred<Response>();
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    if (pathOf(url).endsWith('/unread-count')) return ok({ unread: 2 });
    if (pathOf(url).endsWith('/11/read')) return pending.promise;
    return ok(page());
  });
  vi.stubGlobal('fetch', fetcher); mount(); await signIn();
  await screen.findByRole('button', { name: 'Notifications, 2 unread' });
  await userEvent.click(screen.getByRole('link', { name: 'Open center fixture' }));
  const button = await screen.findByRole('button', { name: 'Mark as read' });
  fireEvent.click(button); fireEvent.click(button);
  expect(fetcher.mock.calls.filter(([url]) => pathOf(url).endsWith('/11/read'))).toHaveLength(1);
  await act(async () => pending.resolve(ok({ ...notice, id: 99, readAt: null })));
  expect(await screen.findByText('The server did not confirm this notification as read.')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
});

it('does not let a pending old-account read mutation sign out or change the replacement account', async () => {
  const pending = deferred<Response>();
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    if (pathOf(url).endsWith('/unread-count')) return ok({ unread: new Headers(init?.headers).get('Authorization') === 'Bearer fixture-second-jwt' ? 7 : 2 });
    if (pathOf(url).endsWith('/11/read')) return pending.promise;
    return ok(page());
  });
  vi.stubGlobal('fetch', fetcher); mount(); await signIn();
  await screen.findByRole('button', { name: 'Notifications, 2 unread' });
  await userEvent.click(screen.getByRole('link', { name: 'Open center fixture' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as read' }));
  await userEvent.click(screen.getByRole('button', { name: 'Switch account' }));
  await screen.findByRole('button', { name: 'Notifications, 7 unread' });
  await act(async () => pending.resolve(fail(401)));
  expect(screen.getByRole('button', { name: 'Notifications, 7 unread' })).toBeInTheDocument();
  expect(screen.queryByText('Notification session changed.')).not.toBeInTheDocument();
  expect(authSession.read()?.accessToken).toBe('fixture-second-jwt');
});
