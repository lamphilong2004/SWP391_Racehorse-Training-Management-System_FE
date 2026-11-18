import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { StableCarePage } from './StableCarePage';
import type { RoleCode } from '../../shared/auth/roles';
import { formatDate } from '../horses/shared/format';
const state = vi.hoisted(() => ({ id: 2, role: 'GROOM' as RoleCode, token: 'fixture-token-a', handle: vi.fn(() => false) }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: state.id, fullName: 'Groom fixture', roles: [state.role] }, handleApiError: state.handle }) }));
vi.mock('../../shared/auth/authSession', () => ({ authSession: { read: () => ({ accessToken: state.token }) } }));
vi.mock('../../layout/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
const currentDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const task = (name = 'Sao Mai') => ({ id: 10, horseId: 1, horseName: name, horseCode: 'SM', source: 'CARE', taskType: 'CLEANING', taskDate: currentDate(), slot: '00:00', instructions: 'Quan sát và vệ sinh', groomUserId: 2, groomName: 'Groom fixture', boxCode: 'A-01', completedAt: null, cancelledAt: null, cancellationReason: null });
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = () => new Response(JSON.stringify({ success: false, error: { code: 'CONFLICT', message: 'Stock changed.', details: [] } }), { status: 409 });
function element(path: string) { return <RouterProvider router={createMemoryRouter([{ path: '*', element: <StableCarePage /> }], { initialEntries: [path] })} />; }
function mount(path: string) { return render(element(path)); }
beforeEach(() => { state.id = 2; state.role = 'GROOM'; state.token = 'fixture-token-a'; state.handle.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Flow 4 API-only UI', () => {
  it('groups task actions by horse and requires explicit confirmation before cancellation', async () => {
    state.role = 'CLUB_MANAGER';
    const fetcher = vi.fn<typeof fetch>(async () => ok([task()]));
    vi.stubGlobal('fetch', fetcher); mount('/care/daily');
    const group = await screen.findByRole('group', { name: 'Thao tác cho Sao Mai' });
    expect(within(group).queryByRole('button', { name: 'Hủy công việc' })).not.toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: 'Thao tác' }));
    const cancel = within(group).getByRole('button', { name: 'Hủy công việc' });
    expect(within(group).getByRole('button', { name: 'Đổi Groom' })).toBeEnabled();
    expect(within(group).getByRole('button', { name: 'Lịch sử' })).toBeEnabled();
    fireEvent.click(cancel);
    const dialog = await screen.findByRole('dialog', { name: 'Hủy công việc' });
    expect(within(dialog).getByRole('button', { name: 'Xác nhận hủy công việc' })).toBeDisabled();
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('sends selected meal/unit values without converting quantity and keeps custom text after a rejected save', async () => {
    state.role = 'CLUB_MANAGER';
    const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') return fail();
      return String(url).endsWith('/horses') ? ok([{ id: 1, name: 'Sao Mai', horseCode: 'SM' }]) : String(url).endsWith('/grooms') ? ok([{ id: 2, fullName: 'Groom fixture' }]) : ok([]);
    });
    vi.stubGlobal('fetch', fetcher);mount('/stable');
    await screen.findByRole('option', { name: 'Sao Mai · SM' });
    fireEvent.change(screen.getByLabelText('Ngựa'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Loại kế hoạch'), { target: { value: 'nutrition' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo kế hoạch dinh dưỡng' }));
    await screen.findByRole('option', { name: 'Groom fixture' });
    fireEvent.change(screen.getByLabelText('Groom phụ trách'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Bữa 1'), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText('Số lượng'), { target: { value: '2.5' } });
    fireEvent.change(screen.getByLabelText('Đơn vị'), { target: { value: 'g' } });
    expect(screen.getByLabelText('Số lượng')).toHaveValue(2.5);
    fireEvent.change(screen.getByLabelText('Đơn vị'), { target: { value: '__CUSTOM_VALUE__' } });
    fireEvent.change(screen.getByLabelText('Đơn vị (nhập thêm)'), { target: { value: 'bao riêng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch & giao việc' }));
    await screen.findByText('Stock changed.');
    expect(screen.getByLabelText('Bữa 1')).toHaveValue('12:00');
    expect(screen.getByLabelText('Đơn vị (nhập thêm)')).toHaveValue('bao riêng');
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ items: [{ meal: '12:00', component: 'HAY', quantity: 2.5, unit: 'bao riêng' }] });
    expect(screen.queryByText(/Máy chủ đã xác nhận lưu/)).not.toBeInTheDocument();
  });
  it('counts pending, completed and cancelled work separately from actual loaded tasks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok([task('Cần làm'), { ...task('Đã làm'), id: 11, completedAt: new Date().toISOString() }, { ...task('Đã bỏ'), id: 12, cancelledAt: new Date().toISOString(), cancellationReason: 'Đổi lịch' }])));
    mount('/care/daily');const summary = await screen.findByRole('region', { name: 'Tổng hợp công việc trong ngày' });
    for (const [label, value] of [['Tổng công việc', '3'], ['Cần thực hiện', '1'], ['Đã hoàn thành', '1'], ['Đã hủy', '1']]) {
      const card = within(summary).getByText(label, { exact: true }).parentElement!.parentElement!;
      expect(within(card).getByText(value, { exact: true })).toBeInTheDocument();
    }
  });
  it('reassigns a pending task with an explicit reason and the expected current Groom', async () => {
    state.role = 'CLUB_MANAGER'; let assigned = false;
    const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') { assigned = true; return ok({ ...task(), groomUserId: 3 }); }
      return String(url).endsWith('/grooms') ? ok([{ id: 2, fullName: 'Groom fixture' }, { id: 3, fullName: 'Groom dự phòng' }]) : ok([{ ...task(), groomName: assigned ? 'Groom dự phòng' : 'Groom fixture' }]);
    });
    vi.stubGlobal('fetch', fetcher); mount('/care/daily');fireEvent.click(await screen.findByRole('button', { name: 'Thao tác' }));fireEvent.click(screen.getByRole('button', { name: 'Đổi Groom' }));
    expect(screen.getByLabelText('Ngày công việc (giờ Việt Nam)')).toBeDisabled();
    await screen.findByRole('option', { name: 'Groom dự phòng' });expect(within(screen.getByRole('dialog')).queryByRole('option', { name: 'Groom fixture' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Groom thay thế'), { target: { value: '3' } });fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Đổi ca trực' } });fireEvent.click(screen.getByRole('button', { name: 'Lưu phân công' }));
    await screen.findByText('Đã đổi Groom phụ trách và gửi thông báo cho Groom mới.');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();await waitFor(() => expect(screen.getByLabelText('Ngày công việc (giờ Việt Nam)')).toBeEnabled());
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');expect(String(post?.[0])).toMatch(/\/tasks\/10\/reassign$/);expect(JSON.parse(String(post?.[1]?.body))).toEqual({ expectedGroomUserId: 2, groomUserId: 3, reason: 'Đổi ca trực' });
  });
  it('preserves cancellation reason and shows no success after a conflict', async () => {
    state.role = 'CLUB_MANAGER';vi.stubGlobal('fetch', vi.fn(async (_url, init) => init?.method === 'POST' ? fail() : ok([task()])));
    mount('/care/daily');fireEvent.click(await screen.findByRole('button', { name: 'Thao tác' }));fireEvent.click(screen.getByRole('button', { name: 'Hủy công việc' }));fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Giữ lý do' } });fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy công việc' }));
    await screen.findByText('Stock changed.');expect(screen.getByLabelText('Lý do thay đổi')).toHaveValue('Giữ lý do');expect(screen.queryByText(/Đã hủy công việc/)).not.toBeInTheDocument();
  });
  it('does not offer mutations on cancelled/completed/past work and filters cancellation separately', async () => {
    state.role = 'CLUB_MANAGER';vi.stubGlobal('fetch', vi.fn(async () => ok([{ ...task('Đã hủy'), cancelledAt: new Date().toISOString(), cancellationReason: 'Lịch thay đổi' }, { ...task('Đã xong'), id: 11, completedAt: new Date().toISOString() }])));
    mount('/care/daily');await screen.findByText('Đã xong');expect(screen.queryByRole('button', { name: 'Đổi Groom' })).not.toBeInTheDocument();expect(screen.queryByRole('button', { name: 'Hủy công việc' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'cancelled' } });expect(screen.queryByText('Đã xong')).not.toBeInTheDocument();expect(screen.getByText('Lịch thay đổi')).toBeInTheDocument();
  });
  it('keeps Groom readonly for assignment changes and renders server history', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => String(url).endsWith('/changes') ? ok([{ id: 1, changeType: 'REASSIGN', previousGroomName: 'Groom A', newGroomName: 'Groom B', changedBy: 'Manager', changedAt: new Date().toISOString(), reason: 'Đổi ca đã xác nhận' }]) : ok([task()])));
    mount('/care/daily');await screen.findByText('Sao Mai');expect(screen.queryByRole('button', { name: 'Đổi Groom' })).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button', { name: 'Lịch sử' }));await screen.findByText('Groom A → Groom B');expect(screen.getByText('Đổi ca đã xác nhận')).toBeInTheDocument();
  });
  it('Head Trainer can change nutrition tasks but cannot change care tasks', async () => {
    state.role = 'HEAD_TRAINER';vi.stubGlobal('fetch', vi.fn(async () => ok([task('Chăm sóc'), { ...task('Khẩu phần'), id: 11, source: 'NUTRITION' }])));
    mount('/care/daily');await screen.findByText('Khẩu phần');expect(screen.getAllByRole('button', { name: 'Thao tác' })).toHaveLength(1);fireEvent.click(screen.getByRole('button', { name: 'Thao tác' }));expect(screen.getAllByRole('button', { name: 'Đổi Groom' })).toHaveLength(1);expect(screen.getAllByRole('button', { name: 'Hủy công việc' })).toHaveLength(1);
  });
  it('completes only after server confirmation and reports incident through the existing route', async () => {
    let completed = false;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') { completed = true; return ok({ ...task(), completedAt: new Date().toISOString() }); }
      return ok([{ ...task(), completedAt: completed ? new Date().toISOString() : null }]);
    });
    vi.stubGlobal('fetch', fetcher); mount('/care/daily');
    await screen.findByText('Sao Mai'); expect(screen.getByRole('button', { name: 'Báo bất thường' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hoàn thành' })).toBeDisabled());
    expect(fetcher.mock.calls.some(([url, init]) => String(url).endsWith('/api/stable-care/tasks/10/complete') && init?.method === 'POST')).toBe(true);
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes('/movements'))).toBe(true);
  });
  it('offers a receipt for a care incident only after the server confirms it', async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => init?.method === 'POST'
      ? ok({ id: 21, incidentCode: 'INC-0021' }) : ok([task()]));
    vi.stubGlobal('fetch', fetcher);
    mount('/care/daily');
    fireEvent.click(await screen.findByRole('button', { name: 'Báo bất thường' }));
    const dialog = await screen.findByRole('dialog', { name: 'Báo cáo sự cố' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bỏ ăn' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thấp' }));
    fireEvent.change(within(dialog).getByLabelText('Mô tả *'), { target: { value: 'Chưa ăn phần được giao' } });
    expect(screen.queryByRole('link', { name: 'Theo dõi báo cáo' })).not.toBeInTheDocument();
    fireEvent.submit(dialog.querySelector('form')!);
    expect(await screen.findByRole('link', { name: 'Theo dõi báo cáo' })).toHaveAttribute('href', '/incidents/21');
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ careTaskId: 10, horseId: 1, incidentType: 'OFF_FEED' });
  });
  it('does not fake completion when API fails and permits retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => init?.method === 'POST' ? fail() : ok([task()])));
    mount('/care/daily'); await screen.findByText('Sao Mai');fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));
    await screen.findByText('Stock changed.');expect(screen.getByRole('button', { name: 'Hoàn thành' })).toBeEnabled();
    expect(screen.queryByText('Máy chủ đã xác nhận thao tác.')).not.toBeInTheDocument();
  });
  it('does not permit completing future daily work', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok([task()])));mount('/care/daily');await screen.findByText('Sao Mai');
    fireEvent.change(screen.getByLabelText('Ngày công việc (giờ Việt Nam)'), { target: { value: '2099-01-01' } });
    await screen.findByText('Sao Mai');expect(screen.queryByRole('button', { name: 'Hoàn thành' })).not.toBeInTheDocument();
  });
  it('shows Hoàn thành at the Vietnam slot without a reload', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T00:59:59Z'));
    vi.stubGlobal('fetch', vi.fn(async () => ok([{ ...task(), slot: '08:00 · ca sáng' }])));
    mount('/care/daily');
    expect(await screen.findByText('Chưa đến giờ')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Hoàn thành' })).not.toBeInTheDocument();
    vi.setSystemTime(new Date('2026-11-03T01:00:00Z'));
    expect(await screen.findByRole('button', { name: 'Hoàn thành' }, { timeout: 2500 })).toBeEnabled();
  });
  it('drops old account data and ignores late responses after an account switch', async () => {
    let resolveOld!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; })).mockImplementation(async () => ok([task('Ngựa tài khoản mới')])));
    const view = mount('/care/daily');await waitFor(() => expect(resolveOld).toBeDefined());
    state.id = 3;state.token = 'fixture-token-b';view.rerender(element('/care/daily'));
    await screen.findByText('Ngựa tài khoản mới');await act(async () => resolveOld(ok([task('Ngựa tài khoản cũ')])));
    expect(screen.queryByText('Ngựa tài khoản cũ')).not.toBeInTheDocument();
  });
  it('keeps form values and disables Save when Groom dependency is unavailable', async () => {
    state.role = 'CLUB_MANAGER';
    vi.stubGlobal('fetch', vi.fn(async url => String(url).endsWith('/horses') ? ok([{ id: 1, name: 'Sao Mai', horseCode: 'SM' }]) : String(url).includes('/care-plans') ? ok([]) : fail()));
    mount('/stable');await screen.findByRole('option', { name: 'Sao Mai · SM' });fireEvent.change(screen.getByLabelText('Ngựa'), { target: { value: '1' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo kế hoạch chăm sóc' }));
    fireEvent.change(screen.getByLabelText('Hướng dẫn'), { target: { value: 'Giữ hướng dẫn đã nhập' } });await screen.findByText('Stock changed.');
    expect(screen.getByRole('button', { name: 'Lưu kế hoạch & giao việc' })).toBeDisabled();expect(screen.getByLabelText('Hướng dẫn')).toHaveValue('Giữ hướng dẫn đã nhập');
  });
  it('Head Trainer has nutrition editing but no care editing or inventory link', async () => {
    state.role = 'HEAD_TRAINER';vi.stubGlobal('fetch', vi.fn(async url => String(url).endsWith('/horses') ? ok([{ id: 1, name: 'Sao Mai', horseCode: 'SM' }]) : ok([])));
    mount('/stable');await screen.findByRole('option', { name: 'Sao Mai · SM' });fireEvent.change(screen.getByLabelText('Ngựa'), { target: { value: '1' } });
    await screen.findByText('Chưa có kế hoạch');expect(screen.queryByRole('button', { name: 'Tạo kế hoạch chăm sóc' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Loại kế hoạch'), { target: { value: 'nutrition' } });expect(await screen.findByRole('button', { name: 'Tạo kế hoạch dinh dưỡng' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kho vật tư' })).not.toBeInTheDocument();
  });
  it('does not report zero results or an empty list while loading or after an API error', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done; })));
    mount('/care/daily');await waitFor(() => expect(resolve).toBeDefined());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();expect(screen.queryByText(/0 kết quả/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tổng hợp công việc trong ngày' })).not.toBeInTheDocument();
    await act(async () => resolve(fail()));await screen.findByText('Stock changed.');
    expect(screen.queryByText('Không có công việc phù hợp')).not.toBeInTheDocument();expect(screen.queryByRole('table')).not.toBeInTheDocument();expect(screen.queryByText(/0 kết quả/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tổng hợp công việc trong ngày' })).not.toBeInTheDocument();
  });
  it('keeps dirty plan values on Cancel or navigation until explicitly discarded', async () => {
    state.role = 'CLUB_MANAGER';vi.stubGlobal('fetch', vi.fn(async url => String(url).endsWith('/horses') ? ok([{ id: 1, name: 'Sao Mai', horseCode: 'SM' }]) : String(url).endsWith('/grooms') ? ok([{ id: 2, fullName: 'Groom' }]) : ok([])));
    mount('/stable');await screen.findByRole('option', { name: 'Sao Mai · SM' });fireEvent.change(screen.getByLabelText('Ngựa'), { target: { value: '1' } });fireEvent.click(await screen.findByRole('button', { name: 'Tạo kế hoạch chăm sóc' }));
    fireEvent.change(screen.getByLabelText('Hướng dẫn'), { target: { value: 'Nội dung chưa lưu' } });expect(screen.getByLabelText('Ngựa')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));const cancel = await screen.findByRole('dialog', { name: 'Hủy thay đổi chưa lưu?' });fireEvent.click(within(cancel).getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));expect(screen.getByLabelText('Hướng dẫn')).toHaveValue('Nội dung chưa lưu');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Chăm sóc chuồng' })).getByRole('link', { name: 'Chăm sóc hằng ngày' }));const navigation = await screen.findByRole('dialog', { name: 'Thay đổi chưa lưu' });fireEvent.click(within(navigation).getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));expect(screen.getByLabelText('Hướng dẫn')).toHaveValue('Nội dung chưa lưu');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));fireEvent.click(within(await screen.findByRole('dialog', { name: 'Hủy thay đổi chưa lưu?' })).getByRole('button', { name: 'Hủy thay đổi' }));expect(screen.queryByLabelText('Hướng dẫn')).not.toBeInTheDocument();expect(screen.getByLabelText('Ngựa')).toBeEnabled();
  });
  it('announces confirmed plan save after the editor is closed', async () => {
    state.role = 'CLUB_MANAGER';let saved = false;
    const plan = { id: 11, horseId: 1, horseName: 'Sao Mai', from: currentDate(), to: currentDate(), notes: '', groomUserId: 2, careItems: [{ taskType: 'CLEANING', timeSlot: '08:00', instructions: 'Vệ sinh' }], nutritionItems: [] };
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (init?.method === 'POST') { saved = true; return ok(plan); }
      return String(url).endsWith('/horses') ? ok([{ id: 1, name: 'Sao Mai', horseCode: 'SM' }]) : String(url).endsWith('/grooms') ? ok([{ id: 2, fullName: 'Groom' }]) : ok(saved ? [plan] : []);
    }));
    mount('/stable');await screen.findByRole('option', { name: 'Sao Mai · SM' });fireEvent.change(screen.getByLabelText('Ngựa'), { target: { value: '1' } });fireEvent.click(await screen.findByRole('button', { name: 'Tạo kế hoạch chăm sóc' }));await screen.findByRole('option', { name: 'Groom' });fireEvent.change(screen.getByLabelText('Groom phụ trách'), { target: { value: '2' } });fireEvent.change(screen.getByLabelText('Hướng dẫn'), { target: { value: 'Vệ sinh' } });fireEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch & giao việc' }));
    await screen.findByText('Đã lưu kế hoạch và cập nhật công việc được giao.');expect(screen.queryByLabelText('Hướng dẫn')).not.toBeInTheDocument();expect(await screen.findByText(`${formatDate(currentDate())} – ${formatDate(currentDate())}`, { exact: false })).toBeInTheDocument();
  });
});

describe('Flow 4 approved Tailwind interaction patterns', () => {
  const stock = [
    { id: 1, name: 'Cỏ khô', category: 'FEED', unit: 'kg', currentQuantity: 8, threshold: 10, active: true },
    { id: 2, name: 'Băng quấn chân', category: 'MEDICAL_SUPPLY', unit: 'cuộn', currentQuantity: 24, threshold: 5, active: true },
    { id: 3, name: 'Dụng cụ cũ', category: 'TOOL', unit: 'cái', currentQuantity: 0, threshold: 2, active: false },
  ];
  it('keeps quick task filters and the status field synchronized without a write', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-18T02:00:00Z'));
    const fetcher = vi.fn<typeof fetch>(async () => ok([task('Quá giờ'), { ...task('Sắp tới'), id: 11, slot: '23:00' }]));
    vi.stubGlobal('fetch', fetcher); mount('/care/daily');
    const filters = await screen.findByRole('group', { name: 'Lọc nhanh công việc' });
    fireEvent.click(within(filters).getByRole('button', { name: 'Quá giờ · 1' }));
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('overdue');
    expect(screen.queryByText('Sắp tới', { exact: true })).not.toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: 'Quá giờ · 1' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'upcoming' } });
    expect(within(filters).getByRole('button', { name: 'Quá giờ · 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Sắp tới', { exact: true })).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: 'Tất cả · 2' }));
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('');
    expect(fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });
  it('combines inventory search and stock filters, excludes inactive low stock, and clears both', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => ok(String(url).includes('/replenishments') ? [] : stock)));
    mount('/inventory'); await screen.findByText('Cỏ khô');
    fireEvent.change(screen.getByLabelText('Tình trạng tồn kho'), { target: { value: 'low' } });
    expect(screen.getByText('Cỏ khô')).toBeInTheDocument();
    expect(screen.queryByText('Dụng cụ cũ')).not.toBeInTheDocument();
    expect(screen.queryByText('Băng quấn chân')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tìm vật tư / nhóm'), { target: { value: 'không tồn tại' } });
    expect(screen.getByText('Không có vật tư phù hợp')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc vật tư' }));
    expect(screen.getByLabelText('Tìm vật tư / nhóm')).toHaveValue('');
    expect(screen.getByLabelText('Tình trạng tồn kho')).toHaveValue('');
    expect(screen.getByText('Dụng cụ cũ')).toBeInTheDocument();
  });
  it('does not show inventory totals or an empty inventory while loading or after a read error', async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(url => String(url).includes('/replenishments') ? Promise.resolve(ok([])) : new Promise<Response>(done => { finish = done; })));
    mount('/inventory'); await waitFor(() => expect(finish).toBeDefined());
    expect(screen.queryByRole('region', { name: 'Tổng hợp vật tư đã tải' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Kho vật tư' })).not.toBeInTheDocument();
    await act(async () => finish(fail())); await screen.findByText('Stock changed.');
    expect(screen.queryByRole('region', { name: 'Tổng hợp vật tư đã tải' })).not.toBeInTheDocument();
    expect(screen.queryByText('Không có vật tư phù hợp')).not.toBeInTheDocument();
  });
  it('keeps a Groom replenishment draft after conflict and never sends a stock movement', async () => {
    const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => init?.method === 'POST' ? fail() : ok(String(url).endsWith('/inventory') ? stock : []));
    vi.stubGlobal('fetch', fetcher); mount('/inventory'); await screen.findByText('Cỏ khô');
    expect(screen.queryByRole('button', { name: 'Thêm vật tư' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nhập / xuất' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Đề nghị bổ sung' })[0]);
    fireEvent.change(screen.getByLabelText('Số lượng đề nghị (kg)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Lý do bổ sung'), { target: { value: 'Cần cho ca chiều' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu bổ sung' }));
    await screen.findByText('Stock changed.');
    expect(screen.getByLabelText('Số lượng đề nghị (kg)')).toHaveValue(3);
    expect(screen.getByLabelText('Lý do bổ sung')).toHaveValue('Cần cho ca chiều');
    const writes = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(writes).toHaveLength(1); expect(String(writes[0][0])).toMatch(/replenishments$/);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ inventoryItemId: 1, quantity: 3, reason: 'Cần cho ca chiều' });
    expect(screen.queryByText('Đã gửi yêu cầu bổ sung. Tồn kho chưa thay đổi.')).not.toBeInTheDocument();
  });
  it('shows Vet a read-only ledger and preserves Manager stock-write payload and double-submit protection', async () => {
    state.role = 'VETERINARIAN';
    vi.stubGlobal('fetch', vi.fn(async url => ok(String(url).endsWith('/inventory') ? stock : [])));
    const view = mount('/inventory'); await screen.findByText('Cỏ khô');
    expect(screen.queryByRole('button', { name: 'Thêm vật tư' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Xem sổ kho' })[0]);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument(); view.unmount();
    state.role = 'CLUB_MANAGER'; let finish!: (value: Response) => void;
    const fetcher = vi.fn((url: unknown, init?: RequestInit) => init?.method === 'POST' ? new Promise<Response>(done => { finish = done; }) : Promise.resolve(ok(String(url).endsWith('/inventory') ? stock : [])));
    vi.stubGlobal('fetch', fetcher); mount('/inventory'); await screen.findByText('Cỏ khô');
    fireEvent.click(screen.getAllByRole('button', { name: 'Nhập / xuất' })[0]);
    fireEvent.change(screen.getByLabelText('Biến động (kg): nhập dương, xuất âm'), { target: { value: '-2' } });
    fireEvent.change(screen.getByLabelText('Lý do nhập / xuất'), { target: { value: 'Xuất thực tế' } });
    const save = screen.getByRole('button', { name: 'Ghi biến động thực tế' });
    fireEvent.click(save); fireEvent.click(save);
    expect(save).toBeDisabled();
    const writes = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST'); expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ changeQuantity: -2, expectedQuantity: 8, note: 'Xuất thực tế' });
    await act(async () => finish(fail())); await screen.findByText('Stock changed.');
    expect(save).toBeEnabled(); expect(screen.getByLabelText('Lý do nhập / xuất')).toHaveValue('Xuất thực tế');
  });
});
