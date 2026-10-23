import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';
import { IncidentDetailPage, IncidentListPage } from './Incidents';
import { createIncidentService, readIncident, type IncidentService } from './incidentService';
import type { Incident } from './models';
import { ApiError } from '../../shared/auth/authApi';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { buildRoutes } from '../../app/router';
const incident: Incident = { id: 1, incidentCode: 'INC-001', horseId: 14, reportedByUserId: 6, observedAt: '2026-10-19T01:00:00Z', reportedAt: '2026-10-19T01:01:00Z', incidentType: 'HOOF_OR_LEG_PROBLEM', observedSeverity: 'MEDIUM', status: 'REPORTED', description: 'Limp after exercise' };
const page = (items: Incident[]) => ({ items, page: 0, size: 20, totalElements: items.length });
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const groom = { id: 6, roles: ['GROOM' as const] }, vet = { id: 7, roles: ['VETERINARIAN' as const] };
function service(): IncidentService { return { list: vi.fn().mockResolvedValue(page([incident])), get: vi.fn().mockResolvedValue(incident), report: vi.fn().mockResolvedValue(incident), review: vi.fn().mockResolvedValue({ ...incident, status: 'RESOLVED' }) }; }
function detail(value: IncidentService, role: 'VETERINARIAN' | 'GROOM' = 'VETERINARIAN', path = '/incidents/1') {
  const router = createMemoryRouter([{ path: '/incidents/:incidentId', element: <IncidentDetailPage service={value} role={role} /> }, { path: '/medical/cases/:caseId', element: <h1>Case detail</h1> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />); return router;
}
afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); });
it('opens a report from the list using its keyboard-accessible canonical link and local filters', async () => {
  const value = service(); render(<MemoryRouter><IncidentListPage service={value} role="GROOM" actorId={6} /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'INC-001' })).toHaveAttribute('href', '/incidents/1');
  expect(screen.getByText('Bạn')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tìm trên trang hiện tại'), { target: { value: 'no match' } });
  expect(screen.getByText('Không có sự cố')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sau' })).toBeDisabled();
  expect(screen.queryByText(/submitted/)).not.toBeInTheDocument();
});
it('opens the existing canonical report modal and cancels without a write', async () => {
  const value = service(); vi.mocked(value.report).mockRejectedValue(new ApiError(409, 'CONFLICT', 'sensitive internal message'));
  render(<MemoryRouter><IncidentListPage service={value} role="GROOM" actorId={6} /></MemoryRouter>);
  await screen.findByRole('link', { name: 'INC-001' });
  fireEvent.click(screen.getByRole('button', { name: 'Báo cáo sự cố' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Hủy/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(value.report).not.toHaveBeenCalled();
});
it('locks duplicate handling and updates state only after the response and readback', async () => {
  const value = service(); let finish!: (v: Incident) => void;
  vi.mocked(value.review).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  vi.mocked(value.get).mockResolvedValueOnce(incident).mockResolvedValueOnce({ ...incident, status: 'RESOLVED' });
  detail(value); await screen.findByText('Limp after exercise');
  const resolve = screen.getByRole('button', { name: 'Đóng sự cố' }); fireEvent.click(resolve); fireEvent.click(resolve);
  expect(value.review).toHaveBeenCalledTimes(1); expect(resolve).toBeDisabled();
  await act(async () => { finish({ ...incident, status: 'RESOLVED' }); });
  expect(await screen.findByText(/Sự cố đã được xử lý xong\. Không còn thao tác nào khác\./)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mở ca y tế' })).not.toBeInTheDocument();
});
it('validates case linking and retains input on a conflict without false success', async () => {
  const value = service(); vi.mocked(value.review).mockRejectedValue(new ApiError(409, 'CONFLICT', 'private diagnosis'));
  detail(value); await screen.findByText('Limp after exercise');
  const input = screen.getByLabelText('Mã ca y tế đang mở'); fireEvent.change(input, { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Liên kết ca y tế' }));
  expect(await screen.findByText('Nhập mã ca y tế là số dương hợp lệ.')).toBeInTheDocument(); expect(value.review).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '9' } }); fireEvent.click(screen.getByRole('button', { name: 'Liên kết ca y tế' }));
  await screen.findByText(/Sự cố đã thay đổi hoặc xung đột với thao tác này\. Hãy làm mới và thử lại\./);
  expect(input).toHaveValue(9); expect(screen.queryByText('private diagnosis')).not.toBeInTheDocument();
});
it('opens the returned medical case and never invents the case ID', async () => {
  const value = service(); vi.mocked(value.review).mockResolvedValue({ ...incident, status: 'UNDER_REVIEW', medicalCaseId: 91 });
  const router = detail(value); await screen.findByText('Limp after exercise');
  fireEvent.click(screen.getByRole('button', { name: 'Mở ca y tế' }));
  await screen.findByRole('heading', { name: 'Case detail' }); expect(router.state.location.pathname).toBe('/medical/cases/91');
});
it.each(['RESOLVED', 'UNDER_REVIEW'] as const)('prevents re-opening/linking a %s incident', async (status) => {
  const value = service(); vi.mocked(value.get).mockResolvedValue({ ...incident, status, medicalCaseId: 9 });
  detail(value); await screen.findByText('Limp after exercise');
  expect(screen.queryByRole('button', { name: 'Mở ca y tế' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Liên kết ca y tế' })).not.toBeInTheDocument();
  if (status === 'RESOLVED') expect(screen.queryByRole('button', { name: 'Đóng sự cố' })).not.toBeInTheDocument();
});
it('renders a Groom detail as read-only without linking to the clinical case', async () => {
  const value = service(); vi.mocked(value.get).mockResolvedValue({ ...incident, medicalCaseId: 9 }); detail(value, 'GROOM');
  await screen.findByText('Limp after exercise'); expect(screen.queryByRole('link', { name: /Ca y tế/ })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Resolve|Open medical/ })).not.toBeInTheDocument();
});
it('clears an old incident immediately on a direct-link change and ignores its late response', async () => {
  const value = service(); let finish!: (v: Incident) => void;
  vi.mocked(value.get).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ ...incident, id: 2, incidentCode: 'INC-002', description: 'Second report' });
  const router = detail(value); await act(() => router.navigate('/incidents/2'));
  await screen.findByText('Second report'); await act(async () => { finish(incident); });
  expect(screen.queryByText('Limp after exercise')).not.toBeInTheDocument();
});
it('rejects another Groom report and any clinical fields before disclosure', () => {
  expect(() => readIncident({ ...incident, reportedByUserId: 99 }, groom)).toThrow('Tài khoản của bạn không xem được báo cáo này.');
  expect(() => readIncident({ ...incident, diagnosis: 'secret' }, vet)).toThrow('Dữ liệu sự cố không có hoặc không hợp lệ.');
});
it('uses only approved incident DTOs, checks identities and does not fall back on 403', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ ...incident, id: 2 })).mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Denied', details: [] } }), { status: 403 }));
  const value = createIncidentService('fixture', groom, undefined, { baseUrl: '', fetcher });
  await expect(value.get(1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' }); await expect(value.get(1)).rejects.toMatchObject({ status: 403 }); expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rejects review by a non-Vet before HTTP and requires the approved transition response', async () => {
  const fetcher = vi.fn().mockResolvedValue(ok(incident));
  await expect(createIncidentService('fixture', groom, undefined, { baseUrl: '', fetcher }).review(1, 'RESOLVE')).rejects.toMatchObject({ status: 403 }); expect(fetcher).not.toHaveBeenCalled();
  await expect(createIncidentService('fixture', vet, undefined, { baseUrl: '', fetcher }).review(1, 'RESOLVE')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('handles an unavailable list with retry and no stale reports', async () => {
  const value = service(); vi.mocked(value.list).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(page([]));
  render(<MemoryRouter><IncidentListPage service={value} role="VETERINARIAN" actorId={7} /></MemoryRouter>);
  await screen.findByText('Không tải được sự cố'); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await screen.findByText('Không có sự cố'); expect(screen.queryByText('INC-001')).not.toBeInTheDocument();
});
it('invalid direct links never request a report', () => { const value = service(); detail(value, 'GROOM', '/incidents/-1'); expect(screen.getByText('Không tìm thấy sự cố')).toBeInTheDocument(); expect(value.get).not.toHaveBeenCalled(); });
it('blocks Horse Owner and anonymous incident routes before any report request', async () => {
  authSession.save('fixture', 3600, false); const fetcher = vi.fn().mockResolvedValue(ok({ id: 99, userCode: 'O99', fullName: 'Chủ ngựa', email: 'owner@example.test', roles: ['HORSE_OWNER'], accountStatus: 'ACTIVE' })); vi.stubGlobal('fetch', fetcher);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: ['/incidents/1'] }); render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()); expect(fetcher).toHaveBeenCalledOnce();
});

it('preserves a failed incident report and masks sensitive server errors', async () => {
  const value = service(); vi.mocked(value.report).mockRejectedValue(new ApiError(409, 'CONFLICT', 'private diagnosis'));
  render(<MemoryRouter><IncidentListPage service={value} role="GROOM" actorId={6} /></MemoryRouter>);
  await screen.findByRole('link', { name: 'INC-001' }); fireEvent.click(screen.getByRole('button', { name: 'Báo cáo sự cố' }));
  fireEvent.change(screen.getByLabelText('Ngựa *'), { target: { value: '14' } });
  fireEvent.click(screen.getByRole('button', { name: 'Vấn đề móng hoặc chân' }));
  fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
  fireEvent.change(screen.getByLabelText('Mô tả *'), { target: { value: 'Limp after walking' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi sự cố' }));
  expect(await screen.findByText(/Sự cố đã thay đổi hoặc xung đột với thao tác này\. Hãy làm mới và thử lại\./)).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.getByLabelText('Mô tả *')).toHaveValue('Limp after walking');
  expect(screen.queryByText('private diagnosis')).not.toBeInTheDocument(); expect(screen.queryByText(/Incident INC-001 submitted/)).not.toBeInTheDocument();
});

it('shows the reporter name when a directory reader is available and keeps the id otherwise', async () => {
  const value = service(), reporter = vi.fn().mockResolvedValue('Demo GROOM');
  const { unmount } = render(<MemoryRouter><IncidentListPage service={value} role="CLUB_MANAGER" actorId={1} reporter={reporter} /></MemoryRouter>);
  expect(await screen.findByText('Demo GROOM')).toBeInTheDocument(); expect(reporter).toHaveBeenCalledWith(6);
  unmount();
  render(<MemoryRouter><IncidentListPage service={service()} role="VETERINARIAN" actorId={7} /></MemoryRouter>);
  expect(await screen.findByText('Người dùng 6')).toBeInTheDocument();
});
it('names the signed-in reporter "You" on the detail page', async () => {
  const value = service();
  render(<RouterProvider router={createMemoryRouter([{ path: '/incidents/:incidentId', element: <IncidentDetailPage service={value} role="GROOM" actorId={6} /> }], { initialEntries: ['/incidents/1'] })} />);
  await screen.findByText('Limp after exercise'); expect(screen.getByText('Bạn')).toBeInTheDocument();
});
