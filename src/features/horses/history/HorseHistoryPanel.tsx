import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, ErrorState, KeyValue, LoadingState } from '../../../design-system';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { ApiError } from '../../../shared/auth/authApi';
import type { HorseDetail, Ownership, Page, StableAssignment } from '../api/types';
import { formatDate } from '../shared/format';
import { useHorseHistoryService } from './historyService';
import type { TimelineEvent } from './historyTypes';
import styles from './history.module.css';

const missing = 'Not available';
function Message({ code, retry }: { code: number; retry(): void }) { return <ErrorState title={code === 403 ? 'Access denied' : code === 404 ? 'Horse not found' : 'History unavailable'} description={code === 403 ? 'Your role cannot read this horse history.' : 'Please try again or contact the club.'} onRetry={code === 403 || code === 404 ? undefined : retry} />; }
export function HorseHistoryPanel({ horse }: { horse: HorseDetail }) {
  const { user, expiresAt } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.some((r) => ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'].includes(r))) return <ErrorState title="Access denied" description="Horse history is unavailable for your role." />;
  return <History key={`${user.id}:${expiresAt}:${horse.id}`} horse={horse} />;
}
function History({ horse }: { horse: HorseDetail }) {
  const service = useHorseHistoryService();
  const { user, handleApiError } = useAuth();
  const fullHistory = user!.roles.some((r) => ['CLUB_MANAGER', 'HEAD_TRAINER'].includes(r));
  const [page, setPage] = useState(0), [revision, setRevision] = useState(0);
  const source = useMemo(() => ({ service, id: horse.id, page, revision, fullHistory, actorId: user!.id }), [service, horse.id, page, revision, fullHistory, user]);
  const [result, setResult] = useState<{ source: object; timeline?: Page<TimelineEvent>; ownerships?: Ownership[]; assignments?: StableAssignment[]; error?: number }>();
  useEffect(() => {
    const abort = new AbortController(); let active = true;
    const histories = source.fullHistory ? Promise.all([service.ownerships(source.id, abort.signal), service.assignments(source.id, abort.signal)]) : Promise.resolve([undefined, undefined] as const);
    Promise.all([service.timeline(source.id, source.page, abort.signal), histories]).then(([timeline, [ownerships, assignments]]) => { if (active) setResult({ source, timeline, ownerships, assignments }); }, (cause: unknown) => { if (active && !handleApiError(cause)) setResult({ source, error: cause instanceof ApiError ? cause.status : 500 }); });
    return () => { active = false; abort.abort(); };
  }, [source, service, handleApiError]);
  const current = result?.source === source ? result : undefined;
  const ownerNames = horse.currentOwnerships.map((ownership) => ownership.owner.fullName).join(', ') || missing;
  if (current?.error !== undefined) return <Message code={current.error} retry={() => setRevision((v) => v + 1)} />;
  if (!current?.timeline) return <LoadingState label="Loading horse history…" />;
  return <div className={styles.page}>
    <Link to={`/horses/${horse.id}?tab=overview`} className={styles.back}>← Back to Horse Profile</Link>
    <div><h1 className={styles.title}>Pedigree &amp; History</h1><p className={styles.subtitle}>{horse.horseCode} · {horse.name} · {horse.breed ?? missing} · {horse.sex ?? missing} · foaled {formatDate(horse.foaledDate)} · Owner {ownerNames}</p></div>
    {service.source === 'sample' && <AlertBanner title="Sample history">Only shared sample records are shown. Additional history is not available in this preview.</AlertBanner>}
    <h2 className={styles.sectionTitle}>Origin &amp; Pedigree</h2>
    <Card className={styles.section}><h3>Origin &amp; Identity</h3><div className={styles.identityGrid}>
      <KeyValue label="Horse Name" value={horse.name} /><KeyValue label="Horse ID" value={horse.horseCode} /><KeyValue label="Breed" value={horse.breed ?? missing} />
      <KeyValue label="Country of Origin" value={horse.countryOfOrigin ?? missing} /><KeyValue label="Date of Birth" value={formatDate(horse.foaledDate)} /><KeyValue label="Sex" value={horse.sex ?? missing} />
      <KeyValue label="Breeder" value={missing} /><KeyValue label="Current Owner" value={ownerNames} /><span aria-hidden="true" /><KeyValue label="Sire" value={horse.pedigree.sire.name ?? horse.pedigree.sire.horseCode ?? missing} /><KeyValue label="Dam" value={horse.pedigree.dam.name ?? horse.pedigree.dam.horseCode ?? missing} />
    </div></Card>
    <Card className={styles.section}><h3>Pedigree Tree</h3><div className={styles.tree}>
      <div className={styles.ancestors}>{['Sire’s Sire', 'Sire’s Dam', 'Dam’s Sire', 'Dam’s Dam'].map((label) => <div className={styles.chip} key={label}><span>{missing}</span><small>{label}</small></div>)}</div>
      <span className={styles.arrow} aria-hidden="true">→</span><div className={styles.ancestors}>{[['Sire', horse.pedigree.sire], ['Dam', horse.pedigree.dam]].map(([label, parent]) => <div className={styles.chip} key={String(label)}><span>{typeof parent === 'object' ? parent.name ?? parent.horseCode ?? missing : missing}</span><small>{String(label)}</small></div>)}</div>
      <span className={styles.arrow} aria-hidden="true">→</span><div className={`${styles.chip} ${styles.subject}`}><span>{horse.name}</span><small>{horse.horseCode} · Subject</small></div>
    </div></Card>
    <Card className={styles.section}><h2>Ownership &amp; History</h2><div className={styles.identityGrid}><KeyValue label="Current Owner" value={ownerNames} /><KeyValue label="Registration No." value={horse.registrationNo ?? missing} /><KeyValue label="Current Stable" value={horse.currentAssignment ? [horse.currentAssignment.yard, horse.currentAssignment.boxCode].filter(Boolean).join(' · ') : missing} /><KeyValue label="Timeline starts" value={horse.activatedAt ? <time dateTime={horse.activatedAt} title={horse.activatedAt}>{formatDate(horse.activatedAt)}</time> : 'Not activated yet'} /></div>
      {fullHistory ? <>
        <h3>Ownership history</h3>{current.ownerships?.length ? <ul className={styles.records}>{current.ownerships.map((o) => <li key={o.id}><strong>{o.owner.fullName} · {o.sharePercentage}%</strong><span>{formatDate(o.effectiveFrom)} – {o.effectiveTo ? formatDate(o.effectiveTo) : 'Open period'}{o.isManagingOwner ? ' · Managing owner' : ''}</span></li>)}</ul> : <EmptyState title="No ownership history recorded" />}
        <h3>Stable assignment history</h3>{current.assignments?.length ? <ul className={styles.records}>{current.assignments.map((a) => <li key={a.id}><strong>{[a.yard, a.boxCode].filter(Boolean).join(' · ')}</strong><span>{formatDate(a.effectiveFrom)} – {a.effectiveTo ? formatDate(a.effectiveTo) : 'Open period'}</span></li>)}</ul> : <EmptyState title="No stable assignments recorded" />}
      </> : <p>Full ownership and stable history is available to Club Managers and Head Trainers.</p>}
    </Card>
    <Card className={styles.section}><h2>Horse timeline</h2><p className={styles.subtitle}>The timeline begins at automatic activation. Only non-clinical event titles are shown.</p>
      {current.timeline.items.length ? <ol className={styles.records}>{current.timeline.items.map((event, index) => <li key={`${event.occurredAt}:${index}`}><time dateTime={event.occurredAt} title={event.occurredAt}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurredAt))}</time><span>{event.title}</span></li>)}</ol> : <EmptyState title="No timeline events shared" description="Existing activation, ownership and stable records remain visible above when your role permits." />}
      <nav aria-label="Timeline pagination" className={styles.pagination}><Button variant="secondary" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Previous</Button><span>Page {current.timeline.page + 1} of {Math.max(1, current.timeline.totalPages)}</span><Button variant="secondary" disabled={page + 1 >= current.timeline.totalPages} onClick={() => setPage((n) => n + 1)}>Next</Button></nav>
    </Card>
    <p className={styles.subtitle}>Training history belongs to the Training module; clinical history remains with the veterinary team.</p>
  </div>;
}
