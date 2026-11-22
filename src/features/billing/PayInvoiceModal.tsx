import { useId, useRef, useState } from 'react';
import { AlertBanner, Button, LoadingState, Modal, Tabs } from '../../design-system';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { paymentDisplayStatus, viDateTime, vietQrImageUrl, VNPAY_METHODS, vnd, type BillingApi, type InvoiceSummary, type PaymentResult, type QrApi, type QrTransfer } from './billingApi';
import { MomoPayTab } from './MomoPayTab';
import styles from './billing.module.css';

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thực hiện được thao tác. Hãy thử lại.';

type Tab = 'vnpay' | 'momo' | 'vietqr';
const TABS: { value: Tab; label: string }[] = [
  { value: 'vnpay', label: 'VNPay' },
  { value: 'momo', label: 'MoMo' },
  { value: 'vietqr', label: 'VietQR' },
];

/** QR image (with an offline fallback) and the transfer details it encodes. */
export function QrTransferInfo({ transfer }: { transfer: QrTransfer }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <div className={styles.qr}>
    {imageFailed
      ? <div className={styles.qrFallback} role="status">Không tải được ảnh mã QR (máy cần kết nối Internet). Bạn vẫn có thể chuyển khoản theo thông tin bên cạnh.</div>
      : <img className={styles.qrImage} src={vietQrImageUrl(transfer)} width={270} height={320} onError={() => setImageFailed(true)}
        alt={`Mã VietQR chuyển ${vnd(transfer.amount)} đến ${transfer.bankName} ${transfer.accountNo}`} />}
    <dl className={styles.qrInfo}>
      <div><dt>Ngân hàng</dt><dd>{transfer.bankName}</dd></div>
      <div><dt>Số tài khoản</dt><dd className={styles.amount}>{transfer.accountNo}</dd></div>
      <div><dt>Chủ tài khoản</dt><dd>{transfer.accountName}</dd></div>
      <div><dt>Số tiền</dt><dd className={styles.qrTotal}>{vnd(transfer.amount)}</dd></div>
      <div><dt>Nội dung chuyển khoản</dt><dd className={styles.amount}>{transfer.content}</dd></div>
    </dl>
  </div>;
}

/**
 * DEC-016 pay popup opened from the owner's invoice list: one tab per payment method, the pay action and a cancel
 * action at the bottom right. VietQR settles at once (the popup closes and the row turns paid); VNPay and MoMo open
 * their sandbox page and come back to the return page. While a VNPay link of the invoice is open, a second payment is
 * blocked (server rule too) and "Hủy giao dịch VNPay" gives it up so the owner can pay again at once.
 */
export function PayInvoiceModal({ api, qrApi, invoice, onClose, onPaid }: {
  api: BillingApi; qrApi: QrApi; invoice: InvoiceSummary; onClose: () => void; onPaid: (result: PaymentResult) => void;
}) {
  const [version, setVersion] = useState(0);
  const detail = useSupportingLoad(() => api.myInvoice(invoice.id), [api, invoice.id, version]);
  const qr = useSupportingLoad(() => qrApi.qrTransfer(invoice.id), [qrApi, invoice.id]);
  const [tab, setTab] = useState<Tab>('vnpay');
  const [method, setMethod] = useState('VNBANK');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const prefix = `pay-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  const open = detail.data?.payments.find((payment) => paymentDisplayStatus(payment) === 'PENDING');
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const payVnpay = () => run(async () => { window.location.assign((await api.pay(invoice.id, method)).paymentUrl); });
  const cancelVnpay = () => run(async () => { setNotice((await api.cancelPayment(invoice.id)).message); setVersion((value) => value + 1); });
  const recheck = () => run(async () => {
    const result = await api.ownerCheck(invoice.id);
    if (result.invoiceStatus === 'PAID') onPaid(result);
    else { setNotice(result.message); setVersion((value) => value + 1); }
  });
  const payQr = () => run(async () => { onPaid(await qrApi.confirmQrTransfer(invoice.id)); });

  const pendingNotice = open && <AlertBanner type="warning" title="Đang có một giao dịch VNPay chưa hoàn tất">
    {`Để không bị trừ tiền hai lần, hãy hoàn tất giao dịch đó, bấm "Kiểm tra lại" nếu đã trả, hoặc bấm "Hủy giao dịch VNPay" để thanh toán lại ngay (giao dịch tự hết hạn lúc ${viDateTime(open.expiresAt)}).`}
  </AlertBanner>;

  const close = <Button variant="secondary" onClick={onClose} disabled={busy}>Hủy</Button>;
  const footer = tab === 'vnpay'
    ? open
      ? <><Button variant="danger" onClick={cancelVnpay} disabled={busy}>Hủy giao dịch VNPay</Button>
        <Button variant="secondary" onClick={recheck} disabled={busy}>Kiểm tra lại</Button></>
      : <>{close}<Button onClick={payVnpay} disabled={busy || !detail.data || !detail.data.paymentConfigured}>Thanh toán qua VNPay</Button></>
    : tab === 'momo'
      ? <>{close}<Button disabled>Thanh toán qua MoMo</Button></>
      : <>{close}<Button onClick={payQr} disabled={busy || !qr.data || Boolean(open)}>{`Thanh toán ${vnd(invoice.totalAmount)}`}</Button></>;

  return <Modal open size="lg" title={`Thanh toán hóa đơn ${invoice.invoiceCode}`} onClose={onClose} dismissible={!busy} footer={footer}>
    <div className={styles.form}>
      <p className={styles.payHeading}>
        <span>{`${invoice.horse.name} (${invoice.horse.horseCode})`}</span>
        <strong className={styles.qrTotal}>{vnd(invoice.totalAmount)}</strong>
      </p>
      <Tabs items={TABS} value={tab} onChange={(value) => { setTab(value as Tab); setError(''); }} label="Phương thức thanh toán" idPrefix={prefix} />
      {notice && <AlertBanner feedback type="info" title={notice} />}
      {error && <AlertBanner feedback type="danger" title="Chưa thực hiện được">{error}</AlertBanner>}
      <div role="tabpanel" id={`${prefix}-panel-${tab}`} aria-labelledby={`${prefix}-tab-${tab}`} className={styles.form}>
        {tab === 'vnpay' && (detail.error ? <AlertBanner type="danger" title="Không tải được hóa đơn">{message(detail.error)}</AlertBanner>
          : !detail.data ? <LoadingState label="Đang tải…" />
            : <>
              {!detail.data.paymentConfigured && <AlertBanner type="warning" title="Cổng VNPay chưa được cấu hình trên máy chủ. Liên hệ Club Manager." />}
              {pendingNotice}
              <fieldset className={styles.methods} disabled={Boolean(open)}>
                <legend className={styles.hint}>Chọn phương thức</legend>
                {VNPAY_METHODS.map((item) => <label key={item.value || 'any'}>
                  <input type="radio" name={`${prefix}-method`} value={item.value} checked={method === item.value} onChange={() => setMethod(item.value)} />
                  <span><strong>{item.title}</strong><small>{item.text}</small></span>
                </label>)}
              </fieldset>
              <p className={styles.hint}>Bạn sẽ được chuyển sang cổng VNPay (môi trường sandbox). Hóa đơn chỉ được ghi nhận đã thanh toán sau khi VNPay xác nhận giao dịch với máy chủ.</p>
            </>)}
        {tab === 'momo' && <MomoPayTab />}
        {tab === 'vietqr' && (qr.error ? <AlertBanner type="warning" title="Chưa thể hiện mã QR">{message(qr.error)}</AlertBanner>
          : !qr.data ? <LoadingState label="Đang tạo mã QR…" />
            : <>
              <QrTransferInfo transfer={qr.data} />
              <p className={styles.hint}>Mở ứng dụng ngân hàng, quét mã để chuyển đúng số tiền và nội dung, rồi bấm Thanh toán.</p>
              {pendingNotice}
            </>)}
      </div>
    </div>
  </Modal>;
}
