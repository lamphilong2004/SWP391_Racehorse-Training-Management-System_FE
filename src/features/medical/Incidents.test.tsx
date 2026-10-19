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
  expect(screen.getByText('You')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search current page'), { target: { value: 'no match' } });
  expect(screen.getByText('No incidents')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.queryByText(/submitted/)).not.toBeInTheDocument();
});
it('opens the existing canonical report modal and cancels without a write', async () => {
  const value = service(); vi.mocked(value.report).mockRejectedValue(new ApiError(409, 'CONFLICT', 'sensitive internal message'));
  render(<MemoryRouter><IncidentListPage service={value} role="GROOM" actorId={6} /></MemoryRouter>);
  await screen.findByRole('link', { name: 'INC-001' });
  fireEvent.click(screen.getByRole('button', { name: 'Report Incident' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(value.report).not.toHaveBeenCalled();
});
it('locks duplicate handling and updates state only after the response and readback', async () => {
  const value = service(); let finish!: (v: Incident) => void;
  vi.mocked(value.review).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  vi.mocked(value.get).mockResolvedValueOnce(incident).mockResolvedValueOnce({ ...incident, status: 'RESOLVED' });
  detail(value); await screen.findByText('Limp after exercise');
  const resolve = screen.getByRole('button', { name: 'Resolve incident' }); fireEvent.click(resolve); fireEvent.click(resolve);
  expect(value.review).toHaveBeenCalledTimes(1); expect(resolve).toBeDisabled();
  await act(async () => { finish({ ...incident, status: 'RESOLVED' }); });
  expect(await screen.findByText(/This incident is resolved/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open medical case' })).not.toBeInTheDocument();
});
it('validates case linking and retains input on a conflict without false success', async () => {
  const value = service(); vi.mocked(value.review).mockRejectedValue(new ApiError(409, 'CONFLICT', 'private diagnosis'));
  detail(value); await screen.findByText('Limp after exercise');
  const input = screen.getByLabelText('Existing open case ID'); fireEvent.change(input, { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Link case' }));
  expect(await screen.findByText('Enter a valid positive case ID.')).toBeInTheDocument(); expect(value.review).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '9' } }); fireEvent.click(screen.getByRole('button', { name: 'Link case' }));
  await screen.findByText(/The incident changed or conflicts/);
  expect(input).toHaveValue(9); expect(screen.queryByText('private diagnosis')).not.toBeInTheDocument();
});
it('opens the returned medical case and never invents the case ID', async () => {
  const value = service(); vi.mocked(value.review).mockResolvedValue({ ...incident, status: 'UNDER_REVIEW', medicalCaseId: 91 });
  const router = detail(value); await screen.findByText('Limp after exercise');
  fireEvent.click(screen.getByRole('button', { name: 'Open medical case' }));
  await screen.findByRole('heading', { name: 'Case detail' }); expect(router.state.location.pathname).toBe('/medical/cases/91');
});
it.each(['RESOLVED', 'UNDER_REVIEW'] as const)('prevents re-opening/linking a %s incident', async (status) => {
  const value = service(); vi.mocked(value.get).mockResolvedValue({ ...incident, status, medicalCaseId: 9 });
  detail(value); await screen.findByText('Limp after exercise');
  expect(screen.queryByRole('button', { name: 'Open medical case' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Link case' })).not.toBeInTheDocument();
  if (status === 'RESOLVED') expect(screen.queryByRole('button', { name: 'Resolve incident' })).not.toBeInTheDocument();
});
it('renders a Groom detail as read-only without linking to the clinical case', async () => {
  const value = service(); vi.mocked(value.get).mockResolvedValue({ ...incident, medicalCaseId: 9 }); detail(value, 'GROOM');
  await screen.findByText('Limp after exercise'); expect(screen.queryByRole('link', { name: /Medical case/ })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Resolve|Open medical/ })).not.toBeInTheDocument();
});
it('clears an old incident immediately on a direct-link change and ignores its late response', async () => {
  const value = service(); let finish!: (v: Incident) => void;
  vi.mocked(value.get).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ ...incident, id: 2, incidentCode: 'INC-002', description: 'Second report' });
  const router = detail(value); await act(() => router.navigate('/incidents/2'));
  await screen.findByText('Second report'); await act(async () => { finish(incident); });
  expect(screen.queryByText('Limp after exercise')).not.toBeInTheDocument();
});
it('rejects another Groom report and any clinical fields before disclosure', () => {
  expect(() => readIncident({ ...incident, reportedByUserId: 99 }, groom)).toThrow('not available');
  expect(() => readIncident({ ...incident, diagnosis: 'secret' }, vet)).toThrow('authorized projection');
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
  await screen.findByText('Incident unavailable'); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('No incidents'); expect(screen.queryByText('INC-001')).not.toBeInTheDocument();
});
it('invalid direct links never request a report', () => { const value = service(); detail(value, 'GROOM', '/incidents/-1'); expect(screen.getByText('Incident not found')).toBeInTheDocument(); expect(value.get).not.toHaveBeenCalled(); });
it('blocks Horse Owner and anonymous incident routes before any report request', async () => {
  authSession.save('fixture', 3600, false); const fetcher = vi.fn().mockResolvedValue(ok({ id: 99, userCode: 'O99', fullName: 'Owner', email: 'owner@example.test', roles: ['HORSE_OWNER'], accountStatus: 'ACTIVE' })); vi.stubGlobal('fetch', fetcher);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: ['/incidents/1'] }); render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('Access denied')).toBeInTheDocument()); expect(fetcher).toHaveBeenCalledOnce();
});

it('preserves a failed incident report and masks sensitive server errors', async () => {
  const value = service(); vi.mocked(value.report).mockRejectedValue(new ApiError(409, 'CONFLICT', 'private diagnosis'));
  render(<MemoryRouter><IncidentListPage service={value} role="GROOM" actorId={6} /></MemoryRouter>);
  await screen.findByRole('link', { name: 'INC-001' }); fireEvent.click(screen.getByRole('button', { name: 'Report Incident' }));
  fireEvent.change(screen.getByLabelText('Horse *'), { target: { value: '14' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hoof or leg problem' }));
  fireEvent.click(screen.getByRole('button', { name: 'Medium' }));
  fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Limp after walking' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit Incident' }));
  expect(await screen.findByText(/The incident changed or conflicts/)).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.getByLabelText('Description *')).toHaveValue('Limp after walking');
  expect(screen.queryByText('private diagnosis')).not.toBeInTheDocument(); expect(screen.queryByText(/Incident INC-001 submitted/)).not.toBeInTheDocument();
});
