import { clubDateTime, parseClubDateTime } from '../../shared/clubCalendar';
import { boxLabel } from '../../shared/stableBox';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, Card, ErrorState, Icon, LoadingState, StatusBadge, TextAreaField, TextField } from '../../design-system';
import type { HealthStatus, HorseDetail } from '../horses/api/types';
import { FlowShell } from '../main-flows/FlowShell';
import { errorMessage, idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createBaselineApi, validateWeight, type BaselineRecord } from './baselineApi';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';
import { serverText } from '../../shared/serverText';

const HEALTH: HealthStatus[] = ['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'];
interface Activation { checklist: { id: string; label: string; requirement?: string; state?: string; satisfied?: boolean }[] }
export function BaselinePage() {
  const { id } = useParams();
  return <BaselineContent key={id} rawId={id} />;
}
function BaselineContent({ rawId }: { rawId?: string }) {
  const request = useFlowRequest();
  const api = useMemo(() => createBaselineApi(request), [request]);
  const loadHorse = useCallback((signal: AbortSignal) => request<HorseDetail>(`/api/horses/${idOf(rawId)}`, { signal }), [request, rawId]);
  const loadActivation = useCallback((signal: AbortSignal) => request<Activation>(`/api/horses/${idOf(rawId)}/activation-status`, { signal }), [request, rawId]);
  const horse = useResource(loadHorse), activation = useResource(loadActivation);
  const [weight, setWeight] = useState(''), [health, setHealth] = useState<HealthStatus | ''>('');
  const [condition, setCondition] = useState(''), [notes, setNotes] = useState('');
  const [examinedAt, setExaminedAt] = useState(() => clubDateTime());
  const examinedDate = parseClubDateTime(examinedAt);
  const [futureError, setFutureError] = useState('');
  const examinedError = !examinedDate ? 'Nhập ngày giờ khám hợp lệ.' : futureError || undefined;
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [saved, setSaved] = useState<BaselineRecord>();
  const pending = useRef(false);
  const data = horse.data;
  const valid = validateWeight(weight) && HEALTH.includes(health as HealthStatus) && !!condition.trim() && !examinedError;
  async function save() {
    if (pending.current || !valid || !data || data.lifecycle !== 'DRAFT') return;
    // Checked at submit time (render must stay pure); the server enforces the same rule.
    if (examinedDate!.getTime() > Date.now() + 60_000) { setFutureError('Không chọn thời điểm trong tương lai.'); return; }
    pending.current = true; setSaving(true); setError('');
    try {
      const result = await api.save(data.id, { weightKg: Number(weight), healthStatus: health as HealthStatus, examinedAt: examinedDate!.toISOString(),
        clinicalNotes: `${condition.trim()}${notes.trim() ? `\n\nGhi chú của Veterinarian: ${notes.trim()}` : ''}` });
      if (!result?.id || result.horseId !== data.id || !result.recordedAt) throw new Error('Máy chủ chưa xác nhận đã lưu kết quả khám ban đầu. Hãy tải lại hồ sơ ngựa trước khi thử lại.');
      setSaved(result); activation.reload();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setSaving(false); }
  }
  return <FlowShell title={`Khám sức khỏe ban đầu${data ? ` · ${data.name}` : ''}`} description={data ? `${data.horseCode} · ${data.breed ?? 'Chưa ghi giống'} · ${boxLabel(data.currentBoxCode) ?? 'Chưa xếp ô chuồng'} · tiếp nhận (đăng ký ngựa)` : 'Khám ban đầu của Veterinarian'} section="Ngựa" role="VETERINARIAN" actions={data && <StatusBadge family="lifecycle" status={data.lifecycle} />}>
    {horse.pending && <LoadingState label="Đang tải thông tin ngựa…" />}
    {horse.error && <ErrorState title="Không tải được thông tin ngựa" description={horse.error} onRetry={horse.reload} />}
    {error && <AlertBanner type="danger" title="Chưa lưu được kết quả khám ban đầu">{error}</AlertBanner>}
    {saved && <AlertBanner type="success" title="Đã lưu kết quả khám ban đầu">{saved.weightKg} kg · {viLabel(saved.healthStatus)} · {new Date(saved.recordedAt).toLocaleString('vi-VN')}. <ButtonLink to={`/horses/${saved.horseId}`}>Tải lại hồ sơ ngựa</ButtonLink></AlertBanner>}
    {data && data.lifecycle !== 'DRAFT' && !saved && <AlertBanner type="info" title="Khám ban đầu chỉ dành cho ngựa ở trạng thái Nháp">Mở hồ sơ y tế của ngựa này cho các lần khám tiếp theo.</AlertBanner>}
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className={styles.columns}><Card title="Khám ban đầu"><fieldset disabled={!data || data.lifecycle !== 'DRAFT' || saving || !!saved} className={`${styles.fieldset} ${styles.stack}`}>
        <p className={styles.muted}>Lần khám đầu tiên của ngựa mới: ghi nhận cân nặng, thể trạng và đặt tình trạng sức khỏe ban đầu.</p>
        <div className={styles.fields}><TextField label="Ngày giờ khám" required type="datetime-local" max={clubDateTime()} value={saved ? clubDateTime(new Date(saved.recordedAt)) : examinedAt} error={examinedError} onChange={(event) => { setExaminedAt(event.target.value); setFutureError(''); }} helperText="Mặc định là bây giờ; chỉnh lại nếu đã khám trước đó. Giờ Việt Nam." /><TextField label="Cân nặng (kg)" required type="number" min="0.01" max="9999.99" step="0.01" value={weight} placeholder="Nhập cân nặng" onChange={(event) => setWeight(event.target.value)} error={weight && !validateWeight(weight) ? 'Nhập cân nặng dương, tối đa 9999.99 kg, nhiều nhất hai chữ số thập phân.' : undefined} /></div>
        <TextAreaField label="Thể trạng hiện tại" required value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="Thể trạng chung, chân và móng, mọi dấu hiệu bất thường…" rows={4} />
        <fieldset className={styles.fieldset}><legend className="text-body-strong">Tình trạng sức khỏe ban đầu *</legend><div className={styles.choices}>{HEALTH.map((value) => <label className={styles.choice} key={value}><input required type="radio" name="healthStatus" value={value} checked={health === value} onChange={() => setHealth(value)} /><StatusBadge family="health" status={value} /></label>)}</div><p className="text-caption">{health || 'Chưa chọn.'}</p></fieldset>
        <TextAreaField label="Ghi chú của Veterinarian" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ghi chú (không bắt buộc)…" rows={2} />
        <AlertBanner type="info" title="">Biểu mẫu này chỉ đặt tình trạng sức khỏe ban đầu. Khả năng tập luyện do Veterinarian quản lý riêng trong hồ sơ y tế.</AlertBanner>
      </fieldset></Card><Card title="Mức sẵn sàng kích hoạt"><div className={styles.stack}><p className={styles.muted}>Ngựa tự chuyển sang Hoạt động khi đủ mọi yêu cầu bắt buộc. Nên có đánh giá sẵn sàng của Head Trainer nhưng không bắt buộc để kích hoạt.</p>
        {activation.pending && <LoadingState label="Đang tải mức sẵn sàng…" />}{activation.error && <ErrorState title="Không tải được mức sẵn sàng" description={activation.error} onRetry={activation.reload} />}
        {activation.data?.checklist.map((item) => <div className={styles.checklist} key={item.id}><Icon name={item.state === 'SATISFIED' || item.state === 'REVIEWED' || item.satisfied ? 'check-circle' : 'circle'} size={16} /><div><p>{serverText(item.label)}</p><span className="text-caption">{item.requirement ?? 'Kết quả sẵn sàng từ hệ thống'}</span></div></div>)}
        <div className={styles.row}><StatusBadge family="lifecycle" status="DRAFT" /><Icon name="chevron-right" size={16} /><StatusBadge family="lifecycle" status="ACTIVE" /></div>
      </div></Card></div>
      <div className={styles.footer}><span className="text-caption">Điền đủ các trường bắt buộc để lưu.</span><ButtonLink to={rawId ? `/horses/${rawId}` : '/horses'}>Hủy</ButtonLink><Button type="submit" disabled={!valid || !data || data.lifecycle !== 'DRAFT' || saving || !!saved}>{saving ? 'Đang lưu…' : 'Lưu kết quả khám'}</Button></div>
    </form>
  </FlowShell>;
}
