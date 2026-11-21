import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, LoadingState, MetricCard } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { createBillingApi, createQrApi, invoiceDisplayStatus, monthLabel, paymentDisplayStatus, viDateTime, viDate, vietQrImageUrl, vnd, type BillingApi, type PaymentResult, type QrApi } from './billingApi';
import { InvoiceView, StatusPill } from './InvoiceView';
import styles from './billing.module.css';

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thực hiện được thao tác. Hãy thử lại.';

function useOwnerApi() {
  const auth = useAuth();
  const token = authSession.read()?.accessToken;
  const api = useMemo(() => token ? createBillingApi(token, auth.handleApiError) : null, [token, auth.handleApiError]);
  const qrApi = useMemo(() => token ? createQrApi(token, auth.handleApiError) : null, [token, auth.handleApiError]);
  return { auth, api, qrApi };
}

/** DEC-016 Horse Owner "Hóa đơn & thanh toán": own invoices (/owner/invoices) and one invoice (/owner/invoices/:id). */
export function OwnerInvoicesPage() {
  const { auth, api, qrApi } = useOwnerApi();
  const { id } = useParams();
  if (!auth.user?.roles.includes('HORSE_OWNER') || !api || !qrApi) return <AlertBanner type="danger" title="Đăng nhập bằng tài khoản Horse Owner để xem hóa đơn." />;
  const invoiceId = id ? Number(id) : undefined;
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role: 'HORSE_OWNER' }}
    breadcrumb={invoiceId ? [{ label: 'Hóa đơn & thanh toán', to: '/owner/invoices' }, { label: 'Chi tiết' }] : [{ label: 'Hóa đơn & thanh toán' }]}>
    <section className={styles.stack}>
      {invoiceId && Number.isSafeInteger(invoiceId) ? <OwnerInvoice api={api} qrApi={qrApi} id={invoiceId} /> : <OwnerList api={api} />}
    </section>
  </AppShell>;
}

function OwnerList({ api }: { api: BillingApi }) {
  const load = useSupportingLoad(() => api.myInvoices(), [api]);
  if (load.error) return <ErrorState title="Không tải được hóa đơn" description={message(load.error)} onRetry={load.retry} />;
  if (!load.data) return <LoadingState label="Đang tải hóa đơn…" />;
  const unpaid = load.data.filter((row) => row.status === 'ISSUED');
  return <>
    <header data-page-banner className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Cổng thông tin Horse Owner</p>
        <h1>Hóa đơn & thanh toán</h1>
        <p>Phí lưu chuồng, chăm sóc và huấn luyện ngựa của bạn, tính theo tháng. Thanh toán trực tuyến qua VNPay (quét QR hoặc thẻ ngân hàng).</p>
      </div>
    </header>
    <div className={styles.summary}>
      <MetricCard label="Cần thanh toán" value={vnd(unpaid.reduce((sum, row) => sum + row.totalAmount, 0))} caption={`${unpaid.length} hóa đơn`} />
      <MetricCard label="Tổng hóa đơn" value={String(load.data.length)} />
    </div>
    <DataTable caption="Hóa đơn của tôi" rowKey={(row) => row.id} rows={load.data}
      empty={<EmptyState title="Chưa có hóa đơn" description="Club Manager chưa phát hành hóa đơn cho ngựa của bạn." />}
      columns={[
        { key: 'code', header: 'Mã hóa đơn', nowrap: true, render: (row) => <Link className={styles.link} to={`/owner/invoices/${row.id}`}>{row.invoiceCode}</Link> },
        { key: 'month', header: 'Kỳ', render: (row) => monthLabel(row.billingMonth) },
        { key: 'horse', header: 'Ngựa', render: (row) => `${row.horse.name} (${row.horse.horseCode})` },
        { key: 'total', header: 'Số tiền', align: 'right', nowrap: true, render: (row) => <span className={styles.amount}>{vnd(row.totalAmount)}</span> },
        { key: 'due', header: 'Hạn', nowrap: true, render: (row) => viDate(row.dueDate) },
        { key: 'status', header: 'Trạng thái', render: (row) => <StatusPill status={invoiceDisplayStatus(row)} /> },
      ]} />
  </>;
}

const METHODS = [
  { value: 'VNPAYQR', title: 'Quét mã QR', text: 'Quét bằng ứng dụng ngân hàng hoặc ví hỗ trợ VNPAY-QR.' },
  { value: 'VNBANK', title: 'Thẻ ATM / tài khoản ngân hàng', text: 'Nhập thẻ nội địa trên trang VNPay (môi trường thử nghiệm: thẻ NCB).' },
  { value: '', title: 'Chọn trên trang VNPay', text: 'Mở cổng VNPay và chọn phương thức tại đó.' },
];

/**
 * DEC-016 VietQR: the QR carries the club's receiving account, the invoice total and the invoice code as transfer
 * content. "Thanh toán" records the transfer as declared by the owner (VIETQR / OWNER) and the invoice becomes paid.
 */
function QrPayCard({ qrApi, invoiceId, onPaid, openPaymentUntil, openProvider = 'VNPAY', lockRef, busy, setBusy }: {
  qrApi: QrApi; invoiceId: number; onPaid: (result: PaymentResult) => void;
  /** Defined while an online order may still be paid. MoMo remains pending beyond its advisory local timer. */
  openPaymentUntil?: string | null;
  openProvider?: string;
  /** Shared with the VNPay card, so only one payment action runs at a time on this page. */
  lockRef: RefObject<boolean>; busy: boolean; setBusy: (value: boolean) => void;
}) {
  const load = useSupportingLoad(() => qrApi.qrTransfer(invoiceId), [qrApi, invoiceId]);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const transfer = load.data;
  const blocked = openPaymentUntil !== undefined;
  const pay = async () => {
    if (lockRef.current || blocked) return;
    lockRef.current = true; setBusy(true); setError('');
    try { onPaid(await qrApi.confirmQrTransfer(invoiceId)); }
    catch (cause) { setError(message(cause)); }
    finally { lockRef.current = false; setBusy(false); }
  };
  return <Card className={styles.form}>
    <h2>Thanh toán bằng mã QR</h2>
    {load.error ? <AlertBanner type="warning" title="Chưa thể hiện mã QR">{message(load.error)}</AlertBanner>
      : !transfer ? <LoadingState label="Đang tạo mã QR…" />
        : <div className={styles.qr}>
          {imageFailed
            ? <div className={styles.qrFallback} role="status">Không tải được ảnh mã QR (máy cần kết nối Internet). Bạn vẫn có thể chuyển khoản theo thông tin bên cạnh.</div>
            : <img className={styles.qrImage} src={vietQrImageUrl(transfer)} width={270} height={320} onError={() => setImageFailed(true)}
              alt={`Mã VietQR chuyển ${vnd(transfer.amount)} đến ${transfer.bankName} ${transfer.accountNo}`} />}
          <div className={styles.qrInfo}>
            <dl className={styles.qrInfo}>
            <div><dt>Ngân hàng</dt><dd>{transfer.bankName}</dd></div>
            <div><dt>Số tài khoản</dt><dd className={styles.amount}>{transfer.accountNo}</dd></div>
            <div><dt>Chủ tài khoản</dt><dd>{transfer.accountName}</dd></div>
            <div><dt>Số tiền</dt><dd className={styles.qrTotal}>{vnd(transfer.amount)}</dd></div>
            <div><dt>Nội dung chuyển khoản</dt><dd className={styles.amount}>{transfer.content}</dd></div>
            </dl>
            <p className={styles.hint}>Mở ứng dụng ngân hàng, quét mã để chuyển đúng số tiền và nội dung, rồi bấm Thanh toán.</p>
            {blocked && <AlertBanner type="warning" title={`Đang có một giao dịch ${openProvider === 'MOMO' ? 'MoMo' : 'VNPay'} chưa hoàn tất`}>
              {openProvider === 'MOMO' ? 'Hãy bấm Kiểm tra lại thanh toán. Chỉ chọn cách khác sau khi MoMo xác nhận giao dịch cũ đã kết thúc; thời gian chờ trên máy không chứng minh giao dịch đã hủy.' : `Để không bị trừ tiền hai lần, chỉ thanh toán bằng QR khi giao dịch VNPay đó hết hạn${openPaymentUntil ? ` (${viDateTime(openPaymentUntil)})` : ''}. Nếu bạn đã trả qua VNPay, bấm "Kiểm tra lại thanh toán" bên dưới.`}
            </AlertBanner>}
            {error && <AlertBanner feedback type="danger" title="Chưa ghi nhận được thanh toán">{error}</AlertBanner>}
            <Button onClick={pay} disabled={busy || blocked}>{`Thanh toán ${vnd(transfer.amount)}`}</Button>
          </div>
        </div>}
  </Card>;
}

export function OwnerInvoice({ api, qrApi, id }: { api: BillingApi; qrApi: QrApi; id: number }) {
  const [version, setVersion] = useState(0);
  const load = useSupportingLoad(() => api.myInvoice(id), [api, id, version]);
  const [method, setMethod] = useState('VNPAYQR');
  const [error, setError] = useState('');
  const [check, setCheck] = useState<PaymentResult>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const begin = () => { if (lock.current) return false; lock.current = true; setBusy(true); return true; };
  const end = () => { lock.current = false; setBusy(false); };
  if (load.error) return <ErrorState title="Không tải được hóa đơn" description={message(load.error)} onRetry={load.retry} />;
  const detail = load.data;
  if (!detail) return <LoadingState label="Đang tải hóa đơn…" />;
  const pay = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const link = await api.pay(id, method);
      window.location.assign(link.paymentUrl);
    } catch (cause) { setError(message(cause)); lock.current = false; setBusy(false); }
  };
  const recheck = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { setCheck(await api.ownerCheck(id)); setVersion((value) => value + 1); }
    catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const open = detail.payments.find((payment) => paymentDisplayStatus(payment) === 'PENDING');
  const pending = Boolean(open);
  const payMomo = async () => {
    if (pending || !begin()) return;
    setError('');
    try {
      const link = await api.payMomo(id);
      const url = new URL(link.payUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'test-payment.momo.vn' || url.username || url.password
        || (url.port && url.port !== '443')) throw new Error('Địa chỉ thanh toán MoMo test không hợp lệ.');
      window.location.assign(url.href);
    } catch (cause) { setError(message(cause)); end(); setVersion((value) => value + 1); }
  };
  return <>
    <header data-page-banner className={styles.header}>
      <div>
        <p className={styles.eyebrow}><Link className={styles.link} to="/owner/invoices">← Hóa đơn & thanh toán</Link></p>
        <h1>{`Hóa đơn ${detail.invoice.invoiceCode}`}</h1>
      </div>
    </header>
    {check && <AlertBanner feedback type={check.paymentStatus === 'SUCCESS' ? 'success' : 'info'} title={check.message} />}
    {detail.invoice.status === 'ISSUED' && <QrPayCard qrApi={qrApi} invoiceId={id} openPaymentUntil={open ? open.expiresAt ?? null : undefined} openProvider={open?.provider}
      lockRef={lock} busy={busy} setBusy={setBusy} onPaid={(result) => { setCheck(result); setVersion((value) => value + 1); }} />}
    <Card><InvoiceView detail={detail} showOwner={false} /></Card>
    {detail.invoice.status === 'ISSUED' && <Card className={styles.form}>
      <h2>Hoặc thanh toán thẻ qua VNPay</h2>
      {!detail.paymentConfigured && <AlertBanner type="warning" title="Cổng VNPay chưa được cấu hình trên máy chủ. Liên hệ Club Manager." />}
      <fieldset className={styles.methods}>
        <legend className={styles.hint}>Chọn phương thức</legend>
        {METHODS.map((item) => <label key={item.value || 'any'}>
          <input type="radio" name="method" value={item.value} checked={method === item.value} onChange={() => setMethod(item.value)} />
          <span><strong>{item.title}</strong><small>{item.text}</small></span>
        </label>)}
      </fieldset>
      <p className={styles.hint}>Bạn sẽ được chuyển sang cổng VNPay (môi trường sandbox). Hóa đơn chỉ được ghi nhận đã thanh toán sau khi VNPay xác nhận giao dịch với máy chủ.</p>
      {open && <AlertBanner type="info" title={`Đang có một giao dịch ${open.provider === 'MOMO' ? 'MoMo' : 'VNPay'} chưa hoàn tất`}>
        {open.provider === 'MOMO' ? 'Hãy bấm Kiểm tra lại thanh toán. Thời gian chờ trên máy không chứng minh MoMo đã hủy giao dịch.' : `Để tránh trừ tiền hai lần, chỉ mở giao dịch mới khi giao dịch này hết hạn (${viDateTime(open.expiresAt)}). Nếu bạn đã trả tiền, bấm "Kiểm tra lại thanh toán".`}
      </AlertBanner>}
      {error && <AlertBanner feedback type="danger" title="Chưa mở được cổng thanh toán">{error}</AlertBanner>}
      <div className={styles.actions}>
        {pending && <Button variant="secondary" onClick={recheck} disabled={busy}>Kiểm tra lại thanh toán</Button>}
        <Button onClick={pay} disabled={busy || !detail.paymentConfigured || pending}>{`Thanh toán ${vnd(detail.invoice.totalAmount)}`}</Button>
      </div>
    </Card>}
    {detail.invoice.status === 'ISSUED' && <Card className={styles.form}>
      <h2>Thanh toán qua MoMo</h2>
      <p className={styles.hint}>Dùng thẻ ATM thử nghiệm trên cổng MoMo test. Không dùng thẻ thật hoặc chuyển tiền thật. Kết quả chỉ được ghi nhận sau khi máy chủ xác minh với MoMo.</p>
      {!detail.momoConfigured && <AlertBanner type="warning" title="MoMo test chưa được cấu hình trên máy chủ." />}
      <Button onClick={payMomo} disabled={busy || pending || !detail.momoConfigured}>Thanh toán bằng MoMo</Button>
    </Card>}
  </>;
}

/** Return URL of VNPay (/thanh-toan/vnpay). The server verifies the signature and confirms with VNPay before recording. */
export function VnpayReturnPage({ provider = 'VNPAY' }: { provider?: 'VNPAY' | 'MOMO' }) {
  const momo = provider === 'MOMO';
  const providerLabel = momo ? 'MoMo' : 'VNPay';
  const { auth, api } = useOwnerApi();
  const [params] = useSearchParams();
  const [result, setResult] = useState<PaymentResult>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const fields = useMemo(() => Object.fromEntries([...params.entries()].filter(([key]) => momo || key.startsWith('vnp_'))), [params, momo]);
  const missing = momo ? !fields.orderId : !fields.vnp_TxnRef;
  useEffect(() => {
    if (!api || started.current || missing) return;
    started.current = true;
    (momo ? api.confirmMomoReturn(fields) : api.confirmReturn(fields)).then(setResult, (cause: unknown) => setError(message(cause)));
  }, [api, fields, missing, momo]);
  const role = auth.user?.roles.includes('HORSE_OWNER') ? 'HORSE_OWNER' : auth.user?.roles.includes('CLUB_MANAGER') ? 'CLUB_MANAGER' : undefined;
  if (!auth.user || !api || !role) return <AlertBanner type="danger" title="Đăng nhập lại để xem kết quả thanh toán." />;
  const recheck = async () => {
    if (!result) return;
    setBusy(true);
    try { setResult(role === 'HORSE_OWNER' ? await api.ownerCheck(result.invoiceId) : await api.managerCheck(result.invoiceId)); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  };
  const cancelledByUser = momo ? fields.resultCode === '1006' : fields.vnp_ResponseCode === '24';
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role }} breadcrumb={[{ label: 'Hóa đơn & thanh toán' }, { label: `Kết quả ${providerLabel}` }]}>
    <section className={`${styles.stack} ${styles.result}`}>
      <header data-page-banner className={styles.header}><div><p className={styles.eyebrow}>{providerLabel}</p><h1>Kết quả thanh toán</h1></div></header>
      {(error || missing) && <AlertBanner type="danger" title="Không xác nhận được giao dịch">{error || `Không có thông tin giao dịch từ ${providerLabel}.`}</AlertBanner>}
      {!error && !missing && !result && <LoadingState label={`Đang xác nhận giao dịch với ${providerLabel}…`} />}
      {result && <Card className={styles.form}>
        <AlertBanner type={result.paymentStatus === 'SUCCESS' ? 'success' : result.paymentStatus === 'FAILED' ? 'danger' : 'warning'}
          title={result.paymentStatus === 'SUCCESS' ? 'Thanh toán thành công' : cancelledByUser && result.paymentStatus === 'FAILED' ? 'Bạn đã hủy giao dịch' : result.paymentStatus === 'FAILED' ? 'Thanh toán không thành công' : `Đang chờ ${providerLabel} xác nhận`}>
          {result.message}
        </AlertBanner>
        <p>{`Hóa đơn ${result.invoiceCode}: `}<StatusPill status={result.invoiceStatus} /></p>
        <div className={styles.actions}>
          {result.paymentStatus === 'PENDING' && <Button variant="secondary" onClick={recheck} disabled={busy}>Kiểm tra lại</Button>}
          <Link className={styles.link} to={role === 'HORSE_OWNER' ? `/owner/invoices/${result.invoiceId}` : '/billing'}>Xem hóa đơn</Link>
        </div>
      </Card>}
    </section>
  </AppShell>;
}
