import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../main-flows/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../main-flows/api')>();
  return { ...actual, useFlowRequest: () => request };
});

import { WeightHistoryPanel } from './WeightHistoryPanel';

const existing = { id: 1, horseId: 7, weightKg: 419, recordedAt: '2026-11-08T03:00:00.000Z' };
const created = { id: 2, horseId: 7, weightKg: 420.5, recordedAt: '2026-11-09T03:00:00.000Z' };

describe('periodic weight recording', () => {
  beforeEach(() => request.mockReset());

  it('posts the validated weight/time then reloads the history after server confirmation', async () => {
    request.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return created;
      return { items: request.mock.calls.some(([, options]) => options?.method === 'POST') ? [created, existing] : [existing] };
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
      : { items: [existing] });
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
      return { items: [existing] };
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
    request.mockResolvedValue({ items: [existing] });
    render(<WeightHistoryPanel horseId={7} canRecord={false} />);
    await screen.findByText('419 kg');
    expect(screen.queryByRole('button', { name: 'Lưu cân nặng' })).not.toBeInTheDocument();
  });

  it('blocks future timestamps and malformed weights before making a write request', async () => {
    request.mockResolvedValue({ items: [] });
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
      : { items: [existing] });
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
      return { items: reads === 1 ? [existing] : [created, existing] };
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
