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
  id: number; provider: string; txnRef: string; amount: number; status: 'PENDING' | 'SUCCESS' | 'FAILED'; bankCode: string | null;
  cardType: string | null; providerTransactionNo: string | null; responseCode: string | null; confirmedVia: string | null;
  createdAt: string; confirmedAt: string | null;
}
export interface InvoiceDetail { invoice: InvoiceSummary; lines: InvoiceLine[]; payments: Payment[]; issuedBy: Party; cancelledAt: string | null; cancellationReason: string | null; paymentConfigured: boolean }
export interface GenerateResult { billingMonth: string; periodStart: string; periodEnd: string; created: InvoiceSummary[]; skipped: { horseId: number; horseCode: string; horseName: string; reason: string }[] }
export interface PaymentLink { paymentUrl: string; txnRef: string; amount: number; expiresAt: string }
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
    confirmReturn: (params: Record<string, string>) => call<PaymentResult>('/api/payments/vnpay/return', 'POST', { params }),
  };
}
export type BillingApi = ReturnType<typeof createBillingApi>;

export const STATUS_LABEL: Record<InvoiceStatus, string> = { ISSUED: 'Chờ thanh toán', PAID: 'Đã thanh toán', CANCELLED: 'Đã hủy' };
export const PAYMENT_LABEL: Record<Payment['status'], string> = { PENDING: 'Đang chờ VNPay xác nhận', SUCCESS: 'Thành công', FAILED: 'Không thành công' };
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
