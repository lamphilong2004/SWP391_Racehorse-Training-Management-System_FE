import { createAuthApi } from './authApi';

afterEach(() => { vi.useRealTimers(); });

it('bounds an auth/me request that never receives headers, aborts it and preserves the stored identity for retry', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {})), onUnauthorized = vi.fn();
  const request = createAuthApi({ fetcher }).currentUser('fixture-token', onUnauthorized);
  const rejected = expect(request).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0, message: expect.stringContaining('quá thời gian chờ') });
  await vi.advanceTimersByTimeAsync(15000); await rejected;
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(onUnauthorized).not.toHaveBeenCalled();
});

it('also bounds a stalled JSON body and ignores an unauthorized response arriving after timeout', async () => {
  vi.useFakeTimers();
  let finish!: (body: unknown) => void;
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue({ status: 401, ok: false, json: () => new Promise((resolve) => { finish = resolve; }) } as Response);
  const onUnauthorized = vi.fn();
  const request = createAuthApi({ fetcher }).currentUser('fixture-token', onUnauthorized);
  const rejected = expect(request).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  await vi.advanceTimersByTimeAsync(15000); await rejected;
  finish({ success: false, error: { code: 'UNAUTHORIZED', message: 'Old response', details: [] } });
  await vi.advanceTimersByTimeAsync(0);
  expect(onUnauthorized).not.toHaveBeenCalled();
});

it('preserves a prompt 401 and its unauthorized callback', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Expired', details: [] } }), { status: 401 }));
  const onUnauthorized = vi.fn();
  await expect(createAuthApi({ fetcher }).currentUser('fixture-token', onUnauthorized)).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  expect(onUnauthorized).toHaveBeenCalledOnce();
});

it('returns only the real user from a successful response and clears its timer', async () => {
  vi.useFakeTimers();
  const user = { id: 9, roles: ['TRAINER'], accountStatus: 'ACTIVE' };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ success: true, data: user })));
  await expect(createAuthApi({ fetcher }).currentUser('fixture-token', vi.fn())).resolves.toEqual(user);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not add the restore timeout or retry to a pending login mutation', async () => {
  vi.useFakeTimers(); let settled = false;
  const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
  void createAuthApi({ fetcher }).login({ email: 'fixture@example.invalid', password: 'fixture' }).finally(() => { settled = true; });
  await vi.advanceTimersByTimeAsync(30000);
  expect(settled).toBe(false); expect(fetcher).toHaveBeenCalledOnce();
});
