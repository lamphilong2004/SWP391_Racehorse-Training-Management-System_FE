import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider, useAuth } from '../../shared/auth/AuthProvider';
import { ApiError, type AuthApi, type CurrentUser } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { ROLE_CODES } from '../../shared/auth/roles';
import { OwnerProvider } from './OwnerProvider';
import { ownerRoutes } from './ownerRoutes';
import { createOwnerSampleTransport, ownerContractPending } from './ownerSampleTransport';
import { canonicalFixture, ownerA, ownerB } from './ownerFixtures.test-support';
import type { OwnerHorse, OwnerService } from './ownerModel';

function FixtureSession() {
  const auth = useAuth();
  return <><button onClick={() => void auth.login(ownerB.email, 'fixture-only', false)}>Fixture login B</button><button onClick={() => void auth.logout()}>Fixture logout</button></>;
}
function mount(path = '/owner/horses', options: { user?: CurrentUser | null; service?: OwnerService; noBinding?: boolean } = {}) {
  localStorage.clear(); sessionStorage.clear();
  let actor = options.user === undefined ? ownerA : options.user;
  if (actor) authSession.save('unit-owner-session', 3600, false);
  const snapshot = canonicalFixture();
  const readSamples = vi.fn(() => snapshot);
  const service = options.service ?? createOwnerSampleTransport({ readSamples, getBusinessActor: () => actor }, () => new Date('2026-10-18T00:00:00Z'));
  const api: AuthApi = { async currentUser() { return actor!; }, async login(input) { actor = input.email === ownerB.email ? ownerB : ownerA; return { user: actor, accessToken: `unit-owner-${actor.id}`, tokenType: 'Bearer', expiresIn: 3600 }; }, async logout() { actor = null; } };
  const router = createMemoryRouter([...ownerRoutes, { path: '/login', element: <h1>Shared login</h1> }, { path: '/dashboard', element: <h1>Existing workspace</h1> }], { initialEntries: [path] });
  const content = <><FixtureSession /><RouterProvider router={router} /></>;
  render(<AuthProvider api={api}>{options.noBinding ? content : <OwnerProvider service={service}>{content}</OwnerProvider>}</AuthProvider>);
  return { router, service, readSamples, snapshot };
}
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });

describe('CORE-056 read-only Owner journey', () => {
  it('lists only owned horses and opens the approved profile/health/training tabs', async () => {
    mount(); await screen.findByRole('heading', { name: 'Ngựa của tôi' });
    expect(screen.getByRole('heading', { name: 'Thunder Bolt' })).toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Ocean Pride' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Xem ngựa/ }));
    await screen.findByRole('heading', { name: 'Hồ sơ' });
    expect(screen.getByText('Northern Star')).toBeInTheDocument(); expect(screen.getByText('CHỈ XEM')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Sức khỏe & mức sẵn sàng' }));
    await screen.findByText('Bản tóm tắt dành cho chủ ngựa, do Veterinarian của câu lạc bộ cập nhật.');
    expect(screen.getByText(/Cổng này không hiển thị chi tiết y tế như chẩn đoán, điều trị và thuốc\. Chỉ Veterinarian được thay đổi sức khỏe hoặc mức sẵn sàng\./)).toBeInTheDocument();
    expect(screen.queryByText('512 kg')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Huấn luyện & thành tích' }));
    await screen.findByRole('heading', { name: 'Chương trình huấn luyện hiện tại' });
    expect(screen.getByText('Endurance foundation')).toBeInTheDocument(); expect(screen.queryByText('58%')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Trial-run videos' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: '← Ngựa của tôi' }));
    await screen.findByRole('heading', { name: 'Ngựa của tôi' });
  });
  it('keeps approved Profile layout read-only without extra ownership rows', async () => {
    mount('/owner/horses/7'); await screen.findByRole('heading', { name: 'Quyền sở hữu' });
    expect(screen.getByText('Thunder Bolt đã được liên kết với tài khoản của bạn.')).toBeInTheDocument();
    expect(screen.queryByText('My share')).not.toBeInTheDocument();
    expect(screen.queryByText('Linked since')).not.toBeInTheDocument();
    expect(screen.queryByText('Chủ quản lý')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit|Save|Delete/i })).not.toBeInTheDocument();
  });
  it('uses approved Health/Weight layout and real contract values without inventing progress metrics', async () => {
    const source = createOwnerSampleTransport({ readSamples: canonicalFixture, getBusinessActor: () => ownerA }, () => new Date('2026-10-18T00:00:00Z'));
    const horse = await source.detail(7, { actorId: 17 });
    const service: OwnerService = { list: source.list, async detail() { return { ...horse, healthSummary: { reviewDate: '2026-10-25', recovery: 'IMPROVING', examinedAt: '2026-10-17T06:00:00Z', weights: [{ weightKg: 501.25, recordedAt: '2026-10-18T06:00:00Z' }] }, program: { ...horse.program!, completed: 3, planned: 8 } }; } };
    mount('/owner/horses/7?tab=health', { service });
    await screen.findByText('25 thg 10, 2026');
    expect(screen.getByText('501.25 kg')).toBeInTheDocument();
    expect(screen.getByText(/ghi gần nhất/)).toHaveTextContent('18 thg 10, 2026');
    expect(screen.queryByText('Hồi phục')).not.toBeInTheDocument(); expect(screen.queryByText('Last examined')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Weight history' })).not.toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-10-18T06:00:00Z"]')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Huấn luyện & thành tích' }));
    expect(screen.getByText('3 / 8 buổi tập đã hoàn thành')).toBeInTheDocument(); expect(screen.queryByText('58%')).not.toBeInTheDocument();
  });
  it('supports direct-link health and keeps the selected tab in URL', async () => {
    const { router } = mount('/owner/horses/7?tab=health');
    await screen.findByText('Chưa có tóm tắt cho chủ ngựa');
    expect(screen.getByRole('tab', { name: 'Sức khỏe & mức sẵn sàng' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Huấn luyện & thành tích' }));
    await screen.findByRole('heading', { name: 'Buổi tập gần đây' }); expect(router.state.location.search).toBe('?tab=training');
  });
  it('supports keyboard tab interaction using the canonical Tabs component', async () => {
    mount('/owner/horses/7'); await screen.findByRole('heading', { name: 'Hồ sơ' });
    const profile = screen.getByRole('tab', { name: 'Hồ sơ & phả hệ' }); profile.focus();
    await userEvent.keyboard('{ArrowRight}'); await screen.findByText('Chưa có tóm tắt cho chủ ngựa');
    expect(screen.getByRole('tab', { name: 'Sức khỏe & mức sẵn sàng' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Sức khỏe & mức sẵn sàng' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}'); await screen.findByRole('heading', { name: 'Buổi tập gần đây' });
    expect(screen.getByRole('tab', { name: 'Huấn luyện & thành tích' })).toHaveFocus();
  });
  it.each(['/owner/horses/8', '/owner/horses/8?tab=health', '/owner/horses/8?tab=training'])('blocks a non-owned direct link %s with no other-owner data', async (path) => {
    mount(path); await screen.findByText('Không có quyền truy cập'); expect(screen.queryByText('Ocean Pride')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument(); expect(authSession.read()).not.toBeNull();
    await userEvent.click(screen.getByRole('link', { name: '← Ngựa của tôi' })); await screen.findByRole('heading', { name: 'Thunder Bolt' });
  });
  it('shows not-found instead of returning another horse for an unknown id', async () => {
    mount('/owner/horses/999'); await screen.findByText('Không tìm thấy ngựa'); expect(screen.queryByText('Thunder Bolt')).not.toBeInTheDocument();
  });
  it.each(['/owner/horses/no-id', '/owner/horses/0', '/owner/horses/7?tab=clinical', '/owner/horses/9007199254740992'])('rejects invalid link %s before transport', async (path) => {
    const { readSamples } = mount(path); await screen.findByText('Liên kết ngựa không hợp lệ'); expect(readSamples).not.toHaveBeenCalled();
  });
  it.each(ROLE_CODES.filter((role) => role !== 'HORSE_OWNER'))('denies %s before reading canonical data', async (role) => {
    const { readSamples } = mount(undefined, { user: { ...ownerA, roles: [role] } });
    await screen.findByText('Cổng này chỉ dành cho Horse Owner.'); expect(readSamples).not.toHaveBeenCalled();
  });
  it('redirects anonymous direct-link access to shared login before data reads', async () => {
    const { readSamples } = mount('/owner/horses/7?tab=training', { user: null });
    await screen.findByRole('heading', { name: 'Shared login' }); expect(readSamples).not.toHaveBeenCalled();
  });
  it('renders empty data without auto-seeding an ownership relation', async () => {
    const { snapshot } = mount(undefined, { user: { ...ownerA, id: 100 } });
    await screen.findByText('Chưa có ngựa nào đứng tên bạn'); expect(snapshot.horseRegistry!.records).toHaveLength(2);
  });
  it('searches only the returned owned list and offers a working clear action', async () => {
    const { router } = mount(); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm ngựa của tôi…' }), 'Ocean{Enter}');
    await screen.findByText('Không có ngựa phù hợp'); expect(screen.queryByText('Ocean Pride')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' })); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('searchbox', { name: 'Tìm ngựa của tôi…' })).toHaveValue('');
  });
  it('shows a retryable safe error without leaking raw service details', async () => {
    const service: OwnerService = { list: vi.fn().mockRejectedValueOnce(new Error('CLINICAL-SECRET')).mockResolvedValue([]), detail: vi.fn() };
    mount(undefined, { service }); await screen.findByText('Không tải được thông tin chủ ngựa'); expect(screen.queryByText('CLINICAL-SECRET')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/i })); await screen.findByText('Chưa có ngựa nào đứng tên bạn');
  });
  it('keeps real API mode pending without selecting samples or performing HTTP', async () => {
    const { readSamples } = mount(undefined, { noBinding: true });
    await screen.findByText('Không tải được thông tin chủ ngựa'); expect(readSamples).not.toHaveBeenCalled();
  });
  it('clears the shared session on API 401 rather than displaying stale Owner data', async () => {
    const service = { ...ownerContractPending, list: vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Expired')) };
    mount(undefined, { service }); await screen.findByRole('heading', { name: 'Shared login' }); expect(authSession.read()).toBeNull();
  });
  it('keeps the session on ordinary 403 and does not retry denied reads', async () => {
    const service = { ...ownerContractPending, list: vi.fn().mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Denied')) };
    mount(undefined, { service }); await screen.findByText('Không có quyền truy cập'); expect(authSession.read()).not.toBeNull(); expect(service.list).toHaveBeenCalledOnce();
  });
  it('does not render sensitive fields added to the canonical snapshot', async () => {
    const { snapshot } = mount('/owner/horses/7?tab=training');
    Object.assign(snapshot, { cases: [{ diagnosis: 'CLINICAL-SECRET', medication: 'MEDICATION-SECRET' }] });
    Object.assign(snapshot.sessions[0], { evaluation: { notes: 'EVALUATION-SECRET' }, riderFeedback: 'FEEDBACK-SECRET' });
    await screen.findByRole('heading', { name: 'Buổi tập gần đây' }); expect(document.body).not.toHaveTextContent(/CLINICAL-SECRET|MEDICATION-SECRET|EVALUATION-SECRET|FEEDBACK-SECRET/);
    expect(screen.queryByRole('button', { name: /Edit|Save|Assign|Complete|Delete/i })).not.toBeInTheDocument();
  });
  it('replaces the visible list on session switching and clears it on logout', async () => {
    mount(); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    await userEvent.click(screen.getByRole('button', { name: 'Fixture login B' }));
    await screen.findByRole('heading', { name: 'Ocean Pride' }); expect(screen.queryByRole('heading', { name: 'Thunder Bolt' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fixture logout' }));
    await screen.findByRole('heading', { name: 'Shared login' }); expect(screen.queryByText('Ocean Pride')).not.toBeInTheDocument();
  });
  it('rejects a formerly-owned direct link immediately when another Owner signs in', async () => {
    mount('/owner/horses/7'); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    await userEvent.click(screen.getByRole('button', { name: 'Fixture login B' }));
    await screen.findByText('Không có quyền truy cập'); expect(screen.queryByRole('heading', { name: 'Thunder Bolt' })).not.toBeInTheDocument();
  });
  it('discards delayed previous-session results after switching Owner identity', async () => {
    const source = createOwnerSampleTransport({ readSamples: canonicalFixture, getBusinessActor: () => ownerA }, () => new Date('2026-10-18T00:00:00Z'));
    const rows = await source.list({ actorId: 17 }); let resolve!: (value: OwnerHorse[]) => void;
    const service: OwnerService = { list: vi.fn().mockImplementationOnce(() => new Promise<OwnerHorse[]>((done) => { resolve = done; })).mockResolvedValue([]), detail: vi.fn() };
    mount(undefined, { service }); await waitFor(() => expect(service.list).toHaveBeenCalledOnce());
    expect(screen.getByText('Đang tải ngựa của bạn…')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fixture login B' })); await screen.findByText('Chưa có ngựa nào đứng tên bạn');
    await act(async () => resolve(rows)); expect(screen.queryByText('Thunder Bolt')).not.toBeInTheDocument();
  });
});
