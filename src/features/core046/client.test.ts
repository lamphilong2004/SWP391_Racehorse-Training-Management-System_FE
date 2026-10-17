import { afterEach, vi } from 'vitest';
import { ApiError, collectPages, Core046Client } from './client';

beforeEach(() => vi.stubEnv('VITE_BUSINESS_DATA_SOURCE', 'api'));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function ok(data: unknown, status = 200) { return new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } }); }

describe('CORE-046 Medical API adapter', () => {
  it('uses the merged contract paths, bearer identity and empty completion body', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok({ items: [], page: 0, size: 100, totalElements: 0 }))
      .mockResolvedValueOnce(ok({ id: 7, status: 'COMPLETED' }))
      .mockResolvedValueOnce(ok({ id: 11, incidentCode: 'INC-11' }, 201));
    vi.stubGlobal('fetch', fetcher);
    const client = new Core046Client('token-from-host', 'https://api.example.test');
    await client.listTreatmentTasks();
    await client.completeTreatmentTask(7);
    await client.reportIncident({ horseId: 2, incidentType: 'FEVER', observedSeverity: 'HIGH', observedAt: '2026-10-16T01:00:00.000Z', description: 'Fever observed' });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/api/groom/treatment-tasks?page=0&size=100',
      'https://api.example.test/api/groom/treatment-tasks/7/complete',
      'https://api.example.test/api/incidents',
    ]);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', body: '{}' });
    expect(new Headers(fetcher.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer token-from-host');
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ horseId: 2, incidentType: 'FEVER', observedSeverity: 'HIGH', observedAt: '2026-10-16T01:00:00.000Z', description: 'Fever observed' });
  });

  it('surfaces server errors and rejects malformed success envelopes', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { message: 'Assigned Groom only' } }), { status: 403 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const client = new Core046Client('token');
    await expect(client.completeTreatmentTask(8)).rejects.toEqual(new ApiError('Assigned Groom only', 403));
    await expect(client.listIncidents()).rejects.toEqual(new ApiError('The request could not be completed. Try again.', 200));
  });

  it('rejects a 201 envelope without a usable incident code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ id: 11 }, 201)));
    const client = new Core046Client('token-from-host');
    await expect(client.reportIncident({ horseId: 2, incidentType: 'FEVER', observedSeverity: 'HIGH', observedAt: '2026-10-16T01:00:00.000Z' })).rejects.toThrow('Unexpected incident response.');
  });

  it('does not silently show an incomplete result set', async () => {
    await expect(collectPages(async () => ({ items: [], page: 0, size: 100, totalElements: 1 }))).rejects.toThrow('Incomplete paged response');
  });
});
