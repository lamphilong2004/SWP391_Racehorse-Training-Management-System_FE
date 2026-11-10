import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ApiError } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { createPrecheckApi, type PrecheckApi } from './api';
import { GroomTodayPage, PrecheckPage } from './pages';
import { CHECK_ITEMS, type Checklist, type PrecheckSession, type PreSessionCheck } from './types';

const actor = vi.hoisted(() => ({ user: { id: 8, fullName: 'Test Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' }, handleApiError: vi.fn(() => false) }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => actor }));
const session: PrecheckSession = { id: 40, sessionCode: 'SES-0040', horse: { id: 7, horseCode: 'TB-001', name: 'Thunder Bolt' }, programId: 2, phaseName: 'Foundation', scheduledStart: '2026-10-17T02:00:00Z', status: 'SCHEDULED', workRider: { id: 9, fullName: 'Test Rider' }, blocked: true, blockedReasons: ['PRE_CHECK_MISSING'], trainingAvailability: 'AVAILABLE' };
const checks = Object.fromEntries(CHECK_ITEMS.map(({ key }) => [key, { result: 'NORMAL' }])) as Checklist;
const saved = (abnormal = false): PreSessionCheck => ({ id: 91, sessionId: 40, checks: { ...checks, LEGS_HOOVES: { result: abnormal ? 'ABNORMAL' : 'NORMAL' } }, overallResult: abnormal ? 'ABNORMAL' : 'ALL_NORMAL', performedBy: { id: 8, fullName: 'Test Groom' }, performedAt: '2026-10-17T01:50:00Z' });
function api(): PrecheckApi {
  return { sessions: vi.fn().mockResolvedValue([session]), session: vi.fn().mockResolvedValue(session), submit: vi.fn().mockResolvedValue(saved()), reportIncident: vi.fn().mockResolvedValue({ id: 3, incidentCode: 'INC-0003' }), treatmentTasks: vi.fn().mockResolvedValue([]), incidents: vi.fn().mockResolvedValue([]) };
}
function mount(client: PrecheckApi, path = '/training/my-sessions/40/pre-check') {
  return render(<RouterProvider router={createMemoryRouter([{ path: '/training/my-sessions/:id/pre-check', element: <PrecheckPage api={client} /> }, { path: '/groom/today', element: <GroomTodayPage api={client} /> }], { initialEntries: [path] })} />);
}
async function chooseAll(abnormal = false) {
  await screen.findByRole('heading', { name: 'Danh mục quan sát' });
  for (const item of CHECK_ITEMS) fireEvent.click(within(screen.getByRole('radiogroup', { name: item.label })).getByRole('radio', { name: abnormal && item.key === 'LEGS_HOOVES' ? 'Bất thường' : 'Bình thường' }));
}
beforeEach(() => { actor.user.roles = ['GROOM']; actor.handleApiError.mockClear(); authSession.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); });
afterEach(() => { vi.unstubAllEnvs(); });

it('renders assigned Groom sessions and navigation without optional care modules', async () => {
  mount(api(), '/groom/today');
  expect(await screen.findByRole('link', { name: 'Bắt đầu kiểm tra trước buổi tập' })).toHaveAttribute('href', '/training/my-sessions/40/pre-check');
  expect(screen.getByText(/Mã buổi: SES-0040/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Thunder Bolt · TB-001' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Xem công việc điều trị' })).toHaveAttribute('href', '/medical/my-tasks');
  expect(screen.queryByText('Chăm sóc phòng ngừa')).not.toBeInTheDocument();
});
it('includes unfinished overdue treatment work in the Groom dashboard count', async () => {
  const client = api();
  vi.mocked(client.treatmentTasks).mockResolvedValue([
    { id: 1, horseId: 7, assignedGroomUserId: 8, instruction: 'Past pending', taskDate: '2026-01-01', status: 'PENDING' },
    { id: 2, horseId: 7, assignedGroomUserId: 8, instruction: 'Past completed', taskDate: '2026-01-01', status: 'COMPLETED' },
  ]);
  mount(client, '/groom/today');
  const metric = await screen.findByText('Công việc điều trị chưa xong');
  await waitFor(() => expect(metric.parentElement?.nextElementSibling).toHaveTextContent(/^1$/));
});
it('denies other roles before any feature request', async () => {
  actor.user.roles = ['WORK_RIDER']; const client = api(); mount(client);
  expect(screen.getByText('Chỉ Groom được phân công mới được kiểm tra trước buổi tập.')).toBeInTheDocument();
  expect(client.session).not.toHaveBeenCalled();
});
it('requires all five results before submitting', async () => {
  const client = api(); mount(client); await screen.findByRole('heading', { name: 'Danh mục quan sát' });
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' }));
  const feedback = within(screen.getByLabelText('Thông báo thao tác'));
  expect(feedback.getByRole('alert')).toHaveTextContent('Chọn Bình thường hoặc Bất thường cho cả năm mục kiểm tra.');
  fireEvent.click(feedback.getByRole('button', { name: /Ẩn thông báo/ }));
  expect(feedback.queryByRole('alert')).not.toBeInTheDocument();
  expect(client.submit).not.toHaveBeenCalled();
});
it('records all normal without starting the session or creating an incident', async () => {
  const client = api(); mount(client); await chooseAll();
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' }));
  expect(await screen.findByText('TẤT CẢ BÌNH THƯỜNG — đã ghi kiểm tra trước buổi tập')).toBeInTheDocument(); expect(screen.queryByRole('region', { name: 'Bước tiếp theo: Bắt đầu buổi tập đúng giờ' })).not.toBeInTheDocument();
  expect(client.submit).toHaveBeenCalledWith(40, checks); expect(client.reportIncident).not.toHaveBeenCalled();
  expect(screen.getByText(/Buổi tập vẫn ở trạng thái Đã lên lịch/)).toBeInTheDocument();
});
it('records abnormal then opens the shared explicit report; never auto-creates an incident', async () => {
  const client = api(); vi.mocked(client.submit).mockResolvedValue(saved(true)); mount(client); await chooseAll(true);
  fireEvent.change(screen.getByLabelText('Quan sát Chân & móng (không bắt buộc)'), { target: { value: 'Warm left hind fetlock' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu kiểm tra & báo bất thường' }));
  const dialog = await screen.findByRole('dialog', { name: 'Báo cáo sự cố' });
  expect(client.submit).toHaveBeenCalledTimes(1); expect(client.reportIncident).not.toHaveBeenCalled();
  expect(within(dialog).getByText('Từ kiểm tra trước buổi tập #91 · SES-0040')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Mô tả *')).toHaveValue('Chân & móng: Bất thường');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
  expect(screen.getByText('BẤT THƯỜNG — không được bắt đầu buổi tập này')).toBeInTheDocument();
  expect(screen.getByText('Đã lưu kiểm tra bất thường · Còn bước gửi báo cáo')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Báo cáo sự cố' })).toBeEnabled();
  expect(client.reportIncident).not.toHaveBeenCalled();
});
it('restores the matching incident after refresh instead of inviting a duplicate report', async () => {
  const client = api();
  vi.mocked(client.session).mockResolvedValue({ ...session, preSessionCheck: saved(true) });
  vi.mocked(client.incidents).mockResolvedValue([{ id: 3, incidentCode: 'INC-0003', horseId: 7, preSessionCheckId: 91, incidentType: 'OTHER', observedSeverity: 'LOW', observedAt: '2026-10-17T01:50:00Z', reportedAt: '2026-10-17T01:51:00Z', reportedByUserId: 8, status: 'UNDER_REVIEW' }]);
  mount(client);
  expect(await screen.findByText('Thú y đang xử lý báo cáo')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Theo dõi báo cáo' })).toHaveAttribute('href', '/incidents/3');
  expect(screen.queryByRole('button', { name: 'Báo cáo sự cố' })).not.toBeInTheDocument();
  expect(client.reportIncident).not.toHaveBeenCalled();
});
it('does not invite another report while its existing report cannot be checked', async () => {
  const client = api();
  vi.mocked(client.session).mockResolvedValue({ ...session, preSessionCheck: saved(true) });
  vi.mocked(client.incidents).mockRejectedValue(new Error('Network unavailable'));
  mount(client);
  expect(await screen.findByText('Không kiểm tra được báo cáo đã gửi')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Báo cáo sự cố' })).not.toBeInTheDocument();
  expect(client.reportIncident).not.toHaveBeenCalled();
});
it('keeps observations after a network error and retries without duplicate pending submits', async () => {
  const client = api(); let reject!: (cause: unknown) => void;
  vi.mocked(client.submit).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  mount(client); await chooseAll(); fireEvent.change(screen.getByLabelText('Quan sát Thể trạng chung (không bắt buộc)'), { target: { value: 'Alert and calm' } });
  const submit = screen.getByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' }); fireEvent.click(submit); fireEvent.click(submit);
  expect(client.submit).toHaveBeenCalledTimes(1);
  reject(new ApiError(0, 'NETWORK_ERROR', 'Network unavailable'));
  expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText('Quan sát Thể trạng chung (không bắt buộc)')).toHaveValue('Alert and calm');
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' }));
  await screen.findByText('TẤT CẢ BÌNH THƯỜNG — đã ghi kiểm tra trước buổi tập'); expect(client.submit).toHaveBeenCalledTimes(2);
});
it('locks duplicate409 and reloads the existing recorded check without resubmitting', async () => {
  const client = api(); vi.mocked(client.submit).mockRejectedValue(new ApiError(409, 'CONFLICT', 'Check exists'));
  mount(client); await chooseAll(); fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' }));
  await screen.findByText(/Có thể đã có kết quả kiểm tra\. Hãy tải lại buổi tập trước khi tiếp tục; các quan sát của bạn vẫn được giữ\./);
  expect(screen.queryByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' })).not.toBeInTheDocument();
  vi.mocked(client.session).mockResolvedValue({ ...session, preSessionCheck: saved() });
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại buổi tập' }));
  await screen.findByText('TẤT CẢ BÌNH THƯỜNG — đã ghi kiểm tra trước buổi tập'); expect(client.submit).toHaveBeenCalledTimes(1);
});
it('shows access error and delegates403 to shared auth without data fallback', async () => {
  const client = api(); vi.mocked(client.session).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Outside assigned scope'));
  mount(client); await screen.findByText('Outside assigned scope'); expect(actor.handleApiError).toHaveBeenCalled();
  expect(client.submit).not.toHaveBeenCalled();
});
it('unlocks a409 only after successful reload confirms no existing check and keeps the observations', async () => {
  const client = api(); vi.mocked(client.submit).mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'State changed'));
  mount(client); await chooseAll();
  fireEvent.change(screen.getByLabelText('Quan sát Thể trạng chung (không bắt buộc)'), { target: { value: 'Kept after conflict' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' }));
  await screen.findByText(/Có thể đã có kết quả kiểm tra\. Hãy tải lại buổi tập trước khi tiếp tục; các quan sát của bạn vẫn được giữ\./);
  vi.mocked(client.session).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Reload unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại buổi tập' }));
  await screen.findByText('Reload unavailable'); expect(client.submit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  const retry = await screen.findByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' });
  expect(screen.getByLabelText('Quan sát Thể trạng chung (không bắt buộc)')).toHaveValue('Kept after conflict');
  fireEvent.click(retry); await screen.findByText('TẤT CẢ BÌNH THƯỜNG — đã ghi kiểm tra trước buổi tập');
  expect(client.submit).toHaveBeenCalledTimes(2);
});
it('sends exact checklist-only payload with canonical token and propagates the shared error handler', async () => {
  authSession.save('test-only-token', 3600, false);
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: saved() }), { status: 201 })).mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Chưa phân công', details: [] } }), { status: 403 }));
  const client = createPrecheckApi({ fetcher, baseUrl: 'https://api.example.test', handleApiError: actor.handleApiError });
  await client.submit(40, checks);
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({ checks });
  expect((fetcher.mock.calls[0][1]!.headers as Headers).get('Authorization')).toBe('Bearer test-only-token');
  await expect(client.session(40)).rejects.toMatchObject({ status: 403 });
  await waitFor(() => expect(actor.handleApiError).toHaveBeenCalledTimes(1));
});
it('guards unsubmitted observations and focuses the first unanswered check', async () => {
  const client = api(); mount(client); await screen.findByRole('heading', { name: 'Danh mục quan sát' });
  fireEvent.click(within(screen.getByRole('radiogroup', { name: CHECK_ITEMS[0].label })).getByRole('radio', { name: 'Bình thường' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất kiểm tra trước buổi tập' }));
  await waitFor(() => expect(within(screen.getByRole('radiogroup', { name: CHECK_ITEMS[1].label })).getAllByRole('radio')[0]).toHaveFocus());
  fireEvent.click(screen.getByRole('link', { name: '← Quay lại hôm nay' }));
  expect(await screen.findByRole('dialog', { name: 'Thay đổi chưa lưu' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(within(screen.getByRole('radiogroup', { name: CHECK_ITEMS[0].label })).getByRole('radio', { name: 'Bình thường' })).toBeChecked();
});
