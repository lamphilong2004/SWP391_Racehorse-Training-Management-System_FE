import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SessionDetailPage } from './SessionDetailPage';
import type { TrainingSession } from './sessionApi';

const { request, actor } = vi.hoisted(() => ({
  request: vi.fn(),
  actor: { user: { id: 5, fullName: 'Trainer', roles: ['TRAINER'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(() => false) },
}));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => actor }));
vi.mock('../main-flows/api', async (original) => ({ ...await original<typeof import('../main-flows/api')>(), useFlowRequest: () => request }));

const missing: TrainingSession = {
  id: 6, sessionCode: 'TS-6', horse: { id: 9, name: 'Blue Harbor', horseCode: 'VB' },
  programId: 2, horseProgramPhaseId: 2, phaseName: 'Familiarisation', status: 'SCHEDULED',
  scheduledStart: '2026-01-03T03:00:00Z', workRider: { id: 7, fullName: 'Rider' },
  trainer: { id: 5, fullName: 'Trainer' }, groom: null, preSessionCheck: null,
  trainingAvailability: 'AVAILABLE', blocked: true, blockedReasons: ['PRE_CHECK_MISSING'], exercises: [],
};

function mount() {
  render(<RouterProvider router={createMemoryRouter([{ path: '/training/session/:id', element: <SessionDetailPage /> }], { initialEntries: ['/training/session/6'] })} />);
}

beforeEach(() => {
  actor.user.roles = ['TRAINER'];
  request.mockReset().mockImplementation((path: string) => Promise.resolve(path.endsWith('/groom-candidates') ? [] : missing));
});

it('explains the missing assignment and exact-session check without clearing the server block', async () => {
  mount();
  expect(await screen.findByText(/Groom chưa lưu kiểm tra trước buổi tập cho đúng buổi này\./)).toBeInTheDocument();
  expect(screen.getByText('Trainer cần lưu phân công Groom cho buổi này trước khi Groom có thể kiểm tra.')).toBeInTheDocument();
  expect(screen.getByText(/Kết quả của buổi khác không thay thế được/)).toBeInTheDocument();
  expect(screen.getByText('Chưa có kết quả được lưu cho buổi này')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Phân công & thông báo Groom' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Xem kết quả & điều kiện đánh giá' })).toHaveAttribute('href', '/training/sessions/6/evaluation');
  expect(screen.queryByRole('button', { name: 'Lưu đánh giá' })).not.toBeInTheDocument();
  expect(screen.queryByText('PRE_CHECK_MISSING')).not.toBeInTheDocument();
});

it('reloads the same session from the API after Groom saves, without issuing a mutation', async () => {
  mount();
  await screen.findByText('Chưa có kết quả được lưu cho buổi này');
  request.mockImplementation((path: string) => Promise.resolve(path.endsWith('/groom-candidates') ? [] : {
    ...missing, groom: { id: 2, fullName: 'Groom' }, preSessionCheck: { overallResult: 'ALL_NORMAL' }, blocked: false, blockedReasons: [],
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại buổi tập' }));
  await screen.findByText('Tất cả bình thường');
  expect(screen.queryByText('Chưa có kết quả được lưu cho buổi này')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phân công & thông báo Groom' })).not.toBeInTheDocument();
  await waitFor(() => expect(request.mock.calls.filter(([path]) => path === '/api/training-sessions/6')).toHaveLength(2));
  expect(request.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});

it('keeps a reload failure visible and offers no start or assignment control to Head Trainer', async () => {
  actor.user.roles = ['HEAD_TRAINER'];
  mount();
  await screen.findByText('Chưa có kết quả được lưu cho buổi này');
  expect(screen.queryByRole('button', { name: 'Phân công & thông báo Groom' })).not.toBeInTheDocument();
  request.mockRejectedValue(new Error('Connection unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại buổi tập' }));
  await screen.findByText('Connection unavailable');
  expect(screen.queryByText('Tất cả bình thường')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bắt đầu buổi tập' })).not.toBeInTheDocument();
});

it('guides a completed session to results and evaluation without offering assignment or start', async () => {
  request.mockResolvedValue({ ...missing, status: 'COMPLETED', blocked: false, blockedReasons: [] });
  mount();
  expect(await screen.findByText('1. Xem kết quả đã ghi và so sánh kế hoạch với thực tế.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mở đánh giá của Trainer' })).toHaveAttribute('href', '/training/sessions/6/evaluation');
  expect(screen.queryByText('1. Trainer phân công Groom cho đúng mã buổi tập.')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Phân công & thông báo Groom' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bắt đầu buổi tập' })).not.toBeInTheDocument();
});
