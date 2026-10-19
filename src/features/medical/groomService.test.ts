import { collectAssignedTasks, createGroomService } from './groomService';
import { createMedicalService } from './service';

const task = { id: 12, horseId: 14, assignedGroomUserId: 6, instruction: 'Cold compress', taskDate: '2026-10-19', status: 'PENDING' };
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const page = (items: unknown[]) => ({ items, page: 0, size: 100, totalElements: items.length });
const medicalCase = { id: 9, horseId: 14, status: 'OPEN', openedAt: '2026-10-19T00:00:00Z', examinations: [], injuries: [], incidentIds: [], reexaminations: [] };

it('uses JWT-scoped list and empty completion body without client actor/timestamp fields', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok(page([task]))).mockResolvedValueOnce(ok({ ...task, status: 'COMPLETED', completedAt: '2026-10-19T05:00:00Z' }));
  const api = createGroomService('server-session', 6, undefined, { baseUrl: '', fetcher });
  expect((await api.list()).items).toHaveLength(1);
  expect((await api.complete(12)).status).toBe('COMPLETED');
  expect(fetcher.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([
    ['/api/groom/treatment-tasks?page=0&size=100', 'GET', undefined], ['/api/groom/treatment-tasks/12/complete', 'POST', '{}'],
  ]);
  expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer server-session');
});
it.each([{ assignedGroomUserId: 7 }, { diagnosis: 'private' }, { caseId: 9 }, { treatmentMedicationInstructions: 'private' }, { taskDate: '2026-02-30' }, { status: 'COMPLETED' }])('rejects unauthorized or malformed Groom projection %j instead of filtering it away', async (patch) => {
  const fetcher = vi.fn().mockResolvedValue(ok(page([{ ...task, ...patch }])));
  await expect(createGroomService('session', 6, undefined, { baseUrl: '', fetcher }).list()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  expect(fetcher).toHaveBeenCalledOnce();
});
it('does not acknowledge a mismatched completion response or successful envelope with PENDING', async () => {
  for (const patch of [{ id: 99 }, { assignedGroomUserId: 7 }, { status: 'PENDING', completedAt: undefined }]) {
    const fetcher = vi.fn().mockResolvedValue(ok({ ...task, status: 'COMPLETED', completedAt: '2026-10-19T05:00:00Z', ...patch }));
    await expect(createGroomService('session', 6, undefined, { baseUrl: '', fetcher }).complete(12)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  }
});
it.each([400, 401, 403, 404, 409, 500])('propagates HTTP %i without mock fallback', async (status) => {
  const errorHandler = vi.fn();
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'server error', details: [] } }), { status }));
  await expect(createGroomService('session', 6, errorHandler, { baseUrl: '', fetcher }).list()).rejects.toMatchObject({ status });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(errorHandler).toHaveBeenCalledOnce();
});
it('rejects malformed envelopes and offline requests', async () => {
  for (const response of [ok(null), ok({}), new Response('not-json', { status: 200 })]) {
    await expect(createGroomService('session', 6, undefined, { baseUrl: '', fetcher: vi.fn().mockResolvedValue(response) }).list()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  }
  const fetcher = vi.fn().mockRejectedValue(new TypeError('Offline'));
  await expect(createGroomService('session', 6, undefined, { baseUrl: '', fetcher }).list()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  expect(fetcher).toHaveBeenCalledOnce();
});
it('collects complete server pages and rejects changed totals/duplicates', async () => {
  const first = { items: [task], page: 0, size: 1, totalElements: 2 };
  const list = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ ...first, page: 1, items: [{ ...task, id: 13 }] });
  expect(await collectAssignedTasks({ list })).toHaveLength(2);
  expect(list.mock.calls).toEqual([[0], [1]]);
  const duplicate = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ ...first, page: 1 });
  await expect(collectAssignedTasks({ list: duplicate })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  const changed = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ ...first, page: 1, totalElements: 3 });
  await expect(collectAssignedTasks({ list: changed })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('rejects invalid IDs/pages before sending a Groom request', async () => {
  const fetcher = vi.fn(), api = createGroomService('session', 6, undefined, { baseUrl: '', fetcher });
  await expect(api.complete(0)).rejects.toThrow('Invalid task ID');
  await expect(api.list(NaN)).rejects.toThrow('Invalid page');
  expect(fetcher).not.toHaveBeenCalled();
});
it('validates clinical read DTOs and identity before rendering or claiming data loaded', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(ok({ id: 9 })).mockResolvedValueOnce(ok({ ...medicalCase, id: 99 })).mockResolvedValueOnce(ok({ ...medicalCase, treatmentPlan: null }));
  const api = createMedicalService('session', undefined, { baseUrl: '', fetcher });
  for (let n = 0; n < 3; n++) await expect(api.getCase(9)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
