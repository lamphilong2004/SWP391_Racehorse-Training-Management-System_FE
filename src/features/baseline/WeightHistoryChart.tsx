import { AlertBanner, Card, ChartContainer } from '../../design-system';
import { prepareWeightHistory, weightAxisTicks, type WeightHistoryEntry } from './weightHistory';
import styles from './WeightHistoryChart.module.css';

export type { WeightHistoryEntry } from './weightHistory';

function axisLabel(timestamp: number, duration: number) {
  const options: Intl.DateTimeFormatOptions = duration < 36 * 60 * 60 * 1000
    ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }
    : { day: '2-digit', month: '2-digit', ...(duration > 365 * 24 * 60 * 60 * 1000 ? { year: '2-digit' as const } : {}), timeZone: 'Asia/Ho_Chi_Minh' };
  return new Intl.DateTimeFormat('vi-VN', options).format(new Date(timestamp));
}

function recordedLabel(timestamp: number) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(timestamp));
}

export function WeightHistoryChart({
  records,
  title = 'Lịch sử cân nặng',
  showHistory = true,
}: {
  records: readonly WeightHistoryEntry[];
  title?: string;
  showHistory?: boolean;
}) {
  const { records: sorted, history, invalidCount } = prepareWeightHistory(records);
  const timestamps = sorted.map((record) => record.timestamp);
  const first = timestamps[0], last = timestamps[timestamps.length - 1];
  const duration = first === undefined || last === undefined ? 0 : last - first;
  const xAxisTicks = timestamps.length > 0 && duration === 0
    ? [{ value: timestamps[0], label: axisLabel(timestamps[0], 0) }]
    : timestamps.length > 1
      ? [0, 0.5, 1].map((fraction) => {
        const value = first + duration * fraction;
        return { value, label: axisLabel(value, duration) };
      })
      : [];
  const chartRecords = sorted;

  return <div className={styles.root}>
    {invalidCount > 0 && <AlertBanner type="warning" title="Một số bản ghi cân nặng có dữ liệu thời gian hoặc cân nặng không hợp lệ nên không được vẽ." />}
    <ChartContainer
      title={title}
      seriesLabel="Cân nặng (kg)"
      values={chartRecords.map((record) => record.weightKg)}
      xValues={timestamps}
      xAxisTicks={xAxisTicks}
      xLabels={[]}
      yTicks={weightAxisTicks(chartRecords.map((record) => record.weightKg))}
      emptyTitle="Chưa có bản ghi cân nặng"
      emptyDescription="Các lần đo sẽ xuất hiện tại đây sau khi được ghi nhận."
    />
    {showHistory && sorted.length > 0 && <Card title="Các lần ghi nhận">
      <ol aria-label="Lịch sử cân nặng" className={styles.historyList}>
        {history.map((record, index) => (
          <li key={`${record.timestamp}-${record.weightKg}-${index}`} className={styles.historyItem}>
            <strong>{record.weightKg} kg</strong>
            <time dateTime={record.recordedAt}>{recordedLabel(record.timestamp)}</time>
          </li>
        ))}
      </ol>
    </Card>}
  </div>;
}
