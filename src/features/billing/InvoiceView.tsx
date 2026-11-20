import { DataTable } from '../../design-system';
import { invoiceDisplayStatus, monthLabel, PAYMENT_LABEL, paymentDisplayStatus, STATUS_LABEL, viDate, viDateTime, vnd, type InvoiceDetail, type InvoiceStatus, type Payment } from './billingApi';
import styles from './billing.module.css';

type PillStatus = InvoiceStatus | Payment['status'] | 'OVERDUE' | 'EXPIRED';
const EXTRA_LABEL: Record<string, string> = { OVERDUE: 'Quá hạn thanh toán', EXPIRED: 'Hết hạn (chưa thanh toán)' };

export function StatusPill({ status }: { status: PillStatus }) {
  const label = EXTRA_LABEL[status] ?? (status in STATUS_LABEL ? STATUS_LABEL[status as InvoiceStatus] : PAYMENT_LABEL[status as Payment['status']]);
  return <span className={styles.badge} data-status={status}>{label}</span>;
}

const METHOD: Record<string, string> = { VNPAYQR: 'QR VNPay', QRCODE: 'QR VNPay', ATM: 'Thẻ ATM / tài khoản', NCB: 'Ngân hàng NCB' };

/** Invoice body shared by the Club Manager and the Horse Owner: who, period, lines computed by the server, payments. */
export function InvoiceView({ detail, showOwner }: { detail: InvoiceDetail; showOwner: boolean }) {
  const { invoice } = detail;
  return <div className={styles.form}>
    <dl className={styles.meta}>
      <div><dt>Mã hóa đơn</dt><dd>{invoice.invoiceCode}</dd></div>
      <div><dt>Trạng thái</dt><dd><StatusPill status={invoiceDisplayStatus(invoice)} /></dd></div>
      <div><dt>Ngựa</dt><dd>{`${invoice.horse.name} (${invoice.horse.horseCode})`}</dd></div>
      <div><dt>Kỳ tính phí</dt><dd>{`${monthLabel(invoice.billingMonth)} · ${viDate(invoice.periodStart)} – ${viDate(invoice.periodEnd)}`}</dd></div>
      {showOwner && <div><dt>Chủ ngựa</dt><dd>{`${invoice.owner.fullName} · ${invoice.owner.email}`}</dd></div>}
      <div><dt>Phát hành</dt><dd>{`${viDateTime(invoice.issuedAt)} · ${detail.issuedBy.fullName}`}</dd></div>
      <div><dt>Hạn thanh toán</dt><dd>{viDate(invoice.dueDate)}</dd></div>
      {invoice.paidAt && <div><dt>Đã thanh toán lúc</dt><dd>{viDateTime(invoice.paidAt)}</dd></div>}
      {detail.cancelledAt && <div><dt>Đã hủy</dt><dd>{`${viDateTime(detail.cancelledAt)} — ${detail.cancellationReason ?? ''}`}</dd></div>}
    </dl>
    <DataTable caption="Chi tiết dịch vụ" rowKey={(line) => line.lineNo} rows={detail.lines} columns={[
      { key: 'description', header: 'Dịch vụ', render: (line) => line.description },
      { key: 'quantity', header: 'Số lượng', align: 'right', render: (line) => line.quantity },
      { key: 'unit', header: 'Đơn giá', align: 'right', nowrap: true, render: (line) => <span className={styles.amount}>{vnd(line.unitPrice)}</span> },
      { key: 'amount', header: 'Thành tiền', align: 'right', nowrap: true, render: (line) => <span className={styles.amount}>{vnd(line.amount)}</span> },
    ]} />
    <div className={styles.total}><span>Tổng cộng</span><span className={styles.amount}>{vnd(invoice.totalAmount)}</span></div>
    {detail.payments.length > 0 && <DataTable caption="Lịch sử thanh toán VNPay" rowKey={(payment) => payment.id} rows={detail.payments} columns={[
      { key: 'created', header: 'Thời điểm', nowrap: true, render: (payment) => viDateTime(payment.createdAt) },
      { key: 'ref', header: 'Mã giao dịch', render: (payment) => payment.providerTransactionNo ? `${payment.txnRef} · VNPay ${payment.providerTransactionNo}` : payment.txnRef },
      { key: 'method', header: 'Phương thức', render: (payment) => METHOD[payment.cardType ?? ''] ?? METHOD[payment.bankCode ?? ''] ?? payment.bankCode ?? '—' },
      { key: 'amount', header: 'Số tiền', align: 'right', nowrap: true, render: (payment) => <span className={styles.amount}>{vnd(payment.amount)}</span> },
      { key: 'status', header: 'Kết quả', render: (payment) => <StatusPill status={paymentDisplayStatus(payment)} /> },
      { key: 'via', header: 'Xác nhận', render: (payment) => payment.confirmedVia === 'IPN' ? 'VNPay IPN' : payment.confirmedVia === 'QUERYDR' ? 'Tra cứu VNPay' : payment.confirmedVia === 'RETURN' ? 'Chữ ký VNPay (trang trả về)' : '—' },
    ]} />}
  </div>;
}
