import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '../../shared/auth/authApi';
import { ThresholdOverride } from './ThresholdOverride';
import { createThresholdApi, validThreshold } from './thresholdApi';

const state = vi.hoisted(() => ({ roles: ['VETERINARIAN'], request: vi.fn() }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { roles: state.roles } }) }));
vi.mock('../main-flows/api', async (original) => ({ ...await original<typeof import('../main-flows/api')>(), useFlowRequest: () => state.request }));
const globalThreshold = { metricType: 'HEART_RATE', thresholdValue: 175.5, scope: 'GLOBAL' };
const override = { ...globalThreshold, thresholdValue: 185.25, scope: 'HORSE_OVERRIDE', horseId: 7, effectiveFrom: '2026-10-19T06:00:00Z' };
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
beforeEach(() => { state.roles = ['VETERINARIAN']; state.request.mockReset().mockResolvedValue([globalThreshold]); });
async function open() {
  render(<ThresholdOverride horseId={7} />); fireEvent.click(await screen.findByRole('button', { name: 'Threshold Override' }));
  return screen.findByRole('dialog', { name: 'Threshold Override · Horse 7' });
}
it('requires valid input and confirmation before PUT, then reloads only after a confirmed response', async () => {
  let saved = false;
  state.request.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'PUT' ? (saved = true, override) : [saved ? override : globalThreshold]);
  await open(); expect(screen.getByRole('button', { name: 'Review override' })).toBeDisabled();
  change('Override threshold', '0'); change('Effective from', '2026-10-20T08:00');
  expect(screen.getByRole('button', { name: 'Review override' })).toBeDisabled();
  change('Override threshold', '185.25'); change('Override reason', 'Per-horse clinical plan');
  fireEvent.click(screen.getByRole('button', { name: 'Review override' }));
  expect(await screen.findByRole('dialog', { name: 'Confirm threshold override' })).toBeInTheDocument();
  expect(state.request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm override' }));
  await waitFor(() => expect(state.request).toHaveBeenCalledWith('/api/horses/7/medical-thresholds', { method: 'PUT', body: JSON.stringify({ metricType: 'HEART_RATE', thresholdValue: 185.25, effectiveFrom: new Date('2026-10-20T08:00').toISOString(), reason: 'Per-horse clinical plan' }) }));
  expect(await screen.findByText('185.25 bpm · HORSE_OVERRIDE')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('ends an existing override through confirmed POST /end and never assumes a global value', async () => {
  let ended = false;
  state.request.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'POST' ? (ended = true, { ...override, effectiveTo: '2026-10-20T01:00:00Z' }) : [ended ? globalThreshold : override]);
  await open(); change('End override at', '2026-10-18T08:00');
  expect(screen.getByRole('button', { name: 'Review end override' })).toBeDisabled();
  change('End override at', '2026-10-20T08:00'); fireEvent.click(screen.getByRole('button', { name: 'Review end override' }));
  expect(state.request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm end override' }));
  await waitFor(() => expect(state.request).toHaveBeenCalledWith('/api/horses/7/medical-thresholds/end', { method: 'POST', body: JSON.stringify({ effectiveTo: new Date('2026-10-20T08:00').toISOString() }) }));
  expect(await screen.findByText('175.5 bpm · GLOBAL')).toBeInTheDocument();
});
it('keeps a failed write unconfirmed and retains the draft for retry', async () => {
  state.request.mockImplementation(async (_path: string, init?: RequestInit) => { if (init?.method === 'PUT') throw new ApiError(409, 'CONFLICT', 'Effective interval overlaps'); return [globalThreshold]; });
  await open(); change('Override threshold', '185.25'); change('Effective from', '2026-10-20T08:00');
  fireEvent.click(screen.getByRole('button', { name: 'Review override' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm override' }));
  expect(await screen.findByText('Effective interval overlaps')).toBeInTheDocument();
  expect(screen.queryByText('Threshold request confirmed')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to edit' })); expect(screen.getByLabelText('Override threshold (bpm)')).toHaveValue(185.25);
});
it('does not write when confirmation is cancelled and does not enable END for a global threshold', async () => {
  const dialog = await open(); expect(within(dialog).getByRole('button', { name: 'Review end override' })).toBeDisabled();
  change('Override threshold', '185.25'); change('Effective from', '2026-10-20T08:00'); fireEvent.click(screen.getByRole('button', { name: 'Review override' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(state.request.mock.calls.some(([, init]) => init?.method)).toBe(false);
});
it.each(['HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER', 'GROOM', 'HORSE_OWNER', 'WORK_RIDER'])('does not render or request threshold management for %s', (role) => {
  state.roles = [role]; render(<ThresholdOverride horseId={7} />);
  expect(screen.queryByRole('button', { name: 'Threshold Override' })).not.toBeInTheDocument(); expect(state.request).not.toHaveBeenCalled();
});
it('keeps missing or malformed effective values unavailable without a hardcoded threshold', async () => {
  state.request.mockResolvedValue({ thresholdValue: 180 }); render(<ThresholdOverride horseId={7} />);
  expect(await screen.findByText('Effective threshold was not confirmed by the server. Reload before changing it.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Threshold Override' })).toBeDisabled();
});
it('bounds precision and serializes only approved threshold fields', async () => {
  expect(['0', '-1', '99999.999', '100000', 'Infinity', ''].some(validThreshold)).toBe(false);
  state.request.mockResolvedValue(override);
  await createThresholdApi(state.request).set(7, { metricType: 'HEART_RATE', thresholdValue: 185.25, effectiveFrom: '2026-10-20T01:00:00Z', reason: 'Plan', warningThreshold: 170 } as never);
  expect(JSON.parse(state.request.mock.calls[0][1].body)).toEqual({ metricType: 'HEART_RATE', thresholdValue: 185.25, effectiveFrom: '2026-10-20T01:00:00Z', reason: 'Plan' });
});
