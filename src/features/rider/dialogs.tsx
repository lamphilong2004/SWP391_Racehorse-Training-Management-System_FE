import { useRef, useState, type FormEvent } from 'react';
import { AlertBanner, Button, Modal, SelectField, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { errorMessage } from './data';
import { metricInput, type IssueInput, type RiderSession } from './types';
import styles from './rider.module.css';
import { viLabel } from '../../shared/viLabels';

export function IssueDialog({ session, api, onClose, onSaved }: { session: RiderSession; api: RiderApi; onClose: () => void; onSaved: (code: string) => void }) {
  const { handleApiError } = useAuth();
  const [type, setType] = useState('');
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
    if (!type || !severity || !description.trim() || description.trim().length > 1000) { setError('Chọn loại vấn đề, mức độ quan sát được và mô tả những gì bạn thấy (1–1000 ký tự).'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.issue(session.id, { incidentType: type as IssueInput['incidentType'], observedSeverity: severity as IssueInput['observedSeverity'], description: description.trim(), observedAt: new Date().toISOString() });
      if (!Number.isSafeInteger(response.incidentId) || response.incidentId < 1 || !response.incidentCode) throw new ApiError(201, 'INVALID_RESPONSE', 'Chưa xác nhận được báo cáo vấn đề. Hãy tải lại lượt cưỡi trước khi thử lại.');
      onSaved(response.incidentCode);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflict(true);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  const dirty = Boolean(type || severity || description.trim());
  // Typed issue details are never dismissed by Escape/backdrop; Cancel is the explicit discard.
  return <Modal open dismissible={!busy && !dirty} onClose={busy ? () => undefined : onClose} title="Báo cáo vấn đề" footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>{conflict ? 'Đóng và tải lại lượt cưỡi' : 'Hủy'}</Button><Button type="submit" form="rider-issue-form" disabled={busy || conflict}>{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</Button></>}><form id="rider-issue-form" onSubmit={submit} className={styles.smallStack}><p>{session.horse.name} · {session.sessionCode}</p><SelectField label="Bạn đã thấy gì?" value={type} onChange={(event) => setType(event.target.value)} disabled={busy || conflict} options={[{ value: '', label: 'Chọn vấn đề quan sát được' }, { value: 'OFF_FEED', label: 'Bỏ ăn' }, { value: 'COLIC_SIGNS', label: 'Dấu hiệu đau bụng' }, { value: 'FEVER', label: 'Sốt' }, { value: 'HOOF_OR_LEG_PROBLEM', label: 'Vấn đề móng hoặc chân' }, { value: 'OTHER', label: 'Khác' }]} /><SelectField label="Mức độ quan sát" value={severity} disabled={busy || conflict} onChange={(event) => setSeverity(event.target.value)} options={[{ value: '', label: 'Chọn mức độ' }, ...['LOW', 'MEDIUM', 'HIGH'].map((value) => ({ value, label: viLabel(value) }))]} /><TextAreaField label="Mô tả những gì bạn thấy" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} disabled={busy || conflict} /><AlertBanner type="warning" title="Dừng cưỡi an toàn">Buổi tập đang diễn ra hoặc tạm dừng sẽ chuyển sang Bị gián đoạn khi hệ thống nhận báo cáo này. Trainer và Veterinarian sẽ xem xét báo cáo. Hãy mô tả điều quan sát được, không cần chẩn đoán.</AlertBanner>{error && <AlertBanner type="danger" title="Chưa xác nhận được báo cáo vấn đề">{error}</AlertBanner>}</form></Modal>;
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
  return <Modal open dismissible={!busy && !dirty} onClose={busy ? () => undefined : onClose} title="Thêm số đo thủ công" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>{conflict ? 'Đóng và tải lại lượt cưỡi' : 'Hủy'}</Button><Button type="submit" form="rider-metric-form" disabled={busy || conflict}>{busy ? 'Đang lưu…' : 'Lưu số đo'}</Button></>}><form id="rider-metric-form" onSubmit={submit} className={styles.smallStack}><p>Chỉ nhập giá trị đã đo. Ô để trống nghĩa là không có dữ liệu; 0 vẫn là số đo hợp lệ.</p>{([{ key: 'heartRate', label: 'Nhịp tim (bpm)', step: '1' }, { key: 'speedKmh', label: 'Tốc độ (km/h)', step: 'any' }, { key: 'distanceM', label: 'Quãng đường (m)', step: 'any' }] as const).map(({ key, label, step }) => <TextField key={key} label={label} type="number" min={0} step={step} value={fields[key]} disabled={busy || conflict} onChange={(event) => setFields((old) => ({ ...old, [key]: event.target.value }))} />)}{error && <AlertBanner type="danger" title="Chưa lưu được số đo">{error}</AlertBanner>}</form></Modal>;
}
