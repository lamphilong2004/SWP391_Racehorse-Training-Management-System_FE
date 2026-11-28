import { useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, DataTable, EmptyState, ErrorState, Icon, LoadingState, TextField, type IconName } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { createBillingApi, monthLabel, viDate, vnd, type BillingApi, type HorseEstimate, type OwnerEstimate, type Price } from './billingApi';
import styles from './ownerPrices.module.css';

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Không tải được dữ liệu này.';
const MAX_DAYS = 31;
const MAX_SESSIONS = 100;

/** What each priced service covers and how it is counted (DEC-016: day rate + completed-session rate). */
const SERVICES: Record<Price['serviceCode'], { icon: IconName; includes: string[]; rule: string }> = {
  BOARDING_CARE_DAILY: {
    icon: 'warehouse',
    includes: ['Một ô chuồng riêng trên sơ đồ chuồng', 'Thức ăn và dinh dưỡng theo khẩu phần', 'Chăm sóc hằng ngày của Groom', 'Theo dõi sức khỏe thường ngày'],
    rule: 'Tính theo số ngày ngựa ở ô chuồng. Ngày vào ô được tính; trả ô thì dừng tính.',
  },
  TRAINING_SESSION: {
    icon: 'trending-up',
    includes: ['Buổi tập theo chương trình của Trainer', 'Work Rider thực hiện buổi tập', 'Groom kiểm tra trước buổi tập', 'Theo dõi chỉ số trong lúc tập'],
    rule: 'Chỉ tính buổi đã hoàn thành. Buổi bị hủy, bị chặn hoặc dừng giữa chừng không tính.',
  },
};
const PRESETS = [
  { label: 'Chỉ lưu chuồng', days: 30, sessions: 0 },
  { label: 'Tập nhẹ · 2 buổi/tuần', days: 30, sessions: 8 },
  { label: 'Tập đều · 3 buổi/tuần', days: 30, sessions: 12 },
  { label: 'Tập nặng · 5 buổi/tuần', days: 30, sessions: 20 },
];
const STEPS = [
  { title: 'Gửi ngựa vào ô chuồng', text: 'Phí lưu chuồng tính từ ngày ngựa vào ô. Bạn nhận thông báo kèm giá ngay khi ngựa được nhận.' },
  { title: 'Theo dõi phí tạm tính', text: 'Mỗi ngày xem số ngày ở chuồng và số buổi tập đã hoàn thành ở cuối trang này.' },
  { title: 'Nhận hóa đơn tháng', text: 'Club Manager phát hành hóa đơn theo tháng; số tiền bằng đúng phí tạm tính.' },
  { title: 'Thanh toán trong 7 ngày', text: 'Trả bằng thẻ qua VNPay hoặc quét mã VietQR ở trang Hóa đơn & thanh toán.' },
];

/** Horse Owner "Bảng giá dịch vụ" (/owner/prices): public price list, estimator and this month's running cost. */
export function OwnerPricesPage() {
  const auth = useAuth();
  const token = authSession.read()?.accessToken;
  const api = token ? createBillingApi(token, auth.handleApiError) : null;
  if (!auth.user?.roles.includes('HORSE_OWNER') || !api) return <AlertBanner type="danger" title="Đăng nhập bằng tài khoản Horse Owner để xem bảng giá." />;
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role: 'HORSE_OWNER' }} breadcrumb={[{ label: 'Bảng giá dịch vụ' }]}>
    <OwnerPrices api={api} />
  </AppShell>;
}

export function OwnerPrices({ api }: { api: Pick<BillingApi, 'myEstimate'> }) {
  const load = useSupportingLoad(() => api.myEstimate(), [api]);
  return <section className={styles.page}>
    <header data-page-banner className={styles.hero}>
      <p className={styles.eyebrow}>Cổng thông tin Horse Owner</p>
      <h1>Bảng giá dịch vụ</h1>
      <p>Giá công khai của câu lạc bộ. Bạn biết trước chi phí khi gửi ngựa, theo dõi phí phát sinh mỗi ngày, và hóa đơn cuối tháng khớp đúng số tạm tính.</p>
    </header>
    {load.error ? <ErrorState title="Không tải được bảng giá" description={message(load.error)} onRetry={load.retry} />
      : !load.data ? <LoadingState label="Đang tải bảng giá…" /> : <PriceContent data={load.data} />}
  </section>;
}

function PriceContent({ data }: { data: OwnerEstimate }) {
  const boarding = data.prices.find((price) => price.serviceCode === 'BOARDING_CARE_DAILY')?.unitPrice ?? null;
  const training = data.prices.find((price) => price.serviceCode === 'TRAINING_SESSION')?.unitPrice ?? null;
  const priced = boarding != null && training != null;
  return <>
    {!priced && <AlertBanner type="info" title="Club Manager chưa công bố đủ bảng giá." />}
    <div className={styles.cards}>
      {data.prices.map((price) => <PriceCard key={price.serviceCode} price={price} />)}
    </div>
    <aside className={styles.excluded}>
      <Icon name="info" size={18} />
      <p><strong>Không nằm trong bảng giá này:</strong> khám và điều trị thú y, đóng móng, vận chuyển, đăng ký thi đấu. Hóa đơn dịch vụ của hệ thống chỉ gồm 2 khoản ở trên.</p>
    </aside>
    <section className={styles.panel} aria-labelledby="owner-price-steps">
      <h2 id="owner-price-steps">Tính phí và thanh toán thế nào?</h2>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => <li key={step.title}><span className={styles.stepNo}>{index + 1}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></li>)}
      </ol>
    </section>
    {priced && <Estimator boarding={boarding} training={training} />}
    <RunningCost data={data} />
  </>;
}

function PriceCard({ price }: { price: Price }) {
  const service = SERVICES[price.serviceCode];
  return <article className={styles.card}>
    <div className={styles.cardHead}>
      <span className={styles.cardIcon} aria-hidden="true"><Icon name={service.icon} size={22} /></span>
      <h2>{price.label}</h2>
    </div>
    <p className={styles.price}><strong>{vnd(price.unitPrice)}</strong><span>{` / ${price.unit}`}</span></p>
    <ul className={styles.includes} aria-label={`${price.label} bao gồm`}>
      {service.includes.map((item) => <li key={item}><Icon name="check" size={16} />{item}</li>)}
    </ul>
    <p className={styles.rule}>{service.rule}</p>
  </article>;
}

/** Monthly estimate the owner can try before sending a horse: days in the stable and completed sessions. */
function Estimator({ boarding, training }: { boarding: number; training: number }) {
  const [days, setDays] = useState('30');
  const [sessions, setSessions] = useState('12');
  const dayCount = Number(days); const sessionCount = Number(sessions);
  const error = !Number.isInteger(dayCount) || dayCount < 0 || dayCount > MAX_DAYS ? `Số ngày từ 0 đến ${MAX_DAYS}.`
    : !Number.isInteger(sessionCount) || sessionCount < 0 || sessionCount > MAX_SESSIONS ? `Số buổi từ 0 đến ${MAX_SESSIONS}.` : '';
  const boardingTotal = dayCount * boarding; const trainingTotal = sessionCount * training;
  const total = boardingTotal + trainingTotal;
  return <section className={`${styles.panel} ${styles.estimator}`} aria-labelledby="owner-cost-estimator">
    <div className={styles.estimatorInput}>
      <h2 id="owner-cost-estimator">Ước tính chi phí 1 tháng</h2>
      <p className={styles.muted}>Chọn nhanh một mức tập hoặc tự nhập số ngày và số buổi.</p>
      <div className={styles.presets} role="group" aria-label="Mức tập gợi ý">
        {PRESETS.map((preset) => <button key={preset.label} type="button" className={styles.preset}
          aria-pressed={dayCount === preset.days && sessionCount === preset.sessions}
          onClick={() => { setDays(String(preset.days)); setSessions(String(preset.sessions)); }}>{preset.label}</button>)}
      </div>
      <div className={styles.fields}>
        <TextField label="Số ngày ở chuồng" type="number" min={0} max={MAX_DAYS} value={days} onChange={(event) => setDays(event.target.value)} />
        <TextField label="Số buổi tập hoàn thành" type="number" min={0} max={MAX_SESSIONS} value={sessions} onChange={(event) => setSessions(event.target.value)} />
      </div>
    </div>
    <div className={styles.estimateBox} aria-live="polite">
      {error ? <p className={styles.estimateError} role="alert">{error}</p> : <>
        <p className={styles.muted}>Chi phí ước tính</p>
        <p className={styles.estimateTotal}>{`≈ ${vnd(total)}`}</p>
        <dl className={styles.breakdown}>
          <div><dt>{`Lưu chuồng · ${dayCount} ngày × ${vnd(boarding)}`}</dt><dd>{vnd(boardingTotal)}</dd></div>
          <div><dt>{`Huấn luyện · ${sessionCount} buổi × ${vnd(training)}`}</dt><dd>{vnd(trainingTotal)}</dd></div>
        </dl>
        {total > 0 && <div className={styles.bar} aria-hidden="true">
          <span style={{ width: `${(boardingTotal / total) * 100}%` }} /><span style={{ width: `${(trainingTotal / total) * 100}%` }} />
        </div>}
      </>}
      <p className={styles.note}>Chỉ để tham khảo. Hóa đơn tính theo số ngày ngựa thực ở chuồng và số buổi tập thực hoàn thành.</p>
    </div>
  </section>;
}

function RunningCost({ data }: { data: OwnerEstimate }) {
  const { horses, total, billingMonth, asOf, prices } = data;
  const boarding = prices.find((price) => price.serviceCode === 'BOARDING_CARE_DAILY')?.unitPrice ?? null;
  const training = prices.find((price) => price.serviceCode === 'TRAINING_SESSION')?.unitPrice ?? null;
  return <section className={styles.panel} aria-labelledby="owner-running-cost">
    <div className={styles.panelHead}>
      <div>
        <h2 id="owner-running-cost">{`Phí tạm tính ${monthLabel(billingMonth).toLowerCase()}`}</h2>
        <p className={styles.muted}>{`Ngựa của bạn, tính đến hôm nay (${viDate(asOf)}) theo đúng cách tính hóa đơn. Đây chưa phải hóa đơn.`}</p>
      </div>
      {horses.length > 0 && <p className={styles.runningTotal}><span>Tổng tạm tính</span><strong>{vnd(total)}</strong></p>}
    </div>
    <DataTable caption="Phí tạm tính theo ngựa" rowKey={(row) => row.horseId} rows={horses}
      empty={<EmptyState title="Chưa có ngựa nào ở chuồng tháng này" description="Khi ngựa của bạn được xếp ô chuồng, phí tạm tính sẽ hiện ở đây." />}
      columns={[
        { key: 'horse', header: 'Ngựa', render: (row) => <span className={styles.twoLine}><strong>{row.horseName}</strong><small>{row.horseCode}</small></span> },
        { key: 'period', header: 'Kỳ tạm tính', nowrap: true, render: period },
        { key: 'boarding', header: 'Lưu chuồng & chăm sóc', align: 'right', render: (row) => usage(row.boardingDays, 'ngày', boarding, row.boardingAmount) },
        { key: 'training', header: 'Huấn luyện', align: 'right', render: (row) => usage(row.completedSessions, 'buổi', training, row.trainingAmount) },
        { key: 'total', header: 'Tạm tính', align: 'right', nowrap: true, render: (row) => <strong className={styles.amount}>{vnd(row.total)}</strong> },
      ]} />
    <p className={styles.muted}>Hóa đơn đã phát hành và thanh toán nằm ở <Link className={styles.link} to="/owner/invoices">Hóa đơn & thanh toán</Link>.</p>
  </section>;
}

function period(row: HorseEstimate) {
  if (row.from > row.to) return `Đã có hóa đơn đến ${viDate(row.invoicedUntil)}`;
  return <span className={styles.twoLine}>{`${viDate(row.from)} – ${viDate(row.to)}`}
    {row.invoicedUntil && <small>{`Đã có hóa đơn đến ${viDate(row.invoicedUntil)}`}</small>}</span>;
}

function usage(count: number, unit: string, price: number | null, amount: number | null) {
  return <span className={styles.amount}>{price == null ? `${count} ${unit}` : `${count} ${unit} × ${vnd(price)} = ${vnd(amount)}`}</span>;
}
