import { useRef, useState } from 'react';
import { ActionBar, AlertBanner, Button, Card, TextAreaField, TextField } from '../../design-system';
import type { GroomTaskInstruction, TreatmentPlanRequest } from './models';
import { medicalErrorMessage } from './errors';
import { validDate } from './groomService';
import { dateTime } from '../evaluation/models';

export function TreatmentPlanEditor({ initial, onSave, onCancel, openedAt, retainedTaskCount = 0 }: {
  initial?: Partial<TreatmentPlanRequest>; onSave: (input: TreatmentPlanRequest) => Promise<void>;
  onCancel?: () => void;
  openedAt?: string;
  retainedTaskCount?: number;
}) {
  const [plan, setPlan] = useState<TreatmentPlanRequest>({
    treatmentMedicationInstructions: initial?.treatmentMedicationInstructions ?? '',
    restInstructions: initial?.restInstructions ?? '',
    careInstructions: initial?.careInstructions ?? '',
    reexaminationDate: initial?.reexaminationDate,
    groomTasks: initial?.groomTasks?.map((task) => ({ ...task })) ?? [],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const tasks = plan.groomTasks ?? [];
  const changeTask = (index: number, patch: Partial<GroomTaskInstruction>) =>
    setPlan({ ...plan, groomTasks: tasks.map((task, i) => i === index ? { ...task, ...patch } : task) });
  return <form className="medical-form" onSubmit={async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!plan.treatmentMedicationInstructions.trim()) return setError('Cần nhập hướng dẫn điều trị và thuốc.');
    if ((plan.restInstructions?.trim().length ?? 0) > 100 || (plan.careInstructions?.trim().length ?? 0) > 2000) {
      return setError('Hướng dẫn nghỉ ngơi tối đa 100 ký tự và hướng dẫn chăm sóc tối đa 2000 ký tự.');
    }
    if (tasks.some((task) => !Number.isSafeInteger(task.assignedGroomUserId) || task.assignedGroomUserId < 1 || !task.instruction.trim() || !task.taskDate)) {
      return setError('Mỗi công việc cho Groom cần mã Groom đang hoạt động, hướng dẫn và ngày thực hiện.');
    }
    if (tasks.some((task) => task.instruction.trim().length > 2000 || (task.scheduledSlot?.trim().length ?? 0) > 50)) {
      return setError('Hướng dẫn cho Groom tối đa 2000 ký tự và khung giờ tối đa 50 ký tự.');
    }
    if (tasks.some((task) => !validDate(task.taskDate)) || (plan.reexaminationDate && !validDate(plan.reexaminationDate))) return setError('Nhập ngày thực hiện và ngày tái khám hợp lệ.');
    submitting.current = true; setSaving(true);
    try { await onSave({
      ...plan,
      treatmentMedicationInstructions: plan.treatmentMedicationInstructions.trim(),
      restInstructions: plan.restInstructions?.trim(),
      careInstructions: plan.careInstructions?.trim(),
      groomTasks: tasks.map((task, index) => index < retainedTaskCount ? task : ({ ...task, instruction: task.instruction.trim(), scheduledSlot: task.scheduledSlot?.trim() })),
    }); }
    catch (failure) { setError(medicalErrorMessage(failure, 'Không lưu được phác đồ điều trị.')); }
    finally { submitting.current = false; setSaving(false); }
  }}>
    <Card title="Thời gian phác đồ"><div className="medical-grid">
      <TextField label="Bắt đầu (ngày mở ca)" value={openedAt ? dateTime(openedAt) : 'Không có'} readOnly />
      <TextField label="Ngày tái khám" type="date" value={plan.reexaminationDate ?? ''} disabled={saving} onChange={(event) => setPlan({ ...plan, reexaminationDate: event.target.value || undefined })} />
    </div></Card>
    <Card title="Hướng dẫn điều trị & chăm sóc"><TextAreaField label="Hướng dẫn chăm sóc" value={plan.careInstructions ?? ''} disabled={saving} onChange={(event) => setPlan({ ...plan, careInstructions: event.target.value })} /></Card>
    <Card title="Nghỉ ngơi"><TextField label="Hướng dẫn nghỉ ngơi" value={plan.restInstructions ?? ''} disabled={saving} onChange={(event) => setPlan({ ...plan, restInstructions: event.target.value })} /></Card>
    <Card title="Thuốc"><TextAreaField label="Hướng dẫn điều trị và dùng thuốc" required value={plan.treatmentMedicationInstructions} disabled={saving} onChange={(event) => setPlan({ ...plan, treatmentMedicationInstructions: event.target.value })} /></Card>
    <Card title="Công việc chăm sóc cho Groom"><fieldset disabled={saving} className="medical-form">
      <legend className="text-h3">Công việc đã giao cho Groom</legend>
      {tasks.map((task, index) => <fieldset disabled={index < retainedTaskCount} className="medical-form" key={index}>
        <legend>{index < retainedTaskCount ? 'Công việc đã lưu — giữ lịch sử' : 'Công việc mới'}</legend>
        <TextField label={`Mã Groom ${index + 1}`} type="number" min={1} step={1} value={task.assignedGroomUserId || ''} onChange={(event) => changeTask(index, { assignedGroomUserId: Number(event.target.value) })} />
        <TextAreaField label={`Hướng dẫn cho Groom ${index + 1}`} value={task.instruction} onChange={(event) => changeTask(index, { instruction: event.target.value })} />
        <TextField label={`Ngày thực hiện ${index + 1}`} type="date" value={task.taskDate} onChange={(event) => changeTask(index, { taskDate: event.target.value })} />
        <TextField label={`Khung giờ ${index + 1}`} value={task.scheduledSlot ?? ''} onChange={(event) => changeTask(index, { scheduledSlot: event.target.value || undefined })} />
        <Button type="button" variant="secondary" onClick={() => setPlan({ ...plan, groomTasks: tasks.filter((_, i) => i !== index) })}>Xóa công việc</Button>
      </fieldset>)}
      <Button type="button" variant="secondary" onClick={() => setPlan({ ...plan, groomTasks: [...tasks, { assignedGroomUserId: 0, instruction: '', taskDate: '' }] })}>Thêm công việc cho Groom</Button>
    </fieldset></Card>
    {error && <AlertBanner type="danger" title={error} />}
    <ActionBar>
      {onCancel && <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>Hủy</Button>}
      <Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu phác đồ điều trị'}</Button>
    </ActionBar>
  </form>;
}
