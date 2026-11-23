import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerInvoicesPage, VnpayReturnPage } from './OwnerInvoicesPage';
import { paymentDisplayStatus, type InvoiceDetail, type Payment } from './billingApi';

const mocks = vi.hoisted(() => ({
  myInvoice: vi.fn(), payMomo: vi.fn(), ownerCheck: vi.fn(), confirmMomoReturn: vi.fn(), cancelMomoPayment: vi.fn(), confirmMomoTransfer: vi.fn(),
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
async function openMomoPopup() {
  page();
  fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán hóa đơn HD-TEST' }));
  await screen.findByRole('dialog', { name: 'Thanh toán hóa đơn HD-TEST' });
  fireEvent.click(screen.getByRole('tab', { name: /^MoMo$/ }));
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.myInvoice.mockResolvedValue(detail());
  mocks.qrTransfer.mockResolvedValue({ bankBin: '970436', bankName: 'Test Bank', accountNo: '000000', accountName: 'TEST', amount: 50000, content: 'HDTEST' });
});
describe('MoMo sandbox and shared payment guard (fixtures only)', () => {
  it('pays by MoMo like VietQR: the club QR code, then Thanh toán records the payment and closes the popup', async () => {
    mocks.confirmMomoTransfer.mockResolvedValue({ invoiceId: 1, invoiceCode: 'HD-TEST', invoiceStatus: 'PAID', paymentStatus: 'SUCCESS', responseCode: null,
      message: 'Đã ghi nhận thanh toán qua ví MoMo. Hóa đơn đã được thanh toán.' });
    await openMomoPopup();
    expect(await screen.findByText('000000')).toBeInTheDocument();
    expect(screen.getByText(/Quét mọi QR/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cổng MoMo (thẻ ATM)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /^Thanh toán 50/ }));
    expect(mocks.confirmMomoTransfer).toHaveBeenCalledWith(1);
    expect(mocks.payMomo).not.toHaveBeenCalled();
    expect(await screen.findByText('Đã thanh toán hóa đơn HD-TEST.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    await openMomoPopup();
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy giao dịch MoMo' }));
    // Next to "Hủy giao dịch MoMo" the close button reads "Đóng", never a second "Hủy".
    expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument();
    expect(mocks.cancelMomoPayment).toHaveBeenCalledWith(1);
    expect(await screen.findByText('Đã hủy giao dịch MoMo đang mở. Bạn có thể thanh toán lại bằng VNPay, MoMo hoặc mã QR.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cổng MoMo (thẻ ATM)' })).toBeEnabled());
    expect(screen.getByRole('button', { name: /^Thanh toán 50/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Hủy giao dịch MoMo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'VietQR' }));
    expect(await screen.findByRole('button', { name: /^Thanh toán 50/ })).toBeEnabled();
    expect(paymentDisplayStatus({ ...pending, status: 'FAILED', confirmedVia: 'OWNER' })).toBe('CANCELLED');
  });
  it('closes the popup when cancelling finds the MoMo order already paid', async () => {
    mocks.myInvoice.mockResolvedValue(detail([pending]));
    mocks.cancelMomoPayment.mockResolvedValue({ invoiceId: 1, invoiceCode: 'HD-TEST', invoiceStatus: 'PAID', paymentStatus: 'SUCCESS', responseCode: null,
      message: 'MoMo đã xác nhận thanh toán. Hóa đơn đã thanh toán.' });
    await openMomoPopup();
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy giao dịch MoMo' }));
    expect(await screen.findByText('Đã thanh toán hóa đơn HD-TEST.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps every pay action blocked until an outstanding MoMo order is confirmed, even after local expiry', async () => {
    mocks.myInvoice.mockResolvedValue(detail([pending])); await openMomoPopup();
    expect(await screen.findByRole('button', { name: /^Thanh toán 50/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cổng MoMo (thẻ ATM)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra lại' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Hủy giao dịch VNPay' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy giao dịch MoMo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('tab', { name: 'VietQR' }));
    expect(await screen.findByRole('button', { name: /^Thanh toán 50/ })).toBeDisabled();
    expect(paymentDisplayStatus(pending)).toBe('PENDING');
  });
  it('hides the MoMo gateway when the server has no MoMo keys, while the MoMo QR payment stays available', async () => {
    mocks.myInvoice.mockResolvedValue(detail([], false)); await openMomoPopup();
    expect(await screen.findByRole('button', { name: /^Thanh toán 50/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Cổng MoMo (thẻ ATM)' })).not.toBeInTheDocument();
  });
  it('double-click submits once and server errors preserve the invoice and allow retry', async () => {
    let reject!: (reason: Error) => void;
    mocks.payMomo.mockImplementation(() => new Promise((_, fail) => { reject = fail; })); await openMomoPopup();
    const button = await screen.findByRole('button', { name: 'Cổng MoMo (thẻ ATM)' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.payMomo).toHaveBeenCalledTimes(1); expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: 'VNPay' }));
    expect(screen.getByRole('button', { name: 'Thanh toán qua VNPay' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán qua VNPay' }));
    expect(mocks.pay).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: /^MoMo$/ }));
    await act(async () => { reject(new Error('Mạng đang lỗi, hãy kiểm tra lại.')); });
    expect(await screen.findByText('Mạng đang lỗi, hãy kiểm tra lại.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hóa đơn HD-TEST' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cổng MoMo (thẻ ATM)' })).toBeEnabled());
  });
  it('reloads an uncertain create and blocks retry when the server retained a pending order', async () => {
    let reject!: (reason: Error) => void;
    mocks.payMomo.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    await openMomoPopup();
    fireEvent.click(await screen.findByRole('button', { name: 'Cổng MoMo (thẻ ATM)' }));
    mocks.myInvoice.mockResolvedValue(detail([pending]));
    await act(async () => { reject(new Error('MOMO_CREATE_UNCONFIRMED')); });
    expect(await screen.findByText('Đang có một giao dịch MoMo chưa hoàn tất')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cổng MoMo (thẻ ATM)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Thanh toán 50/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kiểm tra lại' })).toBeEnabled();
    expect(mocks.payMomo).toHaveBeenCalledTimes(1);
  });
  it('rejects a checkout address outside the HTTPS MoMo sandbox', async () => {
    mocks.payMomo.mockResolvedValue({ payUrl: 'https://example.test/checkout' });
    await openMomoPopup();
    fireEvent.click(await screen.findByRole('button', { name: 'Cổng MoMo (thẻ ATM)' }));
    expect(await screen.findByText('Địa chỉ thanh toán MoMo test không hợp lệ.')).toBeInTheDocument();
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
