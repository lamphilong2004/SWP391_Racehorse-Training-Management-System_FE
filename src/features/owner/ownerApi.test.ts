import { createOwnerApi } from './ownerApi';

const card = { id: 7, horseCode: 'RH-7', name: 'Owned horse', lifecycle: 'ACTIVE', trainingAvailability: 'AVAILABLE', healthStatus: null };
const profile = { horse: card, pedigree: { sire: { name: 'Sire' }, dam: {} }, myOwnership: { sharePercentage: 60, effectiveFrom: '2026-01-01', isManagingOwner: true } };
const health = { healthStatus: 'MONITORING', trainingAvailability: 'LIMITED', weights: [{ weightKg: 501.25, recordedAt: '2026-10-18T06:00:00Z' }], restrictionReviewDate: '2026-10-25', recoveryStatus: 'IMPROVING', lastExaminedAt: '2026-10-17T06:00:00Z' };
const training = { currentProgram: { name: 'Foundation', status: 'ACTIVE', periodStart: '2026-10-01', periodEnd: '2026-10-31', currentPhaseName: null, sessionsCompleted: 3, sessionsPlanned: 8 }, recentSessions: [{ sessionCode: 'SES-42', scheduledStart: '2026-10-17T06:00:00Z', status: 'COMPLETED' }] };
function setup(data: { list?: unknown; profile?: unknown; health?: unknown; training?: unknown; fail?: string; status?: number } = {}) {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (data.fail && path.endsWith(data.fail)) return new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'SERVER-SECRET', details: [] } }), { status: data.status ?? 403 });
    const value = path.endsWith('/profile') ? data.profile ?? profile : path.endsWith('/health-summary') ? data.health ?? health : path.endsWith('/training-summary') ? data.training ?? training : data.list ?? [card];
    return new Response(JSON.stringify({ success: true, data: value }), { status: 200 });
  });
  return { fetcher, service: createOwnerApi({ fetcher, baseUrl: 'https://api.example.test', getToken: () => 'fixture-only' }) };
}
describe('CORE-056 pinned CORE-004 HTTP contract', () => {
  it('reads the array envelope using shared HTTP, Bearer session and no invented query parameters', async () => {
    const { service, fetcher } = setup();
    expect((await service.list({ actorId: 17 })).map((item) => item.id)).toEqual([7]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/owner/horses');
    const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1];
    expect(init.method).toBe('GET'); expect(new Headers(init.headers).get('Authorization')).toBe('Bearer fixture-only'); expect(init.body).toBeUndefined();
  });
  it('accepts an empty array without sample seed or pagination', async () => { expect(await setup({ list: [] }).service.list({ actorId: 17 })).toEqual([]); });
  it('rejects paginated objects rather than silently adapting a different DTO', async () => {
    await expect(setup({ list: { items: [card], totalElements: 1 } }).service.list({ actorId: 17 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('reads the three exact detail endpoints, preserving nullable fields, weights, progress and own ownership', async () => {
    const { service, fetcher } = setup(); const result = await service.detail(7, { actorId: 17 });
    expect(fetcher.mock.calls.map(([url]) => String(url).replace('https://api.example.test', ''))).toEqual(['/api/owner/horses/7/profile', '/api/owner/horses/7/health-summary', '/api/owner/horses/7/training-summary']);
    expect(result).toMatchObject({ id: 7, health: 'MONITORING', availability: 'LIMITED', dam: null, ownership: profile.myOwnership, healthSummary: { weights: health.weights, reviewDate: health.restrictionReviewDate, recovery: 'IMPROVING' }, program: { completed: 3, planned: 8, trainer: null }, sessions: [{ title: 'SES-42', distanceM: null }] });
  });
  it('whitelists summary fields and never exposes staff-only, clinical, telemetry or other-owner values', async () => {
    const { service } = setup({ profile: { ...profile, diagnosis: 'SECRET', otherOwners: ['SECRET'], stable: 'SECRET' }, health: { ...health, findings: 'SECRET', prescription: 'SECRET', restrictionReason: 'SECRET' }, training: { ...training, trainer: 'SECRET', nextSession: 'SECRET', recentSessions: [{ ...training.recentSessions[0], feedback: 'SECRET', evaluationLabel: 'SECRET', distance: 1200 }] } });
    expect(JSON.stringify(await service.detail(7, { actorId: 17 }))).not.toMatch(/SECRET|diagnosis|prescription|feedback|otherOwners|restrictionReason/);
  });
  it('shows only the owned profile current box projection, including its persisted date', async () => {
    const { service } = setup({ profile: { ...profile, currentBoxCode: 'PRESENT-04', stableEffectiveFrom: '2026-10-21' } });
    expect(await service.detail(7, { actorId: 17 })).toMatchObject({ stable: 'PRESENT-04', stableSince: '2026-10-21' });
  });
  it.each([401, 403, 404, 500])('propagates profile %s without summary calls or sample fallback', async (status) => {
    const { service, fetcher } = setup({ fail: '/profile', status });
    await expect(service.detail(7, { actorId: 17 })).rejects.toMatchObject({ status }); expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(['/health-summary', '/training-summary'])('does not display a partial detail or fall back when %s fails', async (fail) => {
    await expect(setup({ fail }).service.detail(7, { actorId: 17 })).rejects.toMatchObject({ status: 403 });
  });
  it('rejects a mismatched profile id and unsupported status instead of returning another entity', async () => {
    await expect(setup({ profile: { ...profile, horse: { ...card, id: 8 } } }).service.detail(7, { actorId: 17 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(setup({ list: [{ ...card, lifecycle: 'INVENTED' }] }).service.list({ actorId: 17 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it.each([{ ...health, weights: Array(13).fill(health.weights[0]) }, { ...health, weights: [{ weightKg: 0, recordedAt: '2026-10-18T06:00:00Z' }] }, { ...health, restrictionReviewDate: '2026-02-31' }, { ...health, healthStatus: undefined }])('rejects malformed required health or out-of-contract values', async (value) => {
    await expect(setup({ health: value }).service.detail(7, { actorId: 17 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('supports nullable/omitted optional summaries without inventing metrics', async () => {
    const result = await setup({ health: { healthStatus: null, trainingAvailability: 'AVAILABLE', weights: [] }, training: { currentProgram: null, recentSessions: [] } }).service.detail(7, { actorId: 17 });
    expect(result.program).toBeNull(); expect(result.healthSummary).toEqual({ reviewDate: null, examinedAt: null, recovery: null, weights: [] });
  });
  it('does not send requests for missing credentials, invalid ids or pre-aborted reads', async () => {
    const fetcher = vi.fn(); const service = createOwnerApi({ fetcher, getToken: () => undefined });
    await expect(service.list({ actorId: 17 })).rejects.toMatchObject({ status: 401 });
    await expect(service.detail(0, { actorId: 17 })).rejects.toMatchObject({ status: 400 });
    const controller = new AbortController(); controller.abort();
    await expect(service.list({ actorId: 17, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('propagates network failures with no alternate request or sample fallback', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline')); const service = createOwnerApi({ fetcher, getToken: () => 'fixture-only' });
    await expect(service.list({ actorId: 17 })).rejects.toMatchObject({ code: 'NETWORK_ERROR' }); expect(fetcher).toHaveBeenCalledOnce();
  });
});
