import { useRef, useState, type FormEvent } from 'react';
import { AlertBanner, Button, Modal, RadioGroup, SelectField, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { errorMessage } from './data';
import { metricInput, type IssueInput, type RiderSession } from './types';
import styles from './rider.module.css';
import { viLabel } from '../../shared/viLabels';

/**
 * What a Work Rider can notice in the saddle. The API keeps the five approved incident types (1_Scope!C15), so each
 * sign maps to one of them and its label is written at the start of the description for the Veterinarian.
 */
export const RIDE_SIGNS = [
  { key: 'LAMENESS', label: 'Khập khiễng, bước không đều', type: 'HOOF_OR_LEG_PROBLEM' },
  { key: 'STUMBLE', label: 'Vấp hoặc bước hụt', type: 'HOOF_OR_LEG_PROBLEM' },
  { key: 'INJURY', label: 'Chấn thương do va chạm hoặc té ngã', type: 'OTHER' },
  { key: 'BREATHING', label: 'Thở khó, thở rít', type: 'OTHER' },
  { key: 'NOSEBLEED', label: 'Chảy máu mũi', type: 'OTHER' },
  { key: 'EXHAUSTION', label: 'Mệt bất thường, ra mồ hôi nhiều', type: 'OTHER' },
  { key: 'BEHAVIOUR', label: 'Hoảng sợ, khó kiểm soát', type: 'OTHER' },
  { key: 'COLIC', label: 'Dấu hiệu đau bụng (cào đất, muốn lăn)', type: 'COLIC_SIGNS' },
  { key: 'OTHER', label: 'Vấn đề khác', type: 'OTHER' },
] as const;

export function IssueDialog({ session, api, onClose, onSaved }: { session: RiderSession; api: RiderApi; onClose: () => void; onSaved: (code: string, incidentId: number) => void }) {
  const { handleApiError } = useAuth();
  const [sign, setSign] = useState('');
  const signInfo = RIDE_SIGNS.find((item) => item.key === sign);
  const type = signInfo?.type ?? '';
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || conflict) return;
    if (session.status !== 'IN_PROGRESS' && session.status !== 'PAUSED') { setError('Lượt cưỡi này không đang diễn ra. Hãy nhờ Groom hoặc Trainer được phân công kiểm tra lại.'); return; }
    const fullDescription = signInfo && signInfo.key !== 'OTHER' ? `${signInfo.label}: ${description.trim()}` : description.trim();
    if (!type || !severity || !description.trim() || fullDescription.length > 1000) { setError('Chọn dấu hiệu, mức độ quan sát được và mô tả những gì bạn thấy (tối đa 1000 ký tự).'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.issue(session.id, { incidentType: type as IssueInput['incidentType'], observedSeverity: severity as IssueInput['observedSeverity'], description: fullDescription, observedAt: new Date().toISOString() });
      if (!Number.isSafeInteger(response.incidentId) || response.incidentId < 1 || !response.incidentCode || response.sessionStatus !== 'INTERRUPTED') throw new ApiError(201, 'INVALID_RESPONSE', 'Chưa xác nhận được báo cáo vấn đề. Hãy tải lại lượt cưỡi trước khi thử lại.');
      onSaved(response.incidentCode, response.incidentId);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflict(true);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  const dirty = Boolean(sign || severity || description.trim());
  // Typed issue details are never dismissed by Escape/backdrop; Cancel is the explicit discard.
  return <Modal open dismissible={!busy && !dirty} onClose={busy ? () => undefined : onClose} title="Báo cáo vấn đề" footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>{conflict ? 'Đóng và tải lại lượt cưỡi' : 'Hủy'}</Button><Button variant="danger" type="submit" form="rider-issue-form" disabled={busy || conflict}>{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</Button></>}><form id="rider-issue-form" onSubmit={submit} className={styles.smallStack}><AlertBanner type="warning" title="Báo bất thường trong lúc tập"><p>Chỉ thao tác khi đã dừng cưỡi an toàn. Gửi báo cáo sẽ chuyển lượt này sang Bị gián đoạn; Trainer và Veterinarian tiếp nhận để xử lý.</p></AlertBanner><p>{session.horse.name} · {session.sessionCode}</p><RadioGroup label="Bạn thấy dấu hiệu gì khi đang cưỡi?" value={sign} onChange={setSign} helperText={signInfo ? `Ghi vào hồ sơ sự cố là: ${viLabel(signInfo.type)}. Dấu hiệu bạn chọn đứng đầu phần mô tả cho Veterinarian.` : 'Chọn dấu hiệu gần nhất; mô tả chi tiết ở ô bên dưới.'} disabled={busy || conflict} options={RIDE_SIGNS.map((item) => ({ value: item.key, label: item.label }))} /><SelectField label="Mức độ quan sát" value={severity} disabled={busy || conflict} onChange={(event) => setSeverity(event.target.value)} options={[{ value: '', label: 'Chọn mức độ' }, ...['LOW', 'MEDIUM', 'HIGH'].map((value) => ({ value, label: viLabel(value) }))]} /><TextAreaField label="Mô tả những gì bạn thấy" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} disabled={busy || conflict} /><p className={styles.muted}>Sau khi gửi, theo dõi báo cáo và bổ sung phản hồi về phần đã thực hiện. Veterinarian quyết định xử lý sức khỏe.</p>{error && <AlertBanner feedback type="danger" title="Chưa xác nhận được báo cáo vấn đề">{error}</AlertBanner>}</form></Modal>;
}

export function MetricDialog({ session, api, onClose, onSaved }: { session: RiderSession; api: RiderApi; onClose: () => void; onSaved: () => void }) {
  const { handleApiError } = useAuth();
  const [fields, setFields] = useState({ heartRate: '', speedKmh: '', distanceM: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current || conflict) return;
    let body;
    try { body = metricInput(fields); } catch (cause) { setError(errorMessage(cause)); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.metric(session.id, body);
      if (!Number.isSafeInteger(response.sampleId) || response.sampleId < 1) throw new ApiError(201, 'INVALID_RESPONSE', 'Chưa xác nhận được số đo. Hãy đóng và tải lại lượt cưỡi trước khi thử lại.');
      onSaved();
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflict(true);
        setError(errorMessage(cause));
      }
    }
    finally { pending.current = false; setBusy(false); }
  }
  const dirty = Object.values(fields).some((value) => value.trim() !== '');
  return <Modal open dismissible={!busy && !dirty} onClose={busy ? () => undefined : onClose} title="Thêm số đo thủ công" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>{conflict ? 'Đóng và tải lại lượt cưỡi' : 'Hủy'}</Button><Button type="submit" form="rider-metric-form" disabled={busy || conflict}>{busy ? 'Đang lưu…' : 'Lưu số đo'}</Button></>}><form id="rider-metric-form" onSubmit={submit} className={styles.smallStack}><p>Chỉ nhập giá trị đã đo. Ô để trống nghĩa là không có dữ liệu; 0 vẫn là số đo hợp lệ.</p>{([{ key: 'heartRate', label: 'Nhịp tim (bpm)', step: '1' }, { key: 'speedKmh', label: 'Tốc độ (km/h)', step: 'any' }, { key: 'distanceM', label: 'Quãng đường (m)', step: 'any' }] as const).map(({ key, label, step }) => <TextField key={key} label={label} type="number" min={0} step={step} value={fields[key]} disabled={busy || conflict} onChange={(event) => setFields((old) => ({ ...old, [key]: event.target.value }))} />)}{error && <AlertBanner feedback type="danger" title="Chưa lưu được số đo">{error}</AlertBanner>}</form></Modal>;
}
