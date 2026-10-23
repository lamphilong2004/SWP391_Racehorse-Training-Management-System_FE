import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertBanner, Button, Card, ErrorState, KeyValue, LoadingState, Modal, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { dateTime } from '../evaluation/models';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createThresholdApi, validThreshold } from './thresholdApi';
import styles from '../main-flows/flow.module.css';

/** SCR-MED-014. Mounted only for Vet; other readers retain the existing effective threshold read. */
export function ThresholdOverride({ horseId }: { horseId: number }) {
  const { user } = useAuth();
  return user?.roles.includes('VETERINARIAN') ? <VetThresholdOverride key={horseId} horseId={horseId} /> : null;
}
function VetThresholdOverride({ horseId }: { horseId: number }) {
  const request = useFlowRequest(), api = useMemo(() => createThresholdApi(request), [request]);
  const load = useCallback((signal: AbortSignal) => api.read(horseId, signal), [api, horseId]);
  const resource = useResource(load), current = resource.data?.find((item) => item.metricType === 'HEART_RATE');
  const [open, setOpen] = useState(false), [stage, setStage] = useState<'edit' | 'set' | 'end'>('edit');
  const [value, setValue] = useState(''), [reason, setReason] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false); const pending = useRef(false);
  const validTime = (text: string) => !!text && Number.isFinite(new Date(text).getTime());
  const canSet = validThreshold(value) && validTime(from) && reason.length <= 1000;
  const canEnd = current?.scope === 'HORSE_OVERRIDE' && validTime(to) && (!current.effectiveFrom || new Date(to).getTime() >= Date.parse(current.effectiveFrom));
  const close = () => { if (!pending.current) { setOpen(false); setStage('edit'); setError(''); } };
  async function confirm() {
    if (pending.current || (stage === 'set' ? !canSet : stage !== 'end' || !canEnd)) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (stage === 'set') await api.set(horseId, { metricType: 'HEART_RATE', thresholdValue: Number(value), effectiveFrom: new Date(from).toISOString(), reason });
      else await api.end(horseId, new Date(to).toISOString());
      setMessage('Máy chủ đã xác nhận thay đổi ngưỡng. Đang tải lại giá trị đang áp dụng.'); resource.reload();
      setOpen(false); setStage('edit'); setValue(''); setReason(''); setFrom(''); setTo('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Card title="Ngưỡng cảnh báo y tế"><div className={styles.stack}>
    {resource.pending && <LoadingState label="Đang tải ngưỡng đang áp dụng…" />}
    {resource.error && <ErrorState title="Không tải được ngưỡng" description={resource.error} onRetry={resource.reload} />}
    {message && <AlertBanner type="success" title="Đã xác nhận yêu cầu ngưỡng">{message}</AlertBanner>}
    <KeyValue label="Ngưỡng nhịp tim nghiêm trọng đang áp dụng" value={current ? `${current.thresholdValue} bpm · ${current.scope}` : 'Chưa cung cấp'} />
    <Button variant="secondary" disabled={resource.pending || !!resource.error} onClick={() => { setError(''); setMessage(''); setStage('edit'); setOpen(true); }}>Ngưỡng riêng</Button>
    <Modal open={open} onClose={close} title={stage === 'edit' ? `Ngưỡng riêng · Ngựa ${horseId}` : stage === 'set' ? 'Xác nhận đặt ngưỡng riêng' : 'Xác nhận kết thúc ngưỡng riêng'} footer={<>
      <Button variant="secondary" disabled={busy} onClick={close}>Hủy</Button>
      {stage === 'edit' ? <><Button variant="secondary" disabled={!canEnd || resource.pending || !!resource.error} onClick={() => setStage('end')}>Xem lại việc kết thúc</Button><Button disabled={!canSet || resource.pending || !!resource.error} onClick={() => setStage('set')}>Xem lại ngưỡng riêng</Button></>
        : <><Button variant="secondary" disabled={busy} onClick={() => { setStage('edit'); setError(''); }}>Quay lại chỉnh sửa</Button><Button disabled={busy || resource.pending || !!resource.error || (stage === 'set' ? !canSet : !canEnd)} onClick={() => void confirm()}>{busy ? 'Đang lưu…' : stage === 'set' ? 'Xác nhận ngưỡng riêng' : 'Xác nhận kết thúc'}</Button></>}
    </>}><div className={styles.stack}>
      <AlertBanner type="danger" title="Chỉ Veterinarian có quyền">Thao tác này đổi ngưỡng nhịp tim nghiêm trọng của ngựa. Trainer và Head Trainer không sửa được.</AlertBanner>
      {error && <AlertBanner type="danger" title="Chưa xác nhận được ngưỡng">{error}</AlertBanner>}
      <KeyValue label="Chỉ số" value="Nhịp tim · ngưỡng nghiêm trọng" /><KeyValue label="Giá trị đang áp dụng" value={current ? `${current.thresholdValue} bpm · ${current.scope}` : 'Chưa cung cấp'} />
      <KeyValue label="Mặc định chung" value={current?.scope === 'GLOBAL' ? `${current.thresholdValue} bpm` : 'Hệ thống chưa cung cấp'} />
      {stage === 'edit' ? <fieldset disabled={busy} className={`${styles.fieldset} ${styles.stack}`}>
        <TextField label="Ngưỡng riêng (bpm)" type="number" min="0.01" max="99999.99" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} helperText="Giá trị dương, tối đa hai chữ số thập phân. Không có giá trị mặc định." />
        <TextField label="Hiệu lực từ" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} required />
        <TextAreaField label="Lý do đặt ngưỡng riêng" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        <TextField label="Kết thúc ngưỡng riêng lúc" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} disabled={current?.scope !== 'HORSE_OVERRIDE'} helperText={current?.effectiveFrom ? `Phải từ ${dateTime(current.effectiveFrom)} trở đi.` : 'Cần có ngưỡng riêng đang áp dụng. Hệ thống kiểm tra khoảng hiệu lực.'} />
        <p>Để trống giá trị không xóa ngưỡng riêng. Muốn kết thúc phải xác nhận riêng.</p>
      </fieldset> : <><KeyValue label={stage === 'set' ? 'Ngưỡng nghiêm trọng mới' : 'Kết thúc ngưỡng riêng'} value={stage === 'set' ? `${value} bpm · ${dateTime(new Date(from).toISOString())}` : dateTime(new Date(to).toISOString())} />
        {stage === 'set' && <KeyValue label="Lý do" value={reason.trim() || 'Chưa cung cấp'} />}
        <p>{stage === 'set' ? 'Hệ thống thay ngưỡng riêng hiện tại và kiểm tra xung đột về khoảng hiệu lực.' : 'Hệ thống kết thúc ngưỡng riêng và xác định lại ngưỡng áp dụng. Ở đây không giả định giá trị mặc định chung.'}</p></>}
      <p className="text-caption">Chưa có ngưỡng cảnh báo. Trình duyệt không tự tính giá trị hay mức cảnh báo.</p>
    </div></Modal>
  </div></Card>;
}
