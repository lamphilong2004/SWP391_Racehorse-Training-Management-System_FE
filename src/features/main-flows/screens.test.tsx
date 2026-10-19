import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { BaselinePage } from '../baseline/BaselinePage';
import { CreateSessionPage } from '../trainer-session/CreateSessionPage';
import { RestrictionsPage } from '../restrictions/RestrictionsPage';

const state = vi.hoisted(() => ({ request: vi.fn(), user: { id: 2, fullName: 'Test Vet', roles: ['VETERINARIAN'], accountStatus: 'ACTIVE' } }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('./api', async (original) => ({ ...await original<typeof import('./api')>(), useFlowRequest: () => state.request }));
const horse = { id: 7, horseCode: 'RD-015', name: 'Test Horse', lifecycle: 'DRAFT', trainingAvailability: 'AVAILABLE', breed: 'Thoroughbred' };
beforeEach(() => { state.request.mockReset(); state.user.roles = ['VETERINARIAN']; });
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });

it('keeps a failed baseline draft for retry and confirms only a real save response', async () => {
  let fail = true;
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/activation-status')) return { checklist: [] };
    if (init?.method === 'POST') { if (fail) throw new Error('Baseline endpoint unavailable'); return { id: 9, horseId: 7, weightKg: 512, healthStatus: 'FIT', recordedAt: '2026-10-19T06:00:00Z' }; }
    return horse;
  });
  render(<MemoryRouter initialEntries={['/horses/7/baseline']}><Routes><Route path="/horses/:id/baseline" element={<BaselinePage />} /></Routes></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Initial Health Baseline · Test Horse' });
  change('Weight (kg)', '512'); change('Current condition', 'Normal gait'); fireEvent.click(screen.getByRole('radio', { name: 'FIT' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Baseline' }));
  expect(await screen.findByText('Baseline endpoint unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText('Weight (kg)', { exact: false })).toHaveValue(512);
  expect(screen.queryByText('Baseline saved')).not.toBeInTheDocument();
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Save Baseline' }));
  expect(await screen.findByText('Baseline saved')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save Baseline' })).toBeDisabled();
});
it('schedules one session through all four steps using the approved draft/recommendation/create operations', async () => {
  state.user.roles = ['TRAINER']; let posts = 0;
  const program = { id: 10, horse, name: 'Test program', status: 'ACTIVE', phases: [{ id: 31, name: 'Foundation', startDate: '2026-11-01', endDate: '2026-11-30' }] };
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.startsWith('/api/training-programs?')) return { items: [program] };
    if (path === '/api/training-programs/10') return program;
    if (path.endsWith('/training-availability')) return { availability: 'AVAILABLE' };
    if (path === '/api/exercises') return [{ id: 8, name: 'Walk' }];
    if (path.endsWith('/suitability-check')) return { trainingAvailability: 'AVAILABLE', sessionBlocked: false, exercises: [], sessionIssues: [] };
    if (path.endsWith('/work-rider-recommendations')) return { candidates: [{ user: { id: 5, fullName: 'Test Rider' }, label: 'SUITABLE', warnings: [], reasons: [], skills: [], hardBlock: null }] };
    if (path === '/api/training-sessions' && init?.method === 'POST') { posts++; return { id: 42 }; }
    throw new Error(`Unexpected test request: ${path}`);
  });
  render(<MemoryRouter initialEntries={['/training/schedule/session/new']}><Routes><Route path="/training/schedule/session/new" element={<CreateSessionPage />} /><Route path="/training/session/:id" element={<h1>Saved session detail</h1>} /></Routes></MemoryRouter>);
  await screen.findByRole('option', { name: 'Test Horse · Test program' }); change('Program', '10');
  await screen.findByRole('option', { name: 'Foundation' }); change('Phase', '31'); change('Date', '2026-11-05'); change('Start time', '06:00'); change('Expected duration', '60');
  fireEvent.click(screen.getByRole('button', { name: 'Next: Exercises' }));
  await screen.findByRole('option', { name: 'Walk' }); change('Add exercise', '8');
  fireEvent.click(screen.getByRole('button', { name: 'Next: Work Rider' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Select Rider' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Review' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save & Notify' }));
  expect(await screen.findByRole('heading', { name: 'Saved session detail' })).toBeInTheDocument(); expect(posts).toBe(1);
});
it('shows restriction reason without exposing an editor to Trainers', async () => {
  state.user.roles = ['TRAINER'];
  state.request.mockImplementation(async (path: string) => path.startsWith('/api/horses?') ? { items: [horse] } : { horseId: 7, availability: 'LIMITED', reason: 'Walk only', exerciseRules: [{ ruleType: 'ALLOWED', exerciseTypeNote: 'Walk' }] });
  render(<MemoryRouter initialEntries={['/medical/restrictions?horseId=7']}><RestrictionsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Walk only')).toBeInTheDocument());
  expect(screen.getByText('Read-only')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Save Training Availability' })).not.toBeInTheDocument();
});
it('preserves existing restriction rules when neither read response includes them', async () => {
  state.request.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/horses?')) return { items: [horse] };
    if (path.startsWith('/api/medical/restrictions?')) return { items: [{ id: 12, horseId: 7, level: 'LIMITED', reason: 'Walk only' }], totalPages: 1 };
    return { horseId: 7, availability: 'LIMITED', reason: 'Walk only', activeRestrictionId: 12 };
  });
  render(<MemoryRouter initialEntries={['/medical/restrictions?horseId=7']}><RestrictionsPage /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Save Training Availability' })).toBeDisabled();
  expect(screen.getByText('Exercise rules unavailable')).toBeInTheDocument();
  expect(state.request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
});
