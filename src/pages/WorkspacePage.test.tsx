import { render, screen } from '@testing-library/react';
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
