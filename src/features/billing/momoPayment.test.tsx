import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerInvoicesPage, VnpayReturnPage } from './OwnerInvoicesPage';
import { paymentDisplayStatus, type InvoiceDetail, type Payment } from './billingApi';

const mocks = vi.hoisted(() => ({
  myInvoice: vi.fn(), payMomo: vi.fn(), ownerCheck: vi.fn(), confirmMomoReturn: vi.fn(),
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
beforeEach(() => {
  vi.clearAllMocks(); mocks.myInvoice.mockResolvedValue(detail());
  mocks.qrTransfer.mockResolvedValue({ bankBin: '970436', bankName: 'Test Bank', accountNo: '000000', accountName: 'TEST', amount: 50000, content: 'HDTEST' });
});
describe('MoMo sandbox and shared payment guard (fixtures only)', () => {
  it('keeps every pay action blocked until an outstanding MoMo order is confirmed, even after local expiry', async () => {
    mocks.myInvoice.mockResolvedValue(detail([pending])); page();
    expect(await screen.findByRole('button', { name: 'Thanh toán bằng MoMo' })).toBeDisabled();
    await screen.findByText('Test Bank');
    for (const button of screen.getAllByRole('button', { name: /^Thanh toán 50/ })) expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kiểm tra lại thanh toán' })).toBeEnabled();
    expect(paymentDisplayStatus(pending)).toBe('PENDING');
  });
  it('disables MoMo if server configuration is absent', async () => {
    mocks.myInvoice.mockResolvedValue(detail([], false)); page();
    expect(await screen.findByRole('button', { name: 'Thanh toán bằng MoMo' })).toBeDisabled();
    expect(screen.getByText('MoMo test chưa được cấu hình trên máy chủ.')).toBeInTheDocument();
  });
  it('double-click submits once and server errors preserve the invoice and allow retry', async () => {
    let reject!: (reason: Error) => void;
    mocks.payMomo.mockImplementation(() => new Promise((_, fail) => { reject = fail; })); page();
    const button = await screen.findByRole('button', { name: 'Thanh toán bằng MoMo' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.payMomo).toHaveBeenCalledTimes(1); expect(button).toBeDisabled();
    await act(async () => { reject(new Error('Mạng đang lỗi, hãy kiểm tra lại.')); });
    expect(await screen.findByText('Mạng đang lỗi, hãy kiểm tra lại.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hóa đơn HD-TEST' })).toBeInTheDocument();
    await waitFor(() => expect(button).toBeEnabled());
  });
  it('never interprets resultCode=0 in the browser as payment success before the server query confirms', async () => {
    mocks.confirmMomoReturn.mockResolvedValue({ invoiceId: 1, invoiceCode: 'HD-TEST', invoiceStatus: 'ISSUED', paymentStatus: 'PENDING', message: 'Chờ máy chủ' });
    render(<MemoryRouter initialEntries={['/thanh-toan/momo?orderId=MM1&resultCode=0&signature=test']}><VnpayReturnPage provider="MOMO" /></MemoryRouter>);
    expect(await screen.findByText('Đang chờ MoMo xác nhận')).toBeInTheDocument();
    expect(screen.queryByText('Thanh toán thành công')).not.toBeInTheDocument();
    expect(mocks.confirmMomoReturn).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'MM1', resultCode: '0' }));
  });
});
