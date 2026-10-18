import { ROLE_CODES } from '../../../shared/auth/roles';
import { getBusinessActor, setBusinessActor } from '../../../shared/data/businessData';
import { readSamples, resetSamples, sampleUser, saveSamples } from '../../../shared/data/sampleStore';
import { createHorseHistorySample } from './historySample';
import { createHorseHistoryApi, parseChecklist } from './historyApi';

const context = { readSamples, saveSamples, getBusinessActor };
const sample = () => createHorseHistorySample(context, () => new Date('2026-10-18T06:00:00Z'));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'); resetSamples(); setBusinessActor(sampleUser('HEAD_TRAINER')); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); setBusinessActor(null); });
describe('CORE-017 canonical sample history/readiness', () => {
  it('returns exactly five mandatory and one recommended item without changing activation', async () => {
    const before = JSON.stringify(readSamples()); const result = await sample().checklist(7);
    expect(result.checklist.map((i) => i.id)).toEqual(['IDENTITY', 'PEDIGREE', 'OWNER', 'FREE_STABLE_BOX', 'VETERINARIAN_BASELINE', 'HEAD_TRAINER_READINESS_REVIEW']);
    expect(result.checklist[5]).toMatchObject({ requirement: 'RECOMMENDED', state: 'NOT_REVIEWED' });
    expect(JSON.stringify(readSamples())).toBe(before); expect(parseChecklist(result, 7)).toEqual(result);
  });
  it('distinguishes missing pedigree from existing ownership rather than using legacy combined state', async () => {
    const data = readSamples(); data.horseRegistry!.records[0].pedigree.sire = { horseId: null, name: null }; saveSamples(data);
    const items = (await sample().checklist(7)).checklist;
    expect(items.find((i) => i.id === 'PEDIGREE')?.state).toBe('PENDING'); expect(items.find((i) => i.id === 'OWNER')?.state).toBe('SATISFIED');
  });
  it('does not make optional identity fields mandatory in the pinned checklist projection', async () => {
    const data = readSamples(); Object.assign(data.horseRegistry!.records[0], { breed: null, sex: null, foaledDate: null }); saveSamples(data);
    expect((await sample().checklist(7)).checklist.find((i) => i.id === 'IDENTITY')?.state).toBe('SATISFIED');
  });
  it('persists repeated review events for actual actors in the existing store, across session switches, without lifecycle or medical writes', async () => {
    const original = readSamples(); const service = sample(); await service.acknowledge(7);
    setBusinessActor({ ...sampleUser('HEAD_TRAINER'), id: 47 }); await service.acknowledge(7);
    const data = readSamples() as ReturnType<typeof readSamples> & { horseReadinessEvents: { action: string; actorId: number }[] };
    expect(data.horseReadinessEvents.map((e) => e.actorId)).toEqual([11, 47]); expect(data.horseReadinessEvents.every((e) => e.action === 'HEAD_TRAINER_READINESS_REVIEWED')).toBe(true);
    expect(data.horseRegistry).toEqual(original.horseRegistry); expect(data.cases).toEqual(original.cases); expect(data.healthStatus).toBe(original.healthStatus);
    setBusinessActor(null); await expect(service.checklist(7)).rejects.toMatchObject({ status: 401 }); setBusinessActor(sampleUser('HEAD_TRAINER'));
    expect((await sample().checklist(7)).checklist[5].state).toBe('REVIEWED');
    expect(Object.keys(localStorage)).toEqual(['racehorse.business-samples.v1']);
  });
  it.each(ROLE_CODES.filter((r) => r !== 'HEAD_TRAINER'))('denies readiness writes by %s at transport', async (role) => {
    setBusinessActor(sampleUser(role)); const before = JSON.stringify(readSamples()); await expect(sample().acknowledge(7)).rejects.toMatchObject({ status: 403 }); expect(JSON.stringify(readSamples())).toBe(before);
  });
  it.each(['TRAINER', 'VETERINARIAN', 'GROOM', 'WORK_RIDER', 'HORSE_OWNER'] as const)('denies full ownership/stable history by %s', async (role) => {
    setBusinessActor(sampleUser(role)); await expect(sample().ownerships(7)).rejects.toMatchObject({ status: 403 }); await expect(sample().assignments(7)).rejects.toMatchObject({ status: 403 });
  });
  it('scopes Trainer timeline to assigned program, rather than relying on a hidden UI link', async () => {
    setBusinessActor(sampleUser('TRAINER')); expect((await sample().timeline(7, 0)).items).toEqual([]);
    setBusinessActor({ ...sampleUser('TRAINER'), id: 88 }); await expect(sample().timeline(7, 0)).rejects.toMatchObject({ status: 403 });
  });
  it('never invents timeline events or returns clinical details, reasons or private user fields', async () => {
    const data = readSamples(); Object.assign(data.horseRegistry!.records[0].currentOwnerships[0].owner, { email: 'PRIVATE-SECRET' }); data.horseRegistry!.records[0].currentAssignment!.reason = 'CLINICAL-SECRET'; saveSamples(data);
    const service = sample(); expect((await service.timeline(7, 0)).items).toEqual([]);
    const result = JSON.stringify([await service.ownerships(7), await service.assignments(7), await service.checklist(7)]);
    expect(result).not.toMatch(/SECRET|diagnosis|medication|password|email/);
  });
  it('fails a review when canonical persistence fails, rather than claiming success', async () => {
    const save = vi.fn(() => { throw new Error('disk unavailable'); }); const service = createHorseHistorySample({ ...context, saveSamples: save });
    await expect(service.acknowledge(7)).rejects.toThrow('disk unavailable'); expect((await sample().checklist(7)).checklist[5].state).toBe('NOT_REVIEWED');
  });
  it('blocks inactive/session-switched actors, missing/invalid horses and aborted reads', async () => {
    setBusinessActor({ ...sampleUser('HEAD_TRAINER'), accountStatus: 'INACTIVE' }); await expect(sample().checklist(7)).rejects.toMatchObject({ status: 403 });
    setBusinessActor(sampleUser('HEAD_TRAINER')); await expect(sample().checklist(0)).rejects.toMatchObject({ status: 400 }); await expect(sample().checklist(999)).rejects.toMatchObject({ status: 404 });
    const abort = new AbortController(); abort.abort(); await expect(sample().timeline(7, 0, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const service = createHorseHistorySample({ ...context, readSamples: () => { const data = readSamples(); setBusinessActor(null); return data; } }); await expect(service.checklist(7)).rejects.toMatchObject({ status: 401 });
  });
});
describe('CORE-017 pinned API operations', () => {
  const api = (fetcher: typeof fetch) => createHorseHistoryApi({ fetcher, baseUrl: 'https://api.example.test', getToken: () => 'fixture-token' });
  it('uses exact paged timeline path, preserves unknown event types as neutral titles, and whitelists fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { page: 2, size: 20, totalItems: 45, totalPages: 3, items: [{ occurredAt: '2026-10-18T06:00:00Z', eventType: 'FUTURE_BE_TYPE', title: 'Safe summary', diagnosis: 'SECRET' }] } })));
    const result = await api(fetcher).timeline(7, 2); expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/horses/7/timeline?page=2&size=20'); expect(result.items[0].eventType).toBe('FUTURE_BE_TYPE'); expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('sends a bodyless POST and accepts 204 without parsing JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); await api(fetcher).acknowledge(7);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/horses/7/readiness-review'); expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST' }); expect(fetcher.mock.calls[0][1].body).toBeUndefined(); expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer fixture-token');
  });
  it.each([401, 403, 404, 500])('preserves readiness error %s with no sample mutation/fallback', async (status) => {
    const before = localStorage.getItem('racehorse.business-samples.v1'); const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Unavailable', details: [] } }), { status }));
    await expect(api(fetcher).acknowledge(7)).rejects.toMatchObject({ status }); expect(fetcher).toHaveBeenCalledOnce(); expect(localStorage.getItem('racehorse.business-samples.v1')).toBe(before);
  });
  it('rejects an unexpected 200 acknowledgement rather than treating an empty envelope as the required 204', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await expect(api(fetcher).acknowledge(7)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('does not accept the legacy four-item activation DTO', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { horseId: 7, horseCode: 'RH-7', name: 'Horse', lifecycle: 'DRAFT', checklist: [{ item: 'IDENTITY', complete: true }] } })));
    await expect(api(fetcher).checklist(7)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects invalid ids/pages or absent credentials before network access', async () => {
    const fetcher = vi.fn(); const service = api(fetcher); await expect(service.timeline(7, -1)).rejects.toMatchObject({ status: 400 }); await expect(service.acknowledge(0)).rejects.toMatchObject({ status: 400 });
    await expect(createHorseHistoryApi({ fetcher, getToken: () => undefined }).checklist(7)).rejects.toMatchObject({ status: 401 }); expect(fetcher).not.toHaveBeenCalled();
  });
});
