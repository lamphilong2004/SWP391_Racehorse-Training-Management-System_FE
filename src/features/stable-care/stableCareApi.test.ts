import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStableCareApi, STABLE_CARE_READ_TIMEOUT_MS } from './stableCareApi';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Flow4 slow read boundary', () => {
  it('aborts a stalled read, reports a retryable error and does not invent empty data', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetch);
    const onError = vi.fn(() => false), api = createStableCareApi('actor-fixture', onError);
    const pending = api.inventory();
    const rejected = expect(pending).rejects.toThrow('Máy chủ phản hồi chậm');
    await vi.advanceTimersByTimeAsync(STABLE_CARE_READ_TIMEOUT_MS); await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer actor-fixture');
    expect(onError).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [{ id: 1 }] }), { status: 200 }));
    expect(await api.inventory()).toEqual([{ id: 1 }]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('also bounds a stalled JSON body after the response headers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => new Promise(() => {}) }));
    const pending = createStableCareApi('actor-fixture', () => false).tasks('2026-11-10');
    const rejected = expect(pending).rejects.toThrow('Dữ liệu chưa tải được');
    await vi.advanceTimersByTimeAsync(STABLE_CARE_READ_TIMEOUT_MS); await rejected;
  });

  it('preserves authorization errors instead of turning them into slow-read errors', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Denied', details: [] } }), { status: 403 })));
    await expect(createStableCareApi('actor-fixture', () => false).inventory()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never times out, retries or reports success for an unfinished write', async () => {
    vi.useFakeTimers();let resolve!: (value: Response) => void;
    const fetch = vi.fn().mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal('fetch', fetch);
    let settled = false;
    const save = createStableCareApi('actor-fixture', () => false).complete(7).then((data) => { settled = true; return data; });
    await vi.advanceTimersByTimeAsync(STABLE_CARE_READ_TIMEOUT_MS * 2);
    expect(fetch).toHaveBeenCalledTimes(1);expect(settled).toBe(false);
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    resolve(new Response(JSON.stringify({ success: true, data: { id: 7 } }), { status: 200 }));
    expect(await save).toEqual({ id: 7 });expect(vi.getTimerCount()).toBe(0);
  });
});
