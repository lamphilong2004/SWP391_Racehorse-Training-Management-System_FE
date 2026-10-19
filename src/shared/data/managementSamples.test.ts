import { requestApi } from '../auth/authApi';
import { setBusinessActor } from './businessData';
import { readSamples, sampleUser, saveSamples } from './sampleStore';
import { createManagementService } from '../../features/management/managementService';
import type { AuditPage } from '../../features/management/types';

const service = createManagementService();
const context = { token: 'test-only-unused-in-sample' };
beforeEach(() => { localStorage.clear(); vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'sample'); setBusinessActor(sampleUser('CLUB_MANAGER')); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); setBusinessActor(null); });

it('projects current shared horse/session/incident counts and never fetches or creates another store', async () => {
  const data = readSamples();
  const first = await service.dashboard(context);
  expect(first.horsesByLifecycle.find((row) => row.key === 'ACTIVE')?.count).toBe(1);
  expect(first.openIncidents).toBe(data.incidents.length);
  data.horseRegistry!.records.push({ ...data.horseRegistry!.records[0], id: 800, horseCode: 'NEW-800', name: 'New sample', lifecycle: 'DRAFT' });
  data.incidents[0].status = 'RESOLVED';
  saveSamples(data);
  const next = await service.dashboard(context);
  expect(next.needsAttention.pendingActivations).toBe(first.needsAttention.pendingActivations + 1);
  expect(next.openIncidents).toBe(first.openIncidents - 1);
  expect(next.accountsByStatus).toEqual([{ key: 'ACTIVE', count: 7 }, { key: 'INACTIVE', count: 0 }]);
  expect(Object.keys(localStorage)).toEqual(['racehorse.business-samples.v1']);
  expect(fetch).not.toHaveBeenCalled();
});

it('shares snapshot rows with the dashboard, pages newest first and filters across all pages', async () => {
  const page = await service.audit({ page: 0, size: 1 }, context);
  const second = await service.audit({ page: 1, size: 1 }, context);
  expect(page.totalItems).toBeGreaterThan(1);
  expect(page.items[0].id).not.toBe(second.items[0].id);
  expect(Date.parse(page.items[0].occurredAt)).toBeGreaterThanOrEqual(Date.parse(second.items[0].occurredAt));
  expect((await service.dashboard(context)).recentAudit[0]).toEqual(page.items[0]);
  const filtered = await service.audit({ action: second.items[0].action, targetType: second.items[0].targetType!, from: second.items[0].occurredAt, to: second.items[0].occurredAt, page: 0, size: 100 }, context);
  expect(filtered.items).toContainEqual(second.items[0]);
  expect(filtered.items.every((row) => row.source === 'SAMPLE_SNAPSHOT' && !('email' in (row.actor ?? {})))).toBe(true);
  expect((await service.audit({ action: 'NO_MATCH', page: 0, size: 20 }, context)).items).toEqual([]);
});

it('rejects cross-role reads, mutations and malformed direct query input', async () => {
  setBusinessActor(sampleUser('TRAINER'));
  await expect(service.dashboard(context)).rejects.toMatchObject({ status: 403 });
  await expect(service.audit({ page: 0, size: 20 }, context)).rejects.toMatchObject({ status: 403 });
  setBusinessActor(sampleUser('CLUB_MANAGER'));
  await expect(requestApi('/api/admin/audit-log', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 405 });
  await expect(requestApi('/api/admin/audit-log?page=-1')).rejects.toMatchObject({ status: 400 });
});

it.each([401, 403, 500])('keeps API mode HTTP %s strict despite stored sample data', async (status) => {
  readSamples(); const before = localStorage.getItem('racehorse.business-samples.v1');
  vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api');
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Real API failure', details: [] } }), { status }));
  await expect(service.dashboard(context)).rejects.toMatchObject({ status });
  await expect(service.audit({ page: 0, size: 20 }, context)).rejects.toMatchObject({ status });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem('racehorse.business-samples.v1')).toBe(before);
});

it('returns empty read-only audit after the sample graph has no records', async () => {
  const data = readSamples(); data.horseRegistry!.records = []; data.sessions = []; data.incidents = []; saveSamples(data);
  expect(await requestApi<AuditPage>('/api/admin/audit-log?page=0&size=20')).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
});
