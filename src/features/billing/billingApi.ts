import { requestApi } from '../../shared/auth/authApi';

/** DEC-016 service billing contract. Amounts are whole VND. */
export type InvoiceStatus = 'ISSUED' | 'PAID' | 'CANCELLED';
export interface Price { serviceCode: 'BOARDING_CARE_DAILY' | 'TRAINING_SESSION'; label: string; unit: string; unitPrice: number | null; updatedAt: string | null; updatedBy: string | null }
export interface Party { id: number; fullName: string; email: string }
export interface InvoiceSummary {
  id: number; invoiceCode: string; billingMonth: string; periodStart: string; periodEnd: string;
  horse: { id: number; horseCode: string; name: string }; owner: Party; totalAmount: number; status: InvoiceStatus;
  dueDate: string; issuedAt: string; paidAt: string | null;
}
export interface InvoiceLine { lineNo: number; serviceCode: string; description: string; quantity: number; unitPrice: number; amount: number }
export interface Payment {
  id: number; provider: string; txnRef: string; amount: number; status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUND_REQUIRED'; bankCode: string | null;
  cardType: string | null; providerTransactionNo: string | null; responseCode: string | null; confirmedVia: string | null;
  createdAt: string; confirmedAt: string | null; expiresAt: string | null;
}
export interface InvoiceDetail { invoice: InvoiceSummary; lines: InvoiceLine[]; payments: Payment[]; issuedBy: Party; cancelledAt: string | null; cancellationReason: string | null; paymentConfigured: boolean; momoConfigured?: boolean }
export interface GenerateResult { billingMonth: string; periodStart: string; periodEnd: string; created: InvoiceSummary[]; skipped: { horseId: number; horseCode: string; horseName: string; reason: string }[] }
export interface PaymentLink { paymentUrl: string; txnRef: string; amount: number; expiresAt: string }
export interface MomoPaymentLink { payUrl: string; txnRef: string; amount: number; expiresAt: string }
export interface PaymentResult { invoiceId: number; invoiceCode: string; invoiceStatus: InvoiceStatus; paymentStatus: string; responseCode: string | null; message: string }

export function createBillingApi(token: string, onError: (cause: unknown) => boolean) {
  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    try {
      return await requestApi<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { token });
    } catch (cause) { onError(cause); throw cause; }
  }
  const query = (values: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
    const text = params.toString();
    return text ? `?${text}` : '';
  };
  return {
    prices: () => call<Price[]>('/api/billing/prices'),
    updatePrices: (body: { boardingCareDaily?: number; trainingSession?: number }) => call<Price[]>('/api/billing/prices', 'PUT', body),
    generate: (billingMonth: string) => call<GenerateResult>('/api/billing/invoices/generate', 'POST', { billingMonth }),
    invoices: (month?: string, status?: string) => call<InvoiceSummary[]>(`/api/billing/invoices${query({ month, status })}`),
    invoice: (id: number) => call<InvoiceDetail>(`/api/billing/invoices/${id}`),
    cancel: (id: number, reason: string) => call<InvoiceDetail>(`/api/billing/invoices/${id}/cancel`, 'POST', { reason }),
    managerCheck: (id: number) => call<PaymentResult>(`/api/billing/invoices/${id}/payment-check`, 'POST', {}),
    myInvoices: () => call<InvoiceSummary[]>('/api/owner/invoices'),
    myInvoice: (id: number) => call<InvoiceDetail>(`/api/owner/invoices/${id}`),
    pay: (id: number, bankCode: string) => call<PaymentLink>(`/api/owner/invoices/${id}/vnpay-payment`, 'POST', bankCode ? { bankCode } : {}),
    ownerCheck: (id: number) => call<PaymentResult>(`/api/owner/invoices/${id}/payment-check`, 'POST', {}),
    /** Give up the open VNPay link so the invoice can be paid again at once (VNPay or VietQR). */
    cancelPayment: (id: number) => call<PaymentResult>(`/api/owner/invoices/${id}/vnpay-payment/cancel`, 'POST', {}),
    /** Give up the open MoMo order (MoMo is asked first; an order already paid is recorded instead). */
    cancelMomoPayment: (id: number) => call<PaymentResult>(`/api/owner/invoices/${id}/momo-payment/cancel`, 'POST', {}),
    confirmReturn: (params: Record<string, string>) => call<PaymentResult>('/api/payments/vnpay/return', 'POST', { params }),
    payMomo: (id: number) => call<MomoPaymentLink>(`/api/owner/invoices/${id}/momo-payment`, 'POST', {}),
    confirmMomoReturn: (params: Record<string, string>) => call<PaymentResult>('/api/payments/momo/return', 'POST', { params }),
  };
}
export type BillingApi = ReturnType<typeof createBillingApi>;

export const STATUS_LABEL: Record<InvoiceStatus, string> = { ISSUED: 'Chờ thanh toán', PAID: 'Đã thanh toán', CANCELLED: 'Đã hủy' };
export const PAYMENT_LABEL: Record<Payment['status'], string> = { PENDING: 'Đang chờ xác nhận', SUCCESS: 'Thành công', FAILED: 'Không thành công', REFUND_REQUIRED: 'Thu trùng — cần hoàn tiền' };
/** Display state of an invoice: an unpaid invoice past its due date (Vietnam date) is shown as overdue. */
export function invoiceDisplayStatus(invoice: { status: InvoiceStatus; dueDate: string }): InvoiceStatus | 'OVERDUE' {
  return invoice.status === 'ISSUED' && invoice.dueDate < todayVn() ? 'OVERDUE' : invoice.status;
}
/**
 * A PENDING link past its expiry can no longer be paid; it is shown as expired, not as waiting. A VNPay link the owner
 * cancelled (FAILED, confirmed by OWNER) is shown as cancelled.
 */
export function paymentDisplayStatus(payment: Payment, now = Date.now()): Payment['status'] | 'EXPIRED' | 'CANCELLED' {
  if (payment.status === 'FAILED' && payment.confirmedVia === 'OWNER' && (payment.provider === 'VNPAY' || payment.provider === 'MOMO')) return 'CANCELLED';
  return payment.provider !== 'MOMO' && payment.status === 'PENDING' && payment.expiresAt && Date.parse(payment.expiresAt) < now ? 'EXPIRED' : payment.status;
}
export function todayVn(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const SKIP_LABEL: Record<string, string> = {
  ALREADY_INVOICED: 'Đã có hóa đơn tháng này', NO_MANAGING_OWNER: 'Chưa xác định chủ quản lý', NO_BILLABLE_SERVICE: 'Không có dịch vụ phát sinh',
};

export function vnd(amount: number | null | undefined): string {
  return amount == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}
export function viDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
export function viDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
}
export function monthLabel(month: string): string {
  const [year, value] = month.split('-');
  return `Tháng ${Number(value)}/${year}`;
}
/** Current month in Vietnam time as YYYY-MM. */
export function currentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
}

/* ---------- DEC-016 VietQR bank transfer ---------- */
export interface PaymentAccount { bankBin: string; bankName: string; accountNo: string; accountName: string; updatedAt: string | null; updatedBy: string | null }
export interface QrTransfer { bankBin: string; bankName: string; accountNo: string; accountName: string; amount: number; content: string }

/** NAPAS BINs as returned by https://api.vietqr.io/v2/banks (checked 2026-11-20). */
export const BANKS: { bin: string; name: string }[] = [
  { bin: '970436', name: 'Vietcombank' }, { bin: '970415', name: 'VietinBank' }, { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' }, { bin: '970407', name: 'Techcombank' }, { bin: '970422', name: 'MBBank' },
  { bin: '970416', name: 'ACB' }, { bin: '970432', name: 'VPBank' }, { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' }, { bin: '970441', name: 'VIB' }, { bin: '970443', name: 'SHB' },
  { bin: '970437', name: 'HDBank' }, { bin: '970448', name: 'OCB' }, { bin: '970426', name: 'MSB' },
  { bin: '970431', name: 'Eximbank' }, { bin: '970440', name: 'SeABank' }, { bin: '970449', name: 'LPBank' },
  { bin: '970428', name: 'NamABank' }, { bin: '970409', name: 'BacABank' }, { bin: '970438', name: 'BaoVietBank' },
  { bin: '963388', name: 'Timo' }, { bin: '546034', name: 'CAKE' }, { bin: '970452', name: 'KienLongBank' },
  { bin: '970412', name: 'PVcomBank' },
];

/** VietQR Quick Link image (https://www.vietqr.io/danh-sach-api/link-tao-ma-nhanh/): scannable by any Vietnamese bank app. */
export function vietQrImageUrl(transfer: QrTransfer): string {
  const query = new URLSearchParams({ amount: String(transfer.amount), addInfo: transfer.content, accountName: transfer.accountName });
  return `https://img.vietqr.io/image/${encodeURIComponent(transfer.bankBin)}-${encodeURIComponent(transfer.accountNo)}-compact2.png?${query.toString().replace(/\+/g, '%20')}`;
}

export function createQrApi(token: string, onError: (cause: unknown) => boolean) {
  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    try {
      return await requestApi<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { token });
    } catch (cause) { onError(cause); throw cause; }
  }
  return {
    // The API omits a null data field (NON_NULL envelope): no account yet arrives as undefined, normalised to null.
    paymentAccount: async () => (await call<PaymentAccount | null | undefined>('/api/billing/payment-account')) ?? null,
    updatePaymentAccount: (body: Omit<PaymentAccount, 'updatedAt' | 'updatedBy'>) => call<PaymentAccount>('/api/billing/payment-account', 'PUT', body),
    qrTransfer: (invoiceId: number) => call<QrTransfer>(`/api/owner/invoices/${invoiceId}/qr-transfer`),
    confirmQrTransfer: (invoiceId: number) => call<PaymentResult>(`/api/owner/invoices/${invoiceId}/qr-transfer`, 'POST', {}),
  };
}
export type QrApi = ReturnType<typeof createQrApi>;

/**
 * The only VNPay method offered: the domestic ATM card / bank account. VNPAYQR, and the gateway's own method page that
 * lists it, are left out because the sandbox merchant answers VNPAYQR with code 76 (bank not supported).
 */
export const VNPAY_ATM = { bankCode: 'VNBANK', title: 'Thẻ ATM / tài khoản ngân hàng', text: 'Nhập thẻ nội địa trên trang VNPay (môi trường thử nghiệm: thẻ NCB).' };
