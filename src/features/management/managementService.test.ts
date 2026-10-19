import { vi } from 'vitest';
import { ApiError } from '../../shared/auth/authApi';
import { createManagementService, parseAuditEntry, parseAuditPage, parseDashboard } from './managementService';
import { auditEntry, auditPageFixture, dashboardFixture } from './management.fixtures';

function transport(data: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: 'Denied.', details: [] } }), { status }));
  return { fetcher, service: createManagementService({ fetcher, baseUrl: 'https://backend.test/' }) };
}

describe('CORE-052 real HTTP adapter', () => {
  it('loads the exact dashboard contract through shared bearer transport', async () => {
    const { service, fetcher } = transport(dashboardFixture);
    const controller = new AbortController();
    expect(await service.dashboard({ token: 'test-token', signal: controller.signal })).toEqual(dashboardFixture);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://backend.test/api/dashboard/club-manager');
    expect(request?.method).toBe('GET');
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(request?.signal).toBe(controller.signal);
    expect(request?.body).toBeUndefined();
  });

  it('sends only approved audit parameters and preserves UTC instants', async () => {
    const { service, fetcher } = transport(auditPageFixture);
    await service.audit({ actor: 12, action: 'REGISTRATION_APPROVED', targetType: 'REGISTRATION', from: '2026-10-01T00:00:00Z', to: '2026-10-17T23:59:00Z', page: 0, size: 20 }, { token: 'test-token' });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/admin/audit-log');
    expect(Object.fromEntries(url.searchParams)).toEqual({ actor: '12', action: 'REGISTRATION_APPROVED', targetType: 'REGISTRATION', from: '2026-10-01T00:00:00Z', to: '2026-10-17T23:59:00Z', page: '0', size: '20' });
  });

  it('rejects invalid filters before transport', async () => {
    const { service, fetcher } = transport(auditPageFixture);
    await expect(service.audit({ actor: 0, page: -1, size: 101 }, { token: 'test' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])('propagates HTTP %s without any sample fallback or second request', async (status) => {
    const { service, fetcher } = transport(null, status);
    await expect(service.dashboard({ token: 'test' })).rejects.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('propagates an offline error instead of returning dashboard fixtures', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    await expect(createManagementService({ fetcher }).dashboard({ token: 'test' })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('strips arbitrary audit payloads and preserves historical/null actors', () => {
    expect(parseAuditEntry({ ...auditEntry, password: 'must-not-render', accessToken: 'must-not-render', actor: { ...auditEntry.actor, email: 'private@test', passwordHash: 'must-not-render' }, details: { secret: 'must-not-render' } })).toEqual(auditEntry);
    expect(parseAuditEntry({ id: 3, action: 'AUTOMATIC_ACTION', occurredAt: auditEntry.occurredAt, actor: null, actorRole: null }).actor).toBeNull();
  });

  it.each([
    { ...auditEntry, occurredAt: '2026-02-30T00:00:00Z' },
    { ...auditEntry, occurredAt: 'not-a-date' },
    { ...auditEntry, actorRole: 'SYSTEM' },
    { ...auditEntry, actor: { id: 12 } },
  ])('rejects malformed audit entry %#', (entry) => {
    expect(() => parseAuditEntry(entry)).toThrow(ApiError);
  });

  it('rejects malformed and ambiguous page metadata', () => {
    expect(() => parseAuditPage({ ...auditPageFixture, totalItems: 21 })).toThrow(ApiError);
    expect(() => parseAuditPage({ ...auditPageFixture, items: [auditEntry, auditEntry] })).toThrow(ApiError);
    expect(() => parseAuditPage({ ...auditPageFixture, size: 0 })).toThrow(ApiError);
  });

  it('rejects an API page that does not match the requested pagination', async () => {
    const { service } = transport(auditPageFixture);
    await expect(service.audit({ page: 1, size: 20 }, { token: 'test' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('does not silently coerce missing, negative or duplicate dashboard counts to zero', () => {
    expect(() => parseDashboard({ ...dashboardFixture, openIncidents: undefined })).toThrow(ApiError);
    expect(() => parseDashboard({ ...dashboardFixture, boxOccupancy: { ...dashboardFixture.boxOccupancy, free: -1 } })).toThrow(ApiError);
    expect(() => parseDashboard({ ...dashboardFixture, horsesByLifecycle: [{ key: 'ACTIVE', count: 1 }, { key: 'ACTIVE', count: 2 }] })).toThrow(ApiError);
    expect(() => parseDashboard({ ...dashboardFixture, horsesByLifecycle: [{ key: 'UNKNOWN', count: 1 }] })).toThrow(ApiError);
    expect(() => parseDashboard({ ...dashboardFixture, recentAudit: Array.from({ length: 11 }, () => auditEntry) })).toThrow(ApiError);
  });
});
