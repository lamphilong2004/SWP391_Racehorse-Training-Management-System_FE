import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, LoadingState, MetricCard, Modal, SelectField, TextAreaField, TextField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { createBillingApi, currentMonth, monthLabel, SKIP_LABEL, STATUS_LABEL, viDate, viDateTime, vnd, type BillingApi, type GenerateResult, type InvoiceSummary, type Price } from './billingApi';
import { InvoiceView, StatusPill } from './InvoiceView';
import styles from './billing.module.css';

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thực hiện được thao tác. Hãy thử lại.';

/** DEC-016 Club Manager "Phí dịch vụ & hóa đơn": monthly invoices (/billing) and the price list (/billing/prices). */
export function BillingPage() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const token = authSession.read()?.accessToken;
  const api = useMemo(() => token ? createBillingApi(token, auth.handleApiError) : null, [token, auth.handleApiError]);
  if (!auth.user?.roles.includes('CLUB_MANAGER') || !api) return <AlertBanner type="danger" title="Chỉ Club Manager quản lý phí dịch vụ." />;
  const prices = pathname === '/billing/prices';
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Phí dịch vụ' }, { label: prices ? 'Bảng giá' : 'Hóa đơn' }]}>
    <section className={styles.stack}>
      <header data-page-banner className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Vận hành · Thanh toán</p>
          <h1>{prices ? 'Bảng giá dịch vụ' : 'Hóa đơn dịch vụ'}</h1>
          <p>Chủ ngựa trả phí lưu chuồng & chăm sóc theo ngày và phí huấn luyện theo buổi đã hoàn thành. Hóa đơn tháng được tính từ dữ liệu xếp chuồng và buổi tập thật, chủ ngựa thanh toán qua VNPay.</p>
        </div>
        <nav aria-label="Phí dịch vụ" className={styles.tabs}>
          <Link to="/billing" aria-current={!prices ? 'page' : undefined}>Hóa đơn</Link>
          <Link to="/billing/prices" aria-current={prices ? 'page' : undefined}>Bảng giá</Link>
        </nav>
      </header>
      {prices ? <PricesPanel api={api} /> : <InvoicesPanel api={api} />}
    </section>
  </AppShell>;
}

function PricesPanel({ api }: { api: BillingApi }) {
  const load = useSupportingLoad(() => api.prices(), [api]);
  const [saved, setSaved] = useState<Price[]>();
  const prices = saved ?? load.data;
  const [boarding, setBoarding] = useState('');
  const [training, setTraining] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (load.error && !prices) return <ErrorState title="Không tải được bảng giá" description={message(load.error)} onRetry={load.retry} />;
  if (!prices) return <LoadingState label="Đang tải bảng giá…" />;
  const parse = (value: string) => value.trim() === '' ? undefined : Number(value.replace(/[.,\s]/g, ''));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = { boardingCareDaily: parse(boarding), trainingSession: parse(training) };
    const values = [body.boardingCareDaily, body.trainingSession].filter((value) => value !== undefined) as number[];
    if (values.length === 0) { setError('Nhập ít nhất một giá mới.'); return; }
    if (values.some((value) => !Number.isInteger(value) || value < 1000 || value > 100_000_000)) { setError('Giá phải là số nguyên từ 1.000 đến 100.000.000 ₫.'); return; }
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { setSaved(await api.updatePrices(body)); setBoarding(''); setTraining(''); setNotice('Đã lưu bảng giá. Giá mới áp dụng cho hóa đơn phát hành từ bây giờ; hóa đơn đã phát hành giữ nguyên giá cũ.'); }
    catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <form className={styles.form} onSubmit={submit} noValidate>
    {notice && <AlertBanner feedback type="success" title={notice} />}
    <div className={styles.prices}>
      {prices.map((price) => <Card key={price.serviceCode} className={styles.price}>
        <h3>{price.label}</h3>
        <p>{`Đơn vị tính: ${price.unit}`}</p>
        <MetricCard label="Giá hiện hành" value={price.unitPrice == null ? 'Chưa đặt giá' : vnd(price.unitPrice)} unavailable={price.unitPrice == null}
          caption={price.updatedAt ? `Cập nhật ${viDateTime(price.updatedAt)} · ${price.updatedBy}` : 'Cần đặt giá trước khi phát hành hóa đơn'} />
        <TextField label="Giá mới (₫)" inputMode="numeric" placeholder={price.unitPrice == null ? 'Ví dụ 250000' : String(price.unitPrice)}
          value={price.serviceCode === 'BOARDING_CARE_DAILY' ? boarding : training}
          onChange={(event) => (price.serviceCode === 'BOARDING_CARE_DAILY' ? setBoarding : setTraining)(event.target.value)} />
      </Card>)}
    </div>
    {error && <AlertBanner feedback type="danger" title="Chưa lưu được bảng giá">{error}</AlertBanner>}
    <div className={styles.actions}><Button type="submit" disabled={busy}>Lưu bảng giá</Button></div>
  </form>;
}

function InvoicesPanel({ api }: { api: BillingApi }) {
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState(0);
  const load = useSupportingLoad(() => api.invoices(month, status), [api, month, status, version]);
  const [result, setResult] = useState<GenerateResult>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number>();
  const lock = useRef(false);
  const rows = load.data ?? [];
  const total = (list: InvoiceSummary[]) => list.reduce((sum, row) => sum + row.totalAmount, 0);
  const paid = rows.filter((row) => row.status === 'PAID');
  const unpaid = rows.filter((row) => row.status === 'ISSUED');
  const generate = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setResult(undefined);
    try { setResult(await api.generate(month)); setVersion((value) => value + 1); }
    catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className={styles.form}>
    <div className={styles.toolbar}>
      <TextField label="Tháng tính phí" type="month" value={month} max={currentMonth()} onChange={(event) => event.target.value && setMonth(event.target.value)} />
      <SelectField label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}
        options={[{ value: '', label: 'Tất cả' }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
      <Button onClick={generate} disabled={busy}>{`Phát hành hóa đơn ${monthLabel(month).toLowerCase()}`}</Button>
    </div>
    <p className={styles.hint}>Hệ thống tính cho từng ngựa đang ở chuồng trong tháng: số ngày lưu chuồng × giá ngày, số buổi tập đã hoàn thành × giá buổi. Tháng hiện tại được tính đến hôm nay. Ngựa đã có hóa đơn tháng này sẽ được bỏ qua.</p>
    {error && <AlertBanner feedback type="danger" title="Chưa phát hành được hóa đơn">{error}</AlertBanner>}
    {result && <AlertBanner feedback type={result.created.length ? 'success' : 'info'} title={`Đã phát hành ${result.created.length} hóa đơn (${viDate(result.periodStart)} – ${viDate(result.periodEnd)})`}>
      {result.skipped.length > 0 && <p>{`Bỏ qua: ${result.skipped.map((item) => `${item.horseName} (${SKIP_LABEL[item.reason] ?? item.reason})`).join('; ')}.`}</p>}
    </AlertBanner>}
    <div className={styles.summary}>
      <MetricCard label="Số hóa đơn" value={String(rows.length)} caption={monthLabel(month)} />
      <MetricCard label="Tổng phải thu" value={vnd(total(rows.filter((row) => row.status !== 'CANCELLED')))} />
      <MetricCard label="Đã thu" value={vnd(total(paid))} caption={`${paid.length} hóa đơn`} />
      <MetricCard label="Chờ thanh toán" value={vnd(total(unpaid))} caption={`${unpaid.length} hóa đơn`} />
    </div>
    {load.error ? <ErrorState title="Không tải được hóa đơn" description={message(load.error)} onRetry={load.retry} />
      : !load.data ? <LoadingState label="Đang tải hóa đơn…" />
        : <DataTable caption={`Hóa đơn ${monthLabel(month).toLowerCase()}`} rowKey={(row) => row.id} rows={rows} onRowClick={(row) => setOpenId(row.id)}
          empty={<EmptyState title="Chưa có hóa đơn" description="Bấm Phát hành hóa đơn để tính phí tháng này." />}
          columns={[
            { key: 'code', header: 'Mã hóa đơn', nowrap: true, render: (row) => row.invoiceCode },
            { key: 'horse', header: 'Ngựa', render: (row) => `${row.horse.name} (${row.horse.horseCode})` },
            { key: 'owner', header: 'Chủ ngựa', render: (row) => row.owner.fullName },
            { key: 'period', header: 'Kỳ', nowrap: true, render: (row) => `${viDate(row.periodStart)} – ${viDate(row.periodEnd)}` },
            { key: 'total', header: 'Tổng tiền', align: 'right', nowrap: true, render: (row) => <span className={styles.amount}>{vnd(row.totalAmount)}</span> },
            { key: 'status', header: 'Trạng thái', render: (row) => <StatusPill status={row.status} /> },
            { key: 'action', header: '', render: (row) => <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); setOpenId(row.id); }}>Xem</Button> },
          ]} />}
    {openId && <ManagerInvoiceModal api={api} id={openId} onClose={() => setOpenId(undefined)} onChanged={() => setVersion((value) => value + 1)} />}
  </div>;
}

function ManagerInvoiceModal({ api, id, onClose, onChanged }: { api: BillingApi; id: number; onClose: () => void; onChanged: () => void }) {
  const [version, setVersion] = useState(0);
  const load = useSupportingLoad(() => api.invoice(id), [api, id, version]);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = async (action: () => Promise<unknown>, done: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { const value = await action(); setNotice(typeof value === 'object' && value && 'message' in value ? String((value as { message: string }).message) : done); setVersion((v) => v + 1); onChanged(); setCancelling(false); }
    catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const detail = load.data;
  const pending = detail?.payments.some((payment) => payment.status === 'PENDING');
  return <Modal open size="lg" title={detail ? `Hóa đơn ${detail.invoice.invoiceCode}` : 'Hóa đơn'} onClose={busy ? () => undefined : onClose}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Đóng</Button>
      {detail && pending && <Button variant="secondary" disabled={busy} onClick={() => run(() => api.managerCheck(id), 'Đã kiểm tra với VNPay.')}>Kiểm tra thanh toán</Button>}
      {detail?.invoice.status === 'ISSUED' && !cancelling && <Button variant="danger" disabled={busy} onClick={() => setCancelling(true)}>Hủy hóa đơn</Button>}
      {cancelling && <Button variant="danger" disabled={busy || !reason.trim()} onClick={() => run(() => api.cancel(id, reason.trim()), 'Đã hủy hóa đơn. Có thể phát hành lại cho tháng này.')}>Xác nhận hủy</Button>}
    </>}>
    {load.error ? <ErrorState title="Không tải được hóa đơn" description={message(load.error)} onRetry={load.retry} />
      : !detail ? <LoadingState label="Đang tải hóa đơn…" />
        : <div className={styles.form}>
          {notice && <AlertBanner feedback type="success" title={notice} />}
          <InvoiceView detail={detail} showOwner />
          {cancelling && <TextAreaField label="Lý do hủy (bắt buộc)" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />}
          {error && <AlertBanner feedback type="danger" title="Không thực hiện được">{error}</AlertBanner>}
        </div>}
  </Modal>;
}
