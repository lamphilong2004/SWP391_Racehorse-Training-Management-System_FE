import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BillingApi, OwnerEstimate } from './billingApi';
import { OwnerCosts } from './OwnerCosts';

vi.mock('../../shared/auth/AuthProvider', () => {
  const auth = { handleApiError: () => false };
  return { useAuth: () => auth };
});

const prices: OwnerEstimate['prices'] = [
  { serviceCode: 'BOARDING_CARE_DAILY', label: 'Lưu chuồng & chăm sóc', unit: 'ngày', unitPrice: 250000, updatedAt: null, updatedBy: null },
  { serviceCode: 'TRAINING_SESSION', label: 'Huấn luyện', unit: 'buổi hoàn thành', unitPrice: 500000, updatedAt: null, updatedBy: null },
];
const estimate = (extra: Partial<OwnerEstimate> = {}): OwnerEstimate => ({
  billingMonth: '2026-11', asOf: '2026-11-28', prices, total: 2_250_000,
  horses: [{ horseId: 22, horseCode: 'RH-022', horseName: 'Bạch Long', from: '2026-11-24', to: '2026-11-28', invoicedUntil: null,
    boardingDays: 5, completedSessions: 2, boardingAmount: 1_250_000, trainingAmount: 1_000_000, total: 2_250_000 }],
  ...extra,
});
const show = (data: OwnerEstimate) => render(<OwnerCosts api={{ myEstimate: vi.fn().mockResolvedValue(data) } as unknown as BillingApi} />);
const text = (value: string) => value.replace(/\s/g, ' ');

describe('Owner price transparency: price list, estimator and running cost', () => {
  it('shows the club prices and the running cost of each horse with the same formula as the invoice', async () => {
    show(estimate());
    const list = await screen.findByText('Lưu chuồng & chăm sóc', { selector: 'dt' });
    expect(text(list.closest('div')!.textContent!)).toContain('250.000 ₫ / ngày');
    const row = screen.getByRole('row', { name: /Bạch Long/ });
    expect(text(row.textContent!)).toContain('5 ngày × 250.000 ₫ = 1.250.000 ₫');
    expect(text(row.textContent!)).toContain('2 buổi × 500.000 ₫ = 1.000.000 ₫');
    expect(text(row.textContent!)).toContain('24/11/2026 – 28/11/2026');
    expect(text(screen.getByText('Tổng tạm tính').textContent!)).toContain('2.250.000 ₫');
  });

  it('lets the owner estimate a month before sending a horse and rejects impossible numbers', async () => {
    show(estimate());
    const estimator = within(await screen.findByRole('region', { name: 'Ước tính chi phí 1 tháng' }));
    expect(text(estimator.getByText(/≈/).textContent!)).toContain('13.500.000 ₫'); // 30 x 250k + 12 x 500k
    fireEvent.change(estimator.getByLabelText('Số ngày ở chuồng'), { target: { value: '10' } });
    fireEvent.change(estimator.getByLabelText('Số buổi tập hoàn thành'), { target: { value: '0' } });
    expect(text(estimator.getByText(/≈/).textContent!)).toContain('2.500.000 ₫');
    fireEvent.change(estimator.getByLabelText('Số ngày ở chuồng'), { target: { value: '40' } });
    expect(estimator.getByRole('alert')).toHaveTextContent('Số ngày từ 0 đến 31.');
  });

  it('says when part of the month is already invoiced and when no price is published yet', async () => {
    show(estimate({ prices: prices.map((price) => ({ ...price, unitPrice: null })), total: null, horses: [{ ...estimate().horses[0],
      from: '2026-11-29', invoicedUntil: '2026-11-28', boardingDays: 0, completedSessions: 0, boardingAmount: null, trainingAmount: null, total: null }] }));
    expect(await screen.findByText('Club Manager chưa công bố đủ bảng giá.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ước tính chi phí 1 tháng' })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Bạch Long/ })).toHaveTextContent('Đã có hóa đơn đến 28/11/2026');
  });

  it('explains an empty month instead of showing a zero table', async () => {
    show(estimate({ horses: [], total: 0 }));
    expect(await screen.findByText('Chưa có ngựa nào ở chuồng tháng này')).toBeInTheDocument();
    expect(screen.queryByText('Tổng tạm tính')).not.toBeInTheDocument();
  });
});
