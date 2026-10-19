import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  AlertBanner, Button, Card, Checkbox, ErrorState, StatusBadge, Icon, LoadingState, SelectField, TextField,
} from '../../../design-system';
import { ApiRequestError } from '../api/horsesApi';
import { useHorsesApi } from '../api/HorsesApiContext';
import type { ActivationStatus, HorseDetail, StableAssignment, UserSummary } from '../api/types';
import { formatDate, todayIsoDate } from '../shared/format';
import { useBreadcrumb } from '../shared/HorseManagementLayout';
import styles from '../shared/horses.module.css';
import { AssignBoxModal } from './AssignBoxModal';

interface Loaded {
  horse: HorseDetail;
  owners?: UserSummary[];
  assignments?: StableAssignment[];
  activation?: ActivationStatus;
  unavailable: string[];
}

type Field = 'sire' | 'dam' | 'owner';

/**
 * SCR-HORSE-004 Pedigree & Ownership (Figma 283:2487) — Flow 1 step 1.2, BR-04. Declares sire/dam (sent as names:
 * the contract's ref-XOR-name rule is satisfied by never sending both), links the owner and opens the Assign Stable Box
 * modal. Completing these items can activate the horse automatically (DEC-009 §1); there is no approve action.
 */
export function PedigreeOwnershipPage() {
  const api = useHorsesApi();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { photoUploadFailed?: boolean } };
  const id = Number(useParams().id);

  const [data, setData] = useState<Loaded>();
  const [loadError, setLoadError] = useState<string>();
  const initializedHorse = useRef<number | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [sire, setSire] = useState('');
  const [dam, setDam] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [share, setShare] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIsoDate());
  const [managing, setManaging] = useState(false);
  const pending = useRef(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [boxModalOpen, setBoxModalOpen] = useState(false);

  useBreadcrumb([{ label: 'Horses', to: '/horses' }, { label: data?.horse.name ?? 'Horse' }, { label: 'Pedigree & Ownership' }]);

  const fetchAll = useCallback(async (): Promise<Loaded> => {
    const horse = await api.getHorse(id);
    const [owners, assignments, activation] = await Promise.allSettled([
      api.listHorseOwners(), api.listStableAssignments(id), api.getActivationStatus(id),
    ]);
    return {
      horse,
      owners: owners.status === 'fulfilled' ? owners.value.items : undefined,
      assignments: assignments.status === 'fulfilled' ? assignments.value : undefined,
      activation: activation.status === 'fulfilled' ? activation.value : undefined,
      unavailable: [
        owners.status === 'rejected' ? 'Owner accounts' : null,
        assignments.status === 'rejected' ? 'Stable assignment history' : null,
        activation.status === 'rejected' ? 'Activation checklist' : null,
      ].filter((item): item is string => item !== null),
    };
  }, [api, id]);

  const apply = useCallback((loaded: Loaded) => {
    const { horse } = loaded;
    setData(loaded);
    setLoadError(undefined);
    if (initializedHorse.current !== horse.id) {
      initializedHorse.current = horse.id;
      setSire(horse.pedigree.sire.name || horse.pedigree.sire.horseCode || '');
      setDam(horse.pedigree.dam.name || horse.pedigree.dam.horseCode || '');
      setOwnerId(String(horse.currentOwnerships[0]?.owner.id ?? ''));
    }
  }, []);

  const loadFailed = (e: unknown) => {
    setLoadError(e instanceof ApiRequestError && e.status === 404 ? 'This horse was not found.' : e instanceof ApiRequestError && e.status === 403 ? 'You do not have permission to view this horse.' : 'The horse could not be loaded.');
  };

  useEffect(() => {
    let active = true;
    fetchAll().then((loaded) => active && apply(loaded), (e) => active && loadFailed(e));
    return () => {
      active = false;
    };
  }, [fetchAll, apply]);

  const load = async () => {
    setRefreshing(true);
    try { apply(await fetchAll()); } catch (e) { loadFailed(e); }
    finally { setRefreshing(false); }
  };

  if (loadError) {
    return <div className={styles.page}>
      <ErrorState title="Horse not available" description={loadError} onRetry={() => { setLoadError(undefined); void load(); }} />
    </div>;
  }
  if (!data) {
    return <LoadingState label="Loading horse…" />;
  }

  const { horse, owners, assignments, activation, unavailable } = data;
  const baselineDone = activation?.checklist.find((c) => c.item === 'VET_BASELINE')?.complete;
  const current = horse.currentAssignment;
  const previous = assignments?.filter((a) => a.effectiveTo !== null).length;
  const facts = [horse.horseCode, horse.breed, horse.sex, horse.foaledDate ? `foaled ${formatDate(horse.foaledDate)}` : null].filter(Boolean).join(' · ');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || refreshing || unavailable.length > 0) return;
    const missing: Partial<Record<Field, string>> = {};
    if (!sire.trim()) missing.sire = 'Enter the sire.';
    if (!dam.trim()) missing.dam = 'Enter the dam.';
    if (!ownerId) missing.owner = 'Select the owner.';
    const alreadyOwned = horse.currentOwnerships.some((item) => item.owner.id === Number(ownerId));
    if (!alreadyOwned && (!Number.isFinite(Number(share)) || Number(share) <= 0 || Number(share) > 100 || !effectiveFrom)) missing.owner = 'Enter an ownership share (greater than 0, at most 100) and effective date.';
    setErrors(missing);
    setFormError(undefined);
    if (Object.keys(missing).length > 0) return;

    pending.current = true; setSaving(true);
    try {
      const parent = (name: string, existing: HorseDetail['pedigree']['sire']) => existing.horseId && name.trim() === (existing.name || existing.horseCode || '') ? { horseId: existing.horseId, name: null } : { horseId: null, name: name.trim() };
      await api.setPedigree(horse.id, { sire: parent(sire, horse.pedigree.sire), dam: parent(dam, horse.pedigree.dam) });
      if (!horse.currentOwnerships.some((o) => o.owner.id === Number(ownerId))) {
        await api.addOwnership(horse.id, { ownerUserId: Number(ownerId), sharePercentage: Number(share), effectiveFrom, isManagingOwner: managing });
      }
      navigate('/horses/pending-activation', { state: { completedHorseId: horse.id } });
    } catch (e) {
      setFormError(e instanceof ApiRequestError ? e.message : 'The changes could not be saved. Please try again.');
    } finally {
      pending.current = false; setSaving(false);
    }
  };

  return (
    <form className={styles.page} onSubmit={submit} noValidate>
      <button type="button" className={styles.back} onClick={() => navigate(-1)}>{'←  Back'}</button>

      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{`Pedigree & Ownership · ${horse.name}`}</h1>
          <p className={styles.subtitle}>{`Step 2 of 2 · ${facts}`}</p>
        </div>
        <StatusBadge family="lifecycle" status={horse.lifecycle} />
      </div>

      {location.state?.photoUploadFailed && (
        <AlertBanner type="warning" title="Some photos were not uploaded">The horse was saved. Add the photos again from the horse profile.</AlertBanner>
      )}
      {formError && <AlertBanner type="danger" title="Changes not saved">{formError}</AlertBanner>}
      {unavailable.length > 0 && <AlertBanner type="warning" title="Horse setup unavailable">
        <p>{`${unavailable.join(', ')} could not be loaded. The saved horse remains available. Saving is disabled until the required setup data can be verified.`}</p>
        <Button variant="secondary" disabled={refreshing || saving} onClick={() => void load()}>{refreshing ? 'Retrying…' : 'Try again'}</Button>
        <p><Link to={`/horses/${id}`}>View saved horse profile</Link>{' · '}<Link to="/horses">Back to Horses</Link></p>
      </AlertBanner>}

      <div className={styles.twoCol}>
        <div className={styles.colMain}>
          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Pedigree</h2>
              <div className={styles.row}>
                <TextField label="Sire *" value={sire} maxLength={150} error={errors.sire} disabled={saving}
                  onChange={(e) => { setSire(e.target.value); setErrors((x) => ({ ...x, sire: undefined })); }} />
                <TextField label="Dam *" value={dam} maxLength={150} error={errors.dam} disabled={saving}
                  onChange={(e) => { setDam(e.target.value); setErrors((x) => ({ ...x, dam: undefined })); }} />
              </div>
            </div>
          </Card>

          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Ownership</h2>
              <p className={styles.cardHelp}>The owner sees this horse read-only in the Owner portal — owners cannot edit administrative data.</p>
              <SelectField label="Owner *" placeholder="Select a Horse Owner account" value={ownerId} error={errors.owner}
                disabled={!owners || saving || refreshing}
                helperText={owners ? (owners.length ? 'Ownership is saved when you continue.' : 'No active Horse Owner accounts were returned. Contact the Club Manager.') : 'Owner accounts unavailable. Retry setup data.'}
                options={(owners ?? []).map((o) => ({ value: String(o.id), label: `${o.fullName} · Horse Owner account` }))}
                onChange={(e) => { setOwnerId(e.target.value); setErrors((x) => ({ ...x, owner: undefined })); }} />
              {!horse.currentOwnerships.some((item) => item.owner.id === Number(ownerId)) && <>
                <TextField label="Ownership share (%)" type="number" min={0.01} max={100} step={0.01} value={share} disabled={saving} onChange={(event) => setShare(event.target.value)} />
                <TextField label="Ownership effective from" type="date" value={effectiveFrom} disabled={saving} onChange={(event) => setEffectiveFrom(event.target.value)} />
                <Checkbox label="Managing owner" checked={managing} disabled={saving} onChange={(event) => setManaging(event.target.checked)} />
              </>}
              <p className={styles.cardHelp}>Existing ownerships are retained. This form does not assume a single owner or a 100% share.</p>
            </div>
          </Card>

          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Stable box</h2>
              <p className={styles.cardHelp}>Required before activation. Only a free box can be assigned.</p>
              <div className={styles.boxRow}>
                <div className={styles.boxValue}>
                  <span className={styles.boxValueMain}>{current ? `Box ${current.boxCode}${current.yard ? ` · ${current.yard}` : ''}` : 'No box assigned yet'}</span>
                  <span className={styles.boxValueSub}>
                    {previous === undefined ? 'Box history unavailable' : previous === 0 ? (current ? `Assigned ${formatDate(current.effectiveFrom)}` : 'Box history: none — new arrival')
                      : `Box history: ${previous} previous ${previous === 1 ? 'box' : 'boxes'}`}
                  </span>
                </div>
                <Button variant="secondary" disabled={saving || refreshing} onClick={() => setBoxModalOpen(true)}>Assign Stable Box</Button>
              </div>
            </div>
          </Card>
        </div>

        <aside className={styles.colSide}>
          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Horse summary</h2>
              <div className={styles.kv}><span className={styles.kvLabel}>Horse</span><span className={styles.kvValue}>{`${horse.name} · ${horse.horseCode}`}</span></div>
              <div className={styles.kv}><span className={styles.kvLabel}>Breed · sex</span><span className={styles.kvValue}>{[horse.breed, horse.sex].filter(Boolean).join(' · ') || '—'}</span></div>
              <div className={styles.kv}><span className={styles.kvLabel}>Lifecycle</span><StatusBadge family="lifecycle" status={horse.lifecycle} /></div>
              <div className={styles.kv}><span className={styles.kvLabel}>Health baseline</span>
                <span className={styles.kvValue}>{baselineDone === undefined ? 'Baseline status unavailable' : baselineDone ? 'Recorded (Veterinarian)' : 'Not yet recorded (Veterinarian)'}</span></div>
            </div>
          </Card>
          <div className={[styles.note, styles.notePrimary].join(' ')}>
            <Icon name="info" size={16} />
            <span>Pedigree, owner and box complete the administrative profile. The horse stays DRAFT until all activation requirements — including the Veterinarian’s initial health baseline — are met.</span>
          </div>
        </aside>
      </div>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={() => navigate('/horses')} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || refreshing || unavailable.length > 0}>{'Save & Continue'}</Button>
      </div>

      {boxModalOpen && (
        <AssignBoxModal open horse={horse} onClose={() => setBoxModalOpen(false)}
          onAssigned={() => { setBoxModalOpen(false); void load(); }} />
      )}
    </form>
  );
}
