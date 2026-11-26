import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { IncidentReportModal } from './IncidentReportModal';
import { IncidentPhotoGallery } from './IncidentPhotos';
import type { IncidentPhotoApi } from './incidentPhotoApi';

const png = (name = 'scene.png', size = 1000) => new File([new Uint8Array(size)], name, { type: 'image/png' });
const fakeApi = (overrides: Partial<IncidentPhotoApi> = {}): IncidentPhotoApi => ({
  list: vi.fn().mockResolvedValue([]),
  upload: vi.fn().mockImplementation(async () => ({ id: 1, uploadedAt: '2026-11-25T03:00:00Z' })),
  image: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
  ...overrides,
});
const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('Chọn ảnh hiện trường'), { target: { files } });

async function fillAndSend() {
  await userEvent.click(screen.getByRole('button', { name: 'Chấn thương (va chạm, vết thương)' }));
  await userEvent.click(screen.getByRole('button', { name: 'Trung bình' }));
  fireEvent.change(screen.getByLabelText('Mô tả *'), { target: { value: 'Vết xước chân trước trái' } });
  fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);
}

describe('Flow 3 step 3.1: incident scene photos', () => {
  const source = { kind: 'groom' as const, horseId: 31, horseLabel: 'Silver Comet', contextLabel: 'Quan sát tại chuồng' };

  it('uploads the chosen photos to the incident the host created, then closes', async () => {
    const api = fakeApi(), onClose = vi.fn(), onSubmit = vi.fn().mockResolvedValue({ id: 77 });
    render(<IncidentReportModal open source={source} onClose={onClose} onSubmit={onSubmit} photoApi={api} />);
    pick([png('a.png'), png('b.png')]);
    expect(screen.getByRole('button', { name: 'Bỏ ảnh 1 (a.png)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bỏ ảnh 2 (b.png)' })).toBeInTheDocument();
    await fillAndSend();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(api.upload).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.upload).mock.calls.map(([id, file]) => [id, file.name])).toEqual([[77, 'a.png'], [77, 'b.png']]);
  });

  it('never reports "not sent" when only a photo failed: the incident exists, so it says how to add the photo later', async () => {
    const api = fakeApi({ upload: vi.fn().mockResolvedValueOnce({ id: 1, uploadedAt: '2026-11-25T03:00:00Z' }).mockRejectedValueOnce(new Error('boom')) });
    const onClose = vi.fn(), onSubmit = vi.fn().mockResolvedValue({ id: 77 });
    render(<IncidentReportModal open source={source} onClose={onClose} onSubmit={onSubmit} photoApi={api} />);
    pick([png('a.png'), png('b.png')]);
    await fillAndSend();
    expect(await screen.findByText('Sự cố đã được gửi, nhưng 1/2 ảnh chưa tải lên được.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gửi sự cố' })).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledOnce();
    const closers = screen.getAllByRole('button', { name: 'Đóng' });
    await userEvent.click(closers[closers.length - 1]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('refuses non-image files, files over 5 MB and more than 5 photos before anything is sent', () => {
    render(<IncidentReportModal open source={source} onClose={vi.fn()} onSubmit={vi.fn()} photoApi={fakeApi()} />);
    pick([new File(['x'], 'note.pdf', { type: 'application/pdf' })]);
    expect(screen.getByRole('alert')).toHaveTextContent('"note.pdf" không phải ảnh JPEG, PNG hoặc WebP.');
    pick([png('big.png', 5 * 1024 * 1024 + 1)]);
    expect(screen.getByRole('alert')).toHaveTextContent('"big.png" lớn hơn 5 MB.');
    pick([1, 2, 3, 4, 5, 6].map((n) => png(`${n}.png`)));
    expect(screen.getByRole('alert')).toHaveTextContent('Mỗi sự cố có tối đa 5 ảnh.');
    expect(screen.getAllByRole('button', { name: /^Bỏ ảnh/ })).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Thêm ảnh' })).not.toBeInTheDocument();
  });

  it('shows the photos on the incident and lets only the reporter add more', async () => {
    const photos = [{ id: 5, uploadedAt: '2026-11-25T03:00:00Z' }];
    const api = fakeApi({ list: vi.fn().mockResolvedValueOnce(photos).mockResolvedValue([...photos, { id: 6, uploadedAt: '2026-11-25T03:05:00Z' }]) });
    const { unmount } = render(<IncidentPhotoGallery api={api} incidentId={9} canAdd />);
    await waitFor(() => expect(api.image).toHaveBeenCalledWith(9, 5, expect.any(AbortSignal)));
    pick([png('c.png')]);
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith(9, expect.objectContaining({ name: 'c.png' })));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Còn thêm được 3 ảnh · JPEG, PNG, WebP ≤ 5 MB')).toBeInTheDocument();
    unmount();

    render(<IncidentPhotoGallery api={fakeApi({ list: vi.fn().mockResolvedValue(photos) })} incidentId={9} canAdd={false} />);
    await waitFor(() => expect(document.querySelector('[data-photo-id="5"]')).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Thêm ảnh' })).not.toBeInTheDocument();
  });
});

describe('incident photo gallery: a failed refresh is never silent (review #80)', () => {
  const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('Chọn ảnh hiện trường'), { target: { files } });
  const png = (name: string) => new File([new Uint8Array(10)], name, { type: 'image/png' });
  const api = (first: { id: number; uploadedAt: string }[]): IncidentPhotoApi => ({
    list: vi.fn().mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([...first, { id: 41, uploadedAt: '2026-11-26T03:00:00Z' }]),
    upload: vi.fn().mockResolvedValue({ id: 41, uploadedAt: '2026-11-26T03:00:00Z' }),
    image: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
  });

  it.each([
    ['an empty gallery', []],
    ['a gallery that already has photos', [{ id: 40, uploadedAt: '2026-11-26T02:00:00Z' }]],
  ])('keeps the confirmed upload, shows the refresh failure and retries the list without uploading again (%s)', async (_, first) => {
    const gallery = api(first);
    render(<IncidentPhotoGallery api={gallery} incidentId={9} canAdd />);
    await screen.findByText(/Còn thêm được/);
    pick([png('d.png')]);
    expect(await screen.findByText('Không tải lại được danh sách ảnh.')).toBeInTheDocument();
    expect(document.querySelector('[data-photo-id="41"]')).not.toBeNull();
    expect(screen.queryByText('Chưa có ảnh nào.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm ảnh' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.queryByText('Không tải lại được danh sách ảnh.')).not.toBeInTheDocument());
    expect(screen.getByText(`Còn thêm được ${5 - first.length - 1} ảnh · JPEG, PNG, WebP ≤ 5 MB`)).toBeInTheDocument();
    expect(gallery.upload).toHaveBeenCalledOnce();
    expect(gallery.list).toHaveBeenCalledTimes(3);
  });
});
