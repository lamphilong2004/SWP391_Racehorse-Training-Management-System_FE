import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerInvoicesPage, VnpayReturnPage } from './OwnerInvoicesPage';
import { paymentDisplayStatus, type InvoiceDetail, type Payment } from './billingApi';

const mocks = vi.hoisted(() => ({
  myInvoice: vi.fn(), payMomo: vi.fn(), ownerCheck: vi.fn(), confirmMomoReturn: vi.fn(), cancelMomoPayment: vi.fn(),
  pay: vi.fn(), qrTransfer: vi.fn(), confirmQrTransfer: vi.fn(),
  handleApiError: vi.fn(),
}));
vi.mock('../../layout/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { fullName: 'Owner test', roles: ['HORSE_OWNER'] }, handleApiError: mocks.handleApiError }) }));
vi.mock('../../shared/auth/authSession', () => ({ authSession: { read: () => ({ accessToken: 'test-fixture' }) } }));
vi.mock('./billingApi', async (original) => ({
  ...await original<typeof import('./billingApi')>(),
  createBillingApi: () => mocks,
  createQrApi: () => mocks,
}));
const pending: Payment = { id: 1, provider: 'MOMO', txnRef: 'MM1', amount: 50000, status: 'PENDING', bankCode: null,
  cardType: null, providerTransactionNo: null, responseCode: null, confirmedVia: null,
  createdAt: '2026-11-21T00:00:00Z', confirmedAt: null, expiresAt: '2000-01-01T00:00:00Z' };
const detail = (payments: Payment[] = [], momoConfigured = true): InvoiceDetail => ({
  invoice: { id: 1, invoiceCode: 'HD-TEST', billingMonth: '2026-11', periodStart: '2026-11-01', periodEnd: '2026-11-21',
    horse: { id: 1, horseCode: 'RH-TEST', name: 'Test horse' }, owner: { id: 1, fullName: 'Owner', email: 'owner@example.test' },
    totalAmount: 50000, status: 'ISSUED', dueDate: '2099-01-01', issuedAt: '2026-11-21T00:00:00Z', paidAt: null },
  lines: [], payments, issuedBy: { id: 2, fullName: 'Manager', email: 'cm@example.test' }, cancelledAt: null,
  cancellationReason: null, paymentConfigured: true, momoConfigured,
});
function page() { return render(<MemoryRouter initialEntries={['/owner/invoices/1']}><Routes>
  <Route path="/owner/invoices/:id" element={<OwnerInvoicesPage />} /></Routes></MemoryRouter>); }
async function openPopup() {
  page();
  fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán hóa đơn HD-TEST' }));
  await screen.findByRole('dialog', { name: 'Thanh toán hóa đơn HD-TEST' });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.myInvoice.mockResolvedValue(detail());
  mocks.qrTransfer.mockResolvedValue({ bankBin: '970436', bankName: 'Test Bank', accountNo: '000000', accountName: 'TEST', amount: 50000, content: 'HDTEST' });
});
describe('MoMo removed from the pay popup; an order opened earlier can still be resolved (fixtures only)', () => {
  it('offers only VNPay and VietQR', async () => {
    await openPopup();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['VNPay', 'VietQR']);
    expect(screen.queryByText(/MoMo/)).not.toBeInTheDocument();
  });
  it('lets the owner give up an outstanding MoMo order and pay again at once', async () => {
    let cancelled = false;
    mocks.myInvoice.mockImplementation(() => Promise.resolve(detail([cancelled
      ? { ...pending, status: 'FAILED', confirmedVia: 'OWNER' } : pending])));
    mocks.cancelMomoPayment.mockImplementation(() => {
      cancelled = true;
      return Promise.resolve({ invoiceId: 1, invoiceCode: 'HD-TEST', invoiceStatus: 'ISSUED', paymentStatus: 'CANCELLED', responseCode: null,
        message: 'Đã hủy giao dịch MoMo đang mở. Bạn có thể thanh toán lại bằng VNPay, MoMo hoặc mã QR.' });
    });
    await openPopup();
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy giao dịch MoMo' }));
    expect(mocks.cancelMomoPayment).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thanh toán qua VNPay' })).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Hủy giao dịch MoMo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'VietQR' }));
    expect(await screen.findByRole('button', { name: /^Thanh toán 50/ })).toBeEnabled();
    expect(paymentDisplayStatus({ ...pending, status: 'FAILED', confirmedVia: 'OWNER' })).toBe('CANCELLED');
  });
  it('closes the popup when cancelling finds the MoMo order already paid', async () => {
    mocks.myInvoice.mockResolvedValue(detail([pending]));
    mocks.cancelMomoPayment.mockResolvedValue({ invoiceId: 1, invoiceCode: 'HD-TEST', invoiceStatus: 'PAID', paymentStatus: 'SUCCESS', responseCode: null,
      message: 'MoMo đã xác nhận thanh toán. Hóa đơn đã thanh toán.' });
    await openPopup();
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy giao dịch MoMo' }));
    expect(await screen.findByText('Đã thanh toán hóa đơn HD-TEST.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps every pay action blocked while an outstanding MoMo order is open, even after local expiry', async () => {
    mocks.myInvoice.mockResolvedValue(detail([pending])); await openPopup();
    expect(await screen.findByRole('button', { name: 'Kiểm tra lại' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hủy giao dịch MoMo' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Thanh toán qua VNPay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy giao dịch VNPay' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'VietQR' }));
    expect(await screen.findByRole('button', { name: /^Thanh toán 50/ })).toBeDisabled();
    expect(paymentDisplayStatus(pending)).toBe('PENDING');
  });
  it('shows a cancelled signed return as unpaid rather than success', async () => {
    mocks.confirmMomoReturn.mockResolvedValue({ invoiceId: 1, invoiceCode: 'HD-TEST', invoiceStatus: 'ISSUED', paymentStatus: 'FAILED', responseCode: '1006', message: 'Đã hủy; hóa đơn chưa thanh toán.' });
    render(<MemoryRouter initialEntries={['/thanh-toan/momo?orderId=MM1&resultCode=1006&signature=test']}><VnpayReturnPage provider="MOMO" /></MemoryRouter>);
    expect(await screen.findByText('Bạn đã hủy giao dịch')).toBeInTheDocument();
    expect(screen.getByText('Chờ thanh toán')).toBeInTheDocument();
    expect(screen.queryByText('Thanh toán thành công')).not.toBeInTheDocument();
  });
  it('never interprets resultCode=0 in the browser as payment success before the server query confirms', async () => {
    mocks.confirmMomoReturn.mockResolvedValue({ invoiceId: 1, invoiceCode: 'HD-TEST', invoiceStatus: 'ISSUED', paymentStatus: 'PENDING', message: 'Chờ máy chủ' });
    render(<MemoryRouter initialEntries={['/thanh-toan/momo?orderId=MM1&resultCode=0&signature=test']}><VnpayReturnPage provider="MOMO" /></MemoryRouter>);
    expect(await screen.findByText('Đang chờ MoMo xác nhận')).toBeInTheDocument();
    expect(screen.queryByText('Thanh toán thành công')).not.toBeInTheDocument();
    expect(mocks.confirmMomoReturn).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'MM1', resultCode: '0' }));
  });
});
