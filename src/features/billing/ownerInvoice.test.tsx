import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { BillingApi, InvoiceDetail, Payment, QrApi } from './billingApi';
import { OwnerInvoice } from './OwnerInvoicesPage';

vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ handleApiError: () => false }) }));

const party = { id: 7, fullName: 'Chủ ngựa', email: 'owner@example.test' };
const vnpay = (extra: Partial<Payment> = {}): Payment => ({
  id: 1, provider: 'VNPAY', txnRef: 'HD1T1', amount: 750000, status: 'PENDING', bankCode: null, cardType: null,
  providerTransactionNo: null, responseCode: null, confirmedVia: null, createdAt: new Date().toISOString(), confirmedAt: null,
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), ...extra,
});
const detail = (payments: Payment[]): InvoiceDetail => ({
  invoice: {
    id: 1, invoiceCode: 'HD-2026-11-0001', billingMonth: '2026-11', periodStart: '2026-11-01', periodEnd: '2026-11-21',
    horse: { id: 3, horseCode: 'RH-003', name: 'Ngọc Trai' }, owner: party, totalAmount: 750000, status: 'ISSUED',
    dueDate: '2999-01-01', issuedAt: '2026-11-21T01:00:00Z', paidAt: null,
  },
  lines: [], payments, issuedBy: party, cancelledAt: null, cancellationReason: null, paymentConfigured: true,
});

function setup(payments: Payment[]) {
  const confirmQrTransfer = vi.fn(() => new Promise<never>(() => undefined));
  const pay = vi.fn(() => new Promise<never>(() => undefined));
  const api = { myInvoice: vi.fn().mockResolvedValue(detail(payments)), pay, ownerCheck: vi.fn() } as unknown as BillingApi;
  const qrApi = {
    qrTransfer: vi.fn().mockResolvedValue({ bankBin: '970436', bankName: 'Vietcombank', accountNo: '0123456789', accountName: 'CLB', amount: 750000, content: 'HD2026110001' }),
    confirmQrTransfer,
  } as unknown as QrApi;
  render(<MemoryRouter><OwnerInvoice api={api} qrApi={qrApi} id={1} /></MemoryRouter>);
  return { confirmQrTransfer, pay };
}

const payButtons = async () => {
  await screen.findByText('Ngân hàng');
  const [qr, card] = screen.getAllByRole('button', { name: /^Thanh toán / });
  return { qr, card };
};

describe('DEC-016 owner invoice payment guards', () => {
  it('blocks the VietQR Pay button while a VNPay link of the invoice can still be paid', async () => {
    const { confirmQrTransfer } = setup([vnpay()]);
    const { qr, card } = await payButtons();
    expect(qr).toBeDisabled();
    expect(card).toBeDisabled();
    expect(screen.getAllByText('Đang có một giao dịch VNPay chưa hoàn tất')).toHaveLength(2);
    fireEvent.click(qr);
    expect(confirmQrTransfer).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Kiểm tra lại thanh toán' })).toBeEnabled();
  });

  it('allows VietQR again once the VNPay link has expired', async () => {
    const { confirmQrTransfer } = setup([vnpay({ expiresAt: new Date(Date.now() - 60_000).toISOString() })]);
    const { qr } = await payButtons();
    expect(qr).toBeEnabled();
    fireEvent.click(qr);
    expect(confirmQrTransfer).toHaveBeenCalledTimes(1);
  });

  it('runs one payment action at a time: VNPay is locked while the VietQR payment is being recorded', async () => {
    const { confirmQrTransfer, pay } = setup([]);
    const { qr, card } = await payButtons();
    fireEvent.click(qr);
    await waitFor(() => expect(card).toBeDisabled());
    fireEvent.click(card);
    fireEvent.click(qr);
    expect(confirmQrTransfer).toHaveBeenCalledTimes(1);
    expect(pay).not.toHaveBeenCalled();
  });
});
