import { ButtonLink,
  AlertBanner, Button, CandidateCard, Card, Checkbox, EmptyState, HorseCard, KeyValue, OptionalFields,
  SelectField, StatusBadge, TextAreaField, TextField,
} from '../../design-system';
import type { ProgramCreationFlow } from './useProgramCreation';
import type { CreateProgramRequest, Intensity, ProgramPhaseInput } from './programTypes';
import type { ProgramValidationIssue } from './programDraft';
import styles from './ProgramCreationPage.module.css';
import { sexLabel, strengthSummary } from '../horses/shared/options';
import { viLabel } from '../../shared/viLabels';
import { serverText } from '../../shared/serverText';
import { dateTime } from '../evaluation/models';
import { clubDate } from '../../shared/clubCalendar';
import { formatDate } from '../horses/shared/format';

export function HorseSummary({ flow }: { flow: ProgramCreationFlow }) {
  const horse = flow.horse;
  return horse ? <Card title="Ngựa đã chọn"><HorseCard className={styles.horseSummary} name={horse.name} meta={`${horse.horseCode}${horse.breed ? ` · ${horse.breed}` : ''}`}
    availability={horse.trainingAvailability} facts={[
      { label: 'Vòng đời', value: viLabel(horse.lifecycle) }, { label: 'Giới tính', value: sexLabel(horse.sex) ?? 'Chưa cung cấp' },
      { label: 'Ngày sinh', value: horse.foaledDate ?? 'Chưa cung cấp' },
      { label: 'Thế mạnh (Club Manager khai báo)', value: strengthSummary(horse.strengths) },
    ]} /></Card> : <Card title="Ngựa đã chọn"><p>Chọn một ngựa để xem thông tin.</p></Card>;
}

export function AvailabilityNote({ flow }: { flow: ProgramCreationFlow }) {
  return <AlertBanner type={flow.horse?.trainingAvailability === 'LIMITED' ? 'warning' : 'info'} title="Khả năng tập luyện">
    Khả năng tập luyện do Veterinarian quản lý. Hệ thống kiểm tra lại khả năng tập luyện và quyền hạn khi bạn gửi.
  </AlertBanner>;
}

export function DraftSteps({ step, flow, issues, update, edit }: {
  step: number; flow: ProgramCreationFlow; issues: ProgramValidationIssue[];
  update: (patch: Partial<Omit<CreateProgramRequest, 'horseId' | 'templateVersionId'>>) => void;
  edit: (step: number) => void;
}) {
  const { draft, template, trainers } = flow;
  if (!draft || !template) return null;
  const error = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const phaseUpdate = (index: number, patch: Partial<ProgramPhaseInput>) => update({ phases: draft.phases.map((phase, i) => i === index ? { ...phase, ...patch } : phase) });
  const selectedTrainer = trainers?.candidates.find((item) => item.user.id === draft.trainer.trainerUserId);
  const chooseTrainer = (id: number) => {
    if (draft.trainer.trainerUserId === id) return;
    update({ trainer: { ...draft.trainer, trainerUserId: id, effectiveFrom: draft.trainer.effectiveFrom || draft.periodStart, warningsAcknowledged: false, reason: '' } });
  };

  if (step === 3) return <div className={styles.stack}>
      <Card title="Thông tin chương trình"><div className={styles.stack}>
        <TextField label="Tên chương trình" required maxLength={150} value={draft.name} error={error('name')} onChange={(event) => update({ name: event.target.value })} />
        <TextAreaField label="Mục tiêu huấn luyện" maxLength={2000} value={draft.goals ?? ''} error={error('goals')} onChange={(event) => update({ goals: event.target.value })} />
        <div className={styles.fields}>
          <TextField label="Ngày bắt đầu chương trình" type="date" required min={clubDate()} helperText="Từ hôm nay trở đi, theo giờ Việt Nam." value={draft.periodStart} error={error('periodStart')} onChange={(event) => update({ periodStart: event.target.value })} />
          <TextField label="Ngày kết thúc chương trình" type="date" required min={draft.periodStart || clubDate()} value={draft.periodEnd} error={error('periodEnd')} onChange={(event) => update({ periodEnd: event.target.value })} />
        </div>
        <OptionalFields label="Chỉ số mục tiêu và ghi chú" reveal={Boolean(draft.targetMetrics || draft.notes || error('targetMetrics') || error('notes'))}>
          <TextAreaField label="Chỉ số mục tiêu" maxLength={1000} value={draft.targetMetrics ?? ''} error={error('targetMetrics')} onChange={(event) => update({ targetMetrics: event.target.value })} />
          <TextAreaField label="Ghi chú" maxLength={2000} value={draft.notes ?? ''} error={error('notes')} onChange={(event) => update({ notes: event.target.value })} />
        </OptionalFields>
      </div></Card>
      <p className={styles.stepHint}>Chọn ngày cho từng giai đoạn trong thời gian chương trình. Các giai đoạn không được chồng lấn.</p>
      <div className={styles.phaseSettings}>
      {draft.phases.map((phase, index) => {
        const prefix = `phases[${index}]`;
        const label = `Giai đoạn ${index + 1}`;
        return <Card key={index} title={label}><div className={styles.stack}>
          <div className={styles.fields}>
            <TextField label={`${label} — thứ tự`} type="number" min={1} step={1} required value={phase.phaseOrder} error={error(`${prefix}.phaseOrder`)} onChange={(event) => phaseUpdate(index, { phaseOrder: Number(event.target.value) })} />
            <TextField label={`${label} — tên`} required maxLength={150} value={phase.name} error={error(`${prefix}.name`)} onChange={(event) => phaseUpdate(index, { name: event.target.value })} />
            <TextField label={`${label} — ngày bắt đầu`} type="date" required min={draft.periodStart || clubDate()} max={draft.periodEnd || undefined} value={phase.startDate} error={error(`${prefix}.startDate`)} onChange={(event) => phaseUpdate(index, { startDate: event.target.value })} />
            <TextField label={`${label} — ngày kết thúc`} type="date" required min={phase.startDate || draft.periodStart || clubDate()} max={draft.periodEnd || undefined} value={phase.endDate} error={error(`${prefix}.endDate`)} onChange={(event) => phaseUpdate(index, { endDate: event.target.value })} />
          </div>
          <OptionalFields label="Mục tiêu giai đoạn" reveal={Boolean(phase.objective || error(`${prefix}.objective`))}>
            <TextAreaField label={`${label} — mục tiêu`} maxLength={1000} value={phase.objective ?? ''} error={error(`${prefix}.objective`)} onChange={(event) => phaseUpdate(index, { objective: event.target.value })} />
          </OptionalFields>
        </div></Card>;
      })}
      </div>
  </div>;

  if (step === 4) return <div className={styles.columns}>
    <Card title="Khối lượng theo giai đoạn"><div className={styles.phaseList}>{draft.phases.map((phase, index) => {
      const label = `Giai đoạn ${index + 1}`;
      const prefix = `phases[${index}]`;
      const options = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'].map((value) => ({ value, label: viLabel(value) }));
      const guidance = template.version.phases.find((source) => source.id === phase.templateVersionPhaseId)?.intensityGuidance;
      return <section key={index} className={styles.workloadPhase}>
        <header className={styles.phaseHeader}>
          <h3>{label} · {phase.name}</h3>
          <p>{formatDate(phase.startDate)} — {formatDate(phase.endDate)}</p>
        </header>
        {guidance && <p className={styles.phaseGuidance}><strong>Hướng dẫn từ mẫu</strong> {guidance}</p>}
        <div className={styles.fields}>
          <SelectField label={`${label} — cường độ tối thiểu`} placeholder="Chưa xác định" options={options} value={phase.intensityMin ?? ''} error={error(`${prefix}.intensityMin`)} onChange={(event) => phaseUpdate(index, { intensityMin: (event.target.value || null) as Intensity | null })} />
          <SelectField label={`${label} — cường độ tối đa`} placeholder="Chưa xác định" options={options} value={phase.intensityMax ?? ''} error={error(`${prefix}.intensityMax`)} onChange={(event) => phaseUpdate(index, { intensityMax: (event.target.value || null) as Intensity | null })} />
        </div>
        <TextAreaField label={`${label} — khối lượng`} rows={2} maxLength={500} value={phase.workload ?? ''} error={error(`${prefix}.workload`)} onChange={(event) => phaseUpdate(index, { workload: event.target.value })} />
      </section>;
    })}</div></Card>
    <Card title="Hướng dẫn lập kế hoạch"><div className={styles.stack}>
      <p className={styles.muted}>Dựa vào hướng dẫn để đặt khoảng cường độ và khối lượng phù hợp cho ngựa này.</p>
      {template.version.workloadIntensityGuidance && <KeyValue label="Khối lượng / cường độ" value={<span className={styles.summary}>{template.version.workloadIntensityGuidance}</span>} />}
      {template.version.recoveryGuidance && <KeyValue label="Hồi phục" value={<span className={styles.summary}>{template.version.recoveryGuidance}</span>} />}
    </div></Card>
  </div>;

  if (step === 5) return <div className={styles.stack}>
    <p className={styles.stepHint}>Chọn Trainer, kiểm tra ngày phân công và xác nhận cảnh báo nếu có.</p>
    {trainers?.candidates.length ? <div className={styles.candidates}>{trainers.candidates.map((candidate) => <CandidateCard key={candidate.user.id}
      name={candidate.user.fullName} subtitle={`Trainer${candidate.experienceLevel ? ` · ${candidate.experienceLevel}` : ''}`} tags={candidate.skills}
      onSelect={candidate.hardBlock ? undefined : () => chooseTrainer(candidate.user.id)}
      className={draft.trainer.trainerUserId === candidate.user.id ? styles.selected : undefined}
      facts={[{ label: 'Mức phù hợp', value: viLabel(candidate.label) }, { label: 'Lý do', value: candidate.reasons.map(serverText).join(' · ') || 'Chưa cung cấp' },
        ...(candidate.warnings.length ? [{ label: 'Cảnh báo', value: candidate.warnings.map(serverText).join(' · ') }] : []),
        ...(candidate.hardBlock ? [{ label: 'Không thể phân công', value: serverText(candidate.hardBlock) }] : [])]}
      actions={<Button type="button" variant="secondary" aria-pressed={draft.trainer.trainerUserId === candidate.user.id} disabled={Boolean(candidate.hardBlock)} onClick={() => chooseTrainer(candidate.user.id)}>
        {draft.trainer.trainerUserId === candidate.user.id ? `Đã chọn ${candidate.user.fullName}` : `Chọn ${candidate.user.fullName}`}
      </Button>} />)}</div> : <EmptyState title="Không có Trainer phù hợp" description={serverText(trainers?.emptyReason) || 'Không có ứng viên cho ngựa và phiên bản mẫu này.'} />}
    {error('trainer.trainerUserId') && <p className={styles.error} role="alert">{error('trainer.trainerUserId')}</p>}
    <Card title="Phân công"><div className={styles.stack}>
      <TextField label="Trainer phụ trách từ ngày" type="date" required value={draft.trainer.effectiveFrom} helperText="Mặc định là ngày bắt đầu chương trình khi chọn Trainer. Bạn có thể điều chỉnh ngày phân công." error={error('trainer.effectiveFrom')} onChange={(event) => update({ trainer: { ...draft.trainer, effectiveFrom: event.target.value } })} />
      <TextAreaField label="Lý do phân công" maxLength={500} value={draft.trainer.reason ?? ''} error={error('trainer.reason')} onChange={(event) => update({ trainer: { ...draft.trainer, reason: event.target.value } })} />
      {Boolean(selectedTrainer?.warnings.length) && <>
        <AlertBanner type="warning" title="Cảnh báo về Trainer"><ul className={styles.reasons}>{selectedTrainer!.warnings.map((warning) => <li key={warning}>{serverText(warning)}</li>)}</ul></AlertBanner>
        <Checkbox label="Tôi đã đọc các cảnh báo về Trainer" checked={draft.trainer.warningsAcknowledged ?? false} required aria-invalid={Boolean(error('trainer.warningsAcknowledged'))} aria-describedby={error('trainer.warningsAcknowledged') ? 'trainer-warning-error' : undefined} onChange={(event) => update({ trainer: { ...draft.trainer, warningsAcknowledged: event.target.checked } })} />
        {error('trainer.warningsAcknowledged') && <p id="trainer-warning-error" className={styles.error} role="alert">{error('trainer.warningsAcknowledged')}</p>}
      </>}
    </div></Card>
  </div>;

  if (step === 6) return <div className={styles.columns}>
    <div className={styles.stack}>
      <Card title="Tóm tắt chương trình" action={<Button type="button" variant="tertiary" onClick={() => edit(3)}>Sửa chương trình</Button>}><div className={styles.stack}>
        <KeyValue label="Tên chương trình" value={draft.name} /><KeyValue label="Thời gian" value={`${formatDate(draft.periodStart)} — ${formatDate(draft.periodEnd)}`} />
        <KeyValue label="Mục tiêu huấn luyện" value={draft.goals || 'Chưa xác định'} /><KeyValue label="Chỉ số mục tiêu" value={draft.targetMetrics || 'Chưa xác định'} />
        <KeyValue label="Ghi chú" value={draft.notes || 'Chưa xác định'} /><KeyValue label="Nguồn" value={`${template.template.templateCode} · v${template.version.versionNo}`} />
      </div></Card>
      <Card title="Giai đoạn" action={<Button type="button" variant="tertiary" onClick={() => edit(4)}>Sửa khối lượng</Button>}><div className={styles.stack}>
        {[...draft.phases].sort((a, b) => a.phaseOrder - b.phaseOrder).map((phase, index) => <div className={styles.summary} key={index}>
          <h3>{phase.phaseOrder}. {phase.name}</h3><p>{formatDate(phase.startDate)} — {formatDate(phase.endDate)}</p><p>{phase.objective}</p>
          <p>Cường độ: {viLabel(phase.intensityMin, 'Chưa xác định')} — {viLabel(phase.intensityMax, 'Chưa xác định')}</p><p>Khối lượng: {phase.workload || 'Chưa xác định'}</p>
        </div>)}
      </div></Card>
      <Card title="Trainer" action={<Button type="button" variant="tertiary" onClick={() => edit(5)}>Sửa Trainer</Button>}><div className={styles.stack}>
        <KeyValue label="Trainer" value={selectedTrainer?.user.fullName ?? 'Chưa chọn'} /><KeyValue label="Hiệu lực từ" value={draft.trainer.effectiveFrom} />
        <KeyValue label="Lý do" value={draft.trainer.reason || 'Chưa xác định'} />
        {Boolean(selectedTrainer?.warnings.length) && <KeyValue label="Đã xác nhận cảnh báo" value={draft.trainer.warningsAcknowledged ? 'Có' : 'Chưa có'} />}
      </div></Card>
    </div>
    <div className={styles.stack}><HorseSummary flow={flow} /><AvailabilityNote flow={flow} />
      <AlertBanner type="info" title="Tạo và kích hoạt">Hệ thống kiểm tra lại ngựa, mẫu chương trình và Trainer trước khi tạo chương trình.</AlertBanner>
    </div>
  </div>;
  return null;
}

export function ProgramResult({ flow, reload, reloading, readError }: { flow: ProgramCreationFlow; reload: () => void; reloading: boolean; readError: string | null }) {
  const program = flow.created!;
  return <div className={styles.stack}>
    <AlertBanner feedback type="success" title="Đã tạo chương trình">Mã chương trình: {program.id}</AlertBanner>
      <ButtonLink to={`/training/programs/${program.id}`}>Mở chi tiết chương trình</ButtonLink>
    <Card title={program.name}><div className={styles.stack}>
      <StatusBadge family="program" status={program.status} /><KeyValue label="Ngựa" value={`${program.horse.name} · ${program.horse.horseCode}`} />
      <KeyValue label="Thời gian" value={`${formatDate(program.periodStart)} — ${formatDate(program.periodEnd)}`} /><KeyValue label="Phiên bản mẫu" value={`v${program.sourceTemplateVersion}`} />
      <KeyValue label="Trainer" value={program.currentTrainer?.fullName ?? 'Không có trong dữ liệu trả về'} />
      <KeyValue label="Kích hoạt lúc" value={<time dateTime={program.activatedAt} title={program.activatedAt}>{dateTime(program.activatedAt)}</time>} />
      {program.phases.map((phase) => <p key={phase.id}>{phase.phaseOrder}. {phase.name} · {formatDate(phase.startDate)} — {formatDate(phase.endDate)}</p>)}
      <Button type="button" variant="secondary" disabled={reloading} onClick={reload}>{reloading ? 'Đang tải lại…' : 'Tải lại chương trình đã lưu'}</Button>
      {readError && <AlertBanner feedback type="danger" title="Không đọc lại được">{readError}</AlertBanner>}
    </div></Card>
  </div>;
}
