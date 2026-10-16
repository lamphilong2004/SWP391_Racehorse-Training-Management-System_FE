import { loadMedicalRuntime } from './runtimeClient';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('medical authentication boundary', () => {
  it('requires a valid active authenticated account', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadMedicalRuntime()).rejects.toThrow('Sign in');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects malformed or inactive identity responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 6, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'INACTIVE' } }))));
    await expect(loadMedicalRuntime('test-token')).rejects.toThrow('active');
  });
  it('uses the verified server identity and forwards supplied JWT', async () => {
    const actor = { id: 6, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: actor })));
    vi.stubGlobal('fetch', fetcher);
    const runtime = await loadMedicalRuntime('test-token');
    expect(runtime.actor).toEqual(actor);
    expect(runtime.service.listCases).toBeTypeOf('function');
    expect(fetcher).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  });
});
