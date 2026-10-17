import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, Icon, SelectField, StatusBadge, TextField } from '../../../design-system';
import { useSupportingApi, useSupportingLoad, dateRange } from './supportingHooks';
import { SupportingReadState, SupportingShell } from './SupportingShell';
import type { AssignedProgram, SupportingApi } from './supportingApi';
import styles from './supporting.module.css';

export function AssignedProgramsPage({ api: supplied }: { api?: SupportingApi }) {
  const api = useSupportingApi(supplied);
  return <SupportingShell title="Assigned Programs" roles={['TRAINER']}><Programs api={api} /></SupportingShell>;
}
function Programs({ api }: { api: SupportingApi }) {
  const [page, setPage] = useState(0); const [status, setStatus] = useState(''); const [horse, setHorse] = useState('');
  const [phase, setPhase] = useState(''); const [search, setSearch] = useState('');
  const range = useMemo(() => dateRange(new Date()), []);
  const programs = useSupportingLoad(() => api.programs({ page, status, horseId: horse ? Number(horse) : undefined }), [api, page, status, horse]);
  const sessions = useSupportingLoad(() => api.sessions(range), [api, range]);
  const rows = (programs.data?.items ?? []).filter((item) => (!phase || item.currentPhaseName === phase) && `${item.horse.name} ${item.horse.horseCode} ${item.name}`.toLowerCase().includes(search.toLowerCase()));
  const horses = [...new Map((programs.data?.items ?? []).map((item) => [item.horse.id, item.horse])).values()];
  const phases = [...new Set((programs.data?.items ?? []).flatMap((item) => item.currentPhaseName ? [item.currentPhaseName] : []))];
  const nextSession = (program: AssignedProgram) => (sessions.data ?? []).filter((session) => session.programId === program.id && session.status === 'SCHEDULED' && Date.parse(session.scheduledStart) >= Date.now()).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0];
  return <div className={styles.stack}><div className={styles.header}><div><h1 className={styles.title}>My Assigned Programs</h1><p className={styles.muted}>Horse Training Programs assigned to you — each derived from a Program Template.</p></div><span className={styles.notice}><Icon name="info" size={14} />Programs are created and adjusted by the Head Trainer</span></div>
    <Card><div className={styles.filters}><TextField label="Search horse or program" type="search" placeholder="Search current page…" value={search} onChange={(event) => setSearch(event.target.value)} /><SelectField label="Program Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); setPhase(''); }} options={[{ value: '', label: 'All' }, ...['ACTIVE', 'PAUSED', 'COMPLETED'].map((value) => ({ value, label: value }))]} /><SelectField label="Horse" value={horse} onChange={(event) => { setHorse(event.target.value); setPage(0); }} options={[{ value: '', label: 'All' }, ...horses.map((item) => ({ value: String(item.id), label: item.name }))]} /><SelectField label="Current Phase" value={phase} onChange={(event) => setPhase(event.target.value)} options={[{ value: '', label: 'All' }, ...phases.map((value) => ({ value, label: value }))]} /></div>
      <SupportingReadState error={programs.error} loading={!programs.data} retry={programs.retry} />
      {programs.data && <><div className={styles.tableWrap}><DataTable<AssignedProgram> caption="My assigned programs" rows={rows} rowKey={(row) => row.id} empty={<EmptyState title="No assigned programs" description="No programs match this page and filter selection." />} columns={[
        { key: 'horse', header: 'Horse', render: (item) => <div className={styles.smallStack}><span className={styles.strong}>{item.horse.name}</span><span className={styles.caption}>{item.horse.horseCode}</span>{item.trainingAvailability && <StatusBadge family="availability" status={item.trainingAvailability} />}</div> },
        { key: 'program', header: 'Program', render: (item) => item.name },
        { key: 'goal', header: 'Goal', render: () => <span className={styles.caption}>Not supplied</span> },
        { key: 'phase', header: 'Current Phase', render: (item) => item.currentPhaseName ?? 'Not supplied' },
        { key: 'progress', header: 'Progress', render: () => <span className={styles.caption}>Not supplied</span> },
        { key: 'next', header: 'Next Session', render: (item) => { const next = nextSession(item); return next ? <Link className={styles.link} to={`/training/session/${next.id}`}>{new Date(next.scheduledStart).toLocaleString()}</Link> : <span className={styles.caption}>{sessions.error ? 'Unavailable' : 'None supplied in next 30 days'}</span>; } },
        { key: 'status', header: 'Program Status', render: (item) => <StatusBadge family="program" status={item.status} /> },
        { key: 'actions', header: 'Actions', render: (item) => <div className={styles.actions}><Link className={styles.link} aria-label={`View program ${item.name}`} to={`/training/programs/${item.id}`}><Icon name="eye" size={16} /></Link>{item.status === 'ACTIVE' && item.trainingAvailability && item.trainingAvailability !== 'LOCKED' ? <Link className={styles.link} to={`/training/schedule/session/new?programId=${item.id}`}>+ Add Session</Link> : <span className={styles.caption}>Add Session unavailable</span>}</div> },
      ]} /></div><div className={styles.header}><p className={styles.caption}>{programs.data.totalItems} programs assigned to your account. Search and phase filters apply to the current page.</p><div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage((old) => old - 1)}>Previous</Button><span>Page {page + 1} of {Math.max(1, programs.data.totalPages)}</span><Button variant="secondary" disabled={page + 1 >= programs.data.totalPages} onClick={() => setPage((old) => old + 1)}>Next</Button></div></div></>}
    </Card><AlertBanner type="info" title="Program details and scheduling">Program details and scheduling are not available yet. Goals and progress appear when supplied.</AlertBanner>
  </div>;
}
