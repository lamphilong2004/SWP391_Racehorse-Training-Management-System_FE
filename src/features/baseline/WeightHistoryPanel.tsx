import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertBanner, Button, Card, ErrorState, LoadingState, TextField } from '../../design-system';
import { clubDateTime, parseClubDateTime } from '../../shared/clubCalendar';
import { ApiError } from '../../shared/auth/authApi';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createBaselineApi, validateWeight, type WeightRecord } from './baselineApi';
import { WeightHistoryChart } from './WeightHistoryChart';
import flowStyles from '../main-flows/flow.module.css';
import horseStyles from '../horses/shared/horses.module.css';

function isConfirmedRecord(record: WeightRecord | null | undefined, horseId: number, requestedWeight: number) {
  return Boolean(record
    && Number.isSafeInteger(record.id) && record.id > 0
    && record.horseId === horseId
    && validateWeight(String(record.weightKg))
    && Math.round(record.weightKg * 100) === Math.round(requestedWeight * 100)
    && Number.isFinite(Date.parse(record.recordedAt)));
}

export function WeightHistoryPanel({ horseId, canRecord, onSaved }: { horseId: number; canRecord: boolean; onSaved?: () => void }) {
  return <WeightHistoryContent key={horseId} horseId={horseId} canRecord={canRecord} onSaved={onSaved} />;
}

function WeightHistoryContent({ horseId, canRecord, onSaved }: { horseId: number; canRecord: boolean; onSaved?: () => void }) {
  const request = useFlowRequest();
  const api = useMemo(() => createBaselineApi(request), [request]);
  const [page, setPage] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    const result = await api.weights(idOf(horseId), signal, page);
    if (!result || !Array.isArray(result.items) || result.page !== page
      || !Number.isSafeInteger(result.size) || result.size < 1
      || !Number.isSafeInteger(result.totalElements) || result.totalElements < 0
      || result.items.length > result.size || page * result.size + result.items.length > result.totalElements) {
      throw new Error('Phản hồi lịch sử cân nặng không đúng định dạng.');
    }
    return result;
  }, [api, horseId, page]);
  const history = useResource(load);
  const terminalError = history.errorCause instanceof ApiError && (history.errorCause.status === 403 || history.errorCause.status === 404);
  const [weight, setWeight] = useState('');
  const [recordedAt, setRecordedAt] = useState(() => clubDateTime());
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<WeightRecord>();
  const pending = useRef(false);
  const date = parseClubDateTime(recordedAt);
  const dateError = recordedAt && !date
    ? 'Nhập ngày giờ ghi nhận hợp lệ theo giờ Việt Nam.'
    : date && date.getTime() > now ? 'Không chọn thời điểm trong tương lai.' : undefined;
  const weightError = weight && !validateWeight(weight)
    ? 'Nhập cân nặng lớn hơn 0, tối đa 9999.99 kg và không quá hai chữ số thập phân.' : undefined;
  const valid = validateWeight(weight) && !!date;

  async function save() {
    if (pending.current) return;
    const submittedAt = Date.now();
    setNow(submittedAt);
    const submittedDate = parseClubDateTime(recordedAt);
    if (!validateWeight(weight) || !submittedDate || submittedDate.getTime() > submittedAt) return;
    pending.current = true;
    setSaving(true);
    setError('');
    setSaved(undefined);
    try {
      const requestedWeight = Number(weight);
      const result = await api.addWeight(horseId, { weightKg: requestedWeight, recordedAt: submittedDate.toISOString() });
      if (!isConfirmedRecord(result, horseId, requestedWeight)) {
        throw new Error('Máy chủ chưa xác nhận đã lưu bản ghi cân nặng. Hãy tải lại lịch sử trước khi thử lại.');
      }
      setSaved(result);
      setWeight('');
      setRecordedAt(clubDateTime());
      if (page === 0) history.reload();
      else setPage(0);
      onSaved?.();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return <section aria-label="Lịch sử cân nặng">
    {canRecord && !terminalError && <Card title="Ghi nhận cân nặng định kỳ">
      {error && <AlertBanner feedback type="danger" title="Chưa ghi nhận được cân nặng">{error}</AlertBanner>}
      {saved && <AlertBanner feedback type="success" title="Đã ghi nhận cân nặng">{saved.weightKg} kg · {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(saved.recordedAt))}</AlertBanner>}
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving} className={flowStyles.fieldset}>
          <div className={flowStyles.fields}>
            <TextField
              label="Ngày giờ ghi nhận"
              type="datetime-local"
              required
              value={recordedAt}
              error={dateError}
              helperText="Giờ Việt Nam; mặc định là thời điểm hiện tại."
              onChange={(event) => { setRecordedAt(event.target.value); setNow(Date.now()); }}
            />
            <TextField
              label="Cân nặng (kg)"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="9999.99"
              step="0.01"
              required
              value={weight}
              error={weightError}
              onChange={(event) => setWeight(event.target.value)}
            />
          </div>
          <Button type="submit" loading={saving} disabled={!valid}>
            {saving ? 'Đang lưu…' : 'Lưu cân nặng'}
          </Button>
        </fieldset>
      </form>
    </Card>}
    {history.pending && <LoadingState label="Đang tải lịch sử cân nặng…" />}
    {history.error && <ErrorState title="Không tải được lịch sử cân nặng" description={history.error} onRetry={terminalError ? undefined : history.reload} />}
    {history.data && <>
      <WeightHistoryChart records={history.data.items} title="Lịch sử cân nặng — trang hiện tại" />
      <nav aria-label="Phân trang lịch sử cân nặng" className={horseStyles.registryPagination}>
        <span role="status">
          Trang {history.data.page + 1} / {Math.max(1, Math.ceil(history.data.totalElements / history.data.size))}
          {' · '}{history.data.totalElements ? history.data.page * history.data.size + 1 : 0}–{history.data.page * history.data.size + history.data.items.length} / {history.data.totalElements} bản ghi
        </span>
        <div>
          <Button variant="secondary" disabled={saving || page === 0} onClick={() => setPage((value) => value - 1)}>Trước</Button>
          <Button variant="secondary" disabled={saving || (page + 1) * history.data.size >= history.data.totalElements} onClick={() => setPage((value) => value + 1)}>Sau</Button>
        </div>
      </nav>
    </>}
  </section>;
}
