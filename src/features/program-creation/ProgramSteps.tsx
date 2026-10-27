import { ButtonLink,
  AlertBanner, Button, CandidateCard, Card, ChartContainer, Checkbox, EmptyState, HorseCard, KeyValue,
  SelectField, StatusBadge, TextAreaField, TextField,
} from '../../design-system';
import type { ProgramCreationFlow } from './useProgramCreation';
import type { CreateProgramRequest, Intensity, ProgramPhaseInput } from './programTypes';
import type { ProgramValidationIssue } from './programDraft';
import styles from './ProgramCreationPage.module.css';
import { sexLabel, strengthSummary } from '../horses/shared/options';
import { viLabel } from '../../shared/viLabels';
import { dateTime } from '../evaluation/models';
import { clubDate } from '../../shared/clubCalendar';

export function HorseSummary({ flow }: { flow: ProgramCreationFlow }) {
  const horse = flow.horse;
  return horse ? <Card title="Ngựa đã chọn"><HorseCard className={styles.horseSummary} name={horse.name} meta={`${horse.horseCode}${horse.breed ? ` · ${horse.breed}` : ''}`}
    availability={horse.trainingAvailability} facts={[
      { label: 'Vòng đời', value: horse.lifecycle }, { label: 'Giới tính', value: sexLabel(horse.sex) ?? 'Chưa cung cấp' },
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

  if (step === 3) return <div className={styles.columns}>
    <div className={styles.stack}>
      <AlertBanner type="info" title="Chương trình riêng cho ngựa này">Thay đổi chỉ áp dụng cho chương trình này. Mẫu gốc không bị thay đổi.</AlertBanner>
      <Card title="Thông tin chương trình"><div className={styles.stack}>
        <TextField label="Tên chương trình" required maxLength={150} value={draft.name} error={error('name')} onChange={(event) => update({ name: event.target.value })} />
        <TextAreaField label="Mục tiêu huấn luyện" maxLength={2000} value={draft.goals ?? ''} error={error('goals')} onChange={(event) => update({ goals: event.target.value })} />
        <div className={styles.fields}>
          <TextField label="Ngày bắt đầu chương trình" type="date" required min={clubDate()} helperText="Từ hôm nay trở đi, theo giờ Việt Nam." value={draft.periodStart} error={error('periodStart')} onChange={(event) => update({ periodStart: event.target.value })} />
          <TextField label="Ngày kết thúc chương trình" type="date" required min={draft.periodStart || clubDate()} value={draft.periodEnd} error={error('periodEnd')} onChange={(event) => update({ periodEnd: event.target.value })} />
        </div>
        <TextAreaField label="Chỉ số mục tiêu" maxLength={1000} value={draft.targetMetrics ?? ''} error={error('targetMetrics')} onChange={(event) => update({ targetMetrics: event.target.value })} />
        <TextAreaField label="Ghi chú" maxLength={2000} value={draft.notes ?? ''} error={error('notes')} onChange={(event) => update({ notes: event.target.value })} />
      </div></Card>
      {draft.phases.map((phase, index) => {
        const prefix = `phases[${index}]`;
        const label = `Giai đoạn ${index + 1}`;
        return <Card key={index} title={label}><div className={styles.stack}>
          <p className={styles.muted}>Giai đoạn gốc: {phase.templateVersionPhaseId ?? 'Không có'}</p>
          <div className={styles.fields}>
            <TextField label={`${label} order`} type="number" min={1} step={1} required value={phase.phaseOrder} error={error(`${prefix}.phaseOrder`)} onChange={(event) => phaseUpdate(index, { phaseOrder: Number(event.target.value) })} />
            <TextField label={`${label} — tên`} required maxLength={150} value={phase.name} error={error(`${prefix}.name`)} onChange={(event) => phaseUpdate(index, { name: event.target.value })} />
            <TextField label={`${label} — ngày bắt đầu`} type="date" required min={draft.periodStart || clubDate()} max={draft.periodEnd || undefined} value={phase.startDate} error={error(`${prefix}.startDate`)} onChange={(event) => phaseUpdate(index, { startDate: event.target.value })} />
            <TextField label={`${label} — ngày kết thúc`} type="date" required min={phase.startDate || draft.periodStart || clubDate()} max={draft.periodEnd || undefined} value={phase.endDate} error={error(`${prefix}.endDate`)} onChange={(event) => phaseUpdate(index, { endDate: event.target.value })} />
          </div>
          <TextAreaField label={`${label} — mục tiêu`} maxLength={1000} value={phase.objective ?? ''} error={error(`${prefix}.objective`)} onChange={(event) => phaseUpdate(index, { objective: event.target.value })} />
        </div></Card>;
      })}
    </div>
    <div className={styles.stack}><Card title="Mẫu gốc"><div className={styles.stack}>
      <KeyValue label="Mẫu chương trình" value={template.version.name} /><KeyValue label="Phiên bản" value={`v${template.version.versionNo}`} />
      <KeyValue label="Thời lượng gợi ý" value={template.version.recommendedDuration ?? 'Chưa cung cấp'} />
      <p className={styles.muted}>Đặt ngày cho ngựa này. Mỗi giai đoạn phải nằm trong thời gian chương trình và không chồng lấn giai đoạn khác.</p>
    </div></Card><Card title="Dòng thời gian chương trình"><div className={styles.stack}>{draft.phases.map((phase, index) => <KeyValue key={index} label={`${phase.phaseOrder}. ${phase.name}`} value={`${phase.startDate || 'Chưa đặt ngày bắt đầu'} → ${phase.endDate || 'Chưa đặt ngày kết thúc'}`} />)}</div></Card><Card title="Bài tập được chọn sau"><p>Giai đoạn đặt mục tiêu, ngày và khoảng cường độ. Trainer chọn bài tập cho từng buổi tập trong giai đoạn đã duyệt.</p></Card></div>
  </div>;

  if (step === 4) return <div className={styles.columns}>
    <div className={styles.stack}><Card title="Khối lượng theo giai đoạn"><div className={styles.table}><table><thead><tr><th>Giai đoạn</th><th>Mặc định của mẫu → Kế hoạch cho ngựa</th><th>Khoảng cường độ</th></tr></thead><tbody>{draft.phases.map((phase, index) => {
      const label = `Giai đoạn ${index + 1}`;
      const prefix = `phases[${index}]`;
      const options = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'].map((value) => ({ value, label: viLabel(value) }));
      return <tr key={index}><td><strong>{phase.name}</strong><p>{phase.startDate} — {phase.endDate}</p></td><td><div className={styles.stack}><p className={styles.muted}>Mẫu: {template.version.phases.find((source) => source.id === phase.templateVersionPhaseId)?.intensityGuidance ?? 'Chưa cung cấp'}</p><TextAreaField label={`${label} — khối lượng`} maxLength={500} value={phase.workload ?? ''} error={error(`${prefix}.workload`)} onChange={(event) => phaseUpdate(index, { workload: event.target.value })} /></div></td><td>
        <div className={styles.fields}>
          <SelectField label={`${label} — cường độ tối thiểu`} placeholder="Chưa xác định" options={options} value={phase.intensityMin ?? ''} error={error(`${prefix}.intensityMin`)} onChange={(event) => phaseUpdate(index, { intensityMin: (event.target.value || null) as Intensity | null })} />
          <SelectField label={`${label} — cường độ tối đa`} placeholder="Chưa xác định" options={options} value={phase.intensityMax ?? ''} error={error(`${prefix}.intensityMax`)} onChange={(event) => phaseUpdate(index, { intensityMax: (event.target.value || null) as Intensity | null })} />
        </div>
      </td></tr>;
    })}</tbody></table></div></Card><ChartContainer title="Khối lượng dự kiến theo tuần" seriesLabel="Điểm khối lượng" values={[]} yTicks={[1, 0]} xLabels={[]} emptyTitle="Chưa có chuỗi khối lượng theo tuần" emptyDescription="Hệ thống chỉ cung cấp hướng dẫn khối lượng dạng văn bản. Không áp dụng công thức tính điểm." /></div>
    <div className={styles.stack}><Card title="Gợi ý của hệ thống"><EmptyState title="Chưa có gợi ý" description="Hệ thống chưa cung cấp gợi ý khối lượng." /></Card><Card title="Hướng dẫn"><div className={styles.stack}>
      <KeyValue label="Khối lượng / cường độ" value={template.version.workloadIntensityGuidance ?? 'Chưa cung cấp'} />
      <KeyValue label="Hồi phục" value={template.version.recoveryGuidance ?? 'Chưa cung cấp'} />
      <p className={styles.muted}>Dựa vào hướng dẫn để đặt khoảng cường độ và khối lượng phù hợp cho ngựa này.</p>
    </div></Card></div>
  </div>;

  if (step === 5) return <div className={styles.stack}>
    <AlertBanner type="info" title="Chọn Trainer">Gợi ý mô tả mức phù hợp. Hãy xem lý do và xác nhận các cảnh báo trước khi tiếp tục.</AlertBanner>
    {trainers?.candidates.length ? <div className={styles.candidates}>{trainers.candidates.map((candidate) => <CandidateCard key={candidate.user.id}
      name={candidate.user.fullName} subtitle={`Trainer${candidate.experienceLevel ? ` · ${candidate.experienceLevel}` : ''}`} tags={candidate.skills}
      className={draft.trainer.trainerUserId === candidate.user.id ? styles.selected : undefined}
      facts={[{ label: 'Mức phù hợp', value: candidate.label.replaceAll('_', ' ') }, { label: 'Lý do', value: candidate.reasons.join(' · ') || 'Chưa cung cấp' },
        ...(candidate.warnings.length ? [{ label: 'Cảnh báo', value: candidate.warnings.join(' · ') }] : []),
        ...(candidate.hardBlock ? [{ label: 'Không có', value: candidate.hardBlock }] : [])]}
      actions={<Button type="button" variant="secondary" aria-pressed={draft.trainer.trainerUserId === candidate.user.id} disabled={Boolean(candidate.hardBlock)} onClick={() => update({ trainer: { ...draft.trainer, trainerUserId: candidate.user.id, warningsAcknowledged: false, reason: '' } })}>
        {draft.trainer.trainerUserId === candidate.user.id ? `Đã chọn ${candidate.user.fullName}` : `Chọn ${candidate.user.fullName}`}
      </Button>} />)}</div> : <EmptyState title="Không có Trainer phù hợp" description={trainers?.emptyReason ?? 'Không có ứng viên cho ngựa và phiên bản mẫu này.'} />}
    {error('trainer.trainerUserId') && <p className={styles.error} role="alert">{error('trainer.trainerUserId')}</p>}
    <Card title="Phân công"><div className={styles.stack}>
      <TextField label="Trainer phụ trách từ ngày" type="date" required value={draft.trainer.effectiveFrom} error={error('trainer.effectiveFrom')} onChange={(event) => update({ trainer: { ...draft.trainer, effectiveFrom: event.target.value } })} />
      <TextAreaField label="Lý do phân công" maxLength={500} value={draft.trainer.reason ?? ''} error={error('trainer.reason')} onChange={(event) => update({ trainer: { ...draft.trainer, reason: event.target.value } })} />
      {Boolean(selectedTrainer?.warnings.length) && <>
        <AlertBanner type="warning" title="Cảnh báo về Trainer"><ul className={styles.reasons}>{selectedTrainer!.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></AlertBanner>
        <Checkbox label="Tôi đã đọc các cảnh báo về Trainer" checked={draft.trainer.warningsAcknowledged ?? false} required aria-invalid={Boolean(error('trainer.warningsAcknowledged'))} aria-describedby={error('trainer.warningsAcknowledged') ? 'trainer-warning-error' : undefined} onChange={(event) => update({ trainer: { ...draft.trainer, warningsAcknowledged: event.target.checked } })} />
        {error('trainer.warningsAcknowledged') && <p id="trainer-warning-error" className={styles.error} role="alert">{error('trainer.warningsAcknowledged')}</p>}
      </>}
    </div></Card>
  </div>;

  if (step === 6) return <div className={styles.columns}>
    <div className={styles.stack}>
      <Card title="Tóm tắt chương trình" action={<Button type="button" variant="tertiary" onClick={() => edit(3)}>Sửa chương trình</Button>}><div className={styles.stack}>
        <KeyValue label="Họ tên" value={draft.name} /><KeyValue label="Thời gian" value={`${draft.periodStart} — ${draft.periodEnd}`} />
        <KeyValue label="Mục tiêu huấn luyện" value={draft.goals || 'Chưa xác định'} /><KeyValue label="Chỉ số mục tiêu" value={draft.targetMetrics || 'Chưa xác định'} />
        <KeyValue label="Ghi chú" value={draft.notes || 'Chưa xác định'} /><KeyValue label="Nguồn" value={`${template.template.templateCode} · v${template.version.versionNo}`} />
      </div></Card>
      <Card title="Giai đoạn" action={<Button type="button" variant="tertiary" onClick={() => edit(4)}>Sửa khối lượng</Button>}><div className={styles.stack}>
        {[...draft.phases].sort((a, b) => a.phaseOrder - b.phaseOrder).map((phase, index) => <div className={styles.summary} key={index}>
          <h3>{phase.phaseOrder}. {phase.name}</h3><p>{phase.startDate} — {phase.endDate}</p><p>{phase.objective}</p>
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
    <AlertBanner type="success" title="Đã tạo chương trình">Mã chương trình: {program.id}</AlertBanner>
      <ButtonLink to={`/training/programs/${program.id}`}>Mở chi tiết chương trình</ButtonLink>
    <Card title={program.name}><div className={styles.stack}>
      <StatusBadge family="program" status={program.status} /><KeyValue label="Ngựa" value={`${program.horse.name} · ${program.horse.horseCode}`} />
      <KeyValue label="Thời gian" value={`${program.periodStart} — ${program.periodEnd}`} /><KeyValue label="Phiên bản mẫu" value={`v${program.sourceTemplateVersion}`} />
      <KeyValue label="Trainer" value={program.currentTrainer?.fullName ?? 'Không có trong dữ liệu trả về'} />
      <KeyValue label="Kích hoạt lúc" value={<time dateTime={program.activatedAt} title={program.activatedAt}>{dateTime(program.activatedAt)}</time>} />
      {program.phases.map((phase) => <p key={phase.id}>{phase.phaseOrder}. {phase.name} · {phase.startDate} — {phase.endDate}</p>)}
      <Button type="button" variant="secondary" disabled={reloading} onClick={reload}>{reloading ? 'Đang tải lại…' : 'Tải lại chương trình đã lưu'}</Button>
      {readError && <AlertBanner type="danger" title="Không đọc lại được">{readError}</AlertBanner>}
    </div></Card>
  </div>;
}
