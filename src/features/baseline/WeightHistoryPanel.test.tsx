import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../main-flows/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../main-flows/api')>();
  return { ...actual, useFlowRequest: () => request };
});

import { WeightHistoryPanel } from './WeightHistoryPanel';
import { ApiError } from '../../shared/auth/authApi';

const existing = { id: 1, horseId: 7, weightKg: 419, recordedAt: '2026-11-08T03:00:00.000Z' };
const created = { id: 2, horseId: 7, weightKg: 420.5, recordedAt: '2026-11-09T03:00:00.000Z' };
const weightPage = (items: typeof existing[]) => ({ items, page: 0, size: 20, totalElements: items.length });

describe('periodic weight recording', () => {
  beforeEach(() => { request.mockReset(); });

  it.each([403, 404])('shows a terminal HTTP %s history error without retry or a recording form', async (status) => {
    request.mockRejectedValue(new ApiError(status, status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', 'History unavailable'));
    render(<WeightHistoryPanel horseId={7} canRecord />);
    expect(await screen.findByText('Không tải được lịch sử cân nặng')).toBeInTheDocument();
    expect(screen.getByText('History unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu cân nặng' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cân nặng (kg)')).not.toBeInTheDocument();
  });

  it.each([
    ['HTTP 500', new ApiError(500, 'INTERNAL_ERROR', 'History unavailable')],
    ['network failure', new ApiError(0, 'NETWORK_ERROR', 'History unavailable')],
  ])('allows retry and retains the recording form after %s', async (_label, error) => {
    request.mockRejectedValueOnce(error).mockResolvedValueOnce(weightPage([existing]));
    render(<WeightHistoryPanel horseId={7} canRecord />);
    expect(await screen.findByText('Không tải được lịch sử cân nặng')).toBeInTheDocument();
    expect(screen.getByLabelText('Cân nặng (kg)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByText('419 kg');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('paginates using server totals, hides stale results on failure, and retries the requested page', async () => {
    const records = Array.from({ length: 43 }, (_, index) => ({
      ...existing, id: index + 1, weightKg: 500 - index,
      recordedAt: new Date(Date.parse('2026-11-09T03:00:00Z') - index * 86400000).toISOString(),
    }));
    let failed = false;
    request.mockImplementation(async (path: string) => {
      const page = Number(new URL(path, 'http://fixture.test').searchParams.get('page'));
      if (page === 1 && !failed) { failed = true; throw new Error('Page unavailable'); }
      return { items: records.slice(page * 20, page * 20 + 20), page, size: 20, totalElements: records.length };
    });
    render(<WeightHistoryPanel horseId={7} canRecord={false} />);
    await screen.findByText('500 kg');
    expect(screen.getByText(/1–20 \/ 43 bản ghi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled();
    expect(screen.getByText('Lịch sử cân nặng — trang hiện tại')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByText('Page unavailable');
    expect(screen.queryByText('500 kg')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByText('480 kg');
    expect(screen.getByText(/21–40 \/ 43 bản ghi/)).toBeInTheDocument();
    expect(request.mock.calls.filter(([path]) => path.includes('page=1&size=20'))).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByText('460 kg');
    expect(screen.getByText('458 kg')).toBeInTheDocument();
    expect(screen.getByText(/41–43 \/ 43 bản ghi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sau' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Trước' }));
    await screen.findByText('480 kg');
  });

  it('resets to the first page for a different horse and ignores a pending old response', async () => {
    let resolveOld!: (value: ReturnType<typeof weightPage>) => void;
    const pending = new Promise<ReturnType<typeof weightPage>>((resolve) => { resolveOld = resolve; });
    request.mockImplementation((path: string) => {
      if (path.includes('/7/') && path.includes('page=1')) return pending;
      if (path.includes('/7/')) return Promise.resolve({ items: [existing], page: 0, size: 20, totalElements: 21 });
      return Promise.resolve(weightPage([{ ...existing, id: 8, horseId: 8, weightKg: 555 }]));
    });
    const { rerender } = render(<WeightHistoryPanel horseId={7} canRecord={false} />);
    await screen.findByText('419 kg');
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('/7/weights?page=1'))).toBe(true));
    rerender(<WeightHistoryPanel horseId={8} canRecord={false} />);
    await screen.findByText('555 kg');
    await act(async () => { resolveOld(weightPage([{ ...existing, weightKg: 333 }])); await pending; });
    expect(screen.queryByText('333 kg')).not.toBeInTheDocument();
    expect(screen.getByText('555 kg')).toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path.includes('/8/weights?page=1'))).toBe(false);
    expect(screen.getByText(/1–1 \/ 1 bản ghi/)).toBeInTheDocument();
  });

  it('prevents pagination during a pending save and reloads the first page after confirmation', async () => {
    let resolvePost!: (value: typeof created) => void;
    const post = new Promise<typeof created>((resolve) => { resolvePost = resolve; });
    let saved = false;
    const onSaved = vi.fn();
    const records = Array.from({ length: 21 }, (_, index) => ({
      ...existing, id: index + 10, weightKg: 419 - index,
      recordedAt: new Date(Date.parse(existing.recordedAt) - index * 86400000).toISOString(),
    }));
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return post;
      const page = Number(new URL(path, 'http://fixture.test').searchParams.get('page'));
      const current = saved ? [created, ...records] : records;
      return Promise.resolve({
        items: current.slice(page * 20, (page + 1) * 20), page, size: 20, totalElements: current.length,
      });
    });
    render(<WeightHistoryPanel horseId={7} canRecord onSaved={onSaved} />);
    await screen.findByText('419 kg');
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByText('399 kg');
    fireEvent.change(screen.getByLabelText('Ngày giờ ghi nhận'), { target: { value: '2026-11-09T10:00' } });
    fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '420.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cân nặng' }));
    expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Trước' }));
    expect(request.mock.calls.filter(([path]) => path.includes('page=0&size=20'))).toHaveLength(1);
    saved = true;
    await act(async () => { resolvePost(created); await post; });
    await screen.findByText('420.5 kg');
    expect(screen.getByText(/1–20 \/ 22 bản ghi/)).toBeInTheDocument();
    expect(request.mock.calls.filter(([path]) => path.includes('page=0&size=20'))).toHaveLength(2);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('posts the validated weight/time then reloads the history after server confirmation', async () => {
    request.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return created;
      return weightPage(request.mock.calls.some(([, options]) => options?.method === 'POST') ? [created, existing] : [existing]);
    });
    render(<WeightHistoryPanel horseId={7} canRecord />);
    await screen.findByText('419 kg');
    fireEvent.change(screen.getByLabelText('Ngày giờ ghi nhận'), { target: { value: '2026-11-09T10:00' } });
    fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '420.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cân nặng' }));

    await screen.findByText('Đã ghi nhận cân nặng');
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method !== 'POST')).toHaveLength(2));
    expect(request.mock.calls.find(([, options]) => options?.method === 'POST')).toEqual([
      '/api/horses/7/weights',
      { method: 'POST', body: JSON.stringify({ weightKg: 420.5, recordedAt: '2026-11-09T03:00:00.000Z' }) },
    ]);
    expect(screen.getByText('420.5 kg')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Lịch sử cân nặng' })).toBeInTheDocument();
  });

  it('does not report success when the API response does not confirm the requested horse record', async () => {
    request.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'POST'
      ? { id: 3, horseId: 8, weightKg: 420.5, recordedAt: '2026-11-09T03:00:00.000Z' }
      : weightPage([existing]));
    render(<WeightHistoryPanel horseId={7} canRecord />);
    await screen.findByText('419 kg');
    fireEvent.change(screen.getByLabelText('Ngày giờ ghi nhận'), { target: { value: '2026-11-09T10:00' } });
    fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '420.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cân nặng' }));

    expect(await screen.findByText(/Máy chủ chưa xác nhận đã lưu bản ghi cân nặng/)).toBeInTheDocument();
    expect(screen.queryByText('Đã ghi nhận cân nặng')).not.toBeInTheDocument();
  });

  it('surfaces a failed create request without showing success', async () => {
    request.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') throw new Error('API refused save');
      return weightPage([existing]);
    });
    render(<WeightHistoryPanel horseId={7} canRecord />);
    await screen.findByText('419 kg');
    fireEvent.change(screen.getByLabelText('Ngày giờ ghi nhận'), { target: { value: '2026-11-09T10:00' } });
    fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '420.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cân nặng' }));

    expect(await screen.findByText('API refused save')).toBeInTheDocument();
    expect(screen.queryByText('Đã ghi nhận cân nặng')).not.toBeInTheDocument();
  });

  it('hides the write form for read-only staff roles', async () => {
    request.mockResolvedValue(weightPage([existing]));
    render(<WeightHistoryPanel horseId={7} canRecord={false} />);
    await screen.findByText('419 kg');
    expect(screen.queryByRole('button', { name: 'Lưu cân nặng' })).not.toBeInTheDocument();
  });

  it('blocks future timestamps and malformed weights before making a write request', async () => {
    request.mockResolvedValue(weightPage([]));
    render(<WeightHistoryPanel horseId={7} canRecord />);
    await screen.findByText('Chưa có bản ghi cân nặng');
    fireEvent.change(screen.getByLabelText('Ngày giờ ghi nhận'), { target: { value: '2099-01-01T10:00' } });
    fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '420.555' } });
    expect(screen.getByText('Không chọn thời điểm trong tương lai.')).toBeInTheDocument();
    expect(screen.getByText(/không quá hai chữ số thập phân/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu cân nặng' })).toBeDisabled();
    expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('revalidates a previously-future timestamp against submission time', async () => {
    const originalNow = Date.now();
    vi.setSystemTime(new Date('2026-11-09T00:00:00.000Z'));
    request.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'POST'
      ? created
      : weightPage([existing]));
    try {
      render(<WeightHistoryPanel horseId={7} canRecord />);
      await screen.findByText('419 kg');
      fireEvent.change(screen.getByLabelText('Ngày giờ ghi nhận'), { target: { value: '2026-11-09T10:00' } });
      fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '420.5' } });
      expect(screen.getByText('Không chọn thời điểm trong tương lai.')).toBeInTheDocument();

      vi.setSystemTime(new Date('2026-11-09T04:00:00.000Z'));
      fireEvent.click(screen.getByRole('button', { name: 'Lưu cân nặng' }));

      await screen.findByText('Đã ghi nhận cân nặng');
      expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true);
      expect(screen.queryByText('Không chọn thời điểm trong tương lai.')).not.toBeInTheDocument();
      expect(request.mock.calls.find(([, options]) => options?.method === 'POST')?.[1]?.body)
        .toBe(JSON.stringify({ weightKg: 420.5, recordedAt: '2026-11-09T03:00:00.000Z' }));
    } finally {
      vi.setSystemTime(new Date(originalNow));
    }
  });

  it('hides stale chart data after a failed reload and restores current history on retry', async () => {
    let reads = 0;
    request.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return created;
      reads += 1;
      if (reads === 2) throw new Error('Refresh failed');
      return weightPage(reads === 1 ? [existing] : [created, existing]);
    });
    render(<WeightHistoryPanel horseId={7} canRecord />);
    await screen.findByText('419 kg');
    fireEvent.change(screen.getByLabelText('Ngày giờ ghi nhận'), { target: { value: '2026-11-09T10:00' } });
    fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '420.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cân nặng' }));

    await screen.findByRole('button', { name: 'Thử lại' });
    expect(screen.queryByText('419 kg')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Lịch sử cân nặng' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByText('420.5 kg');
    expect(screen.getByText('419 kg')).toBeInTheDocument();
  });
});
