import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { WorkspacePage } from './WorkspacePage';

const state = vi.hoisted(() => ({
  user: { id: 15, fullName: 'Workspace Tester', email: 'workspace@example.test', userCode: 'TEST-15', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' },
  request: vi.fn(),
}));
vi.mock('../shared/auth/AuthProvider', () => ({ useAuth: () => ({ status: 'authenticated', user: state.user }) }));
vi.mock('../features/main-flows/api', async (original) => ({ ...await original<object>(), useFlowRequest: () => state.request }));
const horse = { id: 17, name: 'Test arrival', horseCode: 'TEST-17', lifecycle: 'DRAFT', currentBoxCode: null, healthStatus: null };
const page = { items: [horse], page: 0, size: 6, totalItems: 1, totalPages: 1 };
function mount() {
  return render(<MemoryRouter><Routes><Route path="/" element={<WorkspacePage />} /><Route path="/medical" element={<h1>Medical destination</h1>} /><Route path="/owner/horses" element={<h1>Owner destination</h1>} /></Routes></MemoryRouter>);
}
beforeEach(() => { state.user.roles = ['VETERINARIAN']; state.request.mockReset().mockResolvedValue(page); });

it('opens the medical workspace and exposes a baseline action for the actual returned horse', async () => {
  mount();
  expect(await screen.findByRole('link', { name: 'Ghi khám ban đầu' })).toHaveAttribute('href', '/horses/17/baseline');
  expect(screen.getByRole('main')).toHaveAttribute('data-design-system', 'v2');
  expect(screen.queryByRole('link', { name: 'Tạo chương trình' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'Mở ca y tế' }));
  expect(await screen.findByRole('heading', { name: 'Medical destination' })).toBeInTheDocument();
});

it('keeps the Owner hub read-only and does not request the staff horse register', async () => {
  state.user.roles = ['HORSE_OWNER']; mount();
  expect(state.request).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: 'Ghi khám ban đầu' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Xem danh sách ngựa' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'Mở ngựa của tôi' }));
  expect(await screen.findByRole('heading', { name: 'Owner destination' })).toBeInTheDocument();
});

it('shows an error without invented arrivals and retries the live resource', async () => {
  state.request.mockRejectedValueOnce(new Error('Temporarily unavailable')).mockResolvedValueOnce(page);
  mount();
  expect(await screen.findByText('Không tải được ngựa mới đến')).toBeInTheDocument();
  expect(screen.queryByText('Test arrival')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Test arrival')).toBeInTheDocument();
  expect(state.request).toHaveBeenCalledTimes(2);
});

it('puts today\'s care progress and overdue work first for the Groom', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-09T05:00:00Z'));
  state.user.roles = ['GROOM'];
  const task = { id: 1, horseId: 3, horseName: 'Late horse', horseCode: 'RH-3', source: 'NUTRITION', taskType: 'FEEDING', taskDate: '2026-11-09', slot: '07:00', instructions: 'HAY: 2 kg', groomUserId: 15, groomName: 'Workspace Tester', boxCode: 'A-1', completedAt: null, cancelledAt: null, cancellationReason: null };
  state.request.mockReset().mockImplementation((path: string) => Promise.resolve(path.startsWith('/api/stable-care/tasks?date=2026-11-09') ? [task, { ...task, id: 2, slot: '18:00', horseName: 'Evening horse' }] : []));
  try {
    mount();
    expect(await screen.findByRole('heading', { name: 'Chăm sóc hôm nay' })).toBeInTheDocument();
    expect(screen.getByText('Late horse')).toBeInTheDocument();
    expect(screen.getByText('Cỏ khô: 2 kg')).toBeInTheDocument();
    expect(screen.queryByText('Evening horse')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /chăm sóc hằng ngày/i })[0]).toHaveAttribute('href', '/care/daily');
    expect(state.request).not.toHaveBeenCalledWith('/api/stable-care/inventory', expect.anything());
  } finally { vi.useRealTimers(); }
});

describe('care-today clock', () => {
  const base = { id: 1, horseId: 3, horseName: 'Clock horse', horseCode: 'RH-3', source: 'CARE', taskType: 'CLEANING', taskDate: '2026-11-09', slot: '07:00', instructions: 'Dọn chuồng', groomUserId: 15, groomName: 'Workspace Tester', boxCode: 'A-1', completedAt: null, cancelledAt: null, cancellationReason: null };
  afterEach(() => { vi.useRealTimers(); });

  it('moves a task into overdue while the dashboard stays open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(new Date('2026-11-09T00:59:00Z')); // 07:59 Vietnam
    state.user.roles = ['GROOM'];
    state.request.mockReset().mockImplementation((path: string) => Promise.resolve(path.startsWith('/api/stable-care/tasks') ? [base] : []));
    mount();
    expect(await screen.findByRole('heading', { name: 'Chăm sóc hôm nay' })).toBeInTheDocument();
    expect(screen.queryByText('Clock horse')).not.toBeInTheDocument();
    await act(async () => { vi.setSystemTime(new Date('2026-11-09T01:01:00Z')); vi.advanceTimersByTime(30_000); }); // 08:01 Vietnam
    expect(await screen.findByText('Clock horse')).toBeInTheDocument();
  });

  it('loads the new club day after Vietnam midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(new Date('2026-11-09T16:59:00Z')); // 23:59 Vietnam
    state.user.roles = ['GROOM'];
    state.request.mockReset().mockResolvedValue([]);
    mount();
    expect(await screen.findByRole('heading', { name: 'Chăm sóc hôm nay' })).toBeInTheDocument();
    await act(async () => { vi.setSystemTime(new Date('2026-11-09T17:01:00Z')); vi.advanceTimersByTime(30_000); }); // 00:01 next day
    await waitFor(() => expect(state.request).toHaveBeenCalledWith('/api/stable-care/tasks?date=2026-11-10', expect.anything()));
  });
});
