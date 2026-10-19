import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, MetricCard, SelectField, StatusBadge, Tabs, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { useHorsesApi } from './api/HorsesApiContext';
import type { HorseDetail } from './api/types';
import { ageInYears, formatDate } from './shared/format';
import { useBreadcrumb } from './shared/HorseManagementLayout';
import styles from './shared/horses.module.css';

function useHorseResource<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data?: T; error?: string; source?: () => Promise<T> }>({});
  useEffect(() => { let active = true; load().then((data) => { if (active) setState({ data, source: load }); }, (error: unknown) => { if (active) setState({ error: error instanceof Error ? error.message : 'Unable to load horses.', source: load }); }); return () => { active = false; }; }, [load, revision]);
  return { ...(state.source === load ? state : {}), reload: () => { setState({}); setRevision((n) => n + 1); } };
}
function HorseState({ error, retry }: { error?: string; retry: () => void }) {
  return error ? <ErrorState title="Horse data unavailable" description={error} onRetry={retry} /> : <LoadingState label="Loading horses…" />;
}
export function HorseListPage() {
  useBreadcrumb([{ label: 'Horses' }, { label: 'All horses' }]);
  const api = useHorsesApi();
  const { user } = useAuth();
  const canManage = user?.roles.includes('CLUB_MANAGER');
  const [search, setSearch] = useState(''), [lifecycle, setLifecycle] = useState(''), [availability, setAvailability] = useState('');
  const [query, setQuery] = useState({ q: '', lifecycle: '', availability: '', page: 0, size: 20 });
  const load = useCallback(() => api.listHorses(query), [api, query]);
  const { data, error, reload } = useHorseResource(load);
  return <div className={styles.page}>
    <div className={styles.titleRow}><div className={styles.titleBlock}><h1 className="text-h1">Horses</h1><p>Club register · identity, pedigree, ownership and stable boxes</p></div>{canManage && <><Link to="/horses/pending-activation">Pending Activation</Link><Link to="/horses/new">Register Horse</Link></>}</div>
    <form className={styles.row} onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, q: search, lifecycle, availability, page: 0 }); }}>
      <TextField label="Search horses" value={search} onChange={(e) => setSearch(e.target.value)} />
      <SelectField label="Lifecycle" value={lifecycle} options={[{ value: '', label: 'All' }, ...['DRAFT', 'ACTIVE', 'INACTIVE'].map((value) => ({ value, label: value }))]} onChange={(e) => setLifecycle(e.target.value)} />
      <SelectField label="Training Availability" value={availability} options={[{ value: '', label: 'All' }, ...['AVAILABLE', 'LIMITED', 'LOCKED'].map((value) => ({ value, label: value }))]} onChange={(e) => setAvailability(e.target.value)} />
      <Button type="submit" variant="secondary">Apply filters</Button>
    </form>
    {!data ? <HorseState error={error} retry={reload} /> : <>
      <div className={styles.row}><MetricCard label="Matching horses" value={String(data.totalItems)} caption="Filtered register" /><MetricCard label="Page" value={String(data.page + 1)} caption={`of ${Math.max(1, data.totalPages)}`} /></div>
      <Card><div className={styles.table}><DataTable<HorseDetail> caption="Horse register" rows={data.items} rowKey={(h) => h.id} empty={<EmptyState title="No matching horses" />} columns={[
        { key: 'name', header: 'Horse', render: (h) => <Link to={`/horses/${h.id}`}>{h.name}<br />{h.horseCode}</Link> },
        { key: 'breed', header: 'Breed · Age', render: (h) => `${h.breed ?? 'Not recorded'} · ${ageInYears(h.foaledDate) ?? '—'} yrs` },
        { key: 'lifecycle', header: 'Lifecycle', render: (h) => <StatusBadge family="lifecycle" status={h.lifecycle} /> },
        { key: 'health', header: 'Health', render: (h) => h.healthStatus ? <StatusBadge family="health" status={h.healthStatus} /> : 'Baseline pending' },
        { key: 'availability', header: 'Training Availability', render: (h) => <StatusBadge family="availability" status={h.trainingAvailability} /> },
        { key: 'box', header: 'Box', render: (h) => h.currentBoxCode ?? 'Not assigned' },
        { key: 'action', header: 'Action', render: (h) => <Link to={`/horses/${h.id}`}>{canManage ? 'Manage' : 'View'} →</Link> },
      ]} /></div><div className={styles.footer}><Button variant="secondary" disabled={!query.page} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Previous</Button><Button variant="secondary" disabled={query.page + 1 >= data.totalPages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Next</Button></div></Card>
      <p className="text-caption">Health and Training Availability are read-only here. Activation is automatic when all mandatory requirements are met.</p>
    </>}
  </div>;
}
export function HorseProfilePage() {
  const { user, expiresAt } = useAuth(); const { id } = useParams();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.some((role) => ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'].includes(role))) return <ErrorState title="Access denied" description="Horse profiles are unavailable for your role." />;
  return <HorseProfileContent key={`${user.id}:${expiresAt}:${id}`} />;
}
function HorseProfileContent() {
  const api = useHorsesApi(), { user } = useAuth();
  const location = useLocation();
  const rawId = useParams().id ?? '';
  const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const validTab = ['overview', 'pedigree', 'training'].includes(tab);
  const load = useCallback(() => Number.isSafeInteger(id) && id > 0 && validTab ? api.getHorse(id) : Promise.reject(new Error('Invalid horse link')), [api, id, validTab]);
  const { data: horse, error, reload } = useHorseResource(load);
  const setTab = (value: string) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); };
  const [photoError, setPhotoError] = useState(''), [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const canManage = user?.roles.includes('CLUB_MANAGER');
  useBreadcrumb([{ label: 'Horses', to: '/horses' }, { label: horse?.name ?? 'Horse profile' }]);
  if (!Number.isSafeInteger(id) || id < 1) return <EmptyState title="Horse not found" />;
  if (!validTab) return <ErrorState title="Invalid profile section" description="Choose an existing horse profile section." />;
  if (!horse) return <HorseState error={error} retry={reload} />;
  return <div className={styles.page}><Link to="/horses">← Back to Horses</Link>
    {(location.state as { photoUploadFailed?: boolean } | null)?.photoUploadFailed && <AlertBanner type="warning" title="Some photos were not uploaded">Identity was saved. Add the missing photos again from this profile.</AlertBanner>}
    <div className={styles.titleRow}>{horse.primaryPhotoUrl ? <img className={styles.profilePhoto} src={horse.primaryPhotoUrl} alt={horse.name} /> : <div className={styles.profilePhoto}>No photo</div>}<div className={styles.titleBlock}><h1 className="text-h1">{horse.name}</h1><p>{horse.horseCode} · {horse.breed} · {horse.sex} · {horse.currentBoxCode ?? 'No stable box'}</p><div className={styles.row}><StatusBadge family="lifecycle" status={horse.lifecycle} />{horse.healthStatus && <StatusBadge family="health" status={horse.healthStatus} />}<StatusBadge family="availability" status={horse.trainingAvailability} /></div></div>{canManage && <Link to={`/horses/${id}/edit`}>Pedigree & Ownership</Link>}</div>
    <Tabs label="Horse profile sections" idPrefix="horse-profile" value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Overview' }, { value: 'pedigree', label: 'Pedigree & Ownership' }, { value: 'training', label: 'Training & Performance' }]} />
    {tab === 'overview' && <div role="tabpanel" id="horse-profile-panel-overview" aria-labelledby="horse-profile-tab-overview" tabIndex={0} className={styles.twoCol}><div className={styles.colMain}><Card title="Identity & Ownership"><div className={styles.cardBody}><KeyValue label="Horse code" value={horse.horseCode} /><KeyValue label="Registered name" value={horse.name} /><KeyValue label="Breed" value={horse.breed ?? 'Not recorded'} /><KeyValue label="Sex" value={horse.sex ?? 'Not recorded'} /><KeyValue label="Age" value={ageInYears(horse.foaledDate) == null ? 'Not recorded' : `${ageInYears(horse.foaledDate)} yrs`} /><KeyValue label="Weight" value={horse.latestWeight && Number.isFinite(horse.latestWeight.weightKg) && horse.latestWeight.weightKg > 0 ? `${horse.latestWeight.weightKg} kg` : 'Not recorded'} /><KeyValue label="Lifecycle" value={<StatusBadge family="lifecycle" status={horse.lifecycle} />} /><KeyValue label="Foaled" value={formatDate(horse.foaledDate)} /><KeyValue label="Origin" value={horse.countryOfOrigin ?? 'Not recorded'} /><KeyValue label="Registration number" value={horse.registrationNo ?? 'Not recorded'} /><KeyValue label="Owners" value={horse.currentOwnerships?.map((o) => `${o.owner.fullName} · ${o.sharePercentage}%`).join(', ') || 'Not assigned'} /><KeyValue label="Box" value={horse.currentBoxCode ?? 'Not assigned'} /></div></Card>
      {canManage && <Card title="Photos">{photoError && <AlertBanner type="danger" title={photoError} />}<Button variant="secondary" disabled={uploading} onClick={() => photoInput.current?.click()}>{uploading ? 'Uploading…' : 'Add photo'}</Button><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Horse profile photo" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file || uploading) return; setUploading(true); setPhotoError(''); try { await api.uploadPhoto(id, file); reload(); } catch (error) { setPhotoError(error instanceof Error ? error.message : 'Photo upload failed.'); } finally { setUploading(false); } }} /></Card>}</div>
      <aside className={styles.colSide}><Card title="Health & Training Availability"><p>{horse.healthStatus ?? 'Baseline not recorded'}</p><p>{horse.trainingAvailability}</p><p className="text-caption">The Veterinarian owns health and restriction updates. No clinical edit is available here.</p></Card><Card title="Activation & timeline"><KeyValue label="Activated at" value={horse.activatedAt ?? 'Waiting for mandatory requirements'} /><p className="text-caption">The activation timestamp starts the horse timeline. Head Trainer readiness review does not block activation.</p>{canManage && <Link to="/horses/pending-activation">View activation checklist</Link>}</Card></aside></div>}
    {tab === 'pedigree' && <div role="tabpanel" id="horse-profile-panel-pedigree" aria-labelledby="horse-profile-tab-pedigree" tabIndex={0}><Card title="Pedigree & Ownership"><div className={styles.cardBody}><KeyValue label="Sire" value={horse.pedigree.sire.name ?? horse.pedigree.sire.horseCode ?? 'Unknown'} /><KeyValue label="Dam" value={horse.pedigree.dam.name ?? horse.pedigree.dam.horseCode ?? 'Unknown'} /><ul>{horse.currentOwnerships.map((o) => <li key={o.id}>{o.owner.fullName} · {o.sharePercentage}% · {formatDate(o.effectiveFrom)}{o.isManagingOwner ? ' · Managing owner' : ''}</li>)}</ul>{canManage && <Link to={`/horses/${id}/edit`}>Edit pedigree, ownership & box</Link>}</div></Card></div>}
    {tab === 'training' && <div role="tabpanel" id="horse-profile-panel-training" aria-labelledby="horse-profile-tab-training" tabIndex={0}><Card title="Training & Performance"><p>Open your role workspace to continue training tasks. No progress score or distance formula is calculated from this profile.</p><Link to="/dashboard">Training workspace →</Link></Card></div>}
  </div>;
}
