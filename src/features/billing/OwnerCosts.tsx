import { useState } from 'react';
import { AlertBanner, Card, DataTable, EmptyState, ErrorState, LoadingState, TextField } from '../../design-system';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { monthLabel, viDate, vnd, type BillingApi, type HorseEstimate } from './billingApi';
import styles from './billing.module.css';

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Không tải được dữ liệu này.';
const MAX_DAYS = 31;
const MAX_SESSIONS = 100;

/**
 * Price transparency for Horse Owners (DEC-016 update, 2026-11-28): the club price list, a monthly cost estimator and
 * the running cost of the owner's horses this month, computed by the server with the same rules as the invoice.
 */
export function OwnerCosts({ api }: { api: Pick<BillingApi, 'myEstimate'> }) {
  const load = useSupportingLoad(() => api.myEstimate(), [api]);
  if (load.error) return <ErrorState title="Không tải được bảng giá và phí tạm tính" description={message(load.error)} onRetry={load.retry} />;
  if (!load.data) return <LoadingState label="Đang tải bảng giá và phí tạm tính…" />;
  const { prices, horses, total, billingMonth, asOf } = load.data;
  const boarding = prices.find((price) => price.serviceCode === 'BOARDING_CARE_DAILY')?.unitPrice ?? null;
  const training = prices.find((price) => price.serviceCode === 'TRAINING_SESSION')?.unitPrice ?? null;
  const priced = boarding != null && training != null;
  return <div className={styles.costGrid}>
    <Card title="Bảng giá dịch vụ của CLB">
      <div className={styles.priceCard}>
        <div className={styles.form}>
        {priced
          ? <dl className={styles.priceList}>
            {prices.map((price) => <div key={price.serviceCode}><dt>{price.label}</dt><dd><strong>{vnd(price.unitPrice)}</strong>{` / ${price.unit}`}</dd></div>)}
          </dl>
          : <AlertBanner type="info" title="Club Manager chưa công bố đủ bảng giá." />}
        <p className={styles.hint}>Lưu chuồng & chăm sóc gồm chỗ ở, thức ăn và chăm sóc hằng ngày, tính theo số ngày ngựa ở ô chuồng. Huấn luyện chỉ tính buổi đã hoàn thành; buổi bị hủy hoặc gián đoạn không tính. Đổi giá chỉ áp dụng cho hóa đơn phát hành sau đó.</p>
        </div>
        {priced && <Estimator boarding={boarding} training={training} />}
      </div>
    </Card>
    <Card title={`Phí tạm tính ${monthLabel(billingMonth).toLowerCase()}`}>
      <div className={styles.form}>
        <p className={styles.hint}>{`Tính đến hôm nay (${viDate(asOf)}) theo đúng cách tính hóa đơn. Đây chưa phải hóa đơn: số tiền tăng theo số ngày ngựa ở chuồng và số buổi tập hoàn thành.`}</p>
        <DataTable caption="Phí tạm tính theo ngựa" rowKey={(row) => row.horseId} rows={horses}
          empty={<EmptyState title="Chưa có ngựa nào ở chuồng tháng này" description="Khi ngựa của bạn được xếp ô chuồng, phí tạm tính sẽ hiện ở đây." />}
          columns={[
            { key: 'horse', header: 'Ngựa', render: (row) => <span className={styles.horseCell}><strong>{row.horseName}</strong><small>{row.horseCode}</small></span> },
            { key: 'period', header: 'Kỳ tạm tính', nowrap: true, render: period },
            { key: 'boarding', header: 'Lưu chuồng & chăm sóc', align: 'right', render: (row) => usage(row.boardingDays, 'ngày', boarding, row.boardingAmount) },
            { key: 'training', header: 'Huấn luyện', align: 'right', render: (row) => usage(row.completedSessions, 'buổi', training, row.trainingAmount) },
            { key: 'total', header: 'Tạm tính', align: 'right', nowrap: true, render: (row) => <span className={styles.amount}>{vnd(row.total)}</span> },
          ]} />
        {horses.length > 0 && <p className={styles.costTotal}>Tổng tạm tính <strong className={styles.amount}>{vnd(total)}</strong></p>}
      </div>
    </Card>
  </div>;
}

function period(row: HorseEstimate) {
  if (row.from > row.to) return `Đã có hóa đơn đến ${viDate(row.invoicedUntil)}`;
  return <span className={styles.horseCell}>{`${viDate(row.from)} – ${viDate(row.to)}`}
    {row.invoicedUntil && <small>{`Đã có hóa đơn đến ${viDate(row.invoicedUntil)}`}</small>}</span>;
}

function usage(count: number, unit: string, price: number | null, amount: number | null) {
  return <span className={styles.amount}>{price == null ? `${count} ${unit}` : `${count} ${unit} × ${vnd(price)} = ${vnd(amount)}`}</span>;
}

/** Monthly estimate the owner can try before sending a horse: days in the stable and completed sessions. */
function Estimator({ boarding, training }: { boarding: number; training: number }) {
  const [days, setDays] = useState('30');
  const [sessions, setSessions] = useState('12');
  const dayCount = Number(days); const sessionCount = Number(sessions);
  const error = !Number.isInteger(dayCount) || dayCount < 0 || dayCount > MAX_DAYS ? `Số ngày từ 0 đến ${MAX_DAYS}.`
    : !Number.isInteger(sessionCount) || sessionCount < 0 || sessionCount > MAX_SESSIONS ? `Số buổi từ 0 đến ${MAX_SESSIONS}.` : '';
  return <section className={styles.estimator} aria-labelledby="owner-cost-estimator">
    <h3 id="owner-cost-estimator" className={styles.estimatorTitle}>Ước tính chi phí 1 tháng</h3>
    <div className={styles.estimatorFields}>
      <TextField label="Số ngày ở chuồng" type="number" min={0} max={MAX_DAYS} value={days} onChange={(event) => setDays(event.target.value)} />
      <TextField label="Số buổi tập hoàn thành" type="number" min={0} max={MAX_SESSIONS} value={sessions} onChange={(event) => setSessions(event.target.value)} />
    </div>
    {error
      ? <p className={styles.hint} role="alert">{error}</p>
      : <p className={styles.estimateResult} aria-live="polite">
        <span>{`${dayCount} ngày × ${vnd(boarding)} + ${sessionCount} buổi × ${vnd(training)}`}</span>
        <strong className={styles.amount}>{`≈ ${vnd(dayCount * boarding + sessionCount * training)}`}</strong>
      </p>}
    <p className={styles.hint}>Chỉ để tham khảo. Hóa đơn tính theo số ngày ngựa thực ở chuồng và số buổi tập thực hoàn thành.</p>
  </section>;
}
