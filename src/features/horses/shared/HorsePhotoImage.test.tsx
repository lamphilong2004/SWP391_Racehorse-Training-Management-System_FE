import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HorsePhotoImage } from './HorsePhotoImage';
const state = vi.hoisted(() => ({ token: 'actor-a', request: vi.fn() }));
vi.mock('../../../shared/auth/authApi', () => ({ requestHorsePhoto: state.request }));
vi.mock('../../../shared/auth/authSession', () => ({ authSession: { read: () => ({ accessToken: state.token }) } }));
let callback: IntersectionObserverCallback;
const visible = async (value: boolean) => { await act(async () => { callback([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver); }); };
beforeEach(() => {
  state.token = 'actor-a'; state.request.mockReset();
  vi.stubGlobal('IntersectionObserver', class { constructor(cb: IntersectionObserverCallback) { callback = cb; } observe() {} disconnect() {} });
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:photo-fixture'); static revokeObjectURL = vi.fn(); });
});
afterEach(() => vi.unstubAllGlobals());

describe('viewport-aware horse photos', () => {
  it('cancels pending thumbnails on scroll-away and ignores late results', async () => {
    let resolve!: (blob: Blob) => void;
    state.request.mockReturnValueOnce(new Promise<Blob>((done) => { resolve = done; })).mockResolvedValueOnce(new Blob(['new']));
    const view = render(<HorsePhotoImage thumbnail path="/api/horses/7/photos/primary" name="Horse" />);
    expect(state.request).not.toHaveBeenCalled();
    await visible(true); expect(state.request).toHaveBeenCalledTimes(1);
    const signal = state.request.mock.calls[0][2] as AbortSignal;
    await visible(false); expect(signal.aborted).toBe(true);
    await act(async () => { resolve(new Blob(['late'])); });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await visible(true);
    await waitFor(() => expect(view.container.querySelector('[data-photo-state="photo"]')).not.toBeNull());
    expect(state.request).toHaveBeenCalledTimes(2);
  });

  it('does not redownload or revoke a settled image merely because it scrolls away', async () => {
    state.request.mockResolvedValue(new Blob(['photo']));
    const view = render(<HorsePhotoImage thumbnail path="/api/horses/7/photos/primary" name="Horse" />);
    await visible(true);
    await waitFor(() => expect(view.container.querySelector('[data-photo-state="photo"]')).not.toBeNull());
    await visible(false); await visible(true);
    expect(state.request).toHaveBeenCalledTimes(1); expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-fixture');
  });

  it('revokes the old URL and authorizes again when the session changes', async () => {
    state.request.mockResolvedValue(new Blob(['photo']));
    const view = render(<HorsePhotoImage path="/api/horses/7/photos/primary" name="Horse" />);
    await screen.findByAltText('Ảnh Horse');
    state.token = 'actor-b';view.rerender(<HorsePhotoImage path="/api/horses/7/photos/primary" name="Horse" />);
    await waitFor(() => expect(state.request).toHaveBeenCalledTimes(2));
    expect(state.request.mock.calls[1][1]).toBe('actor-b'); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-fixture');
  });
});
