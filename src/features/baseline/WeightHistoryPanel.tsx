import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertBanner, Button, Card, ErrorState, LoadingState, TextField } from '../../design-system';
import { clubDateTime, parseClubDateTime } from '../../shared/clubCalendar';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createBaselineApi, validateWeight, type WeightRecord } from './baselineApi';
import { WeightHistoryChart } from './WeightHistoryChart';
import flowStyles from '../main-flows/flow.module.css';

function isConfirmedRecord(record: WeightRecord | null | undefined, horseId: number, requestedWeight: number) {
  return Boolean(record
    && Number.isSafeInteger(record.id) && record.id > 0
    && record.horseId === horseId
    && validateWeight(String(record.weightKg))
    && Math.round(record.weightKg * 100) === Math.round(requestedWeight * 100)
    && Number.isFinite(Date.parse(record.recordedAt)));
}

export function WeightHistoryPanel({ horseId, canRecord, onSaved }: { horseId: number; canRecord: boolean; onSaved?: () => void }) {
  const request = useFlowRequest();
  const api = useMemo(() => createBaselineApi(request), [request]);
  const load = useCallback(async (signal: AbortSignal) => {
    const result = await api.weights(idOf(horseId), signal);
    if (!result || !Array.isArray(result.items)) throw new Error('Phản hồi lịch sử cân nặng không đúng định dạng.');
    return result.items;
  }, [api, horseId]);
  const history = useResource(load);
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
      history.reload();
      onSaved?.();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return <section aria-label="Lịch sử cân nặng">
    {canRecord && <Card title="Ghi nhận cân nặng định kỳ">
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
    {history.error && <ErrorState title="Không tải được lịch sử cân nặng" description={history.error} onRetry={history.reload} />}
    {history.data && <WeightHistoryChart records={history.data} />}
  </section>;
}
