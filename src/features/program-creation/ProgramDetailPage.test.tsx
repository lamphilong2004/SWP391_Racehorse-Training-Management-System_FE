import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { authSession } from '../../shared/auth/authSession';

const auth = vi.hoisted(() => ({ status: 'authenticated', user: { id: 2, fullName: 'Test User', roles: ['HEAD_TRAINER'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(), logout: vi.fn() }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
const program = { id: 10, horse: { id: 7, name: 'Test Horse', horseCode: 'H-7' }, name: 'Foundation', status: 'ACTIVE', periodStart: '2026-11-01', periodEnd: '2026-11-30', sourceTemplateId: 3, sourceTemplateVersion: 2, sourceTemplateName: 'Pinned Template', currentTrainer: { id: 4, fullName: 'Test Trainer' }, currentPhaseName: 'Base', trainingAvailability: 'LIMITED', activatedAt: '2026-10-20T01:00:00Z', goals: 'Thăng bằng', notes: 'Vet restrictions apply', phases: [{ id: 31, phaseOrder: 1, name: 'Base', startDate: '2026-11-01', endDate: '2026-11-30', workload: 'Walk 20 minutes', intensityMin: 'LOW', intensityMax: 'MEDIUM', isCustomized: true }] };
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
function mount(path = '/training/programs/10') { render(<RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: [path] })} />); }
beforeEach(() => {
  auth.user.roles = ['HEAD_TRAINER']; auth.handleApiError.mockReset(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  localStorage.clear(); sessionStorage.clear(); authSession.save('fixture-detail-jwt', 3600, false);
  fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    const path = new URL(String(url), location.origin).pathname;
    if (path === '/api/training-programs') return ok({ items: [program], page: 0, size: 20, totalItems: 1, totalPages: 1 });
    if (path === '/api/training-programs/10/progress') return ok({ programId: 10, phases: [{ phaseId: 31, phaseOrder: 1, name: 'Base', scheduled: 5, completed: 2, interrupted: 1, totalDistanceM: null }] });
    if (path === '/api/training-programs/10/history') return ok([{ occurredAt: '2026-10-20T01:00:00Z', entryType: 'CREATED', summary: 'Created from immutable version 2', actor: { id: 2, fullName: 'Test HT' } }]);
    if (path === '/api/training-sessions') return ok([]);
    return ok(program);
  }); vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([
  ['HEAD_TRAINER', '/training/programs', 'Xem Foundation'],
  ['TRAINER', '/training/programs/assigned', 'Xem chương trình Foundation'],
])('navigates from the existing %s program list into authenticated read-only detail', async (role, path, name) => {
  auth.user.roles = [role]; mount(path);
  fireEvent.click(await screen.findByRole('link', { name }));
  expect(await screen.findByRole('heading', { name: 'Test Horse · H-7' })).toBeInTheDocument();
  expect(screen.getByText('Pinned Template')).toBeInTheDocument(); expect(screen.getByText('v2')).toBeInTheDocument();
  expect(screen.getByText('Walk 20 minutes')).toBeInTheDocument(); expect(screen.getByText('Test Trainer')).toBeInTheDocument();
  expect(screen.getByText('Chưa cung cấp; không tự suy ra phần trăm')).toBeInTheDocument();
  const call = fetcher.mock.calls.find(([url]) => String(url).endsWith('/api/training-programs/10'))!;
  expect(new Headers(call[1]?.headers).get('Authorization')).toBe('Bearer fixture-detail-jwt');
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});
it('loads approved progress/history on demand without inventing totals or requiring management endpoints', async () => {
  mount(); await screen.findByText('Pinned Template');
  expect(fetcher.mock.calls.some(([url]) => /\/(progress|history)$/.test(String(url)))).toBe(false);
  fireEvent.click(screen.getByRole('tab', { name: 'Tiến độ' }));
  const progress = await screen.findByRole('table', { name: 'Tiến độ chương trình từ hệ thống' });
  expect(within(progress).getByText('2')).toBeInTheDocument(); expect(within(progress).getByText('Chưa đo')).toBeInTheDocument();
  expect(screen.queryByText('40%')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử' }));
  expect(await screen.findByText('Created from immutable version 2')).toBeInTheDocument();
  expect(screen.getByText('Test HT')).toBeInTheDocument();
});
it.each(['VETERINARIAN', 'GROOM'])('allows %s overview without requesting forbidden progress/history', async (role) => {
  auth.user.roles = [role]; mount(); await screen.findByText('Pinned Template');
  fireEvent.click(screen.getByRole('tab', { name: 'Tiến độ' }));
  expect(await screen.findByText('Vai trò này không xem được tiến độ')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử' }));
  expect(await screen.findByText('Vai trò này không xem được lịch sử')).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url]) => /\/(progress|history)$/.test(String(url)))).toBe(false);
});
it.each(['WORK_RIDER', 'HORSE_OWNER'])('denies %s before loading detail', async (role) => {
  auth.user.roles = [role]; mount();
  expect(await screen.findByText('Tài khoản của bạn không có quyền truy cập trang này.')).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects an invalid direct-link ID without issuing HTTP', async () => {
  mount('/training/programs/not-an-id'); expect(await screen.findByText('Hãy chọn bản ghi hợp lệ để tiếp tục.')).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it('keeps overview available after progress API failure and permits retry', async () => {
  const original = fetcher.getMockImplementation()!; let failed = true;
  fetcher.mockImplementation(async (url, init) => String(url).endsWith('/progress') && failed ? new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Progress not implemented', details: [] } }), { status: 404 }) : original(url, init));
  mount(); await screen.findByText('Pinned Template'); fireEvent.click(screen.getByRole('tab', { name: 'Tiến độ' }));
  expect(await screen.findByText('Progress not implemented')).toBeInTheDocument();
  failed = false; fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('table', { name: 'Tiến độ chương trình từ hệ thống' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Tổng quan' })); expect(await screen.findByText('Walk 20 minutes')).toBeInTheDocument();
});
it('forwards protected 401 errors to canonical auth handling without a false detail', async () => {
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token expired', details: [] } }), { status: 401 }));
  mount(); expect(await screen.findByText('Token expired')).toBeInTheDocument();
  await waitFor(() => expect(auth.handleApiError).toHaveBeenCalled()); expect(screen.queryByText('Pinned Template')).not.toBeInTheDocument();
});
