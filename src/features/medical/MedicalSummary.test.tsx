import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';
import { MedicalSummaryPage } from './MedicalSummary';
import { createSummaryService, type SummaryService } from './summaryService';
import { buildRoutes } from '../../app/router';
import { AuthProvider } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
const horse = { id: 14, horseCode: 'ST-014', name: 'Storm', lifecycle: 'ACTIVE' as const, healthStatus: 'MONITORING' as const, trainingAvailability: 'LIMITED' as const, currentBoxCode: 'B-03' };
const summary = { id: 9, horseId: 14, status: 'OPEN', openedAt: '2026-10-19T00:00:00Z' };
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
function service(): SummaryService { return { listHorses: vi.fn().mockResolvedValue([horse]), getHorse: vi.fn().mockResolvedValue(horse), getAvailability: vi.fn().mockResolvedValue({ horseId: 14, availability: 'LIMITED', reason: 'Walking only' }), listCases: vi.fn().mockResolvedValue([summary]) }; }
function mount(value: SummaryService, path = '/medical/summary?horseId=14') { render(<MemoryRouter initialEntries={[path]}><MedicalSummaryPage service={value} /></MemoryRouter>); }
afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); });
it('selects a horse, persists its deep link and renders the read-only authorized summary', async () => {
  const value = service(); mount(value, '/medical/summary');
  fireEvent.change(await screen.findByLabelText('Horse'), { target: { value: '14' } });
  expect(await screen.findByRole('heading', { name: 'Medical Summary · Storm' })).toBeInTheDocument();
  expect(await screen.findByText('Case 9')).toBeInTheDocument();
  expect(screen.getByText('READ-ONLY')).toBeInTheDocument();
  expect(screen.getAllByText('Walking only')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: /save|approve|activate/i })).not.toBeInTheDocument();
  expect(screen.getAllByText('Unavailable in this summary')).toHaveLength(2);
  fireEvent.click(screen.getByRole('link', { name: /Back/ }));
  expect(await screen.findByLabelText('Horse')).toBeInTheDocument();
});
it('shows independent read failures without claiming no case or no restriction', async () => {
  const value = service(); vi.mocked(value.listCases).mockRejectedValue(new Error('Case summary unavailable')); vi.mocked(value.getAvailability).mockRejectedValue(new Error('Availability unavailable'));
  mount(value);
  expect(await screen.findByText('Case summary unavailable')).toBeInTheDocument();
  expect(await screen.findByText('Availability unavailable')).toBeInTheDocument();
  expect(screen.queryByText('None')).not.toBeInTheDocument();
  expect(screen.queryByText(/No active medical restriction/)).not.toBeInTheDocument();
});
it('has loading, empty and retry states without fake summary values', async () => {
  const value = service(); vi.mocked(value.listHorses).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([]);
  mount(value, '/medical/summary');
  expect(screen.getByText('Loading medical summary…')).toBeInTheDocument();
  await screen.findByText('Offline'); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No active horses')).toBeInTheDocument();
});
it('rejects invalid direct-link IDs before loading horse or medical records', async () => {
  const value = service(); mount(value, '/medical/summary?horseId=-4');
  expect(screen.getByText('Horse not found')).toBeInTheDocument();
  expect(value.getHorse).not.toHaveBeenCalled(); expect(value.listCases).not.toHaveBeenCalled();
});
it('discards a stale horse response after selection changes', async () => {
  let finish!: (v: typeof horse) => void;
  const value = service(); vi.mocked(value.getHorse).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ ...horse, id: 15, name: 'Second' });
  const router = createMemoryRouter([{ path: '/medical/summary', element: <MedicalSummaryPage service={value} /> }], { initialEntries: ['/medical/summary?horseId=14'] });
  render(<RouterProvider router={router} />);
  await act(() => router.navigate('/medical/summary?horseId=15'));
  await screen.findByRole('heading', { name: 'Medical Summary · Second' });
  await act(async () => { finish(horse); });
  expect(screen.queryByRole('heading', { name: 'Medical Summary · Storm' })).not.toBeInTheDocument();
});
it.each(['GROOM', 'VETERINARIAN', 'HORSE_OWNER', 'TRAINER', 'CLUB_MANAGER', 'WORK_RIDER'])('denies %s before summary requests', async (role) => {
  authSession.save('fixture', 3600, false);
  const fetcher = vi.fn().mockResolvedValue(ok({ id: 7, fullName: 'Actor', userCode: 'U7', email: 'actor@example.test', roles: [role], accountStatus: 'ACTIVE' }));
  vi.stubGlobal('fetch', fetcher);
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: ['/medical/summary?horseId=14'] });
  render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
  expect(await screen.findByText('Access denied')).toBeInTheDocument(); expect(fetcher).toHaveBeenCalledOnce();
});
it('rejects a clinical response instead of exposing or caching it for Head Trainer', async () => {
  const fetcher = vi.fn().mockResolvedValue(ok({ items: [{ ...summary, reason: 'private diagnosis', examinations: [] }], page: 0, size: 100, totalElements: 1 }));
  await expect(createSummaryService('fixture', undefined, { baseUrl: '', fetcher }).listCases()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('reads all summary pages, rejects unstable pagination and never falls back on failure', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ items: [summary], page: 0, size: 1, totalElements: 2 })).mockResolvedValueOnce(ok({ items: [{ ...summary, id: 10 }], page: 1, size: 1, totalElements: 2 }));
  expect(await createSummaryService('fixture', undefined, { baseUrl: '', fetcher }).listCases()).toHaveLength(2);
  const failed = vi.fn().mockRejectedValue(new Error('Offline'));
  await expect(createSummaryService('fixture', undefined, { baseUrl: '', fetcher: failed }).listCases()).rejects.toMatchObject({ code: 'NETWORK_ERROR' }); expect(failed).toHaveBeenCalledOnce();
});
