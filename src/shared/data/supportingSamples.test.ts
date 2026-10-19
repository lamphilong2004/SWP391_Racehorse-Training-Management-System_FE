import { requestApi } from '../auth/authApi';
import { setBusinessActor } from './businessData';
import { readSamples, sampleUser } from './sampleStore';
import type { Exercise, ProgramPage, CalendarSession } from '../../features/training/assigned/supportingApi';

beforeEach(() => { localStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); setBusinessActor(sampleUser('TRAINER')); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); setBusinessActor(null); });
const call = <T,>(path: string, method = 'GET', body?: unknown) => requestApi<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const range = () => { const now = Date.now(); return `/api/training-sessions?${new URLSearchParams({ from: new Date(now - 86400000).toISOString(), to: new Date(now + 86400000).toISOString() })}`; };

it('persists exercise create/edit in the shared graph with exactly approved fields and no network', async () => {
  const created = await call<Exercise>('/api/exercises', 'POST', { name: 'Walking interval', exerciseType: 'Walk', description: 'Review response', targetMetric: null });
  expect(created).toMatchObject({ name: 'Walking interval', exerciseType: 'Walk', targetMetric: null });
  await call(`/api/exercises/${created.id}`, 'PUT', { name: 'Walking revision', exerciseType: 'Walk', description: null, targetMetric: 'Duration' });
  setBusinessActor(null); setBusinessActor(sampleUser('TRAINER'));
  expect(await call<Exercise>(`/api/exercises/${created.id}`)).toMatchObject({ name: 'Walking revision', description: null });
  expect(await call<Exercise[]>('/api/exercises?q=revision&exerciseType=Walk')).toHaveLength(1);
  expect(readSamples().exercises?.find((item) => item.id === created.id)?.name).toBe('Walking revision');
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects unsupported exercise defaults without persisting a false success', async () => {
  await call('/api/exercises'); const before = localStorage.getItem('racehorse.business-samples.v1');
  await expect(call('/api/exercises', 'POST', { name: 'Canter', intensity: 'HIGH' })).rejects.toMatchObject({ status: 400 });
  await expect(call('/api/exercises/99999')).rejects.toMatchObject({ status: 404 });
  expect(localStorage.getItem('racehorse.business-samples.v1')).toBe(before);
});

it('denies read-only roles from exercise mutations and excludes Groom from the library', async () => {
  setBusinessActor(sampleUser('VETERINARIAN'));
  expect(await call<Exercise[]>('/api/exercises')).not.toHaveLength(0);
  await expect(call('/api/exercises', 'POST', { name: 'No write' })).rejects.toMatchObject({ status: 403 });
  setBusinessActor(sampleUser('GROOM'));
  await expect(call('/api/exercises')).rejects.toMatchObject({ status: 403 });
});

it('returns own assigned programs/calendar only and keeps blocked state from the graph', async () => {
  const programs = await call<ProgramPage>('/api/training-programs?assignedToMe=true&page=0&size=20');
  expect(programs.items.map((item) => item.id)).toEqual([1001]);
  const sessions = await call<CalendarSession[]>(range());
  expect(sessions.find((item) => item.id === 44)).toMatchObject({ status: 'SCHEDULED', blocked: true, blockedReasons: ['PRE_CHECK_MISSING'] });
  setBusinessActor({ ...sampleUser('TRAINER'), id: 900 });
  expect((await call<ProgramPage>('/api/training-programs')).items).toEqual([]);
  expect(await call(range())).toEqual([]);
  setBusinessActor({ ...sampleUser('WORK_RIDER'), id: 901 });
  expect(await call(range())).toEqual([]);
});

it('validates calendar date range and page inputs', async () => {
  await expect(call('/api/training-sessions?from=bad&to=bad')).rejects.toMatchObject({ status: 400 });
  await expect(call('/api/training-programs?page=-1')).rejects.toMatchObject({ status: 400 });
});

it('leaves API failures real instead of falling back to saved samples', async () => {
  readSamples(); const before = localStorage.getItem('racehorse.business-samples.v1');
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Backend unavailable', details: [] } }), { status: 500 }));
  await expect(call('/api/exercises')).rejects.toMatchObject({ status: 500, message: 'Backend unavailable' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('racehorse.business-samples.v1')).toBe(before);
});
