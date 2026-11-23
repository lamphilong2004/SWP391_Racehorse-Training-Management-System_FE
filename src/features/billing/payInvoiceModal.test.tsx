import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { BillingApi, InvoiceDetail, InvoiceSummary, Payment, QrApi } from './billingApi';
import { OwnerList } from './OwnerInvoicesPage';

vi.mock('../../shared/auth/AuthProvider', () => {
  // Stable like the real provider: the load hook re-runs when handleApiError changes.
  const auth = { handleApiError: () => false };
  return { useAuth: () => auth };
});

const party = { id: 7, fullName: 'Chủ ngựa', email: 'owner@example.test' };
const summary = (id: number, status: InvoiceSummary['status']): InvoiceSummary => ({
  id, invoiceCode: `HD-202611-00${id}`, billingMonth: '2026-11', periodStart: '2026-11-01', periodEnd: '2026-11-21',
  horse: { id, horseCode: `RH-0${id}`, name: `Ngựa ${id}` }, owner: party, totalAmount: 500000, status,
  dueDate: '2999-01-01', issuedAt: '2026-11-21T01:00:00Z', paidAt: status === 'PAID' ? '2026-11-21T02:00:00Z' : null,
});
const vnpay = (extra: Partial<Payment> = {}): Payment => ({
  id: 1, provider: 'VNPAY', txnRef: 'HD1T1', amount: 500000, status: 'PENDING', bankCode: null, cardType: null,
  providerTransactionNo: null, responseCode: null, confirmedVia: null, createdAt: new Date().toISOString(), confirmedAt: null,
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), ...extra,
});
const detail = (invoice: InvoiceSummary, payments: Payment[]): InvoiceDetail =>
  ({ invoice, lines: [], payments, issuedBy: party, cancelledAt: null, cancellationReason: null, paymentConfigured: true });

function setup(payments: Payment[] = [], options: { detail?: 'pending' | 'error'; cancelFindsPaid?: boolean } = {}) {
  let paid = false;
  let open = payments;
  const myInvoices = vi.fn(() => Promise.resolve([summary(11, paid ? 'PAID' : 'ISSUED'), summary(12, 'PAID')]));
  const myInvoice = vi.fn(() => options.detail === 'pending' ? new Promise<never>(() => undefined)
    : options.detail === 'error' ? Promise.reject(new Error('Máy chủ không phản hồi.'))
      : Promise.resolve(detail(summary(11, paid ? 'PAID' : 'ISSUED'), open)));
  const pay = vi.fn(() => new Promise<never>(() => undefined));
  const cancelPayment = vi.fn(() => {
    open = [];
    if (options.cancelFindsPaid) {
      paid = true;
      return Promise.resolve({ invoiceId: 11, invoiceCode: 'HD-202611-0011', invoiceStatus: 'PAID', paymentStatus: 'SUCCESS', responseCode: null,
        message: 'VNPay đã xác nhận thanh toán. Hóa đơn đã được ghi nhận là đã thanh toán.' });
    }
    return Promise.resolve({ invoiceId: 11, invoiceCode: 'HD-202611-0011', invoiceStatus: 'ISSUED', paymentStatus: 'CANCELLED', responseCode: '24',
      message: 'Đã hủy giao dịch VNPay đang mở. Bạn có thể thanh toán lại bằng VNPay hoặc mã QR.' });
  });
  const confirmQrTransfer = vi.fn(() => {
    paid = true;
    return Promise.resolve({ invoiceId: 11, invoiceCode: 'HD-202611-0011', invoiceStatus: 'PAID', paymentStatus: 'SUCCESS', responseCode: null,
      message: 'Đã ghi nhận thanh toán chuyển khoản QR. Hóa đơn đã được thanh toán.' });
  });
  const api = { myInvoices, myInvoice, pay, cancelPayment, ownerCheck: vi.fn() } as unknown as BillingApi;
  const qrApi = {
    qrTransfer: vi.fn().mockResolvedValue({ bankBin: '970422', bankName: 'MBBank', accountNo: '9999888877', accountName: 'CLB', amount: 500000, content: 'HD2026110011' }),
    confirmQrTransfer,
  } as unknown as QrApi;
  render(<MemoryRouter><OwnerList api={api} qrApi={qrApi} /></MemoryRouter>);
  return { myInvoices, pay, cancelPayment, confirmQrTransfer };
}

const openPopup = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán hóa đơn HD-202611-0011' }));
  return screen.findByRole('dialog', { name: 'Thanh toán hóa đơn HD-202611-0011' });
};

describe('DEC-016 owner invoice list: pay popup', () => {
  it('shows a Pay button at the end of an unpaid row and "Đã thanh toán" for a paid one', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Thanh toán hóa đơn HD-202611-0011' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thanh toán hóa đơn HD-202611-0012' })).not.toBeInTheDocument();
    expect(screen.getByText('Đã thanh toán')).toBeInTheDocument();
  });

  it('opens a popup with VNPay, MoMo and VietQR tabs, VNPay first with the ATM card as its only method', async () => {
    const { pay } = setup();
    const dialog = await openPopup();
    expect(within(dialog).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['VNPay', 'MoMo', 'VietQR']);
    await within(dialog).findByRole('button', { name: 'Thanh toán qua VNPay' });
    expect(within(dialog).getByText('Thẻ ATM / tài khoản ngân hàng')).toBeInTheDocument();
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Chọn trên trang VNPay')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thanh toán qua VNPay' }));
    expect(pay).toHaveBeenCalledWith(11, 'VNBANK');

    fireEvent.click(within(dialog).getByRole('tab', { name: 'MoMo' }));
    expect(await within(dialog).findByText(/Quét mọi QR/)).toBeInTheDocument();
  });

  it('pays by VietQR from the popup: the popup closes and the row turns paid', async () => {
    const { confirmQrTransfer, myInvoices } = setup();
    const dialog = await openPopup();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'VietQR' }));
    expect(await within(dialog).findByText('9999888877')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thanh toán 500.000 ₫' }));
    expect(confirmQrTransfer).toHaveBeenCalledWith(11);
    expect(await screen.findByText('Đã thanh toán hóa đơn HD-202611-0011.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(myInvoices).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText('Đã thanh toán')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Thanh toán hóa đơn HD-202611-0011' })).not.toBeInTheDocument();
  });

  it('offers no QR and no payment while the invoice is still loading', async () => {
    const { confirmQrTransfer } = setup([], { detail: 'pending' });
    const dialog = await openPopup();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'VietQR' }));
    expect(within(dialog).getByText('Đang tải hóa đơn…')).toBeInTheDocument();
    expect(within(dialog).queryByText('9999888877')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Thanh toán 500.000 ₫' })).not.toBeInTheDocument();
    expect(confirmQrTransfer).not.toHaveBeenCalled();
  });

  it('shows the load error with a retry on every tab and offers no payment when the invoice cannot be loaded', async () => {
    setup([], { detail: 'error' });
    const dialog = await openPopup();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'VietQR' }));
    expect(await within(dialog).findByText('Không tải được hóa đơn')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(within(dialog).queryByText('9999888877')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Thanh toán 500.000 ₫' })).not.toBeInTheDocument();
  });

  it('closes the popup and refreshes the list when cancelling finds the VNPay link already paid', async () => {
    const { cancelPayment, myInvoices } = setup([vnpay()], { cancelFindsPaid: true });
    const dialog = await openPopup();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Hủy giao dịch VNPay' }));
    expect(cancelPayment).toHaveBeenCalledWith(11);
    expect(await screen.findByText('Đã thanh toán hóa đơn HD-202611-0011.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(myInvoices).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Thanh toán hóa đơn HD-202611-0011' })).not.toBeInTheDocument();
  });

  it('blocks a second payment while a VNPay link is open and lets the owner cancel it', async () => {
    const { cancelPayment, confirmQrTransfer } = setup([vnpay()]);
    const dialog = await openPopup();
    expect(await within(dialog).findByRole('button', { name: 'Hủy giao dịch VNPay' })).toBeEnabled();
    expect(within(dialog).queryByRole('button', { name: 'Thanh toán qua VNPay' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'VietQR' }));
    const qrPay = await within(dialog).findByRole('button', { name: 'Thanh toán 500.000 ₫' });
    expect(qrPay).toBeDisabled();
    fireEvent.click(qrPay);
    expect(confirmQrTransfer).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('tab', { name: 'VNPay' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy giao dịch VNPay' }));
    expect(cancelPayment).toHaveBeenCalledWith(11);
    expect(await within(dialog).findByRole('button', { name: 'Thanh toán qua VNPay' })).toBeEnabled();
  });
});
