import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, LoadingState, MetricCard } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { createBillingApi, createQrApi, invoiceDisplayStatus, monthLabel, viDate, vnd, type BillingApi, type InvoiceSummary, type PaymentResult, type QrApi } from './billingApi';
import { InvoiceView, StatusPill } from './InvoiceView';
import { PayInvoiceModal } from './PayInvoiceModal';
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
      {invoiceId && Number.isSafeInteger(invoiceId) ? <OwnerInvoice api={api} qrApi={qrApi} id={invoiceId} /> : <OwnerList api={api} qrApi={qrApi} />}
    </section>
  </AppShell>;
}

export function OwnerList({ api, qrApi }: { api: BillingApi; qrApi: QrApi }) {
  const [version, setVersion] = useState(0);
  const load = useSupportingLoad(() => api.myInvoices(), [api, version]);
  const [paying, setPaying] = useState<InvoiceSummary>();
  const [paid, setPaid] = useState<PaymentResult>();
  if (load.error) return <ErrorState title="Không tải được hóa đơn" description={message(load.error)} onRetry={load.retry} />;
  if (!load.data) return <LoadingState label="Đang tải hóa đơn…" />;
  const unpaid = load.data.filter((row) => row.status === 'ISSUED');
  return <>
    <header data-page-banner className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Cổng thông tin Horse Owner</p>
        <h1>Hóa đơn & thanh toán</h1>
        <p>Phí lưu chuồng, chăm sóc và huấn luyện ngựa của bạn, tính theo tháng. Bấm Thanh toán ở cuối mỗi hóa đơn để trả qua VNPay hoặc mã VietQR.</p>
      </div>
    </header>
    {paid && <AlertBanner feedback type="success" title={`Đã thanh toán hóa đơn ${paid.invoiceCode}.`}>{paid.message}</AlertBanner>}
    {paying && <PayInvoiceModal api={api} qrApi={qrApi} invoice={paying} onClose={() => setPaying(undefined)}
      onPaid={(result) => { setPaying(undefined); setPaid(result); setVersion((value) => value + 1); }} />}
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
        { key: 'pay', header: 'Thanh toán', align: 'right', nowrap: true, render: (row) => row.status === 'ISSUED'
          ? <span className={styles.payCell}>
            {invoiceDisplayStatus(row) === 'OVERDUE' && <StatusPill status="OVERDUE" />}
            <Button size="sm" onClick={() => { setPaid(undefined); setPaying(row); }} aria-label={`Thanh toán hóa đơn ${row.invoiceCode}`}>Thanh toán</Button>
          </span>
          : <StatusPill status={row.status} /> },
      ]} />
  </>;
}

/**
 * DEC-016 one invoice of the owner: details only. An unpaid invoice has the same "Thanh toán" button as the list, and it
 * opens the same pay popup (VNPay / MoMo / VietQR); an open VNPay link is cancelled or rechecked inside the popup.
 */
export function OwnerInvoice({ api, qrApi, id }: { api: BillingApi; qrApi: QrApi; id: number }) {
  const [version, setVersion] = useState(0);
  const load = useSupportingLoad(() => api.myInvoice(id), [api, id, version]);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<PaymentResult>();
  if (load.error) return <ErrorState title="Không tải được hóa đơn" description={message(load.error)} onRetry={load.retry} />;
  const detail = load.data;
  if (!detail) return <LoadingState label="Đang tải hóa đơn…" />;
  const { invoice } = detail;
  return <>
    <header data-page-banner className={styles.header}>
      <div>
        <p className={styles.eyebrow}><Link className={styles.link} to="/owner/invoices">← Hóa đơn & thanh toán</Link></p>
        <h1>{`Hóa đơn ${invoice.invoiceCode}`}</h1>
      </div>
      {invoice.status === 'ISSUED'
        ? <span className={styles.payCell}>
          {invoiceDisplayStatus(invoice) === 'OVERDUE' && <StatusPill status="OVERDUE" />}
          <Button onClick={() => { setPaid(undefined); setPaying(true); }} aria-label={`Thanh toán hóa đơn ${invoice.invoiceCode}`}>Thanh toán</Button>
        </span>
        : <StatusPill status={invoice.status} />}
    </header>
    {paid && <AlertBanner feedback type="success" title={`Đã thanh toán hóa đơn ${paid.invoiceCode}.`}>{paid.message}</AlertBanner>}
    {paying && <PayInvoiceModal api={api} qrApi={qrApi} invoice={invoice} onClose={() => { setPaying(false); setVersion((value) => value + 1); }}
      onPaid={(result) => { setPaying(false); setPaid(result); setVersion((value) => value + 1); }} />}
    <Card><InvoiceView detail={detail} showOwner={false} /></Card>
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
