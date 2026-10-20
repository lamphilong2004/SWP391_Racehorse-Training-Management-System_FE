import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, ErrorState, StatusBadge, Icon, LoadingState, type IconName, DesignSystemScope } from '../../../design-system';
import { useHorsesApi } from '../api/HorsesApiContext';
import type { ActivationItem, ActivationStatus, HorseDetail } from '../api/types';
import { ageInYears, formatDate } from '../shared/format';
import { useBreadcrumb } from '../shared/HorseManagementLayout';
import shared from '../shared/horses.module.css';
import styles from './PendingActivationPage.module.css';

interface PendingHorse {
  status: ActivationStatus;
  horse: HorseDetail;
}

/** Labels and owners of the mandatory items, as drawn on Figma 285:2786. */
const ITEMS: Record<ActivationItem, { label: string; who: 'Club Manager' | 'Veterinarian'; sub: (h: HorseDetail) => string }> = {
  IDENTITY: { label: 'Profile & identity', who: 'Club Manager', sub: () => 'Club Manager · Register Horse' },
  PEDIGREE: { label: 'Pedigree', who: 'Club Manager', sub: () => 'Club Manager · Sire and Dam' },
  OWNER: { label: 'Ownership', who: 'Club Manager', sub: () => 'Club Manager · Horse Owner' },
  FREE_STABLE_BOX: {
    label: 'Stable box assigned', who: 'Club Manager',
    sub: (h) => (h.currentBoxCode ? `Club Manager · ${h.currentBoxCode} (free box)` : 'Club Manager · a free stable box'),
  },
  VETERINARIAN_BASELINE: { label: 'Initial health baseline', who: 'Veterinarian', sub: () => 'Veterinarian · weight, condition, first Health Status' },
};

/**
 * SCR-HORSE-005 Pending Activation (Figma 285:2786) — Flow 1 step 1.5 status view for the Club Manager.
 * Activation is automatic (DEC-009 §1): there is NO approve or activate action anywhere on this page. The Head Trainer
 * readiness review is shown as "Recommended — does not block activation".
 */
/** Design System v2 scope for this CORE-013 screen; the shared horse layout stays owner-neutral. */
export function PendingActivationPage() {
  return <DesignSystemScope><PendingActivationPageContent /></DesignSystemScope>;
}

function PendingActivationPageContent() {
  const api = useHorsesApi();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { completedHorseId?: number } };
  useBreadcrumb([{ label: 'Horses', to: '/horses' }, { label: 'Pending Activation' }]);

  const [pending, setPending] = useState<PendingHorse[]>();
  const [error, setError] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [metadata, setMetadata] = useState({ totalItems: 0, totalPages: 0 });

  const fetchPending = useCallback(async () => {
    const page = await api.listPendingActivation(pageIndex);
    const horses = await Promise.all(page.items.map((status) => api.getHorse(status.horseId)));
    return { items: page.items.map((status, i) => ({ status, horse: horses[i] })), totalItems: page.totalItems, totalPages: page.totalPages };
  }, [api, pageIndex]);

  useEffect(() => {
    let active = true;
    fetchPending().then((data) => { if (active) { setPending(data.items); setMetadata(data); } }, () => active && setError(true));
    return () => {
      active = false;
    };
  }, [fetchPending]);

  const load = () => fetchPending().then((data) => { setPending(data.items); setMetadata(data); }, () => setError(true));
  const changePage = (page: number) => { setPending(undefined); setError(false); setPageIndex(page); };

  const completed = pending?.find((p) => p.horse.id === location.state?.completedHorseId);

  return (
    <div className={shared.page}>
      <button type="button" className={shared.back} onClick={() => navigate('/horses')}>{'←  Back to Horses'}</button>

      <div className={shared.titleBlock}>
        <h1 className={shared.title}>Pending Activation</h1>
        <p className={shared.subtitle}>
          {`Horses in DRAFT and what is still missing before they become ACTIVE${pending ? ` · ${metadata.totalItems} ${metadata.totalItems === 1 ? 'horse' : 'horses'}` : ''}`}
        </p>
      </div>

      {completed && completed.horse.currentBoxCode && missingItems(completed.status).every((item) => item === 'VETERINARIAN_BASELINE') && (
        <AlertBanner type="success" title={`Stable box ${completed.horse.currentBoxCode} assigned to ${completed.horse.name}`}>
          {missingItems(completed.status).length === 1 && missingItems(completed.status)[0] === 'VETERINARIAN_BASELINE'
            ? 'Pedigree, owner and box are recorded. The Veterinarian’s initial health baseline is the remaining requirement.'
            : 'Pedigree, owner and box are recorded.'}
        </AlertBanner>
      )}

      <div className={shared.twoCol}>
        <div className={shared.colMain}>
          {error && <Card><ErrorState title="Pending horses unavailable" description="The pending horses could not be loaded." onRetry={() => { setError(false); setPending(undefined); void load(); }} /></Card>}
          {!error && !pending && <Card><LoadingState label="Loading pending horses…" /></Card>}
          {pending && pending.length === 0 && (
            <Card>
              <EmptyState title="No horses waiting for activation"
                description="No DRAFT horses were returned. New horses appear here while they are waiting for mandatory requirements." />
            </Card>
          )}
          {pending?.map((p) => <PendingHorseCard key={p.horse.id} {...p} onViewRegister={() => navigate('/horses')} />)}
          {pending && metadata.totalPages > 1 && <div className={shared.footer}><Button variant="secondary" disabled={pageIndex === 0} onClick={() => changePage(pageIndex - 1)}>Previous page</Button><span>Page {pageIndex + 1} of {metadata.totalPages}</span><Button variant="secondary" disabled={pageIndex + 1 >= metadata.totalPages} onClick={() => changePage(pageIndex + 1)}>Next page</Button></div>}
        </div>

        <aside className={shared.colSide}>
          <Card>
            <div className={styles.howBody}>
              <h2 className={shared.cardTitle}>How activation works</h2>
              <p className={styles.howText}>DRAFT → ACTIVE happens automatically when the horse’s data is valid: identity, pedigree and owner, a free stable box, and the Veterinarian’s initial health baseline.</p>
              <p className={styles.howMuted}>The Club Manager cannot record or edit the baseline — it is the Veterinarian’s examination.</p>
              <div className={styles.lifecycle}>
                <StatusBadge family="lifecycle" status="DRAFT" />
                <Icon name="chevron-right" size={16} />
                <StatusBadge family="lifecycle" status="ACTIVE" />
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function missingItems(status: ActivationStatus): ActivationItem[] {
  return status.checklist.flatMap((c) => c.requirement === 'MANDATORY' && c.state === 'PENDING' ? [c.id] : []);
}

function PendingHorseCard({ status, horse, onViewRegister }: PendingHorse & { onViewRegister: () => void }) {
  const age = ageInYears(horse.foaledDate);
  const owner = horse.currentOwnerships[0]?.owner.fullName;
  const meta = [horse.breed, horse.sex, age !== null ? `${age} ${age === 1 ? 'yr' : 'yrs'}` : null,
    owner ? `Owner ${owner}` : null, horse.currentBoxCode ? `Box ${horse.currentBoxCode}` : null,
    `registered ${formatDate(horse.createdAt)}`].filter(Boolean).join(' · ');
  const missing = missingItems(status);
  const onlyBaseline = missing.length === 1 && missing[0] === 'VETERINARIAN_BASELINE';
  const reviewed = status.checklist.find((c) => c.id === 'HEAD_TRAINER_READINESS_REVIEW')?.state === 'REVIEWED';

  return (
    <Card>
      <div className={styles.horseBody}>
        <div className={styles.horseHeader}>
          <div className={styles.horseName}>
            <h2 className={styles.horseTitle}>{`${horse.name} · ${horse.horseCode}`}</h2>
            <p className={styles.horseMeta}>{meta}</p>
          </div>
          <StatusBadge family="lifecycle" status={status.lifecycle} />
        </div>
        <hr className={styles.divider} />
        <h3 className={styles.checklistTitle}>Activation checklist</h3>
        <ul className={styles.checklist}>
          {status.checklist.map((c) => {
            if (c.requirement !== 'MANDATORY') return null;
            const spec = ITEMS[c.id];
            const complete = c.state === 'SATISFIED';
            return (
              <ChecklistRow key={c.id} icon={complete ? 'check-circle' : 'clock'} tone={complete ? 'success' : 'warning'}
                label={c.label} sub={c.description} value={complete ? 'Complete' : `Pending — ${spec.who}`} />
            );
          })}
          <ChecklistRow icon={reviewed ? 'check-circle' : 'circle'} tone="muted" label="Head Trainer readiness review"
            sub="Recommended before training — does not block activation" value={reviewed ? 'Reviewed' : 'Recommended'} />
        </ul>
        <div className={[shared.note, shared.noteWarning, shared.noteStrong].join(' ')} role="status">
          <Icon name="clock" size={16} />
          <span>
            {onlyBaseline
              ? 'Waiting for the Veterinarian’s baseline — the last open requirement. '
              : `Waiting for: ${missing.map((m) => ITEMS[m]?.label.toLowerCase() ?? m).join(', ')}. `}
            {`${horse.name} becomes ACTIVE automatically once all mandatory requirements are met — no manual approval.`}
          </span>
        </div>
        <div className={styles.actions}>
          {/* NEEDS CLARIFICATION: no contract operation exists for requesting the baseline (CORE-004); shown disabled. */}
          <Button variant="secondary" disabled title="Not available yet — no request operation in the approved contract">
            Request baseline examination
          </Button>
          <Button variant="tertiary" onClick={onViewRegister}>View horse register</Button>
        </div>
      </div>
    </Card>
  );
}

function ChecklistRow({ icon, tone, label, sub, value }: { icon: IconName; tone: 'success' | 'warning' | 'muted'; label: string; sub: string; value: string }) {
  return (
    <li className={styles.check}>
      <span className={[styles.checkIcon, styles[tone]].join(' ')}><Icon name={icon} size={18} /></span>
      <span className={styles.checkText}>
        <span className={styles.checkLabel}>{label}</span>
        <span className={styles.checkSub}>{sub}</span>
      </span>
      <span className={[styles.checkValue, styles[tone]].join(' ')}>{value}</span>
    </li>
  );
}
