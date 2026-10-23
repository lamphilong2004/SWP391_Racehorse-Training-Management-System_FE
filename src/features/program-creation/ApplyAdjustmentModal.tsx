import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { AlertBanner, Button, ErrorState, LoadingState, Modal, SelectField, TextAreaField, TextField } from '../../design-system';
import { dateTime } from '../evaluation/models';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createProgramDetailApi } from './programDetailApi';
import { validateAdjustedPhases, type AdjustedPhase } from './programDraft';
import { ADJUSTMENT_TYPES, createProgramManagementApi, type AdjustmentRequest } from './programManagementApi';
import type { Intensity, ProgramDetail } from './programTypes';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';

const INTENSITY_OPTIONS = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'].map((value) => ({ value, label: viLabel(value) }));
const typeLabel = (value: string) => ADJUSTMENT_TYPES.find((item) => item.value === value)?.label ?? value;
const nextDay = (iso: string) => { const date = new Date(`${iso}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); };

/**
 * Head Trainer applies an APPROVED adjustment request to the program phases (PUT /phases with
 * adjustmentRequestId). The request text is free-form, so the Head Trainer edits the phases;
 * nothing is derived from it automatically.
 */
export function ApplyAdjustmentModal({ item, onClose, onApplied }: { item: AdjustmentRequest; onClose: () => void; onApplied: (program: ProgramDetail) => void }) {
  const request = useFlowRequest();
  const detailApi = useMemo(() => createProgramDetailApi(request), [request]), api = useMemo(() => createProgramManagementApi(request), [request]);
  const load = useCallback(async (signal: AbortSignal) => {
    const [program, history] = await Promise.all([detailApi.read(item.programId, signal), detailApi.history(item.programId, signal)]);
    return { program, applied: history.find((entry) => entry.summary.includes(`Applied approved request ${item.id}.`)) };
  }, [detailApi, item.programId, item.id]);
  const resource = useResource(load), program = resource.data?.program;
  // Edits start from the loaded phases; nothing is copied into state until the Head Trainer changes something.
  const loaded = useMemo<AdjustedPhase[] | null>(() => program ? [...program.phases].sort((a, b) => a.phaseOrder - b.phaseOrder).map(({ id, templateVersionPhaseId, phaseOrder, name, objective, startDate, endDate, intensityMin, intensityMax, workload }) =>
    ({ id, templateVersionPhaseId, phaseOrder, name, objective: objective ?? '', startDate, endDate, intensityMin: intensityMin ?? null, intensityMax: intensityMax ?? null, workload: workload ?? '' })) : null, [program]);
  const [edited, setPhases] = useState<AdjustedPhase[] | null>(null), phases = edited ?? loaded;
  const [issues, setIssues] = useState<Record<string, string>>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const update = (index: number, patch: Partial<AdjustedPhase>) => setPhases((current) => (current ?? loaded ?? []).map((phase, at) => at === index ? { ...phase, ...patch } : phase));
  function add() {
    if (!phases || !program) return;
    const last = phases[phases.length - 1], start = last?.endDate ? nextDay(last.endDate) : program.periodStart;
    setPhases([...phases, { phaseOrder: phases.length + 1, name: '', objective: '', startDate: start <= program.periodEnd ? start : '', endDate: '', intensityMin: null, intensityMax: null, workload: '' }]);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !phases || !program) return;
    const found = validateAdjustedPhases(phases, program.periodStart, program.periodEnd);
    setIssues(found); setError('');
    if (Object.keys(found).length) { setError('Hãy kiểm tra các trường giai đoạn được đánh dấu.'); return; }
    setBusy(true);
    try {
      const payload = phases.map((phase, index) => ({ ...phase, phaseOrder: index + 1, name: phase.name.trim(), objective: phase.objective?.trim() || null, workload: phase.workload?.trim() || null }));
      onApplied(await api.applyPhases(program.id, item.id, payload));
    } catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  return <Modal open size="lg" title="Áp dụng điều chỉnh đã duyệt" dismissible={!busy} onClose={onClose}
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" form="apply-adjustment-form" disabled={busy || !phases}>{busy ? 'Đang áp dụng…' : 'Áp dụng vào chương trình'}</Button></>}>
    <div className={styles.stack}>
      <div><p><strong>{typeLabel(item.requestType)}</strong>: {item.requestedValue}</p>
        {item.currentValue && <p className={styles.muted}>Hiện tại: {item.currentValue}</p>}
        <p className={styles.muted}>Lý do: {item.reason}{item.reviewedBy ? ` · Duyệt bởi ${item.reviewedBy.fullName}, ${dateTime(item.reviewedAt ?? undefined)}` : ''}</p></div>
      {resource.pending && <LoadingState label="Đang tải các giai đoạn…" />}
      {resource.error && <ErrorState title="Không tải được chương trình" description={resource.error} onRetry={resource.reload} />}
      {resource.data?.applied && <AlertBanner type="warning" title="Đã áp dụng trước đó">Yêu cầu này đã được áp dụng lúc {dateTime(resource.data.applied.occurredAt)}. Áp dụng lại sẽ thay thế các giai đoạn một lần nữa.</AlertBanner>}
      {program && phases && <form id="apply-adjustment-form" className={styles.stack} onSubmit={submit} noValidate aria-busy={busy}>
        <p className={styles.muted}>{program.horse.name} · {program.name}. Các giai đoạn phải nằm trong khoảng {program.periodStart} – {program.periodEnd}, theo thứ tự và không chồng lấn. Không thể xóa giai đoạn đã có buổi tập.</p>
        {phases.map((phase, index) => {
          const label = `Giai đoạn ${index + 1}`, issue = (field: string) => issues[`${index}.${field}`];
          return <fieldset key={phase.id ?? `new-${index}`} className={styles.fieldset}>
            <div className={styles.row}><legend><strong>{label}</strong>{phase.id ? '' : '· mới'}</legend>
              <Button size="sm" variant="tertiary" disabled={busy || phases.length === 1} onClick={() => setPhases(phases.filter((_, at) => at !== index))} aria-label={`Xóa ${label}`}>Xóa</Button></div>
            <div className={styles.fields}>
              <TextField label={`${label} — tên`} required maxLength={150} value={phase.name} error={issue('name')} disabled={busy} onChange={(event) => update(index, { name: event.target.value })} />
              <TextField label={`${label} — khối lượng`} maxLength={500} value={phase.workload ?? ''} error={issue('workload')} disabled={busy} onChange={(event) => update(index, { workload: event.target.value })} />
              <TextField label={`${label} — ngày bắt đầu`} type="date" required min={program.periodStart} max={program.periodEnd} value={phase.startDate} error={issue('startDate')} disabled={busy} onChange={(event) => update(index, { startDate: event.target.value })} />
              <TextField label={`${label} — ngày kết thúc`} type="date" required min={program.periodStart} max={program.periodEnd} value={phase.endDate} error={issue('endDate')} disabled={busy} onChange={(event) => update(index, { endDate: event.target.value })} />
              <SelectField label={`${label} — cường độ tối thiểu`} placeholder="Chưa xác định" options={INTENSITY_OPTIONS} value={phase.intensityMin ?? ''} disabled={busy} onChange={(event) => update(index, { intensityMin: (event.target.value || null) as Intensity | null })} />
              <SelectField label={`${label} — cường độ tối đa`} placeholder="Chưa xác định" options={INTENSITY_OPTIONS} value={phase.intensityMax ?? ''} error={issue('intensityMax')} disabled={busy} onChange={(event) => update(index, { intensityMax: (event.target.value || null) as Intensity | null })} />
            </div>
            <TextAreaField label={`${label} — mục tiêu`} maxLength={1000} value={phase.objective ?? ''} error={issue('objective')} disabled={busy} onChange={(event) => update(index, { objective: event.target.value })} />
          </fieldset>;
        })}
        <div className={styles.row}><Button variant="secondary" disabled={busy} onClick={add}>Thêm giai đoạn</Button></div>
        {error && <AlertBanner type="danger" title="Chưa áp dụng được các giai đoạn">{error}</AlertBanner>}
      </form>}
    </div>
  </Modal>;
}
