import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { ApiError } from '../../shared/auth/authApi';
import { GroomTasks } from './GroomTasks';
import type { GroomService, GroomTreatmentTask } from './groomService';

const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const task: GroomTreatmentTask = { id: 12, horseId: 14, assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: today, status: 'PENDING' };
const page = (items: unknown[]) => ({ items, page: 0, size: 100, totalElements: items.length });
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); });
function mount(role: string, path = '/care/tasks') {
  authSession.save('fixture-session', 3600, false);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/auth/me')) return ok({ id: 6, fullName: 'Assigned Groom', userCode: 'G6', email: 'groom@example.test', roles: [role], accountStatus: 'ACTIVE' });
    if (url.includes('/api/groom/treatment-tasks')) return ok(page([task]));
    throw new Error('Unexpected fixture request');
  });
  vi.stubGlobal('fetch', fetcher);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  return { router, fetcher };
}
it.each(['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'WORK_RIDER', 'VETERINARIAN', 'HORSE_OWNER'])('blocks %s before any Groom request', async (role) => {
  const { fetcher } = mount(role);
  expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledOnce();
});
it('Groom accesses assigned tasks through the real adapter and cannot open clinical routes', async () => {
  const { router, fetcher } = mount('GROOM');
  expect(await screen.findAllByText(/Cold compress/)).toHaveLength(2);
  expect(fetcher.mock.calls.some(([url]) => url.includes('/api/groom/treatment-tasks'))).toBe(true);
  await router.navigate('/medical/cases/9');
  expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url]) => url.includes('/api/medical/'))).toBe(false);
});
it('blocks anonymous direct links using the existing shared login', async () => {
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: ['/care/tasks'] });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Racehorse Ops' })).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it('confirms completion only after success, locks duplicate submits and rereads assigned tasks', async () => {
  let finish!: (task: GroomTreatmentTask) => void;
  const list = vi.fn().mockResolvedValueOnce(page([task])).mockResolvedValueOnce(page([{ ...task, status: 'COMPLETED', completedAt: '2026-10-19T04:00:00Z' }]));
  const complete = vi.fn().mockReturnValue(new Promise<GroomTreatmentTask>((resolve) => { finish = resolve; }));
  render(<GroomTasks service={{ list, complete }} />);
  const checkbox = await screen.findByRole('checkbox', { name: 'Hoàn thành công việc 12' });
  fireEvent.click(checkbox); fireEvent.click(checkbox);
  expect(complete).toHaveBeenCalledOnce();
  expect(screen.queryByText(/Task 12 completed/)).not.toBeInTheDocument();
  finish({ ...task, status: 'COMPLETED', completedAt: '2026-10-19T04:00:00Z' });
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Hoàn thành công việc 12' })).toBeChecked());
  expect(list).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('checkbox')).toBeDisabled();
});
it('preserves failed completion, masks server clinical error text and offers list retry', async () => {
  const list = vi.fn().mockResolvedValue(page([task]));
  const complete = vi.fn().mockRejectedValue(new ApiError(409, 'CONFLICT', 'Private diagnosis must not be displayed'));
  render(<GroomTasks service={{ list, complete }} />);
  fireEvent.click(await screen.findByRole('checkbox'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Công việc đã thay đổi hoặc đã hoàn thành');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.queryByText(/Private diagnosis/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Task 12 completed/)).not.toBeInTheDocument();
});
it('provides empty state and completed/upcoming/horse filters without adding API queries', async () => {
  const list = vi.fn().mockResolvedValue(page([task, { ...task, id: 13, horseId: 15, taskDate: '2099-01-01', instruction: 'Future task' }]));
  render(<GroomTasks service={{ list, complete: vi.fn() }} />);
  await screen.findByRole('checkbox');
  fireEvent.click(screen.getByRole('button', { name: 'Đã hoàn thành' }));
  expect(await screen.findByText('Không có công việc nào với bộ lọc này')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sắp tới' }));
  expect(await screen.findByRole('checkbox', { name: 'Hoàn thành công việc 13' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Ngựa'), { target: { value: '14' } });
  expect(await screen.findByText('Không có công việc nào với bộ lọc này')).toBeInTheDocument();
  expect(list).toHaveBeenCalledOnce();
});
it('drops a delayed read when the task screen unmounts', async () => {
  let finish!: (data: ReturnType<typeof page>) => void;
  const list = vi.fn().mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const { unmount } = render(<GroomTasks service={{ list, complete: vi.fn() } as GroomService} />);
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải công việc điều trị được giao');
  unmount(); finish(page([task]));
  await Promise.resolve();
  expect(screen.queryByText(/Cold compress/)).not.toBeInTheDocument();
});
