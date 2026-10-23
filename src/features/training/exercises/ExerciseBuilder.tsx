import { useId, useRef, useState, type FormEvent } from 'react';
import { AlertBanner, Button, Modal, SelectField, TextAreaField, TextField, focusFirstInvalid } from '../../../design-system';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { ApiError } from '../../../shared/auth/authApi';
import type { Exercise, ExerciseInput, SupportingApi } from '../assigned/supportingApi';
import { supportingError } from '../assigned/supportingHooks';
import shared from '../assigned/supporting.module.css';
import styles from './exercises.module.css';
import { exerciseErrors, exercisePayload } from './exerciseValidation';

export function ExerciseBuilder({ api, initial, onClose, onSaved }: { api: SupportingApi; initial?: Exercise; onClose: () => void; onSaved: (exercise: Exercise) => void }) {
  const { user, handleApiError } = useAuth(); const formId = useId();
  const [fields, setFields] = useState<ExerciseInput>(initial ?? { name: '', exerciseType: null, description: null, targetMetric: null });
  const [errors, setErrors] = useState<Record<string, string>>({}); const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false); const pending = useRef(false); const [conflict, setConflict] = useState(false);
  const [customGait, setCustomGait] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  if (!user?.roles.includes('TRAINER')) return <AlertBanner type="danger" title="Không có quyền truy cập">Chỉ Trainer được dùng trình tạo bài tập.</AlertBanner>;
  // Stored as upper-case codes (WALK, TROT, ...) so library filters and existing records stay consistent.
  const knownGaits = [...new Set(['WALK', 'TROT', 'CANTER', 'GALLOP', ...(fields.exerciseType ? [fields.exerciseType] : [])])];
  const set = (key: keyof ExerciseInput, text: string) => setFields((old) => ({ ...old, [key]: text }));
  async function save(event: FormEvent) {
    event.preventDefault(); if (pending.current || conflict) return;
    const invalid = exerciseErrors(fields); setErrors(invalid); if (Object.keys(invalid).length) { focusFirstInvalid(formRef.current); return; }
    pending.current = true; setBusy(true); setFailure('');
    try {
      const saved = await api.saveExercise(exercisePayload(fields), initial?.id);
      if (!saved || !Number.isSafeInteger(saved.id) || saved.id < 1 || typeof saved.name !== 'string' || !saved.name.trim()) throw new ApiError(201, 'INVALID_RESPONSE', 'Chưa xác nhận được bài tập. Hãy đóng và tải lại trước khi thử lại.');
      onSaved(saved);
    } catch (cause) {
      if (!handleApiError(cause)) {
        setFailure(supportingError(cause));
        if (cause instanceof ApiError) {
          setErrors(Object.fromEntries(cause.details.filter((item) => item.field && ['name', 'exerciseType', 'description', 'targetMetric'].includes(item.field)).map((item) => [item.field!, item.message])));
          if (cause.status === 409 || cause.code === 'INVALID_RESPONSE') setConflict(true);
        }
      }
    } finally { pending.current = false; setBusy(false); }
  }
  const start = initial ?? { name: '', exerciseType: null, description: null, targetMetric: null };
  const dirty = (['name', 'exerciseType', 'description', 'targetMetric'] as const).some((key) => (fields[key] ?? '') !== (start[key] ?? ''));
  // Escape/backdrop never discard typed definitions; Cancel is the explicit discard (UX Playbook v2.1 §1.1).
  return <Modal open dismissible={!busy && !dirty} title={initial ? 'Sửa bài tập' : 'Bài tập mới'} onClose={busy ? () => undefined : onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>{conflict ? 'Đóng và tải lại thư viện' : 'Hủy'}</Button><Button type="submit" form={formId} disabled={busy || conflict}>{busy ? 'Đang lưu…' : 'Lưu bài tập'}</Button></>}><form ref={formRef} id={formId} onSubmit={save} noValidate className={shared.stack}>
    <TextField label="Tên bài tập" required maxLength={150} value={fields.name} disabled={busy || conflict} error={errors.name} onChange={(event) => set('name', event.target.value)} />
    <TextAreaField label="Mục đích" maxLength={2000} value={fields.description ?? ''} disabled={busy || conflict} error={errors.description} onChange={(event) => set('description', event.target.value)} />
    <div className={styles.fields}><div className={shared.smallStack}><SelectField label="Dáng chạy / loại bài tập" value={customGait ? '__custom__' : fields.exerciseType ?? ''} placeholder="Chưa xác định" disabled={busy || conflict} onChange={(event) => { const custom = event.target.value === '__custom__'; setCustomGait(custom); set('exerciseType', custom ? '' : event.target.value); }} options={[...knownGaits.map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })), { value: '__custom__', label: 'Khác…' }]} error={errors.exerciseType} />{customGait && <TextField label="Dáng chạy / loại bài tập khác" maxLength={50} value={fields.exerciseType ?? ''} disabled={busy || conflict} onChange={(event) => set('exerciseType', event.target.value)} />}</div><TextField label="Cường độ" disabled value="Set per session" /><TextField label="Mặt sân" disabled value="Set per session" /></div>
    <TextField label="Hướng dẫn quãng đường / thời lượng" maxLength={100} value={fields.targetMetric ?? ''} disabled={busy || conflict} error={errors.targetMetric} onChange={(event) => set('targetMetric', event.target.value)} helperText="Nhập hướng dẫn quãng đường hoặc thời lượng dạng văn bản; hệ thống không tính toán." />
    <div className={styles.fields}><TextField label="Số lần lặp" disabled value="Set per session" /><TextField label="Thời gian nghỉ" disabled value="Set per session" /></div>
    <AlertBanner type="info" title="Bài tập dùng lại được">Cường độ, mặt sân, số lần lặp và thời gian nghỉ được đặt khi lên lịch buổi tập. Thẻ mục tiêu, ghi chú riêng và hướng dẫn hồi phục chưa có ở đây.</AlertBanner>
    {failure && <AlertBanner type="danger" title="Chưa xác nhận lưu được bài tập">{failure} Nội dung bạn nhập vẫn được giữ.</AlertBanner>}
  </form></Modal>;
}
