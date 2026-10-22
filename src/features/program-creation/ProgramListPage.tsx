import { useCallback, useState } from 'react';
import { ButtonLink, AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, LoadingState, MetricCard, SelectField, StatusBadge, TextField } from '../../design-system';
import { ROUTES } from '../../app/routePaths';
import { FlowShell } from '../main-flows/FlowShell';
import { useResource } from '../main-flows/useResource';
import type { AssignedProgram, ProgramStatus } from '../training/assigned/supportingApi';
import { useProgramCreationApi } from './programTransport';
import styles from '../main-flows/flow.module.css';

/** CORE-022 / SCR-TRAIN-001 (77:317). List reads only; the existing wizard owns creation. */
export function ProgramListPage() {
  const api = useProgramCreationApi();
  const [page, setPage] = useState(0), [status, setStatus] = useState<ProgramStatus | ''>('');
  const [search, setSearch] = useState(''), [trainer, setTrainer] = useState(''), [horse, setHorse] = useState('');
  const load = useCallback((signal: AbortSignal) => api.listPrograms({ page, status: status || undefined }, signal), [api, page, status]);
  const resource = useResource(load), data = resource.data;
  const rows = (data?.items ?? []).filter((item) => (!trainer || String(item.currentTrainer?.id) === trainer) && (!horse || String(item.horse.id) === horse)
    && `${item.horse.name} ${item.horse.horseCode} ${item.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const trainers = [...new Map((data?.items ?? []).flatMap((item) => item.currentTrainer ? [[item.currentTrainer.id, item.currentTrainer] as const] : [])).values()];
  const horses = [...new Map((data?.items ?? []).map((item) => [item.horse.id, item.horse])).values()];
  function changePage(next: number) { setPage(next); setTrainer(''); setHorse(''); }
  return <FlowShell title="Horse Training Programs" description="Horse-specific programs — each created from a reusable Program Template and customized for one horse." section="Training" role="HEAD_TRAINER" actions={<ButtonLink variant="primary" to={ROUTES.trainingProgramCreate}>+ New Horse Training Program</ButtonLink>}>
    <div className={styles.metrics}>{['Active programs', 'Need attention', 'Upcoming completion', 'Available Trainers'].map((label) => <MetricCard key={label} label={label} value="Not provided" unavailable caption="Summary not supplied by the approved list API" />)}</div>
    <Card><div className={styles.stack}><div className={styles.row}>
      <TextField label="Search horse or program" placeholder="Search current page…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <SelectField label="Status" value={status} options={[{ value: '', label: 'All' }, ...['ACTIVE', 'PAUSED', 'COMPLETED'].map((value) => ({ value, label: value }))]} onChange={(event) => { setStatus(event.target.value as ProgramStatus | ''); changePage(0); }} />
      <SelectField label="Trainer · current page" value={trainer} options={[{ value: '', label: 'All' }, ...trainers.map((item) => ({ value: String(item.id), label: item.fullName }))]} onChange={(event) => setTrainer(event.target.value)} />
      <SelectField label="Horse · current page" value={horse} options={[{ value: '', label: 'All' }, ...horses.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={(event) => setHorse(event.target.value)} />
    </div>
      <p className="text-caption">Status filters all programs on the server. Search, Trainer and Horse filter the current page.</p>
      {resource.pending && <LoadingState label="Loading training programs…" />}
      {resource.error && <ErrorState title="Programs unavailable" description={resource.error} onRetry={resource.reload} />}
      {data && <><div className={styles.table}><DataTable<AssignedProgram> caption="Horse Training Programs" rows={rows} rowKey={(item) => item.id} empty={<EmptyState title="No programs match" description="Change the filters or create a Horse Training Program." />} columns={[
        { key: 'horse', header: 'Horse', render: (item) => <><strong>{item.horse.name}</strong><p className="text-caption">{item.horse.horseCode}</p>{item.trainingAvailability && <StatusBadge family="availability" status={item.trainingAvailability} />}</> },
        { key: 'program', header: 'Program', render: (item) => <>{item.name}<p className="text-caption">Template {item.sourceTemplateId} · v{item.sourceTemplateVersion}</p></> },
        { key: 'goal', header: 'Goal', render: () => 'Not provided' },
        { key: 'trainer', header: 'Trainer', render: (item) => item.currentTrainer?.fullName ?? 'Not provided' },
        { key: 'phase', header: 'Current Phase', render: (item) => item.currentPhaseName ?? 'Not provided' },
        { key: 'progress', header: 'Progress', render: () => 'Not provided' },
        { key: 'period', header: 'Period', render: (item) => `${item.periodStart} → ${item.periodEnd}` },
        { key: 'status', header: 'Status', render: (item) => <StatusBadge family="program" status={item.status} /> },
        { key: 'detail', header: 'Details', render: (item) => <ButtonLink to={`/training/programs/${item.id}`} aria-label={`View ${item.name}`}>View</ButtonLink> },
      ]} /></div><div className={styles.row}><span>{rows.length} shown on this page · {data.totalItems} programs match server filters</span><Button variant="secondary" disabled={page === 0} onClick={() => changePage(page - 1)}>Previous programs</Button><span>Page {page + 1} of {Math.max(1, data.totalPages)}</span><Button variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => changePage(page + 1)}>Next programs</Button></div></>}
    </div></Card>
    <AlertBanner type="info" title="Program summaries">Goals, progress and summary metrics are not supplied by the list contract. Open a program for its approved read-only details.</AlertBanner>
    <p className="text-caption">Training Availability is set by the Veterinarian. It is separate from program status.</p>
  </FlowShell>;
}
