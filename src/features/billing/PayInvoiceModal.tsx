import { useId, useRef, useState } from 'react';
import { AlertBanner, Button, LoadingState, Modal, Tabs } from '../../design-system';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { paymentDisplayStatus, viDateTime, vietQrImageUrl, VNPAY_ATM, vnd, type BillingApi, type InvoiceSummary, type PaymentResult, type QrApi, type QrTransfer } from './billingApi';
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
  const [refreshing, setRefreshing] = useState(false);
  const detail = useSupportingLoad(async () => {
    try { return await api.myInvoice(invoice.id); }
    finally { setRefreshing(false); }
  }, [api, invoice.id, version]);
  const qr = useSupportingLoad(() => qrApi.qrTransfer(invoice.id), [qrApi, invoice.id]);
  const [tab, setTab] = useState<Tab>('vnpay');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const prefix = `pay-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  const open = detail.data?.payments.find((payment) => paymentDisplayStatus(payment) === 'PENDING');
  // Payment is offered only once the invoice itself is loaded and still unpaid: while it loads or fails to load, an open
  // VNPay link cannot be ruled out, and a bank transfer made from a displayed QR cannot be undone by the server.
  const ready = !refreshing && detail.data?.invoice.status === 'ISSUED';
  const canPay = ready && !open;
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const payVnpay = () => run(async () => { window.location.assign((await api.pay(invoice.id, VNPAY_ATM.bankCode)).paymentUrl); });
  const reloadDetail = () => { setRefreshing(true); setVersion((value) => value + 1); };
  const payMomo = () => {
    if (!canPay || !detail.data?.momoConfigured) return;
    return run(async () => {
      try {
        const link = await api.payMomo(invoice.id);
        const url = new URL(link.payUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'test-payment.momo.vn' || url.username || url.password
          || (url.port && url.port !== '443')) throw new Error('Địa chỉ thanh toán MoMo test không hợp lệ.');
        window.location.assign(url.href);
      } catch (cause) {
        // A failed response may still have reserved an order. Reload before offering any method again.
        reloadDetail();
        throw cause;
      }
    });
  };
  // Cancel asks VNPay first and may find the link already paid: that result settles the invoice like a recheck.
  const settleOrReload = (result: PaymentResult) => {
    if (result.invoiceStatus === 'PAID') onPaid(result);
    else { setNotice(result.message); reloadDetail(); }
  };
  const cancelVnpay = () => run(async () => settleOrReload(await api.cancelPayment(invoice.id)));
  const cancelMomo = () => run(async () => settleOrReload(await api.cancelMomoPayment(invoice.id)));
  const recheck = () => run(async () => settleOrReload(await api.ownerCheck(invoice.id)));
  const payQr = () => run(async () => { onPaid(await qrApi.confirmQrTransfer(invoice.id)); });

  const pendingNotice = open && <AlertBanner type="warning" title={`Đang có một giao dịch ${open.provider === 'MOMO' ? 'MoMo' : 'VNPay'} chưa hoàn tất`}>
    {open.provider === 'MOMO'
      ? 'Để không bị trừ tiền hai lần, hãy hoàn tất giao dịch đó, bấm "Kiểm tra lại" nếu đã trả, hoặc bấm "Hủy giao dịch MoMo" để thanh toán lại ngay. Nếu MoMo vẫn thu tiền sau khi hủy, khoản đó được ghi nhận hoặc hoàn lại.'
      : `Để không bị trừ tiền hai lần, hãy hoàn tất giao dịch đó, bấm "Kiểm tra lại" nếu đã trả, hoặc bấm "Hủy giao dịch VNPay" để thanh toán lại ngay (giao dịch tự hết hạn lúc ${viDateTime(open.expiresAt)}).`}
  </AlertBanner>;

  // With an open transaction the footer also has "Hủy giao dịch …": the close button then reads "Đóng" to avoid two "Hủy".
  const close = <Button variant="secondary" onClick={onClose} disabled={busy}>{ready && !open ? 'Hủy' : 'Đóng'}</Button>;
  const footer = !ready
    ? close
    : open
      ? <>{close}{open.provider === 'VNPAY' && <Button variant="danger" onClick={cancelVnpay} disabled={busy}>Hủy giao dịch VNPay</Button>}
        {open.provider === 'MOMO' && <Button variant="danger" onClick={cancelMomo} disabled={busy}>Hủy giao dịch MoMo</Button>}
        <Button variant="secondary" onClick={recheck} disabled={busy}>Kiểm tra lại</Button>
        {tab === 'momo' && <Button disabled>Thanh toán qua MoMo</Button>}
        {tab === 'vietqr' && <Button disabled>{`Thanh toán ${vnd(invoice.totalAmount)}`}</Button>}</>
      : tab === 'vnpay'
        ? <>{close}<Button onClick={payVnpay} disabled={busy || !canPay || !detail.data?.paymentConfigured}>Thanh toán qua VNPay</Button></>
        : tab === 'momo'
          ? <>{close}<Button onClick={payMomo} disabled={busy || !canPay || !detail.data?.momoConfigured}>Thanh toán qua MoMo</Button></>
          : <>{close}<Button onClick={payQr} disabled={busy || !canPay || !qr.data}>{`Thanh toán ${vnd(invoice.totalAmount)}`}</Button></>;
  const invoiceState = detail.error
    ? <AlertBanner type="danger" title="Không tải được hóa đơn">
      {message(detail.error)} <Button variant="secondary" size="sm" onClick={detail.retry}>Thử lại</Button>
    </AlertBanner>
    : !detail.data || refreshing ? <LoadingState label="Đang tải hóa đơn…" />
      : !ready ? <AlertBanner type="info" title={detail.data.invoice.status === 'PAID' ? 'Hóa đơn này đã được thanh toán.' : 'Hóa đơn này không còn chờ thanh toán.'} />
        : null;

  return <Modal open size="lg" className={styles.payModal} title={`Thanh toán hóa đơn ${invoice.invoiceCode}`} onClose={onClose} dismissible={!busy} footer={footer}>
    <div className={styles.form}>
      <p className={styles.payHeading}>
        <span>{`${invoice.horse.name} (${invoice.horse.horseCode})`}</span>
        <strong className={styles.qrTotal}>{vnd(invoice.totalAmount)}</strong>
      </p>
      <Tabs items={TABS} value={tab} onChange={(value) => { setTab(value as Tab); setError(''); }} label="Phương thức thanh toán" idPrefix={prefix} />
      {notice && <AlertBanner feedback type="info" title={notice} />}
      {error && <AlertBanner feedback type="danger" title="Chưa thực hiện được">{error}</AlertBanner>}
      <div role="tabpanel" id={`${prefix}-panel-${tab}`} aria-labelledby={`${prefix}-tab-${tab}`} className={styles.form}>
        {invoiceState}
        {ready && tab === 'vnpay' && <>
              {!detail.data?.paymentConfigured && <AlertBanner type="warning" title="Cổng VNPay chưa được cấu hình trên máy chủ. Liên hệ Club Manager." />}
              {pendingNotice}
              <div className={styles.method}>
                <span className={styles.hint}>Phương thức</span>
                <strong>{VNPAY_ATM.title}</strong>
                <small>{VNPAY_ATM.text}</small>
              </div>
              <p className={styles.hint}>Bạn sẽ được chuyển sang cổng VNPay (môi trường sandbox). Hóa đơn chỉ được ghi nhận đã thanh toán sau khi VNPay xác nhận giao dịch với máy chủ.</p>
            </>}
        {ready && tab === 'momo' && <><MomoPayTab configured={Boolean(detail.data?.momoConfigured)} />{pendingNotice}</>}
        {ready && tab === 'vietqr' && (qr.error ? <AlertBanner type="warning" title="Chưa thể hiện mã QR">{message(qr.error)}</AlertBanner>
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
