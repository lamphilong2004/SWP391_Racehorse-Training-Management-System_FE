import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, ChartContainer, DataTable, EmptyState, ErrorState, LoadingState, MetricCard, StatusBadge, TextField } from '../../design-system';
import { evaluationPath } from '../../app/routePaths';
import type { EvaluationApi } from './api';
import { metric, RESULT_LABELS, type PerformancePoint } from './models';

/** Plots one server value per session in date order; a series is drawn only when every returned session carries it. */
function SessionSeries({ rows, title, label, unit, pick, step }: { rows: PerformancePoint[]; title: string; label: string; unit: string; pick: (row: PerformancePoint) => number | null | undefined; step: number }) {
  const values = rows.map(pick);
  const complete = values.length > 0 && values.every((value) => typeof value === 'number' && Number.isFinite(value));
  const series = complete ? (values as number[]) : [];
  const min = series.length ? Math.floor(Math.min(...series) / step) * step : 0;
  const max = series.length ? Math.max(Math.ceil(Math.max(...series) / step) * step, min + step) : step;
  return <ChartContainer title={title} seriesLabel={`${label} (${unit}) theo buổi tập`} values={series} yTicks={[max, (max + min) / 2, min]}
    xLabels={series.length ? [...new Set([rows[0].date, rows.at(-1)!.date])] : []}
    emptyTitle={`Chưa có chuỗi dữ liệu ${label.toLowerCase()} đầy đủ`} emptyDescription={`Có ít nhất một buổi tập chưa ghi nhận ${label.toLowerCase()}.`} />;
}

/** Only contract fields are shown: no invented recovery, phase filters, top-speed history or aggregates. */
export function PerformanceHistory({ horseId, api, onError }: { horseId: number; api: EvaluationApi; onError: (error: unknown) => boolean }) {
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ rows?: PerformancePoint[]; error?: string }>({});
  const [validation, setValidation] = useState('');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.performance(horseId, range, controller.signal).then((rows) => {
      if (active) setState({ rows });
    }).catch((error: unknown) => { if (active && !onError(error)) setState({ error: error instanceof Error ? error.message : 'Không tải được lịch sử.' }); });
    return () => { active = false; controller.abort(); };
  }, [horseId, api, range, attempt, onError]);
  return <div className="evaluation-stack"><h2 className="text-h2">Lịch sử thành tích</h2>
    <form className="evaluation-filters" noValidate onSubmit={(event) => {
      event.preventDefault();
      if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) { setValidation('Nhập khoảng ngày hợp lệ; ngày bắt đầu không được sau ngày kết thúc.'); return; }
      setValidation(''); setState({}); setRange({ from: from || undefined, to: to || undefined });
    }}><TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} error={validation || undefined} /><Button type="submit">Áp dụng</Button></form>
    {state.error ? <ErrorState title="Không tải được lịch sử" description={state.error} onRetry={() => { setState({}); setAttempt(attempt + 1); }} /> : !state.rows ? <LoadingState label="Đang tải lịch sử thành tích…" /> :
      <><div className="evaluation-metrics">
        <MetricCard label="Số buổi tập" value={String(state.rows.length)} caption={`${state.rows.filter((row) => row.status === 'COMPLETED').length} đã hoàn thành · ${state.rows.filter((row) => row.status === 'INTERRUPTED').length} bị gián đoạn`} />
        <MetricCard label="Đã đánh giá" value={String(state.rows.filter((row) => row.result).length)} caption="Đã có đánh giá của Trainer" />
        <MetricCard label="Chờ đánh giá" value={String(state.rows.filter((row) => !row.result).length)} caption="Chưa có đánh giá của Trainer" />
        <MetricCard label="Buổi tập gần nhất" value={state.rows.at(-1)?.date ?? 'Không có'} caption={state.rows.at(-1)?.sessionCode ?? 'Không có buổi tập trong khoảng này'} />
      </div>
      <div className="evaluation-charts">
        <SessionSeries rows={state.rows} title="Nhịp tim cao nhất" label="Nhịp tim cao nhất" unit="bpm" step={20} pick={(row) => row.maxHeartRate} />
        <SessionSeries rows={state.rows} title="Tốc độ trung bình" label="Tốc độ trung bình" unit="km/h" step={10} pick={(row) => row.avgSpeedKmh} />
      </div>
      <Card title="Lịch sử buổi tập"><div className="evaluation-table"><DataTable<PerformancePoint> caption="Lịch sử buổi tập, mới nhất trước" rowKey={(row) => row.sessionId} rows={[...state.rows].reverse()} empty={<EmptyState title="Chưa có lịch sử thành tích" description="Không có buổi tập nào trong khoảng thời gian này." />} columns={[
        { key: 'date', header: 'Ngày', render: (row) => row.date },
        { key: 'session', header: 'Buổi tập', render: (row) => <Link to={evaluationPath(row.sessionId)}>{row.sessionCode}</Link> },
        { key: 'status', header: 'Trạng thái', render: (row) => <StatusBadge family="session" status={row.status} /> },
        { key: 'distance', header: 'Quãng đường', render: (row) => metric(row.totalDistanceM, 'm') },
        { key: 'duration', header: 'Thời lượng', render: (row) => metric(row.durationMin, 'phút') },
        { key: 'speed', header: 'Tốc độ trung bình', render: (row) => metric(row.avgSpeedKmh, 'km/h') },
        { key: 'hr', header: 'Nhịp tim cao nhất', render: (row) => metric(row.maxHeartRate, 'bpm') },
        { key: 'result', header: 'Đánh giá', render: (row) => row.result ? RESULT_LABELS[row.result] : 'Chờ đánh giá' },
      ]} /></div></Card></>}
    <p className="text-caption">Số liệu lấy từ máy chủ. Hệ thống chưa cung cấp thời gian hồi phục và lịch sử tốc độ tối đa. Cách cộng dồn quãng đường đang chờ phê duyệt.</p>
  </div>;
}
