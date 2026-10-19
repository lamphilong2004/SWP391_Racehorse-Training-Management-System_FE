import { createHorsesApi, type HttpClient } from './horsesApi';

const ids = ['IDENTITY', 'PEDIGREE', 'OWNER', 'FREE_STABLE_BOX', 'VETERINARIAN_BASELINE', 'HEAD_TRAINER_READINESS_REVIEW'];
const status = () => ({ horseId: 1, checklist: ids.map((id, index) => ({ id, label: id, description: id, requirement: index < 5 ? 'MANDATORY' : 'RECOMMENDED', state: index < 5 ? 'PENDING' : 'NOT_REVIEWED' })) });
function api(value: unknown) { const request = vi.fn().mockResolvedValue(value); return { request, api: createHorsesApi({ request } as HttpClient) }; }
it('accepts the six-item approved checklist without deriving activation', async () => {
  const s = api(status()); await expect(s.api.getActivationStatus(1)).resolves.toEqual(status());
  expect(s.request).toHaveBeenCalledWith('GET', '/api/horses/1/activation-status');
});
it.each([null, { horseId: 1, checklist: [] }, { ...status(), checklist: status().checklist.slice(0, 4) }, { ...status(), checklist: [...status().checklist].reverse() }, { ...status(), checklist: status().checklist.map((r) => ({ ...r, state: 'INVENTED' })) }])('rejects legacy/malformed checklist rather than showing a false completion', async (value) => {
  await expect(api(value).api.getActivationStatus(1)).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });
});
it('retains exact CORE004 create/list/detail paths and payload without client lifecycle fields', async () => {
  const s = api({}); const body = { horseCode: 'FIX', name: 'Fixture', breed: null, sex: null, foaledDate: null, countryOfOrigin: null, registrationNo: null };
  await s.api.createHorse(body); await s.api.listHorses({ page: 0, size: 20 }); await s.api.getHorse(81);
  expect(s.request.mock.calls).toEqual([['POST', '/api/horses', { body }], ['GET', '/api/horses', { query: { page: 0, size: 20 } }], ['GET', '/api/horses/81']]);
});
