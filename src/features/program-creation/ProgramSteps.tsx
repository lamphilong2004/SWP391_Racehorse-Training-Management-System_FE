import { ButtonLink,
  AlertBanner, Button, CandidateCard, Card, ChartContainer, Checkbox, EmptyState, HorseCard, KeyValue,
  SelectField, StatusBadge, TextAreaField, TextField,
} from '../../design-system';
import type { ProgramCreationFlow } from './useProgramCreation';
import type { CreateProgramRequest, Intensity, ProgramPhaseInput } from './programTypes';
import type { ProgramValidationIssue } from './programDraft';
import styles from './ProgramCreationPage.module.css';

export function HorseSummary({ flow }: { flow: ProgramCreationFlow }) {
  const horse = flow.horse;
  return horse ? <Card title="Selected horse"><HorseCard className={styles.horseSummary} name={horse.name} meta={`${horse.horseCode}${horse.breed ? ` · ${horse.breed}` : ''}`}
    availability={horse.trainingAvailability} facts={[
      { label: 'Lifecycle', value: horse.lifecycle }, { label: 'Sex', value: horse.sex ?? 'Not provided' },
      { label: 'Foaled', value: horse.foaledDate ?? 'Not provided' },
    ]} /></Card> : <Card title="Selected horse"><p>Select a horse to view its information.</p></Card>;
}

export function AvailabilityNote({ flow }: { flow: ProgramCreationFlow }) {
  return <AlertBanner type={flow.horse?.trainingAvailability === 'LIMITED' ? 'warning' : 'info'} title="Training Availability">
    Availability is managed by the Veterinarian. The server rechecks availability and permissions when you submit.
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
      <AlertBanner type="info" title="A separate program for this horse">Changes apply to this program only. The source template remains unchanged.</AlertBanner>
      <Card title="Program details"><div className={styles.stack}>
        <TextField label="Program name" required maxLength={150} value={draft.name} error={error('name')} onChange={(event) => update({ name: event.target.value })} />
        <TextAreaField label="Goals" maxLength={2000} value={draft.goals ?? ''} error={error('goals')} onChange={(event) => update({ goals: event.target.value })} />
        <div className={styles.fields}>
          <TextField label="Program start date" type="date" required value={draft.periodStart} error={error('periodStart')} onChange={(event) => update({ periodStart: event.target.value })} />
          <TextField label="Program end date" type="date" required value={draft.periodEnd} error={error('periodEnd')} onChange={(event) => update({ periodEnd: event.target.value })} />
        </div>
        <TextAreaField label="Target metrics" maxLength={1000} value={draft.targetMetrics ?? ''} error={error('targetMetrics')} onChange={(event) => update({ targetMetrics: event.target.value })} />
        <TextAreaField label="Notes" maxLength={2000} value={draft.notes ?? ''} error={error('notes')} onChange={(event) => update({ notes: event.target.value })} />
      </div></Card>
      {draft.phases.map((phase, index) => {
        const prefix = `phases[${index}]`;
        const label = `Phase ${index + 1}`;
        return <Card key={index} title={label}><div className={styles.stack}>
          <p className={styles.muted}>Source phase: {phase.templateVersionPhaseId ?? 'None'}</p>
          <div className={styles.fields}>
            <TextField label={`${label} order`} type="number" min={1} step={1} required value={phase.phaseOrder} error={error(`${prefix}.phaseOrder`)} onChange={(event) => phaseUpdate(index, { phaseOrder: Number(event.target.value) })} />
            <TextField label={`${label} name`} required maxLength={150} value={phase.name} error={error(`${prefix}.name`)} onChange={(event) => phaseUpdate(index, { name: event.target.value })} />
            <TextField label={`${label} start date`} type="date" required value={phase.startDate} error={error(`${prefix}.startDate`)} onChange={(event) => phaseUpdate(index, { startDate: event.target.value })} />
            <TextField label={`${label} end date`} type="date" required value={phase.endDate} error={error(`${prefix}.endDate`)} onChange={(event) => phaseUpdate(index, { endDate: event.target.value })} />
          </div>
          <TextAreaField label={`${label} objective`} maxLength={1000} value={phase.objective ?? ''} error={error(`${prefix}.objective`)} onChange={(event) => phaseUpdate(index, { objective: event.target.value })} />
        </div></Card>;
      })}
    </div>
    <div className={styles.stack}><Card title="Source template"><div className={styles.stack}>
      <KeyValue label="Template" value={template.version.name} /><KeyValue label="Version" value={`v${template.version.versionNo}`} />
      <KeyValue label="Suggested duration" value={template.version.recommendedDuration ?? 'Not provided'} />
      <p className={styles.muted}>Set dates for this horse. Every phase must fit inside the program period without overlapping another phase.</p>
    </div></Card><Card title="Program timeline"><div className={styles.stack}>{draft.phases.map((phase, index) => <KeyValue key={index} label={`${phase.phaseOrder}. ${phase.name}`} value={`${phase.startDate || 'Start not set'} → ${phase.endDate || 'End not set'}`} />)}</div></Card><Card title="Exercises come later"><p>Phases set objectives, dates and intensity ranges. The Trainer chooses exercises for each session within the approved phase.</p></Card></div>
  </div>;

  if (step === 4) return <div className={styles.columns}>
    <div className={styles.stack}><Card title="Workload by phase"><div className={styles.table}><table><thead><tr><th>Phase</th><th>Template default → Horse plan</th><th>Intensity range</th></tr></thead><tbody>{draft.phases.map((phase, index) => {
      const label = `Phase ${index + 1}`;
      const prefix = `phases[${index}]`;
      const options = ['LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH'].map((value) => ({ value, label: value.replaceAll('_', ' ') }));
      return <tr key={index}><td><strong>{phase.name}</strong><p>{phase.startDate} — {phase.endDate}</p></td><td><div className={styles.stack}><p className={styles.muted}>Template: {template.version.phases.find((source) => source.id === phase.templateVersionPhaseId)?.intensityGuidance ?? 'Not provided'}</p><TextAreaField label={`${label} workload`} maxLength={500} value={phase.workload ?? ''} error={error(`${prefix}.workload`)} onChange={(event) => phaseUpdate(index, { workload: event.target.value })} /></div></td><td>
        <div className={styles.fields}>
          <SelectField label={`${label} minimum intensity`} placeholder="Not specified" options={options} value={phase.intensityMin ?? ''} error={error(`${prefix}.intensityMin`)} onChange={(event) => phaseUpdate(index, { intensityMin: (event.target.value || null) as Intensity | null })} />
          <SelectField label={`${label} maximum intensity`} placeholder="Not specified" options={options} value={phase.intensityMax ?? ''} error={error(`${prefix}.intensityMax`)} onChange={(event) => phaseUpdate(index, { intensityMax: (event.target.value || null) as Intensity | null })} />
        </div>
      </td></tr>;
    })}</tbody></table></div></Card><ChartContainer title="Planned weekly load" seriesLabel="Load points" values={[]} yTicks={[1, 0]} xLabels={[]} emptyTitle="Weekly load series unavailable" emptyDescription="The contract provides workload guidance as text. No load-point formula is applied." /></div>
    <div className={styles.stack}><Card title="System recommendation"><EmptyState title="Recommendation unavailable" description="No workload recommendation response is exposed by the approved contract." /></Card><Card title="Guidance"><div className={styles.stack}>
      <KeyValue label="Workload / intensity" value={template.version.workloadIntensityGuidance ?? 'Not provided'} />
      <KeyValue label="Recovery" value={template.version.recoveryGuidance ?? 'Not provided'} />
      <p className={styles.muted}>Use the guidance to set a suitable range and workload for this horse.</p>
    </div></Card></div>
  </div>;

  if (step === 5) return <div className={styles.stack}>
    <AlertBanner type="info" title="Select a Trainer">Recommendations describe suitability. Review the reasons and acknowledge any warnings before continuing.</AlertBanner>
    {trainers?.candidates.length ? <div className={styles.candidates}>{trainers.candidates.map((candidate) => <CandidateCard key={candidate.user.id}
      name={candidate.user.fullName} subtitle={`Trainer${candidate.experienceLevel ? ` · ${candidate.experienceLevel}` : ''}`} tags={candidate.skills}
      className={draft.trainer.trainerUserId === candidate.user.id ? styles.selected : undefined}
      facts={[{ label: 'Suitability', value: candidate.label.replaceAll('_', ' ') }, { label: 'Reasons', value: candidate.reasons.join(' · ') || 'Not provided' },
        ...(candidate.warnings.length ? [{ label: 'Warnings', value: candidate.warnings.join(' · ') }] : []),
        ...(candidate.hardBlock ? [{ label: 'Unavailable', value: candidate.hardBlock }] : [])]}
      actions={<Button type="button" variant="secondary" aria-pressed={draft.trainer.trainerUserId === candidate.user.id} disabled={Boolean(candidate.hardBlock)} onClick={() => update({ trainer: { ...draft.trainer, trainerUserId: candidate.user.id, warningsAcknowledged: false, reason: '' } })}>
        {draft.trainer.trainerUserId === candidate.user.id ? `Selected ${candidate.user.fullName}` : `Select ${candidate.user.fullName}`}
      </Button>} />)}</div> : <EmptyState title="No Trainer candidates" description={trainers?.emptyReason ?? 'No candidates were returned for this horse and template version.'} />}
    {error('trainer.trainerUserId') && <p className={styles.error} role="alert">{error('trainer.trainerUserId')}</p>}
    <Card title="Assignment"><div className={styles.stack}>
      <TextField label="Trainer effective from" type="date" required value={draft.trainer.effectiveFrom} error={error('trainer.effectiveFrom')} onChange={(event) => update({ trainer: { ...draft.trainer, effectiveFrom: event.target.value } })} />
      <TextAreaField label="Assignment reason" maxLength={500} value={draft.trainer.reason ?? ''} error={error('trainer.reason')} onChange={(event) => update({ trainer: { ...draft.trainer, reason: event.target.value } })} />
      {Boolean(selectedTrainer?.warnings.length) && <>
        <AlertBanner type="warning" title="Trainer warnings"><ul className={styles.reasons}>{selectedTrainer!.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></AlertBanner>
        <Checkbox label="I acknowledge the Trainer warnings" checked={draft.trainer.warningsAcknowledged ?? false} required aria-invalid={Boolean(error('trainer.warningsAcknowledged'))} aria-describedby={error('trainer.warningsAcknowledged') ? 'trainer-warning-error' : undefined} onChange={(event) => update({ trainer: { ...draft.trainer, warningsAcknowledged: event.target.checked } })} />
        {error('trainer.warningsAcknowledged') && <p id="trainer-warning-error" className={styles.error} role="alert">{error('trainer.warningsAcknowledged')}</p>}
      </>}
    </div></Card>
  </div>;

  if (step === 6) return <div className={styles.columns}>
    <div className={styles.stack}>
      <Card title="Program summary" action={<Button type="button" variant="tertiary" onClick={() => edit(3)}>Edit program</Button>}><div className={styles.stack}>
        <KeyValue label="Name" value={draft.name} /><KeyValue label="Period" value={`${draft.periodStart} — ${draft.periodEnd}`} />
        <KeyValue label="Goals" value={draft.goals || 'Not specified'} /><KeyValue label="Target metrics" value={draft.targetMetrics || 'Not specified'} />
        <KeyValue label="Notes" value={draft.notes || 'Not specified'} /><KeyValue label="Source" value={`${template.template.templateCode} · v${template.version.versionNo}`} />
      </div></Card>
      <Card title="Phases" action={<Button type="button" variant="tertiary" onClick={() => edit(4)}>Edit workload</Button>}><div className={styles.stack}>
        {[...draft.phases].sort((a, b) => a.phaseOrder - b.phaseOrder).map((phase, index) => <div className={styles.summary} key={index}>
          <h3>{phase.phaseOrder}. {phase.name}</h3><p>{phase.startDate} — {phase.endDate}</p><p>{phase.objective}</p>
          <p>Intensity: {phase.intensityMin ?? 'Not specified'} — {phase.intensityMax ?? 'Not specified'}</p><p>Workload: {phase.workload || 'Not specified'}</p>
        </div>)}
      </div></Card>
      <Card title="Trainer" action={<Button type="button" variant="tertiary" onClick={() => edit(5)}>Edit Trainer</Button>}><div className={styles.stack}>
        <KeyValue label="Trainer" value={selectedTrainer?.user.fullName ?? 'Not selected'} /><KeyValue label="Effective from" value={draft.trainer.effectiveFrom} />
        <KeyValue label="Reason" value={draft.trainer.reason || 'Not specified'} />
        {Boolean(selectedTrainer?.warnings.length) && <KeyValue label="Warnings acknowledged" value={draft.trainer.warningsAcknowledged ? 'Yes' : 'No'} />}
      </div></Card>
    </div>
    <div className={styles.stack}><HorseSummary flow={flow} /><AvailabilityNote flow={flow} />
      <AlertBanner type="info" title="Create and activate">The server validates the current horse, template and Trainer state before creating the program.</AlertBanner>
    </div>
  </div>;
  return null;
}

export function ProgramResult({ flow, reload, reloading, readError }: { flow: ProgramCreationFlow; reload: () => void; reloading: boolean; readError: string | null }) {
  const program = flow.created!;
  return <div className={styles.stack}>
    <AlertBanner type="success" title="Program created">Program ID: {program.id}</AlertBanner>
      <ButtonLink to={`/training/programs/${program.id}`}>Open Program Detail</ButtonLink>
    <Card title={program.name}><div className={styles.stack}>
      <StatusBadge family="program" status={program.status} /><KeyValue label="Horse" value={`${program.horse.name} · ${program.horse.horseCode}`} />
      <KeyValue label="Period" value={`${program.periodStart} — ${program.periodEnd}`} /><KeyValue label="Template version" value={`v${program.sourceTemplateVersion}`} />
      <KeyValue label="Trainer" value={program.currentTrainer?.fullName ?? 'Not included in response'} />
      <KeyValue label="Activated at" value={program.activatedAt} />
      {program.phases.map((phase) => <p key={phase.id}>{phase.phaseOrder}. {phase.name} · {phase.startDate} — {phase.endDate}</p>)}
      <Button type="button" variant="secondary" disabled={reloading} onClick={reload}>{reloading ? 'Reloading…' : 'Reload saved program'}</Button>
      {readError && <AlertBanner type="danger" title="Read-back failed">{readError}</AlertBanner>}
    </div></Card>
  </div>;
}
