import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ButtonLink, AlertBanner, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, StatusBadge, Tabs } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { dateTime, metric } from '../evaluation/models';
import { FlowShell } from '../main-flows/FlowShell';
import { idOf, useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import { createProgramDetailApi, type ProgramHistoryEntry, type ProgramProgress } from './programDetailApi';
import styles from '../main-flows/flow.module.css';

/** SCR-TRAIN-002/022: read-only Overview, Progress and History. Row scope remains enforced by Backend. */
export function ProgramDetailPage() {
  const { id } = useParams();
  return <ProgramDetailContent key={id} rawId={id} />;
}
function ProgramDetailContent({ rawId }: { rawId?: string }) {
  const { user } = useAuth(), request = useFlowRequest(), api = useMemo(() => createProgramDetailApi(request), [request]);
  const [tab, setTab] = useState('overview');
  const load = useCallback(async (signal: AbortSignal) => api.read(idOf(rawId), signal), [api, rawId]);
  const program = useResource(load), data = program.data;
  const canReadHistory = user?.roles.some((role) => ['HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER'].includes(role)) ?? false;
  const role = user?.roles.find((value) => ['HEAD_TRAINER', 'TRAINER', 'CLUB_MANAGER', 'VETERINARIAN', 'GROOM'].includes(value)) ?? 'HEAD_TRAINER';
  return <FlowShell title={data ? `${data.horse.name} · ${data.horse.horseCode}` : 'Program Detail'} description={data?.name} section="Horse Training Programs" role={role} actions={<div className={styles.row}>
    {user?.roles.includes('HEAD_TRAINER') && <ButtonLink to="/training/programs">Back to Program List</ButtonLink>}
    {user?.roles.includes('TRAINER') && <ButtonLink to="/training/programs/assigned">Back to Assigned Programs</ButtonLink>}
    <ButtonLink to="/dashboard">Back to workspace</ButtonLink>
  </div>}>
    {program.pending && <LoadingState label="Loading program…" />}
    {program.error && <ErrorState title="Program unavailable" description={program.error} onRetry={program.reload} />}
    {data && <><Card><div className={styles.factGrid}>
      <KeyValue label="Program" value={data.name} /><KeyValue label="Program status" value={<StatusBadge family="program" status={data.status} />} />
      <KeyValue label="Assigned Trainer" value={data.currentTrainer?.fullName ?? 'Not provided'} /><KeyValue label="Period" value={`${data.periodStart} → ${data.periodEnd}`} />
      <KeyValue label="Current phase" value={data.currentPhaseName ?? 'Not provided'} /><KeyValue label="Training Availability" value={data.trainingAvailability ? <StatusBadge family="availability" status={data.trainingAvailability} /> : 'Not provided'} />
      <KeyValue label="Source template" value={data.sourceTemplateName ?? data.sourceTemplateCode ?? `Template ${data.sourceTemplateId}`} />
      <KeyValue label="Template version" value={`v${data.sourceTemplateVersion}`} /><KeyValue label="Activated" value={dateTime(data.activatedAt)} />
    </div></Card>
      <Tabs label="Program detail" idPrefix="program-detail" value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Overview' }, { value: 'progress', label: 'Progress' }, { value: 'history', label: 'History' }]} />
      <section role="tabpanel" id={`program-detail-panel-${tab}`} aria-labelledby={`program-detail-tab-${tab}`}>
        {tab === 'overview' ? <div className={styles.columns}><div className={styles.stack}><Card title="Program Summary"><div className={styles.fields}><KeyValue label="Primary goal" value={data.goals ?? 'Not provided'} /><KeyValue label="Target metrics" value={data.targetMetrics ?? 'Not provided'} /><KeyValue label="Overall progress" value="Not provided; no percentage inferred" /></div></Card>
          <Card title="Training Phase Timeline"><div className={styles.stack}>{[...data.phases].sort((a, b) => a.phaseOrder - b.phaseOrder).map((phase) => <Card key={phase.id} title={`${phase.phaseOrder}. ${phase.name}`}><div className={styles.fields}>
            <KeyValue label="Objective" value={phase.objective ?? 'Not provided'} /><KeyValue label="Phase period" value={`${phase.startDate} → ${phase.endDate}`} />
            <KeyValue label="Workload" value={phase.workload ?? 'Not provided'} /><KeyValue label="Intensity range" value={`${phase.intensityMin ?? 'Not provided'} → ${phase.intensityMax ?? 'Not provided'}`} />
          </div></Card>)}{data.phases.length === 0 && <EmptyState title="No training phases returned" />}</div></Card>
        </div><div className={styles.stack}><Card title="Head Trainer Notes"><p>{data.notes ?? 'Not provided'}</p></Card><AlertBanner type="info" title="Read-only Program">Program strategy and the pinned source template stay unchanged. Progress and History display only values returned by the server.</AlertBanner></div></div>
          : canReadHistory ? <ProgramReadTab key={tab} tab={tab} programId={data.id} /> : <EmptyState title={`${tab === 'progress' ? 'Progress' : 'History'} unavailable for this role`} description="The approved API permits Head Trainer, Trainer and Club Manager only." />}
      </section>
    </>}
  </FlowShell>;
}
function ProgramReadTab({ tab, programId }: { tab: string; programId: number }) {
  const request = useFlowRequest(), api = useMemo(() => createProgramDetailApi(request), [request]);
  const load = useCallback(async (signal: AbortSignal) => tab === 'progress' ? api.progress(programId, signal) : api.history(programId, signal), [api, programId, tab]);
  const resource = useResource(load);
  return <Card title={tab === 'progress' ? 'Program Progress' : 'Program History'}>
    {resource.pending && <LoadingState label={`Loading ${tab}…`} />}
    {resource.error && <ErrorState title={`${tab === 'progress' ? 'Progress' : 'History'} unavailable`} description={resource.error} onRetry={resource.reload} />}
    {resource.data && (tab === 'progress' ? <div className={styles.table}><DataTable<ProgramProgress['phases'][number]> caption="Server program progress" rows={(resource.data as ProgramProgress).phases} rowKey={(item) => item.phaseId} empty={<EmptyState title="No phase progress returned" />} columns={[
      { key: 'phase', header: 'Phase', render: (item) => `${item.phaseOrder}. ${item.name}` },
      { key: 'scheduled', header: 'Scheduled', render: (item) => item.scheduled }, { key: 'completed', header: 'Completed', render: (item) => item.completed },
      { key: 'interrupted', header: 'Interrupted', render: (item) => item.interrupted }, { key: 'distance', header: 'Server distance', render: (item) => metric(item.totalDistanceM, 'm') },
      { key: 'evaluation', header: 'Last evaluation', render: (item) => item.lastEvaluationLabel ?? 'Not provided' },
    ]} /></div> : <div className={styles.table}><DataTable<ProgramHistoryEntry> caption="Server program history" rows={resource.data as ProgramHistoryEntry[]} rowKey={(item) => `${item.occurredAt}-${item.entryType}-${item.summary}`} empty={<EmptyState title="No program history returned" />} columns={[
      { key: 'time', header: 'Time', render: (item) => dateTime(item.occurredAt) }, { key: 'type', header: 'Event', render: (item) => item.entryType },
      { key: 'actor', header: 'Actor', render: (item) => item.actor?.fullName ?? 'Not provided' }, { key: 'summary', header: 'Summary', render: (item) => item.summary },
    ]} /></div>)}
  </Card>;
}
