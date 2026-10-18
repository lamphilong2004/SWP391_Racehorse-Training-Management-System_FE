import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { buildRoutes } from '../../../app/router';
import { AuthProvider, useAuth } from '../../../shared/auth/AuthProvider';
import { ApiError } from '../../../shared/auth/authApi';
import { authSession } from '../../../shared/auth/authSession';
import { getBusinessActor, setBusinessActor } from '../../../shared/data/businessData';
import { readSamples, resetSamples, sampleUser, saveSamples } from '../../../shared/data/sampleStore';
import { createHorseHistorySample } from './historySample';
import { HorseHistoryProvider } from './historyService';
import type { HorseHistoryService } from './historyTypes';

const sample = () => createHorseHistorySample({ readSamples, saveSamples, getBusinessActor });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); resetSamples(); setBusinessActor(null); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network'); })); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); setBusinessActor(null); });
function SwitchFixture() { const auth = useAuth(); return <button onClick={() => void auth.login('groom@fixture.test', 'fixture-only', false)}>Fixture switch to Groom</button>; }
function open(path = '/horses/7', user = sampleUser('HEAD_TRAINER'), override?: HorseHistoryService) {
  authSession.save('fixture-session', 3600, false); const service = override ?? sample();
  const api = { login: async () => ({ user: sampleUser('GROOM'), accessToken: 'fixture-groom', tokenType: 'Bearer' as const, expiresIn: 3600 }), currentUser: async () => user, logout: async () => undefined };
  const router = createMemoryRouter(buildRoutes(false), { initialEntries: [path] });
  render(<AuthProvider api={api}><HorseHistoryProvider service={service}><SwitchFixture /><RouterProvider router={router} /></HorseHistoryProvider></AuthProvider>);
  return { router, service };
}
describe('CORE-017 existing Horse Profile extended with history and readiness', () => {
  it('opens Pedigree & History from the existing Profile and preserves deep link/back/keyboard tabs', async () => {
    const { router } = open(); await screen.findByRole('heading', { name: 'Thunder Bolt' });
    await userEvent.click(screen.getByRole('link', { name: 'View Pedigree & History →' }));
    await screen.findByRole('heading', { name: 'Pedigree & History' }); expect(router.state.location.search).toBe('?tab=history');
    expect(screen.getByRole('heading', { name: 'Pedigree Tree' })).toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'Ownership history' })).toBeInTheDocument();
    expect(screen.getAllByText('Current Owner')).toHaveLength(2);
    expect(screen.getByText(/foaled .* · Owner /)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stable assignment history' })).toBeInTheDocument(); expect(screen.getByText('No timeline events shared')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: '← Back to Horse Profile' })); await screen.findByRole('heading', { name: 'Head Trainer readiness review' });
    const tab = screen.getByRole('tab', { name: 'Overview' }); tab.focus(); await userEvent.keyboard('{End}');
    await screen.findByRole('tab', { name: 'Training & Performance' }); expect(screen.getByRole('tab', { name: 'Training & Performance' })).toHaveFocus();
  });
  it('shows approved non-clinical latestWeight from the Profile DTO without inventing a value', async () => {
    const data = readSamples(); data.horseRegistry!.records[0].latestWeight = { weightKg: 501.25, recordedAt: '2026-10-18T06:00:00Z' }; saveSamples(data);
    open(); await screen.findByText('501.25 kg'); expect(screen.queryByText('512 kg')).not.toBeInTheDocument();
  });
  it('supports a refresh-equivalent direct history link without changing shared routing', async () => {
    open('/horses/7?tab=history'); await screen.findByRole('heading', { name: 'Pedigree & History' }); expect(screen.getByRole('link', { name: '← Back to Horse Profile' })).toBeInTheDocument();
  });
  it.each(['GROOM', 'TRAINER', 'VETERINARIAN'] as const)('does not request full ownership/stable history for %s', async (role) => {
    const base = sample(); const service = { ...base, ownerships: vi.fn(base.ownerships), assignments: vi.fn(base.assignments) };
    open('/horses/7?tab=history', sampleUser(role), service); await screen.findByText('Full ownership and stable history is available to Club Managers and Head Trainers.');
    expect(service.ownerships).not.toHaveBeenCalled(); expect(service.assignments).not.toHaveBeenCalled(); expect(screen.queryByRole('heading', { name: 'Ownership history' })).not.toBeInTheDocument();
  });
  it.each(['CLUB_MANAGER', 'VETERINARIAN'] as const)('shows the checklist read-only for %s', async (role) => {
    open(undefined, sampleUser(role)); await screen.findByText('Recommended · non-blocking'); expect(screen.queryByRole('button', { name: 'Record readiness review' })).not.toBeInTheDocument();
  });
  it('prevents duplicate submissions, records the HT acknowledgement, rereads checklist and preserves lifecycle', async () => {
    const base = sample(); let resolve!: () => void; const pending = new Promise<void>((done) => { resolve = done; });
    const service = { ...base, acknowledge: vi.fn(async (id: number) => { await pending; await base.acknowledge(id); }) };
    open(undefined, sampleUser('HEAD_TRAINER'), service); const button = await screen.findByRole('button', { name: 'Record readiness review' });
    const before = structuredClone(readSamples().horseRegistry);
    await userEvent.dblClick(button); expect(service.acknowledge).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Recording review…' })).toBeDisabled();
    await act(async () => resolve()); await screen.findByText('Readiness review recorded'); await screen.findByText('Reviewed · non-blocking');
    expect(readSamples().horseRegistry).toEqual(before); expect(screen.queryByRole('button', { name: /Approve|Activate horse/ })).not.toBeInTheDocument();
  });
  it.each([403, 404, 500])('does not claim review success on %s', async (status) => {
    const base = sample(); const service = { ...base, acknowledge: vi.fn().mockRejectedValue(new ApiError(status, 'INTERNAL_ERROR', 'PRIVATE-SECRET')) };
    open(undefined, sampleUser('HEAD_TRAINER'), service); await userEvent.click(await screen.findByRole('button', { name: 'Record readiness review' }));
    await screen.findByText(status === 403 ? 'Only the Head Trainer can record this review.' : status === 404 ? 'Horse not found.' : 'Review was not confirmed. Try again later.');
    expect(screen.queryByText('Readiness review recorded')).not.toBeInTheDocument(); expect(document.body).not.toHaveTextContent('PRIVATE-SECRET');
  });
  it('clears shared session on a history 401 rather than rendering previous data', async () => {
    const service = { ...sample(), timeline: vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Expired')) };
    open('/horses/7?tab=history', sampleUser('GROOM'), service); await screen.findByRole('heading', { name: 'Sign in to Racehorse Ops' }); expect(authSession.read()).toBeNull();
  });
  it('has retry, empty and paginated timeline states using only returned non-clinical titles', async () => {
    const timeline = vi.fn().mockRejectedValueOnce(new Error('PRIVATE-SECRET')).mockResolvedValueOnce({ items: [{ occurredAt: '2026-10-18T06:00:00Z', eventType: 'UNMAPPED_TYPE', title: 'Safe shared event' }], page: 0, size: 20, totalItems: 21, totalPages: 2 }).mockResolvedValueOnce({ items: [], page: 1, size: 20, totalItems: 21, totalPages: 2 });
    const { router } = open('/horses/7?tab=history', sampleUser('HEAD_TRAINER'), { ...sample(), timeline });
    await screen.findByText('History unavailable'); expect(document.body).not.toHaveTextContent('PRIVATE-SECRET'); await userEvent.click(screen.getByRole('button', { name: /Try again|Retry/ }));
    await screen.findByText('Safe shared event'); expect(document.body).not.toHaveTextContent('UNMAPPED_TYPE'); expect(document.querySelector('time[datetime="2026-10-18T06:00:00Z"]')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Page 2 of 2'); expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled(); expect(timeline.mock.calls[2][1]).toBe(1); expect(router.state.location.search).toBe('?tab=history');
  });
  it('discards a delayed privileged history when switching to Groom', async () => {
    let resolve!: (value: Awaited<ReturnType<HorseHistoryService['timeline']>>) => void;
    const timeline = vi.fn().mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockResolvedValue({ items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 });
    open('/horses/7?tab=history', sampleUser('HEAD_TRAINER'), { ...sample(), timeline }); await waitFor(() => expect(timeline).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole('button', { name: 'Fixture switch to Groom' })); await screen.findByText('Full ownership and stable history is available to Club Managers and Head Trainers.');
    await act(async () => resolve({ items: [{ occurredAt: '2026-10-18T06:00:00Z', eventType: 'X', title: 'OLD-SESSION-SECRET' }], page: 0, size: 20, totalItems: 1, totalPages: 1 })); expect(document.body).not.toHaveTextContent('OLD-SESSION-SECRET');
  });
  it.each(['/horses/0', '/horses/no-id', '/horses/7?tab=clinical'])('handles invalid direct link %s safely', async (path) => {
    open(path); await screen.findByText(path.includes('tab=') ? 'Invalid profile section' : 'Horse not found'); expect(screen.queryByRole('heading', { name: 'Pedigree & History' })).not.toBeInTheDocument();
  });
  it.each(['HORSE_OWNER', 'WORK_RIDER'] as const)('denies staff Horse Profile/history for %s', async (role) => {
    open('/horses/7?tab=history', sampleUser(role)); await screen.findByText('Access denied'); expect(screen.queryByRole('heading', { name: 'Thunder Bolt' })).not.toBeInTheDocument();
  });
});
