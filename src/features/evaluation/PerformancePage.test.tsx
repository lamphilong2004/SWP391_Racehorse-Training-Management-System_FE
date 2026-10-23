import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { RoleCode } from '../../shared/auth/roles';
import { buildRoutes } from '../../app/router';
import { loadPerformanceHorses } from './performanceHorses';

const user = { id: 12, fullName: 'Fixture Trainer', userCode: 'U-12', email: 'trainer@example.test', roles: ['TRAINER'] as RoleCode[], accountStatus: 'ACTIVE' };
const horses = [{ id: 7, horseCode: 'H-7', name: 'First horse' }, { id: 8, horseCode: 'H-8', name: 'Second horse' }];
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const page = (items = horses.map((horse, index) => ({ id: index + 1, horse }))) => ({ items, page: 0, size: 100, totalItems: items.length, totalPages: items.length ? 1 : 0 });
let programReply: () => Response;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
function mount(path = '/training/performance', role: RoleCode = 'TRAINER') {
  authSession.save('fixture-only-token', 3600, false);
  fetcher = vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith('/api/auth/me')) return ok({ ...user, roles: [role] });
    if (String(url).includes('/api/training-programs?')) return programReply();
    const horseId = String(url).includes('/horses/8/') ? 8 : 7;
    return ok([{ sessionId: horseId + 35, sessionCode: `SES-${horseId}`, date: '2026-10-17', status: 'INTERRUPTED', totalDistanceM: 0, durationMin: null, maxHeartRate: null, avgSpeedKmh: null, result: null }]);
  });
  vi.stubGlobal('fetch', fetcher);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return router;
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); programReply = () => ok(page()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('opens standalone history through the canonical auth/client, preserves zero/null and links to evaluation', async () => {
  mount();
  const table = await screen.findByRole('table', { name: 'Lịch sử buổi tập, mới nhất trước' });
  expect(within(table).getByText('0 m')).toBeInTheDocument();
  expect(within(table).getAllByText('Chưa đo')).toHaveLength(3);
  expect(within(table).getByRole('link', { name: 'SES-7' })).toHaveAttribute('href', '/training/sessions/42/evaluation');
  const request = fetcher.mock.calls.find(([url]) => String(url).includes('/api/training-programs?'));
  expect(String(request?.[0])).toContain('assignedToMe=true');
  expect(new Headers(request?.[1]?.headers).get('Authorization')).toBe('Bearer fixture-only-token');
});

it('switches horses without retaining the previous horse history', async () => {
  mount(); await screen.findByRole('link', { name: 'SES-7' });
  fireEvent.change(screen.getByRole('combobox', { name: /^Ngựa$/ }), { target: { value: '8' } });
  expect(await screen.findByRole('link', { name: 'SES-8' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'SES-7' })).not.toBeInTheDocument();
});

it('does not query performance for an invalid or out-of-list horse ID', async () => {
  const router = mount('/training/performance?horseId=999');
  expect(await screen.findByText('Không có ngựa này', { exact: true })).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url]) => String(url).includes('/performance'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Chọn ngựa đầu tiên' }));
  await screen.findByRole('link', { name: 'SES-7' });
  expect(router.state.location.search).toBe('');
});

it('shows a real program error then retries, with no sample fallback', async () => {
  programReply = () => new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Program service unavailable', details: [] } }), { status: 500 });
  mount(); await screen.findByText('Program service unavailable');
  expect(localStorage.getItem('racehorse.business-samples.v1')).toBeNull();
  programReply = () => ok(page([]));
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Không có ngựa nào', { exact: true })).toBeInTheDocument();
});

it('keeps the authenticated session on program403', async () => {
  programReply = () => new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Outside assignment', details: [] } }), { status: 403 });
  const router = mount();
  await screen.findByText('Các chương trình này nằm ngoài phạm vi được phép của bạn. Phiên đăng nhập vẫn còn hiệu lực.');
  expect(router.state.location.pathname).toBe('/training/performance');
  expect(authSession.read()?.accessToken).toBe('fixture-only-token');
});

it('denies Groom before requesting any program or performance data', async () => {
  mount('/training/performance', 'GROOM');
  await screen.findByText('Tài khoản của bạn không có quyền truy cập trang này.');
  expect(fetcher.mock.calls).toHaveLength(1);
});

it('keeps Head Trainer program selection server-scoped without the Trainer-only query', async () => {
  mount('/training/performance', 'HEAD_TRAINER'); await screen.findByRole('link', { name: 'SES-7' });
  expect(String(fetcher.mock.calls.find(([url]) => String(url).includes('/api/training-programs?'))?.[0])).not.toContain('assignedToMe=');
});

it('collects every program page and deduplicates horse references', async () => {
  authSession.save('fixture-only-token', 3600, false);
  const first = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, horse: horses[0] }));
  const network = vi.fn<typeof fetch>(async (url) => ok({ items: String(url).includes('page=0') ? first : [{ id: 101, horse: horses[1] }], page: String(url).includes('page=0') ? 0 : 1, size: 100, totalItems: 101, totalPages: 2 }));
  vi.stubGlobal('fetch', network);
  await expect(loadPerformanceHorses(true)).resolves.toEqual(horses);
  expect(network).toHaveBeenCalledTimes(2);
});

it('rejects incomplete pagination rather than presenting an incomplete horse list', async () => {
  authSession.save('fixture-only-token', 3600, false);
  vi.stubGlobal('fetch', vi.fn(async () => ok({ items: [], page: 0, size: 100, totalItems: 1, totalPages: 1 })));
  await expect(loadPerformanceHorses(false)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  await waitFor(() => expect(authSession.read()).not.toBeNull());
});
