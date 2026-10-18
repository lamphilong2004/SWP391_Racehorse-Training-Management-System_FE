import { ROLE_CODES } from '../../shared/auth/roles';
import { createOwnerSampleTransport, ownerContractPending } from './ownerSampleTransport';
import { canonicalFixture, ownerA, ownerB } from './ownerFixtures.test-support';
import type { CurrentUser } from '../../shared/auth/authApi';

const clock = () => new Date('2026-10-18T00:00:00Z');
function setup() {
  let user: CurrentUser | null = ownerA;
  const snapshot = canonicalFixture();
  const readSamples = vi.fn(() => snapshot);
  const service = createOwnerSampleTransport({ readSamples, getBusinessActor: () => user }, clock);
  return { snapshot, readSamples, service, user: (value: CurrentUser | null) => { user = value; } };
}

describe('CORE-056 sample transport isolation', () => {
  it('isolates two Owner identities before returning list and detail projections', async () => {
    const { service, user } = setup();
    expect((await service.list({ actorId: 17 })).map((horse) => horse.id)).toEqual([7]);
    await expect(service.detail(8, { actorId: 17 })).rejects.toMatchObject({ status: 403 });
    user(ownerB);
    expect((await service.list({ actorId: 18 })).map((horse) => horse.id)).toEqual([8]);
    await expect(service.detail(7, { actorId: 18 })).rejects.toMatchObject({ status: 403 });
    expect((await service.detail(8, { actorId: 18 })).name).toBe('Ocean Pride');
  });
  it('rejects identity spoofing and logged-out calls before reading business data', async () => {
    const { service, readSamples, user } = setup();
    await expect(service.list({ actorId: 18 })).rejects.toMatchObject({ status: 401 });
    user(null); await expect(service.detail(7, { actorId: 17 })).rejects.toMatchObject({ status: 401 });
    expect(readSamples).not.toHaveBeenCalled();
  });
  it.each(ROLE_CODES.filter((role) => role !== 'HORSE_OWNER'))('rejects %s at transport, not only in UI', async (role) => {
    const { service, user, readSamples } = setup(); user({ ...ownerA, roles: [role] });
    await expect(service.list({ actorId: 17 })).rejects.toMatchObject({ status: 403 }); expect(readSamples).not.toHaveBeenCalled();
  });
  it('denies inactive accounts and supports scoped multi-role Owners', async () => {
    const { service, user } = setup(); user({ ...ownerA, accountStatus: 'INACTIVE' });
    await expect(service.list({ actorId: 17 })).rejects.toMatchObject({ status: 403 });
    user({ ...ownerA, roles: ['CLUB_MANAGER', 'HORSE_OWNER'] });
    expect((await service.list({ actorId: 17 })).map((horse) => horse.id)).toEqual([7]);
  });
  it('revalidates the canonical actor if it changes while the snapshot is read', async () => {
    const snapshot = canonicalFixture(); let user = ownerA;
    const service = createOwnerSampleTransport({ readSamples: () => { user = ownerB; return snapshot; }, getBusinessActor: () => user }, clock);
    await expect(service.list({ actorId: 17 })).rejects.toMatchObject({ status: 401 });
  });
  it('does not expose clinical fields, telemetry, feedback, evaluations or other Owner identities', async () => {
    const { snapshot, service } = setup();
    Object.assign(snapshot, { cases: [{ diagnosis: 'CLINICAL-SECRET', medication: 'MEDICATION-SECRET' }] });
    Object.assign(snapshot.horseRegistry!.records[0], { notes: 'CLINICAL-SECRET', weightKg: 512, password: 'SECRET-PASSWORD' });
    Object.assign(snapshot.sessions[0], { riderFeedback: 'SECRET-FEEDBACK', evaluation: 'SECRET-EVALUATION' });
    Object.assign(snapshot.sessions[0].actual!, { maxHeartRate: 199, medicalNote: 'CLINICAL-SECRET' });
    const result = await service.detail(7, { actorId: 17 }); const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/SECRET|diagnosis|medication|weightKg|password|HeartRate|feedback|evaluation|currentOwnerships|owner.beta/i);
    expect(result.sessions.map((session) => session.id)).toEqual([42]); expect(result.nextSession).toBeNull(); expect(result.program?.trainer).toBeNull(); expect(result.sessions[0].distanceM).toBeNull();
    expect(result.program?.name).toBe('Endurance foundation');
  });
  it('reads current canonical state afresh, preserving valid data and writing no storage', async () => {
    const { service, snapshot } = setup(); const before = JSON.stringify(snapshot); const storage = vi.spyOn(Storage.prototype, 'setItem');
    await service.list({ actorId: 17 }); expect(JSON.stringify(snapshot)).toBe(before); expect(storage).not.toHaveBeenCalled();
    snapshot.horseRegistry!.records[0].healthStatus = 'FIT';
    expect((await service.detail(7, { actorId: 17 })).health).toBe('FIT'); storage.mockRestore();
  });
  it('does not auto-assign unlinked horses when an unknown Owner logs in', async () => {
    const { service, user, snapshot } = setup(); const before = JSON.stringify(snapshot); user({ ...ownerA, id: 23 });
    expect(await service.list({ actorId: 23 })).toEqual([]); expect(JSON.stringify(snapshot)).toBe(before);
  });
  it.each(['2026-10-19', '2026-12-01'])('excludes future ownership starting %s', async (from) => {
    const { snapshot, service } = setup(); snapshot.horseRegistry!.records[0].currentOwnerships[0].effectiveFrom = from;
    expect(await service.list({ actorId: 17 })).toEqual([]);
  });
  it('excludes past ended ownership without guessing an inclusive boundary', async () => {
    const { snapshot, service } = setup(); snapshot.horseRegistry!.records[0].currentOwnerships[0].effectiveTo = '2026-10-17' as never;
    await expect(service.detail(7, { actorId: 17 })).rejects.toMatchObject({ status: 403 });
  });
  it.each(['2026-10-18', '2026-11-01'])('excludes non-open ownership ending %s per CORE-004', async (to) => {
    const { snapshot, service } = setup(); snapshot.horseRegistry!.records[0].currentOwnerships[0].effectiveTo = to as never;
    expect(await service.list({ actorId: 17 })).toEqual([]);
  });
  it('fails closed for malformed ownership dates or missing canonical registry', async () => {
    const { snapshot, service } = setup(); snapshot.horseRegistry!.records[0].currentOwnerships[0].effectiveFrom = '2026-99-99';
    await expect(service.list({ actorId: 17 })).rejects.toMatchObject({ status: 503 });
    delete snapshot.horseRegistry; await expect(service.list({ actorId: 17 })).rejects.toMatchObject({ status: 503 });
  });
  it.each([0, -1, NaN, Infinity, 1.2])('rejects invalid direct-link id %s', async (id) => {
    await expect(setup().service.detail(id, { actorId: 17 })).rejects.toMatchObject({ status: 400 });
  });
  it('provides a separate missing-horse state without returning another horse', async () => {
    await expect(setup().service.detail(999, { actorId: 17 })).rejects.toMatchObject({ status: 404 });
  });
  it('respects an aborted read before reading source data', async () => {
    const { service, readSamples } = setup(); const controller = new AbortController(); controller.abort();
    await expect(service.list({ actorId: 17, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(readSamples).not.toHaveBeenCalled();
  });
  it('never falls back from an unavailable real contract to sample or fetch', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(ownerContractPending.list({ actorId: 17 })).rejects.toMatchObject({ status: 503 });
    await expect(ownerContractPending.detail(7, { actorId: 17 })).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
  it('does not invent statuses, grandparent names, program progress, weight or clinical summaries', async () => {
    const { service, snapshot } = setup(); snapshot.horseRegistry!.records[0].healthStatus = 'NEW_UNKNOWN';
    snapshot.horseRegistry!.records[0].primaryPhotoUrl = 'javascript:alert(1)' as never;
    const result = await service.detail(7, { actorId: 17 }); expect(result.health).toBeNull(); expect(result.photo).toBeNull();
    expect(result).not.toHaveProperty('weight'); expect(result.program).not.toHaveProperty('progress'); expect(result).not.toHaveProperty('diagnosis');
  });
});
