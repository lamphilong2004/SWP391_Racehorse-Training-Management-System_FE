import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { BillingApi, InvoiceDetail, Payment, QrApi } from './billingApi';
import { OwnerInvoice } from './OwnerInvoicesPage';

vi.mock('../../shared/auth/AuthProvider', () => {
  // Stable like the real provider: the load hook re-runs when handleApiError changes.
  const auth = { handleApiError: () => false };
  return { useAuth: () => auth };
});

const party = { id: 7, fullName: 'Chủ ngựa', email: 'owner@example.test' };
const vnpay = (extra: Partial<Payment> = {}): Payment => ({
  id: 1, provider: 'VNPAY', txnRef: 'HD1T1', amount: 750000, status: 'PENDING', bankCode: null, cardType: null,
  providerTransactionNo: null, responseCode: null, confirmedVia: null, createdAt: new Date().toISOString(), confirmedAt: null,
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), ...extra,
});
const detail = (payments: Payment[], status: 'ISSUED' | 'PAID' = 'ISSUED'): InvoiceDetail => ({
  invoice: {
    id: 1, invoiceCode: 'HD-2026-11-0001', billingMonth: '2026-11', periodStart: '2026-11-01', periodEnd: '2026-11-21',
    horse: { id: 3, horseCode: 'RH-003', name: 'Ngọc Trai' }, owner: party, totalAmount: 750000, status,
    dueDate: '2999-01-01', issuedAt: '2026-11-21T01:00:00Z', paidAt: status === 'PAID' ? '2026-11-21T02:00:00Z' : null,
  },
  lines: [], payments, issuedBy: party, cancelledAt: null, cancellationReason: null, paymentConfigured: true,
});

function setup(payments: Payment[] = [], status: 'ISSUED' | 'PAID' = 'ISSUED') {
  let paid = status === 'PAID';
  let open = payments;
  const myInvoice = vi.fn(() => Promise.resolve(detail(open, paid ? 'PAID' : 'ISSUED')));
  const pay = vi.fn(() => new Promise<never>(() => undefined));
  const cancelPayment = vi.fn(() => {
    open = [vnpay({ status: 'FAILED', responseCode: '24', confirmedVia: 'OWNER' })];
    return Promise.resolve({ invoiceId: 1, invoiceCode: 'HD-2026-11-0001', invoiceStatus: 'ISSUED', paymentStatus: 'CANCELLED',
      responseCode: '24', message: 'Đã hủy giao dịch VNPay đang mở. Bạn có thể thanh toán lại bằng VNPay hoặc mã QR.' });
  });
  const confirmQrTransfer = vi.fn(() => {
    paid = true;
    return Promise.resolve({ invoiceId: 1, invoiceCode: 'HD-2026-11-0001', invoiceStatus: 'PAID', paymentStatus: 'SUCCESS', responseCode: null,
      message: 'Đã ghi nhận thanh toán chuyển khoản QR. Hóa đơn đã được thanh toán.' });
  });
  const api = { myInvoice, pay, ownerCheck: vi.fn(), cancelPayment } as unknown as BillingApi;
  const qrApi = {
    qrTransfer: vi.fn().mockResolvedValue({ bankBin: '970436', bankName: 'Vietcombank', accountNo: '0123456789', accountName: 'CLB', amount: 750000, content: 'HD2026110001' }),
    confirmQrTransfer,
  } as unknown as QrApi;
  render(<MemoryRouter><OwnerInvoice api={api} qrApi={qrApi} id={1} /></MemoryRouter>);
  return { myInvoice, pay, cancelPayment, confirmQrTransfer };
}

const payButton = () => screen.findByRole('button', { name: 'Thanh toán hóa đơn HD-2026-11-0001' });
const openPopup = async () => {
  fireEvent.click(await payButton());
  return screen.findByRole('dialog', { name: 'Thanh toán hóa đơn HD-2026-11-0001' });
};

describe('DEC-016 owner invoice detail: details only, payment in the popup', () => {
  it('shows the invoice with a single Pay button and no inline QR or VNPay form', async () => {
    setup();
    await payButton();
    expect(screen.queryByText('Ngân hàng')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Thanh toán/ })).toHaveLength(1);
  });

  it('shows no Pay button on a paid invoice', async () => {
    setup([], 'PAID');
    expect(await screen.findByRole('heading', { name: 'Hóa đơn HD-2026-11-0001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thanh toán hóa đơn HD-2026-11-0001' })).not.toBeInTheDocument();
  });

  it('opens the same popup as the list, VNPay first with the ATM card', async () => {
    const { pay } = setup();
    const dialog = await openPopup();
    expect(within(dialog).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['VNPay', 'MoMo', 'VietQR']);
    expect(await within(dialog).findByRole('radio', { name: /Thẻ ATM/ })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thanh toán qua VNPay' }));
    expect(pay).toHaveBeenCalledWith(1, 'VNBANK');
  });

  it('pays by VietQR in the popup: the popup closes and the invoice turns paid', async () => {
    const { confirmQrTransfer, myInvoice } = setup();
    const dialog = await openPopup();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'VietQR' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Thanh toán 750.000 ₫' }));
    expect(confirmQrTransfer).toHaveBeenCalledWith(1);
    expect(await screen.findByText('Đã thanh toán hóa đơn HD-2026-11-0001.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Thanh toán hóa đơn HD-2026-11-0001' })).not.toBeInTheDocument());
    expect(myInvoice.mock.calls.length).toBeGreaterThan(1);
  });

  it('cancels an open VNPay link inside the popup and the history shows it cancelled after closing', async () => {
    const { cancelPayment } = setup([vnpay()]);
    const dialog = await openPopup();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Hủy giao dịch VNPay' }));
    expect(cancelPayment).toHaveBeenCalledWith(1);
    expect(await within(dialog).findByRole('button', { name: 'Thanh toán qua VNPay' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(await screen.findByText('Chủ ngựa đã hủy')).toBeInTheDocument();
  });
});
