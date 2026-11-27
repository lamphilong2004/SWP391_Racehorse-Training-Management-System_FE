import { viLabel } from '../viLabels';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertBanner, Button, Icon, Modal, SelectField, StatusBadge, TextField } from '../../design-system';
import styles from './IncidentReportModal.module.css';
import { IncidentPhotoPicker } from './IncidentPhotos';
import { createIncidentPhotoApi, type IncidentPhotoApi } from './incidentPhotoApi';

import type { IncidentType } from './incidentTypes';
export type { IncidentType };
export type ObservedSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

/** Matches CORE-006 IncidentCreateRequest. No reporter, status or session-state fields are client supplied; photos are uploaded after creation. */
export interface IncidentCreateRequest {
  horseId: number;
  incidentType: IncidentType;
  observedSeverity: ObservedSeverity;
  observedAt: string;
  description: string;
  preSessionCheckId?: number;
  trainingSessionId?: number;
  careTaskId?: number;
}

export type IncidentSource = {
  kind: 'groom';
  horseId?: number;
  horseLabel?: string;
  observedAt?: string;
  preSessionCheckId?: number;
  careTaskId?: number;
  contextLabel?: string;
  initialDescription?: string;
};

export interface IncidentReportModalProps {
  open: boolean;
  onClose: () => void;
  source: IncidentSource;
  horses?: { id: number; label: string }[];
  /**
   * The host owns HTTP and authorization for the report. It returns the created incident so the modal can attach the
   * chosen photos to it; the modal closes itself afterwards, so the host should not close it inside onSubmit.
   */
  onSubmit: (request: IncidentCreateRequest) => Promise<{ id: number } | void>;
  /** Scene photos (Flow 3 step 3.1). Defaults to the session-backed API; tests inject their own. */
  photoApi?: IncidentPhotoApi;
}

const groomTypes: { value: IncidentType; label: string }[] = [
  { value: 'OFF_FEED', label: 'Bỏ ăn' },
  { value: 'COLIC_SIGNS', label: 'Dấu hiệu đau bụng' },
  { value: 'FEVER', label: 'Sốt' },
  { value: 'HOOF_OR_LEG_PROBLEM', label: 'Vấn đề móng hoặc chân' },
  { value: 'LAMENESS', label: 'Khập khiễng, bước không đều' },
  { value: 'INJURY', label: 'Chấn thương (va chạm, vết thương)' },
  { value: 'OTHER', label: 'Khác' },
];

function localDateTime(value?: string): string {
  if (value) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!parts) return '';
    const [, year, month, day, hour, minute, second] = parts.map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (month < 1 || month > 12 || day < 1 || day > lastDay || hour > 23 || minute > 59 || (second !== undefined && second > 59)) return '';
  }
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
    date.getHours() !== hour || date.getMinutes() !== minute) return null;
  return date;
}

function sourceContextError(source: IncidentSource): string | null {
  const values = source as unknown as Record<string, unknown>;
  const contexts = ['preSessionCheckId', 'trainingSessionId', 'careTaskId']
    .filter((field) => values[field] !== undefined);
  if (contexts.length > 1) return 'Hãy chọn một nguồn phát sinh sự cố.';
  if (contexts.some((field) => !Number.isSafeInteger(values[field]) || Number(values[field]) < 1)) {
    return 'Mã nguồn phải là số nguyên dương.';
  }
  if (contexts[0] === 'trainingSessionId') {
    return 'Báo cáo của Groom không gắn với buổi tập.';
  }
  return null;
}

export function IncidentReportModal(props: IncidentReportModalProps) {
  if (!props.open) return null;
  const contextId = props.source.preSessionCheckId ?? props.source.careTaskId ?? 'standalone';
  return <IncidentReportModalForm key={`${props.source.kind}:${props.source.horseId ?? ''}:${contextId}:${props.source.observedAt ?? ''}`} {...props} />;
}

function IncidentReportModalForm({ open, onClose, source, horses = [], onSubmit, photoApi }: IncidentReportModalProps) {
  const formId = useId();
  const descriptionId = `${formId}-description`;
  const [horseId, setHorseId] = useState(source.horseId ? String(source.horseId) : '');
  const [manualHorseId, setManualHorseId] = useState('');
  const [observedAt, setObservedAt] = useState(() => localDateTime(source.observedAt));
  const [incidentType, setIncidentType] = useState<IncidentType | ''>('');
  const [severity, setSeverity] = useState<ObservedSeverity | ''>('');
  const [description, setDescription] = useState(source.initialDescription?.slice(0, 2000) ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [progress, setProgress] = useState('');
  // Set once the incident exists but some photos did not upload: the form must not be sent again (duplicate report).
  const [sent, setSent] = useState<{ failed: number; total: number } | null>(null);
  const photosApi = useMemo(() => photoApi ?? createIncidentPhotoApi(), [photoApi]);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const contextError = sourceContextError(source);
    if (contextError) { setError(contextError); return; }
    const id = Number(horseId === 'manual' ? manualHorseId : horseId);
    const time = parseLocalDateTime(observedAt);
    const body = description.trim();
    if (!Number.isSafeInteger(id) || id < 1) {
      setError('Hãy điền đủ các trường bắt buộc trước khi gửi.');
      return;
    }
    if (!time || time.getTime() > Date.now()) {
      setError('Thời điểm phát hiện phải hợp lệ và không ở tương lai.');
      return;
    }
    if (!severity || !body || !incidentType) {
      setError('Hãy điền đủ các trường bắt buộc trước khi gửi.');
      return;
    }
    if (body.length > 2000) {
      setError('Mô tả tối đa 2.000 ký tự.');
      return;
    }
    const request: IncidentCreateRequest = {
      horseId: id,
      incidentType: incidentType as IncidentType,
      observedSeverity: severity as ObservedSeverity,
      observedAt: time.toISOString(),
      description: body,
      ...(source.preSessionCheckId !== undefined ? { preSessionCheckId: source.preSessionCheckId } :
        source.careTaskId !== undefined ? { careTaskId: source.careTaskId } : {}),
    };
    submitting.current = true;
    setBusy(true);
    setError('');
    let created: { id: number } | void;
    try {
      created = await onSubmit(request);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gửi được sự cố.');
      submitting.current = false;
      setBusy(false);
      return;
    }
    // The incident is saved from here on. A photo failure never turns into "not sent".
    let failed = 0;
    if (photos.length) {
      if (!created || !Number.isSafeInteger(created.id) || created.id < 1) failed = photos.length;
      else for (const [index, file] of photos.entries()) {
        setProgress(`Đang tải ảnh ${index + 1}/${photos.length}…`);
        try { await photosApi.upload(created.id, file); } catch { failed += 1; }
      }
    }
    setProgress('');
    setBusy(false);
    if (failed) { setSent({ failed, total: photos.length }); return; }
    submitting.current = false;
    onClose();
  }

  const dirty = Boolean(incidentType || severity || description.trim() || photos.length);
  if (sent) return (
    <Modal open={open} onClose={onClose} title="Đã gửi sự cố" size="md" className={styles.groomModal}
      footer={<Button onClick={onClose}>Đóng</Button>}>
      <AlertBanner type="warning" title={`Sự cố đã được gửi, nhưng ${sent.failed}/${sent.total} ảnh chưa tải lên được.`}>
        Không gửi lại báo cáo. Mở sự cố trong Theo dõi báo cáo và bấm Thêm ảnh để tải lại ảnh.
      </AlertBanner>
    </Modal>
  );
  const options = source.horseId
    ? [{ value: String(source.horseId), label: source.horseLabel || `Ngựa #${source.horseId}` }]
    : [...horses.map((horse) => ({ value: String(horse.id), label: horse.label })), { value: 'manual', label: 'Mã ngựa khác…' }];

  return (
    <Modal open={open} dismissible={!busy && !dirty} onClose={busy ? () => undefined : onClose} title="Báo cáo sự cố" size="md" className={styles.groomModal}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Hủy</Button><Button type="submit" form={formId} disabled={busy}>{progress || (busy ? 'Đang gửi…' : 'Gửi sự cố')}</Button></>}>
      <form id={formId} className={styles.form} onSubmit={submit} aria-busy={busy}>
        <p className={styles.subtitle}>Ghi điều đã quan sát để Veterinarian tiếp nhận và xử lý</p>
        {source.contextLabel && <div className={styles.context}><Icon name="clipboard-list" size={16} /><span>{source.contextLabel}</span></div>}
        <div className={styles.twoColumns}>
          <div><SelectField label="Ngựa *" value={horseId} onChange={(event) => setHorseId(event.target.value)} disabled={busy || source.horseId !== undefined} required={source.horseId === undefined} placeholder="Chọn ngựa" options={options} />
            {horseId === 'manual' && <TextField label="Mã ngựa *" type="number" min={1} step={1} required disabled={busy} value={manualHorseId} onChange={(event) => setManualHorseId(event.target.value)} helperText="Quyền truy cập được hệ thống kiểm tra." />}</div>
          <TextField label="Thời điểm phát hiện *" type="datetime-local" value={observedAt} max={localDateTime()} required disabled={busy} onChange={(event) => setObservedAt(event.target.value)} />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Loại *</span>
          <div className={styles.chips} role="group" aria-label="Loại sự cố">
            {groomTypes.map((type) => <button key={type.value} type="button" disabled={busy} className={`${styles.chip} ${incidentType === type.value ? styles.selectedChip : ''}`} aria-pressed={incidentType === type.value} onClick={() => setIncidentType(type.value)}>{incidentType === type.value && <Icon name="check" size={14} />}{type.label}</button>)}
          </div>
        </div>
        <div className={styles.field}><span className={styles.label}>Mức độ (theo quan sát của bạn) *</span><div className={styles.severity} role="group" aria-label="Mức độ quan sát">
          {(['LOW', 'MEDIUM', 'HIGH'] as const).map((value) => <button key={value} type="button" disabled={busy} className={severity === value ? styles.selectedSeverity : ''} aria-pressed={severity === value} onClick={() => setSeverity(value)}>{viLabel(value)}</button>)}
        </div></div>
        <div className={styles.field}><label className={styles.label} htmlFor={descriptionId}>Mô tả *</label><textarea id={descriptionId} className={styles.textarea} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} required disabled={busy} /></div>
        <IncidentPhotoPicker files={photos} onChange={setPhotos} disabled={busy} />
        <div className={styles.lifecycle}><Icon name="info" size={16} /><div><div className={styles.statusLine}>Sự cố mới gửi có trạng thái <StatusBadge family="incident" status="REPORTED" /></div><p>Sau khi gửi, mở Theo dõi báo cáo để xem thú y đã tiếp nhận hay chưa. Veterinarian quyết định việc khám và hạn chế tập luyện.</p></div></div>
        {error && <AlertBanner type="danger" title="Không gửi được">{error}</AlertBanner>}
      </form>
    </Modal>
  );
}
