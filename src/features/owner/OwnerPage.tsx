import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { ButtonLink, AlertBanner, Button, Card, EmptyState, ErrorState, Icon, KeyValue, LoadingState, StatusBadge, Tabs } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { OwnerContext } from './OwnerProvider';
import type { OwnerHorse } from './ownerModel';
import styles from './owner.module.css';

const tabs = [{ value: 'profile', label: 'Profile & Pedigree' }, { value: 'health', label: 'Health & Readiness' }, { value: 'training', label: 'Training & Performance' }];
const healthLabels = { FIT: 'Healthy', MONITORING: 'Under monitoring', INJURED: 'Under veterinary care', QUARANTINED: 'Under veterinary care' };
const readinessLabels = { AVAILABLE: 'Cleared for normal training', LIMITED: 'Training continues within veterinary limits', LOCKED: 'Training is paused by the Veterinarian' };
const missing = 'Not shared yet';
const calendar = (iso: string | null) => iso ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso)) : missing;
const timestamp = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
function age(born: string | null, unit = 'yrs') {
  if (!born) return null;
  const birth = new Date(born), now = new Date();
  const years = now.getUTCFullYear() - birth.getUTCFullYear() - Number(now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate()));
  return years >= 0 ? `${years} ${unit}` : null;
}
const meta = (horse: OwnerHorse) => [horse.code, horse.breed, age(horse.born), horse.sex && horse.sex.charAt(0) + horse.sex.slice(1).toLowerCase()].filter(Boolean).join(' · ');

export function OwnerPage() { return <RequireAuth><OwnerAccess /></RequireAuth>; }
function OwnerAccess() {
  const { user, expiresAt } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.includes('HORSE_OWNER')) return <main className="auth-problem"><ErrorState title="Access denied" description="This portal is available to Horse Owners only." /><ButtonLink variant="tertiary" to={ROUTES.dashboard}>← Back to workspace</ButtonLink></main>;
  return <OwnerContent key={`${user.id}:${expiresAt}`} />;
}
function OwnerContent() {
  const { user, handleApiError } = useAuth();
  const service = useContext(OwnerContext);
  const { horseId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get('tab') ?? 'profile';
  const id = horseId && /^\d+$/.test(horseId) ? Number(horseId) : NaN;
  const valid = (!horseId || (Number.isSafeInteger(id) && id > 0)) && (!horseId || tabs.some((item) => item.value === tab));
  const [revision, setRevision] = useState(0);
  const [searchEpoch, setSearchEpoch] = useState(0);
  const source = useMemo(() => ({ service, id, horseId, valid, revision, actorId: user!.id }), [service, id, horseId, valid, revision, user]);
  const [result, setResult] = useState<{ source: object; horses?: OwnerHorse[]; error?: number } | null>(null);
  useEffect(() => {
    if (!source.valid) return;
    let active = true; const controller = new AbortController();
    const context = { actorId: source.actorId, signal: controller.signal };
    const pending = source.horseId ? source.service.detail(source.id, context).then((horse) => [horse]) : source.service.list(context);
    pending.then((horses) => { if (active) setResult({ source, horses }); }).catch((cause: unknown) => {
      if (active && !handleApiError(cause)) setResult({ source, error: cause instanceof ApiError ? cause.status : 500 });
    });
    return () => { active = false; controller.abort(); };
  }, [source, handleApiError]);
  const current = result?.source === source ? result : null;
  const horse = current?.horses?.[0];
  const search = (value: string) => { const next = new URLSearchParams(); if (value.trim()) next.set('q', value.trim()); navigate(`${ROUTES.myHorses}${next.size ? `?${next}` : ''}`); };
  const query = (params.get('q') ?? '').toLocaleLowerCase();
  const horses = current?.horses?.filter((item) => `${item.name} ${item.code}`.toLocaleLowerCase().includes(query));
  return <AppShell designSystem="v2" key={searchEpoch} user={{ fullName: user!.fullName, role: 'HORSE_OWNER' }} breadcrumb={[{ label: 'My Horses', to: ROUTES.myHorses }, ...(horseId ? [{ label: horse?.name ?? 'Horse detail' }] : [])]} searchPlaceholder="Search my horses…" onSearch={search}>
    <div className={styles.page}>
      {service.source === 'sample' && <AlertBanner title="Sample data · This preview has not been verified against Backend records." />}
      {horseId && <Link className={styles.back} to={ROUTES.myHorses}>← My Horses</Link>}
      {!valid ? <ErrorState title="Invalid horse link" description="Check the horse identifier and selected tab." /> : current?.error !== undefined ? <><ErrorState title={current.error === 403 ? 'Access denied' : current.error === 404 ? 'Horse not found' : 'Owner information unavailable'} description={current.error === 403 || current.error === 404 ? 'This horse is not available in your portal.' : 'Please try again later or contact the club.'} onRetry={[403, 404].includes(current.error) ? undefined : () => setRevision((value) => value + 1)} />{!horseId && <ButtonLink variant="tertiary" to={ROUTES.dashboard}>← Back to workspace</ButtonLink>}</> : !current?.horses ? <LoadingState label="Loading your horses…" /> : horseId && horse ? <>
        <Card className={styles.horseHeader}><Photo horse={horse} detail /><div className={styles.headerName}><h1>{horse.name}</h1><p>{[meta(horse), horse.stable].filter(Boolean).join(' · ')}</p><Badges horse={horse} /></div><span className={styles.readOnly}><Icon name="eye" size={14} />READ-ONLY</span></Card>
        <Tabs items={tabs} value={tab} label="Horse details" idPrefix="owner-horse" onChange={(value) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); }} />
        <div role="tabpanel" id={`owner-horse-panel-${tab}`} aria-labelledby={`owner-horse-tab-${tab}`} tabIndex={0}>
          {tab === 'profile' ? <Profile horse={horse} /> : tab === 'health' ? <Health horse={horse} /> : <Training horse={horse} />}
        </div>
      </> : <>
        <PageHeader title="My Horses" description={`Welcome, ${user!.fullName} · ${current.horses.length} ${current.horses.length === 1 ? 'horse' : 'horses'} registered to you · ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())} · read-only view`} />
        <AlertBanner className={styles.note} title="You see only the horses registered to you. Other horses at the club are not available in your portal. Information is read-only — the club’s staff keep it up to date." />
        {query && <div className={styles.searchResult}>Search results for “{params.get('q')}” within your horses <Button variant="tertiary" onClick={() => { setParams({}); setSearchEpoch((value) => value + 1); }}>Clear search</Button></div>}
        {!horses?.length ? <EmptyState title={query ? 'No matching horses' : 'No horses registered to you'} description="Contact the club if you think a horse should appear in your portal." /> : <div className={styles.horseGrid}>{horses.map((item, index) => <Card key={item.id} className={styles.horseCard}><div className={styles.cardTop}><Photo horse={item} /><div><h2>{item.name}</h2><p className={styles.caption}>{meta(item)}</p></div></div><Badges horse={item} /><div className={styles.divider} /><Facts><Fact label="Health" value={item.health ? healthLabels[item.health] : missing} /><Fact label="Readiness" value={item.availability ? readinessLabels[item.availability] : missing} /><Fact label="Training" value={item.program ? [item.program.name, item.program.phase].filter(Boolean).join(' · ') : 'No program shared'} /><Fact label="Next session" value={item.nextSession ? `${timestamp(item.nextSession.date)} · ${item.nextSession.title ?? missing}` : 'Shown when the next session is scheduled'} /></Facts><Link className={`${styles.viewLink} ${index ? styles.secondaryLink : ''}`} aria-label={`View horse ${item.name}`} to={`${ROUTES.myHorses}/${item.id}`}>View horse<span className="sr-only"> {item.name}</span></Link></Card>)}</div>}
      </>}
    </div>
  </AppShell>;
}
function Photo({ horse, detail = false }: { horse: OwnerHorse; detail?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`${styles.photo} ${detail ? styles.detailPhoto : ''}`}>{horse.photo && !failed ? <img src={horse.photo} alt={`${horse.name}`} onError={() => setFailed(true)} /> : <Icon name={detail ? 'image' : 'horseshoe'} size={detail ? 32 : 28} />}</div>;
}
function Badges({ horse }: { horse: OwnerHorse }) { return <div className={styles.badges}>{horse.lifecycle && <StatusBadge family="lifecycle" status={horse.lifecycle} />}{horse.health && <StatusBadge family="health" status={horse.health} />}{horse.availability && <StatusBadge family="availability" status={horse.availability} />}</div>; }
function Facts({ children }: { children: ReactNode }) { return <div className={styles.facts}>{children}</div>; }
function Fact({ label, value }: { label: string; value: ReactNode }) { return <KeyValue className={styles.fact} label={label} value={value ?? missing} />; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <Card className={styles.section}><h2>{title}</h2>{children}</Card>; }
function Profile({ horse }: { horse: OwnerHorse }) {
  return <div className={styles.columns}><div className={styles.stack}><Section title="Profile"><Facts><Fact label="Registered name" value={horse.name} /><Fact label="Horse ID" value={horse.code} /><Fact label="Breed" value={horse.breed} /><Fact label="Sex" value={horse.sex && horse.sex.charAt(0) + horse.sex.slice(1).toLowerCase()} /><Fact label="Date of birth" value={[calendar(horse.born), age(horse.born, 'years')].filter(Boolean).join(' · ')} /><Fact label="Country of origin" value={horse.country} /><Fact label="Stable" value={horse.stable ? `${horse.stable}${horse.stableSince ? ` (since ${calendar(horse.stableSince)})` : ''}` : missing} /></Facts></Section>
    <Section title="Pedigree"><div className={styles.pedigree}><div className={styles.ancestor}><small>Horse</small><strong>{horse.name}</strong></div><div className={styles.stack}><div className={styles.ancestor}><small>Sire</small><strong>{horse.sire ?? missing}</strong></div><div className={styles.ancestor}><small>Dam</small><strong>{horse.dam ?? missing}</strong></div></div><div className={styles.stack}>{['Sire’s sire', 'Sire’s dam', 'Dam’s sire', 'Dam’s dam'].map((label) => <div className={`${styles.ancestor} ${styles.unknownAncestor}`} key={label}><small>{label}</small><span>{missing}</span></div>)}</div></div></Section></div>
    <aside className={styles.stack}><Section title="Ownership"><p className={styles.ownershipStatement}>{horse.name} is linked to your account.</p><p className={styles.caption}>Ownership records are kept by the Club Manager. Contact the club if something here looks wrong.</p></Section><AlertBanner className={styles.note} title="This portal is read-only. Horse records, health and training are managed by the club’s staff." /></aside></div>;
}
function Health({ horse }: { horse: OwnerHorse }) {
  const weight = horse.healthSummary?.weights[0];
  return <div className={styles.columns}><div className={styles.stack}>
    <Section title="Health & readiness">
      <p className={styles.caption}>A summary for owners. Updated by the club’s Veterinarian.</p>
      <div className={styles.healthFacts}>
        <Fact label="Health" value={<span className={styles.badges}>{horse.health && <StatusBadge family="health" status={horse.health} />}{horse.health ? healthLabels[horse.health] : missing}</span>} />
        <Fact label="Training readiness" value={<span className={styles.badges}>{horse.availability && <StatusBadge family="availability" status={horse.availability} />}{horse.availability ? readinessLabels[horse.availability] : missing}</span>} />
        <Fact label="Training limits" value="No owner summary shared yet" />
        <Fact label="Next health review" value={calendar(horse.healthSummary?.reviewDate ?? null)} />
      </div>
    </Section>
    <Section title="Weight">
      {weight ? <div className={styles.weightValue}><p className={styles.weight}>{weight.weightKg} kg</p><p className={styles.caption}>last recorded <time dateTime={weight.recordedAt} title={weight.recordedAt}>{calendar(weight.recordedAt)}</time></p></div> : <p className={styles.weight}>{missing}</p>}
      <p className={styles.caption}>A weight trend appears here as new weights are recorded.</p>
    </Section>
  </div><aside className={styles.stack}><Section title="What these mean"><h3>Health</h3><ul><li>Healthy</li><li>Under monitoring</li><li>Under veterinary care</li></ul><h3>Training readiness</h3><ul><li>Available — cleared for normal training</li><li>Limited — training continues within limits set by the Veterinarian</li><li>Locked — training is paused by the Veterinarian</li></ul></Section><AlertBanner className={styles.note} title="Clinical details such as diagnosis, treatment and medication are not shown in this portal. Only the Veterinarian can change health or readiness." /></aside></div>;
}
function Training({ horse }: { horse: OwnerHorse }) {
  return <div className={styles.columns}><div className={styles.stack}><Section title="Current training program">{horse.program ? <><Facts><Fact label="Program" value={horse.program.name} /><Fact label="Current phase" value={horse.program.phase} /><Fact label="Period" value={`${calendar(horse.program.from)} – ${calendar(horse.program.to)}`} /><Fact label="Trainer" value={horse.program.trainer} /></Facts><Fact label="Program progress" value={horse.program.completed !== undefined && horse.program.planned !== undefined ? `${horse.program.completed} / ${horse.program.planned} sessions completed` : missing} /></> : <EmptyState title="No training program shared" description="A program summary appears here when the club makes it available." />}</Section><Section title="Recent sessions">{horse.sessions.length ? <div>{horse.sessions.map((session) => <div className={styles.session} key={session.id}><time title={session.date} dateTime={session.date}>{calendar(session.date)}</time><strong>{session.title ?? missing}</strong><span>{session.distanceM == null ? missing : `${new Intl.NumberFormat('en-GB').format(session.distanceM)} m`}</span><StatusBadge family="session" status={session.status} /></div>)}</div> : <EmptyState title="No sessions shared yet" />}</Section><Section title="Trainer update"><div className={styles.quote}><Icon name="user" size={16} /><p>No update shared yet.</p></div></Section></div><aside className={styles.stack}><Section title="Next session">{horse.nextSession ? <><strong><time dateTime={horse.nextSession.date} title={horse.nextSession.date}>{timestamp(horse.nextSession.date)}{horse.nextSession.end ? ` – ${new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(new Date(horse.nextSession.end))}` : ''}</time></strong><p className={styles.caption}>{[horse.nextSession.title, horse.nextSession.phase].filter(Boolean).join(' · ') || missing}</p></> : <p className={styles.caption}>Shown when the next session is scheduled</p>}</Section><AlertBanner className={styles.note} title="You can follow training here. Programs, sessions and riders are managed by the club’s trainers." /></aside></div>;
}
