import { describe, expect, it, vi } from 'vitest';
import { scheduleHorsePhoto } from './photoRequests';
import { requestHorsePhoto } from './authApi';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('authenticated photo request scheduling', () => {
  it('applies the bound to actual photo requests without caching or mixing tokens', async () => {
    const release: ((blob: Blob) => void)[] = [];
    const fetch = vi.fn().mockImplementation(async () => ({ status: 200, ok: true,
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
      blob: () => new Promise<Blob>((resolve) => release.push(resolve)),
    }));
    vi.stubGlobal('fetch', fetch);
    try {
      const requests = ['actor-a', 'actor-a', 'actor-b'].map((token) => requestHorsePhoto('/api/horses/7/photos/primary', token, new AbortController().signal));
      await flush(); expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer actor-a');
      release[0](new Blob(['first'])); await flush();
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch.mock.calls[2][1].headers.get('Authorization')).toBe('Bearer actor-b');
      expect(fetch.mock.calls[2][1].cache).toBe('no-store');
      release[1](new Blob(['second'])); release[2](new Blob(['third']));
      expect((await Promise.all(requests)).every((blob) => blob instanceof Blob)).toBe(true);
      await flush();
    } finally {vi.unstubAllGlobals();}
  });
  it('limits photo reads to two until their bodies finish and runs all requests', async () => {
    let active = 0, peak = 0;
    const release: (() => void)[] = [];
    const tasks = Array.from({ length: 8 }, (_, i) => scheduleHorsePhoto(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise<void>((resolve) => release.push(resolve));
      active--; return i;
    }, new AbortController().signal));
    await flush(); expect(release).toHaveLength(2);
    for (let i = 0; i < 8; i++) { release[i](); await flush(); }
    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBe(2);
  });

  it('does not send a queued request after navigation/logout aborts it', async () => {
    const release: (() => void)[] = [];
    const hold = () => scheduleHorsePhoto(() => new Promise<void>((resolve) => release.push(resolve)), new AbortController().signal);
    const first = hold(), second = hold();
    const controller = new AbortController(), fetch = vi.fn().mockResolvedValue('private photo');
    const queued = scheduleHorsePhoto(fetch, controller.signal);
    const rejected = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await rejected;
    await flush(); release.forEach((resolve) => resolve()); await Promise.all([first, second]); await flush();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('releases capacity after a failed or aborted active fetch', async () => {
    const fail = scheduleHorsePhoto(async () => { throw new DOMException('aborted', 'AbortError'); }, new AbortController().signal);
    const rejected = expect(fail).rejects.toMatchObject({ name: 'AbortError' });
    const pass = scheduleHorsePhoto(async () => 'server-authorized result', new AbortController().signal);
    await rejected; expect(await pass).toBe('server-authorized result'); await flush();
    expect(await scheduleHorsePhoto(async () => 'next', new AbortController().signal)).toBe('next');
  });

  it('rejects an already aborted request without calling the API', async () => {
    const controller = new AbortController(); controller.abort(); const fetch = vi.fn();
    await expect(scheduleHorsePhoto(fetch, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
