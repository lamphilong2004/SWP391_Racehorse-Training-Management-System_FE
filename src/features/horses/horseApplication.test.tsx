import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider, useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { CurrentUser } from '../../shared/auth/authApi';
import type { RoleCode } from '../../shared/auth/roles';
import type { ActivationStatus, HorseDetail } from './api/types';

// HTTP fixtures only: never database persistence or a production runtime source.
const manager: CurrentUser = { id: 201, userCode: 'FIX-CM', fullName: 'Fixture Manager', email: 'cm@fixture.test', roles: ['CLUB_MANAGER'], accountStatus: 'ACTIVE' };
const horse = (id = 81): HorseDetail => ({ id, horseCode: 'FIX-81', name: 'Fixture Draft', breed: null, sex: null, foaledDate: null, lifecycle: 'DRAFT', healthStatus: null, trainingAvailability: 'AVAILABLE', currentBoxCode: null, primaryPhotoUrl: null, countryOfOrigin: null, registrationNo: null, activatedAt: null, pedigree: { sire: { horseId: null, name: null }, dam: { horseId: null, name: null } }, currentOwnerships: [], currentAssignment: null, createdAt: '2026-10-19T00:00:00Z', updatedAt: null });
const checklist = (): ActivationStatus => ({ horseId: 81, horseCode: 'FIX-81', name: 'Fixture Draft', lifecycle: 'DRAFT', activatedAt: null, checklist: [
  ...(['IDENTITY', 'PEDIGREE', 'OWNER', 'FREE_STABLE_BOX', 'VETERINARIAN_BASELINE'] as const).map((id) => ({ id, label: id, description: `${id} detail`, requirement: 'MANDATORY' as const, state: id === 'IDENTITY' ? 'SATISFIED' as const : 'PENDING' as const })),
  { id: 'HEAD_TRAINER_READINESS_REVIEW', label: 'Đánh giá sẵn sàng của Head Trainer', description: 'Recommended — does not block activation', requirement: 'RECOMMENDED', state: 'NOT_REVIEWED' },
] });
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });
const failure = (status: number, message = 'Fixture request failed') => new Response(JSON.stringify({ success: false, error: { code: status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : 'NOT_FOUND', message, details: [] } }), { status });
function SessionProbe() {
  const auth = useAuth();
  return <><button onClick={() => void auth.logout()}>Fixture logout</button><button onClick={() => void auth.login('second@fixture.test', 'fixture-only', false)}>Fixture switch</button></>;
}
function mount(path = '/horses', options: { role?: RoleCode; anonymous?: boolean; status?: number; offline?: boolean; setup?: boolean; store?: HorseDetail[]; create?: () => Promise<Response> } = {}) {
  const actor = { ...manager, roles: [options.role ?? 'CLUB_MANAGER'] };
  const store = options.store ?? [horse()];
  const requests: { method: string; path: string; body?: unknown }[] = [];
  let setupAvailable = options.setup ?? false;
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input)); const path = url.pathname; const method = init?.method ?? 'GET';
    if (path === '/api/auth/me') return ok(actor);
    if (path === '/api/auth/login') return ok({ user: { ...actor, id: 202, fullName: 'Second Manager' }, accessToken: 'fixture-second-session', tokenType: 'Bearer', expiresIn: 3600 });
    if (path === '/api/auth/logout') return new Response(null, { status: 204 });
    requests.push({ method, path: path + url.search, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
    expect(new Headers(init?.headers).get('Authorization')).toMatch(/^Bearer fixture-/);
    if (options.offline) throw new Error('network fixture');
    if (options.status) return failure(options.status);
    if (path === '/api/horses' && method === 'POST') {
      if (options.create) return options.create();
      const saved = { ...horse(82), ...JSON.parse(String(init?.body)), lifecycle: 'DRAFT' as const }; store.push(saved); return ok(saved, 201);
    }
    if (path === '/api/horses' && method === 'GET') return ok({ items: store, page: 0, size: 20, totalItems: store.length, totalPages: 1 });
    if (/^\/api\/horses\/\d+$/.test(path)) return ok(store.find((h) => h.id === Number(path.split('/')[3])) ?? horse());
    if (path === '/api/stable-boxes') return ok([
      { id: 31, boxCode: 'B-01', yard: 'Fixture yard', status: 'FREE', currentHorse: null },
      { id: 32, boxCode: 'B-02', yard: 'Fixture yard', status: 'OCCUPIED', currentHorse: { id: 91, name: 'Other fixture', horseCode: 'FIX-91' } },
    ]);
    if (!setupAvailable) return failure(404);
    if (path === '/api/admin/users') return ok({ items: [{ id: 17, userCode: 'FIX-OWN', fullName: 'Fixture Owner', email: 'owner@fixture.test', roles: ['HORSE_OWNER'], accountStatus: 'ACTIVE' }], totalItems: 1, page: 0, size: 100, totalPages: 1 });
    if (path.endsWith('/activation-status')) return ok(checklist());
    if (path === '/api/horses/pending-activation') return ok({ items: [checklist()], totalItems: 1, totalPages: 1, page: 0, size: 50 });
    if (path.endsWith('/stable-assignments') && method === 'GET') return ok([]);
    return failure(404);
  });
  vi.stubGlobal('fetch', fetcher);
  if (!options.anonymous) authSession.save('fixture-session', 3600, false);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><SessionProbe /><RouterProvider router={router} /></AuthProvider>);
  return { router, requests, fetcher, store, restoreSetup: () => { setupAvailable = true; } };
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

it('presents an activation instant as local date/time while preserving the server instant', async () => {
  const instant = '2026-10-23T23:45:00.000Z';
  mount('/horses/81', { store: [{ ...horse(), lifecycle: 'ACTIVE', activatedAt: instant }] });
  await screen.findByRole('heading', { name: 'Fixture Draft' });
  const time = document.querySelector(`time[datetime="${instant}"]`);
  expect(time).toBeInTheDocument();
  expect(time).toHaveAttribute('title', instant);
  expect(time).toHaveTextContent(/\d{2}\/\d{2}\/2026 · \d{2}:\d{2}/);
  expect(screen.queryByText(instant)).not.toBeInTheDocument();
});

it('enters Horse register from workspace menu, creates a DRAFT then lists/details/refreshes through HTTP fixtures', async () => {
  const state = mount('/dashboard', { store: [] });
  await userEvent.click(await screen.findByRole('link', { name: 'Ngựa' }));
  await userEvent.click(await screen.findByRole('link', { name: 'Thêm ngựa' }));
  fireEvent.change(screen.getByLabelText('Tên ngựa *'), { target: { value: 'New Fixture' } });
  fireEvent.change(screen.getByLabelText('Mã ngựa *'), { target: { value: 'FIX-NEW' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  await screen.findByRole('heading', { name: 'Phả hệ & quyền sở hữu · New Fixture' });
  expect(screen.getByText('Không tải được dữ liệu thiết lập ngựa')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưu & tiếp tục' })).toBeDisabled();
  expect(state.requests.find((r) => r.method === 'POST')).toMatchObject({ path: '/api/horses', body: { name: 'New Fixture', horseCode: 'FIX-NEW', breed: null, sex: null, foaledDate: null } });
  expect(state.requests.find((r) => r.method === 'POST')!.body).not.toHaveProperty('lifecycle');
  await userEvent.click(screen.getByRole('link', { name: 'Xem hồ sơ ngựa đã lưu' }));
  await screen.findByRole('heading', { name: 'New Fixture' });
  await userEvent.click(screen.getByRole('link', { name: '← Quay lại danh sách ngựa' }));
  await userEvent.click(await screen.findByRole('link', { name: /New Fixture/ }));
  await screen.findByRole('heading', { name: 'New Fixture' });
  cleanup(); mount('/horses/82', { store: state.store });
  await screen.findByRole('heading', { name: 'New Fixture' });
  expect(screen.getAllByText('Nháp').length).toBeGreaterThan(0);
});
it('validates required identity locally and keeps inputs after duplicate-code/network errors', async () => {
  const { requests } = mount('/horses/new', { create: async () => failure(409, 'Duplicate code') });
  await screen.findByRole('heading', { name: 'Thêm ngựa' });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  expect(screen.getByText('Nhập tên ngựa.')).toBeInTheDocument(); expect(requests).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Tên ngựa *'), { target: { value: 'Keep my edits' } });
  fireEvent.change(screen.getByLabelText('Mã ngựa *'), { target: { value: 'DUPLICATE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  await screen.findByText('Duplicate code');
  expect(screen.getByLabelText('Tên ngựa *')).toHaveValue('Keep my edits');
  expect(screen.getByLabelText('Mã ngựa *')).toHaveValue('DUPLICATE');
});
it('sends only one pending create request despite repeated submit', async () => {
  let finish!: (r: Response) => void;
  const { requests } = mount('/horses/new', { create: () => new Promise((resolve) => { finish = resolve; }) });
  await screen.findByRole('heading', { name: 'Thêm ngựa' });
  fireEvent.change(screen.getByLabelText('Tên ngựa *'), { target: { value: 'One request' } });
  fireEvent.change(screen.getByLabelText('Mã ngựa *'), { target: { value: 'ONE' } });
  const form = screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1));
  await act(async () => finish(failure(500)));
  expect(screen.getByLabelText('Tên ngựa *')).toHaveValue('One request');
});
it('preserves deliberately edited/cleared setup fields when supporting APIs recover', async () => {
  const state = mount('/horses/81/edit');
  await screen.findByText('Không tải được dữ liệu thiết lập ngựa');
  fireEvent.change(screen.getByLabelText('Ngựa cha *'), { target: { value: 'Draft sire' } });
  fireEvent.change(screen.getByLabelText('Ngựa mẹ *'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Tỷ lệ sở hữu (%)'), { target: { value: '65' } });
  expect(screen.getByRole('button', { name: 'Lưu & tiếp tục' })).toBeDisabled();
  expect(screen.getByText('Không tải được lịch sử ô chuồng')).toBeInTheDocument();
  state.restoreSetup(); await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await waitFor(() => expect(screen.queryByText('Không tải được dữ liệu thiết lập ngựa')).not.toBeInTheDocument());
  expect(screen.getByLabelText('Ngựa cha *')).toHaveValue('Draft sire'); expect(screen.getByLabelText('Ngựa mẹ *')).toHaveValue('');
  expect(screen.getByLabelText('Tỷ lệ sở hữu (%)')).toHaveValue(65);
  expect(state.requests.every((r) => r.method === 'GET')).toBe(true);
});
it('shows FREE/OCCUPIED boxes without fabricating an assignment when its API is missing', async () => {
  const { requests } = mount('/horses/81/edit'); await screen.findByText('Không tải được dữ liệu thiết lập ngựa');
  await userEvent.click(screen.getByRole('button', { name: 'Xếp ô chuồng' }));
  expect(await screen.findByText('Chuồng B-02')).toBeInTheDocument();
  expect(screen.getByText('Đang có ngựa')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /B-02/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /B-01/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xếp ô' }));
  await screen.findByText('Không xếp được ô chuồng');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(requests.find((r) => r.method === 'POST')).toMatchObject({ path: '/api/horses/81/stable-assignments', body: { stableBoxId: 31 } });
});
it('renders the approved six checklist rows without a manual activation action', async () => {
  mount('/horses/pending-activation', { setup: true });
  await screen.findByText('Fixture Draft · FIX-81');
  expect(screen.getByText('PEDIGREE')).toBeInTheDocument(); expect(screen.getByText('OWNER')).toBeInTheDocument();
  expect(screen.getByText('Nên làm trước khi tập — không chặn việc kích hoạt')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Activate|Approve/ })).not.toBeInTheDocument();
});
it.each(['HEAD_TRAINER', 'TRAINER', 'WORK_RIDER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'] as const)('denies %s creating horses before business requests', async (role) => {
  const { requests } = mount('/horses/new', { role }); await screen.findByText('Không có quyền truy cập'); expect(requests).toHaveLength(0);
});
it.each(['WORK_RIDER', 'HORSE_OWNER'] as const)('denies %s register reads', async (role) => {
  const { requests } = mount('/horses', { role }); await screen.findByText('Không có quyền truy cập'); expect(requests).toHaveLength(0);
});
it.each(['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'] as const)('allows approved %s register reads', async (role) => {
  mount('/horses', { role }); await screen.findByRole('link', { name: /Fixture Draft/ });
  expect(Boolean(screen.queryByRole('link', { name: 'Thêm ngựa' }))).toBe(role === 'CLUB_MANAGER');
});
it.each(['/horses/no-id', '/horses/0', '/horses/9007199254740992', '/horses/81?tab=clinical', '/horses/no-id/edit'])('rejects invalid %s without business HTTP', async (path) => {
  const { requests } = mount(path); await screen.findByText(/Không tìm thấy ngựa|Mục hồ sơ không hợp lệ|Không có ngựa này/); expect(requests).toHaveLength(0);
});
it.each([403, 404, 500])('shows real HTTP%s error without sample fallback and retains session', async (status) => {
  const { requests } = mount('/horses', { status }); await screen.findByText('Không tải được dữ liệu ngựa');
  expect(requests).toHaveLength(1); expect(authSession.read()).not.toBeNull();
  expect(screen.queryByRole('link', { name: /Fixture Draft/ })).not.toBeInTheDocument();
});
it('clears session on401 and redirects anonymous access before business HTTP', async () => {
  mount('/horses', { status: 401 }); await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' }); expect(authSession.read()).toBeNull();
  cleanup(); const { requests } = mount('/horses/new', { anonymous: true });
  await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' }); expect(requests).toHaveLength(0);
});
it('clears former Horse content when shared session switches or logs out', async () => {
  mount('/horses/81'); await screen.findByRole('heading', { name: 'Fixture Draft' });
  await userEvent.click(screen.getByRole('button', { name: 'Fixture switch' }));
  await screen.findByText('Second Manager');
  await userEvent.click(screen.getByRole('button', { name: 'Fixture logout' }));
  await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' }); expect(screen.queryByText('Fixture Draft')).not.toBeInTheDocument();
});
it('guards a dirty Register Horse form, keeps input on Continue editing and focuses the first invalid field', async () => {
  const { router } = mount('/horses/new');
  await screen.findByRole('heading', { name: 'Thêm ngựa' });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp & tiếp tục' }));
  await waitFor(() => expect(screen.getByLabelText('Tên ngựa *')).toHaveFocus());
  fireEvent.change(screen.getByLabelText('Tên ngựa *'), { target: { value: 'Keep me' } });
  await userEvent.click(screen.getByRole('button', { name: /Quay lại danh sách ngựa/ }));
  expect(await screen.findByRole('dialog', { name: 'Thay đổi chưa lưu' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(router.state.location.pathname).toBe('/horses/new');
  expect(screen.getByLabelText('Tên ngựa *')).toHaveValue('Keep me');
  await userEvent.click(screen.getByRole('button', { name: /Quay lại danh sách ngựa/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Hủy thay đổi' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/horses'));
});

it('clears registry filters via the API adapter and keeps DRAFT distinct from availability', async () => {
  const { requests } = mount('/horses');
  await screen.findByRole('link', { name: /Fixture Draft/ });
  expect(screen.getByLabelText('Chưa kích hoạt · chưa đủ điều kiện vận hành')).toHaveTextContent('Chờ kích hoạt');
  expect(screen.getByText(/Ngựa Nháp vẫn chờ kích hoạt dù khả năng tập luyện là Sẵn sàng/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm ngựa' }), { target: { value: 'River' } });
  fireEvent.change(screen.getByLabelText('Vòng đời'), { target: { value: 'DRAFT' } });
  await userEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
  await waitFor(() => expect(requests.some(r => r.path.includes('q=River') && r.path.includes('lifecycle=DRAFT'))).toBe(true));
  await userEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  await waitFor(() => {
    const path = requests.filter(r => r.path.startsWith('/api/horses?')).at(-1)!.path;
    expect(new URL(path, 'http://fixture.test').searchParams.get('q') ?? '').toBe('');
    expect(new URL(path, 'http://fixture.test').searchParams.get('page')).toBe('0');
  });
  expect(screen.getByRole('searchbox', { name: 'Tìm ngựa' })).toHaveValue('');
});
