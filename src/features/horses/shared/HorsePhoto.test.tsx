import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HorseAvatar } from '../../../design-system';
import { authSession } from '../../../shared/auth/authSession';
import { forgetHorsePhoto, loadHorsePhoto } from '../../../shared/horsePhotos';
import { HorsePhotoPicker } from './HorsePhoto';

describe('HorseAvatar', () => {
  it('labels the shared default photo as illustrative and never as the horse itself', () => {
    render(<HorseAvatar name="Frankel" decorative={false} labelDefault />);
    expect(screen.getByRole('img', { name: /Ảnh minh họa — ngựa này chưa có ảnh riêng \(Frankel\)/ })).toBeInTheDocument();
    expect(screen.getByText('Ảnh minh họa')).toBeInTheDocument();
  });

  it('shows the horse photo without the illustrative label', () => {
    render(<HorseAvatar name="Frankel" src="blob:frankel" decorative={false} labelDefault />);
    expect(screen.getByRole('img', { name: 'Ảnh ngựa Frankel' })).toBeInTheDocument();
    expect(screen.queryByText('Ảnh minh họa')).not.toBeInTheDocument();
  });
});

describe('HorsePhotoPicker', () => {
  it('rejects files the upload API would refuse and accepts a JPEG', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<HorsePhotoPicker file={null} onChange={onChange} />);
    const input = screen.getByLabelText('Chọn ảnh đại diện của ngựa');
    await userEvent.upload(input, new File(['x'], 'notes.gif', { type: 'image/gif' }), { applyAccept: false });
    expect(screen.getByRole('alert')).toHaveTextContent('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
    await userEvent.upload(input, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ảnh vượt quá 5 MB.');
    expect(onChange).not.toHaveBeenCalled();
    const photo = new File(['jpeg'], 'frankel.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, photo);
    expect(onChange).toHaveBeenCalledWith(photo);
    rerender(<HorsePhotoPicker file={photo} onChange={onChange} />);
    expect(screen.getByText(/frankel\.jpg/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ ảnh đã chọn' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('loadHorsePhoto', () => {
  const createObjectURL = vi.fn(() => 'blob:newest');
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    authSession.save('photo-fixture-jwt', 3600, false);
  });
  afterEach(() => { forgetHorsePhoto(2); forgetHorsePhoto(3); authSession.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('loads the newest photo file with the JWT and caches it per horse', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).endsWith('/api/horses/2/photos')
      ? new Response(JSON.stringify({ success: true, data: [{ id: 9, url: '/local-media/horse-photos/new.jpg', uploadedAt: '2026-10-26T00:00:00Z' }, { id: 1, url: '/local-media/horse-photos/old.jpg', uploadedAt: '2026-10-01T00:00:00Z' }] }), { status: 200 })
      : new Response('jpeg', { status: 200, headers: { 'Content-Type': 'image/jpeg' } }));
    await expect(loadHorsePhoto(2)).resolves.toBe('blob:newest');
    await expect(loadHorsePhoto(2)).resolves.toBe('blob:newest');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1];
    expect(String(url)).toMatch(/\/local-media\/horse-photos\/new\.jpg$/);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer photo-fixture-jwt');
  });

  it('resolves to null (default photo) when the horse has no photo or photos are not permitted', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Denied', details: [] } }), { status: 403 }));
    await expect(loadHorsePhoto(2)).resolves.toBeNull();
    await waitFor(() => expect(loadHorsePhoto(3)).resolves.toBeNull());
  });
});
