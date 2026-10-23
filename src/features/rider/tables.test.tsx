import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { RiderApi } from './api';
import { RiderAssignmentsPage, RiderHistoryPage } from './pages';
import type { RiderSession } from './types';

const auth = vi.hoisted(() => ({ user: { id: 9, fullName: 'Test Rider', roles: ['WORK_RIDER'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(() => false) }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('../../layout/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const at = (offsetDays: number, hour: number) => { const date = new Date(); date.setDate(date.getDate() + offsetDays); date.setHours(hour, 0, 0, 0); return date.toISOString(); };
const ride = (id: number, patch: Partial<RiderSession>): RiderSession => ({
  id, sessionCode: `SES-00${id}`, horse: { id: 7, name: 'Thunder Bolt', horseCode: 'TB-001' }, programId: 2, phaseName: 'Foundation',
  scheduledStart: at(0, 6), scheduledEnd: at(0, 7), status: 'SCHEDULED', workRider: { id: 9, fullName: 'Test Rider' }, trainer: { id: 3, fullName: 'Test Trainer' },
  focus: 'Gallop Session', surface: 'Turf Track', preCheckResult: null, blocked: false, blockedReasons: [], exercises: [], ...patch,
});

function client(): RiderApi {
  return {
    assignments: vi.fn(async (status?: string) => status === 'COMPLETED'
      ? [ride(40, { status: 'COMPLETED', scheduledStart: at(-1, 6) })]
      : [ride(41, { preCheckResult: 'ALL_NORMAL' }), ride(42, { scheduledStart: at(0, 9), scheduledEnd: at(0, 10) }), ride(43, { scheduledStart: at(2, 6), scheduledEnd: at(2, 7) })]),
    history: vi.fn(async () => ({ items: [
      ride(30, { status: 'COMPLETED', actualStart: at(-1, 6), actualEnd: at(-1, 7), hasRiderFeedback: true }),
      ride(31, { status: 'INTERRUPTED', actualStart: at(-2, 6), actualEnd: new Date(Date.parse(at(-2, 6)) + 21 * 60000).toISOString(), hasRiderFeedback: false }),
    ], page: 0, size: 20, totalItems: 2, totalPages: 1 })),
    session: vi.fn(), result: vi.fn(), start: vi.fn(), complete: vi.fn(), issue: vi.fn(), feedback: vi.fn(), metric: vi.fn(),
  } as unknown as RiderApi;
}
function mount(element: React.ReactNode, path: string) {
  const router = createMemoryRouter([{ path, element }, { path: '/rider/assignments/:id', element: <p>Assignment detail</p> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

it('groups own assignments into Today and Upcoming tables (Figma WR-D4) and opens a row', async () => {
  const api = client();
  const router = mount(<RiderAssignmentsPage api={api} />, '/rider/assignments');
  expect(await screen.findByRole('tab', { name: 'Hôm nay · 2' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Sắp tới · 1' })).toBeInTheDocument();
  const today = screen.getByRole('table', { name: 'Lượt cưỡi hôm nay' });
  expect(within(today).getAllByRole('row')).toHaveLength(3);
  expect(within(today).getByText('Sẵn sàng')).toBeInTheDocument();
  expect(within(today).getByText('Chưa kiểm tra')).toBeInTheDocument();
  expect(within(today).getAllByText('Turf Track · 60 phút')).toHaveLength(2);
  const upcoming = screen.getByRole('table', { name: 'Lượt cưỡi sắp tới' });
  expect(within(upcoming).getAllByText('Đã lên lịch').length).toBeGreaterThan(0);
  fireEvent.click(within(upcoming).getAllByRole('row')[1]);
  expect(router.state.location.pathname).toBe('/rider/assignments/43');
});

it('requests COMPLETED rides only for the Completed tab', async () => {
  const api = client();
  mount(<RiderAssignmentsPage api={api} />, '/rider/assignments');
  fireEvent.click(await screen.findByRole('tab', { name: 'Đã hoàn thành' }));
  expect(await screen.findByRole('table', { name: 'Lượt cưỡi đã hoàn thành' })).toBeInTheDocument();
  expect(api.assignments).toHaveBeenCalledWith('COMPLETED');
  expect(screen.queryByRole('table', { name: 'Lượt cưỡi hôm nay' })).not.toBeInTheDocument();
});

it('shows history metrics, filter tabs and server-derived duration and feedback (Figma WR-D5)', async () => {
  mount(<RiderHistoryPage api={client()} />, '/rider/history');
  const table = await screen.findByRole('table', { name: 'Lịch sử cưỡi' });
  expect(within(table).getAllByRole('row')).toHaveLength(3);
  expect(within(table).getByText('21 phút')).toBeInTheDocument();
  expect(within(table).getByText('Đã gửi')).toBeInTheDocument();
  expect(within(table).getByText('Chưa gửi')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Bị gián đoạn' }));
  expect(within(screen.getByRole('table', { name: 'Lịch sử cưỡi' })).getAllByRole('row')).toHaveLength(2);
});

it('includes older rides beyond page ten rather than silently truncating history', async () => {
  const api = client();
  vi.mocked(api.history).mockImplementation(async (page = 0) => ({
    items: [ride(100 + page, { status: 'COMPLETED', horse: { id: 7, name: `History horse ${page}`, horseCode: 'TB-001' } })],
    page, size: 1, totalItems: 11, totalPages: 11,
  }));
  mount(<RiderHistoryPage api={api} />, '/rider/history');
  expect(await screen.findByText('History horse 10')).toBeInTheDocument();
  expect(api.history).toHaveBeenCalledWith(10);
  expect(within(screen.getByRole('table', { name: 'Lịch sử cưỡi' })).getAllByRole('row')).toHaveLength(12);
});
