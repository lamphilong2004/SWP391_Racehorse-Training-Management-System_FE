import { loadMedicalRuntime } from './runtimeClient';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('medical authentication boundary', () => {
  it('requires a valid active authenticated account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(loadMedicalRuntime()).rejects.toThrow('Sign in');
  });
  it('rejects malformed or inactive identity responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 6, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'INACTIVE' } }))));
    await expect(loadMedicalRuntime()).rejects.toThrow('active');
  });
  it('uses the verified server identity and forwards supplied JWT', async () => {
    const actor = { id: 6, fullName: 'Groom', roles: ['GROOM'], accountStatus: 'ACTIVE' };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: actor })));
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_MEDICAL_MOCK', 'false');
    const runtime = await loadMedicalRuntime('test-token');
    expect(runtime.actor).toEqual(actor);
    expect(runtime.service.mode).toBe('unavailable');
    expect(fetcher).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  });
});
