import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { BillingApi, OwnerEstimate } from './billingApi';
import { OwnerPrices } from './OwnerPricesPage';

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
const show = (data: OwnerEstimate) => render(<MemoryRouter><OwnerPrices api={{ myEstimate: vi.fn().mockResolvedValue(data) } as unknown as BillingApi} /></MemoryRouter>);
const text = (value: string | null) => (value ?? '').replace(/\s/g, ' ');

describe('Owner price page (/owner/prices)', () => {
  it('shows each price as a card with what it covers and how it is counted', async () => {
    show(estimate());
    const boarding = (await screen.findByRole('heading', { name: 'Lưu chuồng & chăm sóc' })).closest('article')!;
    expect(text(boarding.textContent)).toContain('250.000 ₫ / ngày');
    expect(within(boarding).getByRole('list', { name: 'Lưu chuồng & chăm sóc bao gồm' })).toHaveTextContent('Thức ăn và dinh dưỡng');
    const training = screen.getByRole('heading', { name: 'Huấn luyện' }).closest('article')!;
    expect(text(training.textContent)).toContain('500.000 ₫ / buổi hoàn thành');
    expect(training).toHaveTextContent('Chỉ tính buổi đã hoàn thành');
    expect(screen.getByText(/Không nằm trong bảng giá này/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tính phí và thanh toán thế nào?' })).toBeInTheDocument();
  });

  it('estimates a month from a preset or typed numbers and rejects impossible numbers', async () => {
    show(estimate());
    const estimator = within(await screen.findByRole('region', { name: 'Ước tính chi phí 1 tháng' }));
    expect(text(estimator.getByText(/≈/).textContent)).toContain('13.500.000 ₫'); // 30 x 250k + 12 x 500k
    fireEvent.click(estimator.getByRole('button', { name: 'Chỉ lưu chuồng' }));
    expect(estimator.getByRole('button', { name: 'Chỉ lưu chuồng' })).toHaveAttribute('aria-pressed', 'true');
    expect(text(estimator.getByText(/≈/).textContent)).toContain('7.500.000 ₫');
    fireEvent.change(estimator.getByLabelText('Số ngày ở chuồng'), { target: { value: '10' } });
    fireEvent.change(estimator.getByLabelText('Số buổi tập hoàn thành'), { target: { value: '4' } });
    expect(text(estimator.getByText(/≈/).textContent)).toContain('4.500.000 ₫');
    fireEvent.change(estimator.getByLabelText('Số ngày ở chuồng'), { target: { value: '40' } });
    expect(estimator.getByRole('alert')).toHaveTextContent('Số ngày từ 0 đến 31.');
  });

  it('lists this month\'s running cost per own horse with the invoice formula', async () => {
    show(estimate());
    const row = await screen.findByRole('row', { name: /Bạch Long/ });
    expect(text(row.textContent)).toContain('5 ngày × 250.000 ₫ = 1.250.000 ₫');
    expect(text(row.textContent)).toContain('2 buổi × 500.000 ₫ = 1.000.000 ₫');
    expect(text(row.textContent)).toContain('24/11/2026 – 28/11/2026');
    expect(text(screen.getByText('Tổng tạm tính').parentElement!.textContent)).toContain('2.250.000 ₫');
    expect(screen.getByRole('link', { name: 'Hóa đơn & thanh toán' })).toHaveAttribute('href', '/owner/invoices');
  });

  it('says when no price is published and when part of the month is already invoiced', async () => {
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
