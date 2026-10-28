import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { authSession } from '../../shared/auth/authSession';
import { ROLE_CODES } from '../../shared/auth/roles';

const auth = vi.hoisted(() => ({ status: 'authenticated', user: { id: 2, fullName: 'Test HT', roles: ['HEAD_TRAINER'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(), logout: vi.fn() }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
const program = { id: 10, horse: { id: 7, name: 'Test Horse', horseCode: 'H-7' }, name: 'Foundation', status: 'ACTIVE', periodStart: '2026-11-01', periodEnd: '2026-11-30', sourceTemplateId: 3, sourceTemplateVersion: 2, currentTrainer: { id: 4, fullName: 'Test Trainer' }, currentPhaseName: 'Base', trainingAvailability: 'LIMITED' };
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const response = (items = [program], page = 0, totalItems = 21, totalPages = 2) => new Response(JSON.stringify({ success: true, data: { items, page, size: 20, totalItems, totalPages } }));
function mount() { render(<RouterProvider router={createMemoryRouter(buildRoutes(false), { initialEntries: ['/training/programs'] })} />); }
beforeEach(() => {
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); auth.user.roles = ['HEAD_TRAINER']; auth.handleApiError.mockReset();
  localStorage.clear(); sessionStorage.clear(); authSession.save('test-contract-jwt', 3600, false);
  fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => response([program], Number(new URL(String(url), location.origin).searchParams.get('page')))); vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('mounts the approved list with canonical JWT transport and enters the existing creation route', async () => {
  mount(); await screen.findByRole('link', { name: 'Xem Foundation' });
  const [url, init] = fetcher.mock.calls[0];
  expect(String(url)).toMatch(/\/api\/training-programs\?page=0&size=20$/);
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-contract-jwt');
  expect(screen.getByRole('link', { name: '+ Tạo chương trình huấn luyện' })).toHaveAttribute('href', '/training/programs/new');
  expect(screen.getByRole('link', { name: 'Xem Foundation' })).toHaveAttribute('href', '/training/programs/10');
  expect(screen.getByText('Tóm tắt chương trình')).toBeInTheDocument();
  // Goal and progress are not provided by the API, so the list shows no placeholder columns for them.
  expect(screen.queryByRole('columnheader', { name: 'Tiến độ' })).not.toBeInTheDocument();
  expect(screen.queryByText(/58%/)).not.toBeInTheDocument();
});
it('pages and filters status on the server without assignedToMe or unsupported search fields', async () => {
  mount(); await screen.findByRole('link', { name: 'Xem Foundation' });
  fireEvent.click(screen.getByRole('button', { name: 'Chương trình tiếp' }));
  await waitFor(() => expect(String(fetcher.mock.calls.at(-1)?.[0])).toContain('page=1&size=20'));
  await screen.findByRole('link', { name: 'Xem Foundation' });
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PAUSED' } });
  await waitFor(() => expect(String(fetcher.mock.calls.at(-1)?.[0])).toContain('page=0&size=20&status=PAUSED'));
  await screen.findByRole('link', { name: 'Xem Foundation' });
  const count = fetcher.mock.calls.length;
  fireEvent.change(screen.getByLabelText('Tìm ngựa hoặc chương trình'), { target: { value: 'does not exist' } });
  expect(await screen.findByText('Không có chương trình phù hợp')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(count);
  expect(fetcher.mock.calls.every(([url]) => !String(url).includes('assignedToMe') && !String(url).includes('q='))).toBe(true);
});
it('shows errors and permits retry without fixture fallback or writes', async () => {
  fetcher.mockRejectedValueOnce(new Error('Offline')); mount();
  expect(await screen.findByText('Không kết nối được máy chủ. Hãy kiểm tra kết nối và thử lại.')).toBeInTheDocument();
  expect(screen.queryByText('Test Horse')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('link', { name: 'Xem Foundation' })).toBeInTheDocument();
  expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});
it('renders an empty server result without invented programs', async () => {
  fetcher.mockImplementation(async () => response([], 0, 0, 0)); mount();
  expect(await screen.findByText('Không có chương trình phù hợp')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chương trình tiếp' })).toBeDisabled();
});
it('surfaces malformed pagination without presenting a false empty or successful list', async () => {
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: { items: [] } }))); mount();
  expect(await screen.findByText('Không phân trang được danh sách chương trình. Hãy tải lại.')).toBeInTheDocument();
  expect(screen.queryByText('Không có chương trình phù hợp')).not.toBeInTheDocument();
});
it.each(ROLE_CODES.filter((role) => role !== 'HEAD_TRAINER'))('denies %s before loading the list', async (role) => {
  auth.user.roles = [role]; mount();
  expect(await screen.findByText('Tài khoản của bạn không có quyền truy cập trang này.')).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
