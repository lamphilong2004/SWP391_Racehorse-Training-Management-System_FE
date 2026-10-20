import { createAuthApi, requestApi } from './authApi';

describe('hosted Auth API unavailable errors', () => {
  it.each([404, 405, 502, 503, 504])('explains a non-JSON login response %s without a fake sign-in', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('Static host or gateway error', { status }));
    await expect(createAuthApi({ fetcher }).login({ email: 'invalid@example.invalid', password: 'unused-fixture' }))
      .rejects.toMatchObject({ status, code: 'SERVER_UNAVAILABLE', message: 'Sign-in service is unavailable. Please try again later.' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('preserves an actual Backend JSON error rather than reclassifying it', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Server message', details: [] } }), { status: 404 }));
    await expect(createAuthApi({ fetcher }).login({ email: 'invalid@example.invalid', password: 'unused-fixture' })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Server message' });
  });
  it('does not reinterpret other resource 404s or malformed 200 as successful login', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('not JSON', { status: 404 }));
    await expect(requestApi('/api/horses/1', {}, { fetcher })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 404 });
    fetcher.mockResolvedValue(new Response('<html>SPA</html>', { status: 200 }));
    await expect(createAuthApi({ fetcher }).login({ email: 'invalid@example.invalid', password: 'unused-fixture' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });
  it('still clears unauthorized sessions on non-JSON 401', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    await expect(requestApi('/api/auth/me', {}, { fetcher, onUnauthorized })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
