import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { ApiError, type AuthApi, type CurrentUser } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { ROLE_CODES, type RoleCode } from '../../shared/auth/roles';
import { RegistrationProvider } from './RegistrationProvider';
import { registrationRoutes } from './routes';
import { NEUTRAL_CONFIRMATION, type RegistrationPage, type RegistrationRequest, type RegistrationService } from './types';

const pending: RegistrationRequest = { id: 5, fullName: 'Applicant fixture', email: 'applicant@example.test', status: 'PENDING_APPROVAL', requestedAt: '2026-10-18T01:00:00Z' };
const page = (items = [pending], number = 0, size = 20): RegistrationPage => ({ items, page: number, size, totalItems: items.length, totalPages: items.length ? 1 : 0 });
const manager: CurrentUser = { id: 2, userCode: 'CM-2', fullName: 'Manager fixture', email: 'manager@example.test', roles: ['CLUB_MANAGER'], accountStatus: 'ACTIVE' };
function service(): RegistrationService {
  return { register: vi.fn().mockResolvedValue(undefined), list: vi.fn().mockResolvedValue(page()), approve: vi.fn().mockResolvedValue({ ...pending, status: 'APPROVED', approvedRoleCode: 'GROOM' }), reject: vi.fn().mockResolvedValue({ ...pending, status: 'REJECTED' }) };
}
function mount(path = '/admin/registrations', options: { signedIn?: boolean; roles?: RoleCode[]; selected?: RegistrationService } = {}) {
  localStorage.clear(); sessionStorage.clear();
  if (options.signedIn !== false) authSession.save('test-only-session', 3600, false);
  const api: AuthApi = { currentUser: vi.fn().mockResolvedValue({ ...manager, roles: options.roles ?? manager.roles }), login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) };
  const selected = options.selected ?? service();
  const router = createMemoryRouter([...registrationRoutes, { path: '/login', lazy: async () => ({ Component: (await import('../../pages/LoginPage')).LoginPage }) }, { path: '/dashboard', element: <h1>Existing role workspace</h1> }], { initialEntries: [path] });
  render(<AuthProvider api={api}><RegistrationProvider service={selected}><RouterProvider router={router} /></RegistrationProvider></AuthProvider>);
  return { selected, router, api };
}
async function fillPublic() {
  fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Applicant fixture' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'applicant@example.test' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'FixturePassword123' } });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: 'FixturePassword123' } });
}
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });

describe('CORE-048 public registration', () => {
  it('submits a neutral access request, clears passwords and never logs in or stores applicant credentials', async () => {
    const { selected, api } = mount('/register', { signedIn: false });
    await fillPublic();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu truy cập' }));
    expect(await screen.findByText(NEUTRAL_CONFIRMATION)).toBeInTheDocument();
    expect(selected.register).toHaveBeenCalledWith({ fullName: 'Applicant fixture', email: 'applicant@example.test', password: 'FixturePassword123', confirmPassword: 'FixturePassword123' });
    expect(api.login).not.toHaveBeenCalled();
    expect(authSession.read()).toBeNull();
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
    expect(document.querySelector('input[type=password]')).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Quay lại đăng nhập' }));
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
  it('validates password length without browser UTF-16 truncation', async () => {
    const { selected } = mount('/register', { signedIn: false }); await fillPublic();
    const password = 'A1' + 'a'.repeat(58) + '🐎'.repeat(3);
    expect(Array.from(password)).toHaveLength(63);
    expect(new TextEncoder().encode(password)).toHaveLength(72);
    expect(screen.getByLabelText('Mật khẩu')).not.toHaveAttribute('maxlength');
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: password } });
    await userEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu truy cập' }));
    await screen.findByText(NEUTRAL_CONFIRMATION);
    expect(selected.register).toHaveBeenCalledWith(expect.objectContaining({ password, confirmPassword: password }));
  });
  it('blocks mismatched credentials and allows correction', async () => {
    const { selected } = mount('/register', { signedIn: false });
    await fillPublic();
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: 'mismatch' } });
    await userEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu truy cập' }));
    expect(await screen.findByText('Mật khẩu nhập lại không khớp.')).toBeInTheDocument();
    expect(selected.register).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Mật khẩu')).toHaveValue('FixturePassword123');
  });
  it.each([400, 429, 500])('keeps public HTTP %s neutral without exposing server details', async (status) => {
    const selected = service(); vi.mocked(selected.register).mockRejectedValue(new ApiError(status, 'VALIDATION_ERROR', 'Email exists / secret-password-value'));
    mount('/register', { signedIn: false, selected }); await fillPublic();
    await userEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu truy cập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 429 ? 'Quá nhiều yêu cầu' : 'Chưa xác nhận được yêu cầu');
    expect(screen.queryByText(/Email exists|secret-password-value/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('applicant@example.test');
  });
  it('prevents duplicate submissions and disables fields during the request', async () => {
    let resolve!: () => void;
    const selected = service(); vi.mocked(selected.register).mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    mount('/register', { signedIn: false, selected }); await fillPublic();
    const form = screen.getByRole('button', { name: 'Gửi yêu cầu truy cập' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(selected.register).toHaveBeenCalledOnce(); expect(screen.getByLabelText('Mật khẩu')).toBeDisabled();
    await act(async () => resolve()); await screen.findByText(NEUTRAL_CONFIRMATION);
  });
  it('shows/hides passwords and cancels to the existing login without submitting', async () => {
    const { selected } = mount('/register', { signedIn: false }); await fillPublic();
    await userEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('link', { name: /← Quay lại đăng nhập/ }));
    await screen.findByRole('button', { name: 'Đăng nhập' }); expect(selected.register).not.toHaveBeenCalled();
  });
  it('keeps signed-in actors on their existing workspace rather than registering another account', async () => {
    const { selected } = mount('/register');
    await screen.findByRole('heading', { name: 'Existing role workspace' });
    expect(selected.register).not.toHaveBeenCalled();
  });
});

describe('CORE-048 review access and lifecycle', () => {
  it.each(ROLE_CODES.filter((role) => role !== 'CLUB_MANAGER'))('denies %s before requesting registrations', async (role) => {
    const { selected } = mount(undefined, { roles: [role] });
    await screen.findByText('Chỉ Club Manager được duyệt đăng ký.');
    expect(selected.list).not.toHaveBeenCalled();
  });
  it('redirects anonymous review to shared sign-in without an admin request', async () => {
    const { selected } = mount(undefined, { signedIn: false });
    await screen.findByRole('button', { name: 'Đăng nhập' }); expect(selected.list).not.toHaveBeenCalled();
  });
  it('accepts a multi-role Club Manager and loads through the shared session', async () => {
    const { selected } = mount(undefined, { roles: ['GROOM', 'CLUB_MANAGER'] });
    await screen.findByText('Applicant fixture');
    expect(selected.list).toHaveBeenCalledWith({ page: 0, size: 20 }, expect.objectContaining({ token: 'test-only-session', signal: expect.any(AbortSignal) }));
  });
  it('requires one explicit role, confirms approval and reads updated server state', async () => {
    const selected = service(); let approved = false;
    vi.mocked(selected.list).mockImplementation(async () => page([{ ...pending, ...(approved ? { status: 'APPROVED' as const, approvedRoleCode: 'GROOM' as const, createdUserId: 9 } : {}) }]));
    vi.mocked(selected.approve).mockImplementation(async () => { approved = true; return { ...pending, status: 'APPROVED', approvedRoleCode: 'GROOM' }; });
    mount(undefined, { selected });
    await userEvent.click(await screen.findByRole('button', { name: 'Duyệt yêu cầu 5' }));
    expect(screen.getByLabelText('Vai trò được cấp')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));
    expect(await screen.findByText('Hãy chọn đúng một vai trò trước khi duyệt.')).toBeInTheDocument(); expect(selected.approve).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText('Vai trò được cấp'), 'GROOM');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));
    await screen.findByText('Đã duyệt yêu cầu 5.'); await screen.findByText('Đã đánh giá');
    expect(selected.approve).toHaveBeenCalledWith(5, 'GROOM', { token: 'test-only-session' });
    expect(screen.queryByRole('button', { name: 'Duyệt yêu cầu 5' })).not.toBeInTheDocument();
  });
  it('rejects with a reason and keeps the reason on the decided request', async () => {
    const selected = service(); let rejected = false;
    vi.mocked(selected.list).mockImplementation(async () => page([{ ...pending, ...(rejected ? { status: 'REJECTED' as const, decisionReason: 'Not eligible' } : {}) }]));
    vi.mocked(selected.reject).mockImplementation(async () => { rejected = true; return { ...pending, status: 'REJECTED', decisionReason: 'Not eligible' }; });
    mount(undefined, { selected }); await userEvent.click(await screen.findByRole('button', { name: 'Từ chối yêu cầu 5' }));
    fireEvent.change(screen.getByLabelText('Lý do từ chối (không bắt buộc)'), { target: { value: 'Not eligible' } });
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    await screen.findByText('Đã từ chối yêu cầu 5.'); await screen.findByText('Not eligible');
    expect(selected.reject).toHaveBeenCalledWith(5, 'Not eligible', { token: 'test-only-session' });
  });
  it('cancels a review without writing or selecting a default role', async () => {
    const { selected } = mount(); await userEvent.click(await screen.findByRole('button', { name: 'Duyệt yêu cầu 5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(selected.approve).not.toHaveBeenCalled(); expect(selected.reject).not.toHaveBeenCalled();
  });
  it('blocks duplicate decisions until the pending mutation completes', async () => {
    let finish!: (value: RegistrationRequest) => void; const selected = service();
    vi.mocked(selected.approve).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    mount(undefined, { selected }); await userEvent.click(await screen.findByRole('button', { name: 'Duyệt yêu cầu 5' }));
    await userEvent.selectOptions(screen.getByLabelText('Vai trò được cấp'), 'GROOM');
    const dialog = screen.getByRole('dialog'); const form = dialog.querySelector('form')!;
    fireEvent.submit(form); fireEvent.submit(form); expect(selected.approve).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Vai trò được cấp')).toBeDisabled();
    await act(async () => finish({ ...pending, status: 'APPROVED', approvedRoleCode: 'GROOM' }));
  });
  it('keeps a 409 decision unconfirmed and refreshes before another decision', async () => {
    const selected = service(); vi.mocked(selected.approve).mockRejectedValue(new ApiError(409, 'CONFLICT', 'Changed'));
    mount(undefined, { selected }); await userEvent.click(await screen.findByRole('button', { name: 'Duyệt yêu cầu 5' }));
    await userEvent.selectOptions(screen.getByLabelText('Vai trò được cấp'), 'GROOM'); await userEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));
    await screen.findByText('Không xử lý được yêu cầu này. Hãy làm mới danh sách rồi quyết định lại.');
    expect(screen.getByLabelText('Vai trò được cấp')).toHaveValue('GROOM'); expect(screen.getByRole('button', { name: 'Xác nhận duyệt' })).toBeDisabled();
    expect(screen.queryByText('Đã duyệt yêu cầu 5.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng và làm mới' })); await screen.findByText('Applicant fixture');
    expect(selected.list).toHaveBeenCalledTimes(2);
  });
  it('keeps a confirmed approval successful if list readback fails', async () => {
    const selected = service(); vi.mocked(selected.list).mockResolvedValueOnce(page()).mockRejectedValue(new Error('Readback failed'));
    mount(undefined, { selected }); await userEvent.click(await screen.findByRole('button', { name: 'Duyệt yêu cầu 5' }));
    await userEvent.selectOptions(screen.getByLabelText('Vai trò được cấp'), 'GROOM'); await userEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));
    await screen.findByText('Đã duyệt yêu cầu 5.'); await screen.findByText('Readback failed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Duyệt yêu cầu 5' })).not.toBeInTheDocument();
  });
  it('keeps a rejected API decision editable without claiming success', async () => {
    const selected = service(); vi.mocked(selected.reject).mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'Reason invalid'));
    mount(undefined, { selected }); await userEvent.click(await screen.findByRole('button', { name: 'Từ chối yêu cầu 5' }));
    fireEvent.change(screen.getByLabelText('Lý do từ chối (không bắt buộc)'), { target: { value: 'Original reason' } });
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' })); await screen.findByText('Reason invalid');
    expect(screen.getByLabelText('Lý do từ chối (không bắt buộc)')).toHaveValue('Original reason'); expect(screen.queryByText('Đã từ chối yêu cầu 5.')).not.toBeInTheDocument();
  });
  it.each([401, 403])('delegates HTTP %s correctly to shared authentication', async (status) => {
    const selected = service(); vi.mocked(selected.list).mockRejectedValue(new ApiError(status, status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', 'Not allowed'));
    mount(undefined, { selected });
    if (status === 401) { await screen.findByRole('button', { name: 'Đăng nhập' }); expect(authSession.read()).toBeNull(); }
    else { await screen.findByText('Không có quyền truy cập'); expect(authSession.read()).not.toBeNull(); expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument(); }
  });
  it('supports empty/loading/error and retry without fabricated rows', async () => {
    const selected = service(); vi.mocked(selected.list).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(page([]));
    mount(undefined, { selected }); await screen.findByText('Offline');
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByText('Không có yêu cầu đăng ký');
    expect(selected.list).toHaveBeenCalledTimes(2);
  });
  it('validates deep links before requesting data and recovers via Reset filters', async () => {
    const { selected } = mount('/admin/registrations?status=ACTIVE&page=-1');
    await screen.findByText('Bộ lọc đăng ký không hợp lệ'); expect(selected.list).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' })); await screen.findByText('Applicant fixture'); expect(selected.list).toHaveBeenCalledOnce();
  });
  it('retains server filters across pagination and resets page when size changes', async () => {
    const selected = service(); vi.mocked(selected.list).mockImplementation(async (query) => ({ ...page(), page: query.page, size: query.size, totalItems: 21, totalPages: Math.ceil(21 / query.size) }));
    const { router } = mount('/admin/registrations?status=PENDING_APPROVAL', { selected }); await screen.findByText('Applicant fixture');
    await userEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() => expect(selected.list).toHaveBeenLastCalledWith({ page: 1, size: 20, status: 'PENDING_APPROVAL' }, expect.anything()));
    await screen.findByText('Applicant fixture'); await userEvent.selectOptions(screen.getByLabelText('Số yêu cầu mỗi trang'), '10');
    await waitFor(() => expect(selected.list).toHaveBeenLastCalledWith({ page: 0, size: 10, status: 'PENDING_APPROVAL' }, expect.anything()));
    expect(router.state.location.search).toContain('status=PENDING_APPROVAL');
  });
  it('ignores old filter responses and aborts a previous read', async () => {
    const selected = service(); let finish!: (value: RegistrationPage) => void;
    vi.mocked(selected.list).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue(page([{ ...pending, fullName: 'Fresh result' }]));
    const { router } = mount(undefined, { selected }); await screen.findByText('Đang tải yêu cầu đăng ký…');
    await act(() => router.navigate('/admin/registrations?status=PENDING_APPROVAL'));
    await screen.findByText('Fresh result'); expect(vi.mocked(selected.list).mock.calls[0][1].signal?.aborted).toBe(true);
    await act(async () => finish(page([{ ...pending, fullName: 'Stale result' }])));
    expect(screen.queryByText('Stale result')).not.toBeInTheDocument();
  });
  it('renders applicant content as text and never exposes arbitrary secret fields', async () => {
    const selected = service(); vi.mocked(selected.list).mockResolvedValue(page([{ ...pending, fullName: '<img src=x onerror=bad()>', password_hash: 'PRIVATE_HASH' } as RegistrationRequest]));
    mount(undefined, { selected }); const table = await screen.findByRole('table');
    expect(within(table).getByText('<img src=x onerror=bad()>')).toBeInTheDocument(); expect(table.querySelector('img')).toBeNull(); expect(screen.queryByText('PRIVATE_HASH')).not.toBeInTheDocument();
  });
});
