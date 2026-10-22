import { UiPreviewNotice } from './UiPreviewNotice';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { AlertBanner, ButtonLink, Card, EmptyState, ErrorState, Icon, LoadingState, SelectField, StatusBadge } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { MEDICAL_ROUTES } from './paths';
import { createSummaryService, type SummaryService } from './summaryService';
import { ApiError } from '../../shared/auth/authApi';
import './medical.css';

export function MedicalSummaryAccess() {
  const auth = useAuth(), actor = auth.user, token = authSession.read()?.accessToken;
  const service = useMemo(() => token ? createSummaryService(token, auth.handleApiError) : null, [token, auth.handleApiError]);
  if (auth.status !== 'authenticated' || !actor || actor.accountStatus !== 'ACTIVE' || !actor.roles.includes('HEAD_TRAINER') || !service)
    return <AlertBanner type="danger" title="Access denied" />;
  return <AppShell user={{ fullName: actor.fullName, role: 'HEAD_TRAINER' }} breadcrumb={[{ label: 'Medical Summary' }]}>
    <UiPreviewNotice />
    <MedicalSummaryPage key={`${actor.id}:${auth.expiresAt}`} service={service} />
  </AppShell>;
}
function useRead<T>(load: () => Promise<T>, key: unknown) {
  const [state, setState] = useState<{ key: unknown; data?: T; error?: string }>({ key: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    load().then((data) => { if (active) setState({ key, data }); })
      .catch((error: unknown) => { if (active) setState({ key, error: error instanceof ApiError ? error.status === 403 ? 'Access denied. Summary unavailable for this account.' : 'Summary unavailable. Please retry.' : error instanceof Error ? error.message : 'Summary unavailable.' }); });
    return () => { active = false; };
  }, [load, key, revision]);
  return { ...(state.key === key ? state : {}), retry: () => { setState({ key: null }); setRevision((n) => n + 1); } };
}
function State({ error, retry }: { error?: string; retry: () => void }) {
  return error ? <ErrorState title="Summary unavailable" description={error} onRetry={retry} /> : <LoadingState label="Loading medical summary…" />;
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="medical-summary-row"><dt>{label}</dt><dd>{children}</dd></div>;
}
/** Non-clinical, read-only Figma 274:9405. Missing DTO fields stay unavailable, never inferred. */
export function MedicalSummaryPage({ service }: { service: SummaryService }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get('horseId');
  const id = selected === null ? null : Number(selected);
  const listLoad = useMemo(() => () => service.listHorses(), [service]);
  const horses = useRead(listLoad, service);
  if (id !== null && (!/^\d+$/.test(selected!) || !Number.isSafeInteger(id) || id < 1))
    return <div className="medical-stack"><ButtonLink variant="tertiary" to={MEDICAL_ROUTES.medicalSummary}>← Back to selection</ButtonLink><EmptyState title="Horse not found" description="Choose a horse from Medical Summary." /></div>;
  return <div className="medical-stack">
    {id === null ? <PageHeader title="Medical Summary" description="Read-only training-relevant information" /> : <ButtonLink variant="tertiary" to={MEDICAL_ROUTES.medicalSummary}>← Back</ButtonLink>}
    {id === null && <Card title="Select a horse">{!horses.data ? <State error={horses.error} retry={horses.retry} /> : horses.data.length === 0 ? <EmptyState title="No active horses" /> :
      <SelectField label="Horse" placeholder="Select a horse" value="" options={horses.data.map((h) => ({ value: String(h.id), label: `${h.name} · ${h.horseCode}` }))} onChange={(event) => setParams({ horseId: event.target.value })} />}</Card>}
    {id !== null && <HorseSummary key={id} id={id} service={service} />}
  </div>;
}
function HorseSummary({ id, service }: { id: number; service: SummaryService }) {
  const horseLoad = useMemo(() => () => service.getHorse(id), [service, id]);
  const availabilityLoad = useMemo(() => () => service.getAvailability(id), [service, id]);
  const casesLoad = useMemo(() => () => service.listCases(), [service]);
  const horse = useRead(horseLoad, horseLoad), availability = useRead(availabilityLoad, availabilityLoad), cases = useRead(casesLoad, casesLoad);
  if (!horse.data) return <State error={horse.error} retry={horse.retry} />;
  const current = availability.data;
  const birth = horse.data.foaledDate?.split('-').map(Number), today = new Date();
  let age = birth ? today.getFullYear() - birth[0] : null;
  if (age !== null && birth && (today.getMonth() + 1 < birth[1] || (today.getMonth() + 1 === birth[1] && today.getDate() < birth[2]))) age--;
  const subtitle = [horse.data.horseCode, horse.data.breed, age !== null && age >= 0 ? `${age} yrs` : undefined, horse.data.sex,
    [horse.data.yard, horse.data.currentBoxCode ? `Box ${horse.data.currentBoxCode}` : undefined].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const open = cases.data?.filter((c) => c.horseId === id && c.status === 'OPEN');
  return <>
    <PageHeader title={`Medical Summary · ${horse.data.name}`} description={subtitle}
      actions={<span className="medical-read-only"><Icon name="eye" size={14} /> READ-ONLY</span>} />
    <div className="medical-summary-columns">
      <Card title="Training-relevant medical status" className="medical-summary-status">
        <dl>
          <Row label="Health Status">{horse.data.healthStatus ? <StatusBadge family="health" status={horse.data.healthStatus} /> : 'Not assessed'}</Row>
          <Row label="Training Availability">{current ? <StatusBadge family="availability" status={current.availability} /> : 'Unavailable'}</Row>
          <Row label="Active restriction">{current ? current.availability === 'AVAILABLE' ? 'None' : current.reason || current.availability : 'Unavailable'}</Row>
          <Row label="Open medical case">{open ? open.length ? open.map((c) => `Case ${c.id}`).join(', ') : 'None' : 'Unavailable'}</Row>
          <Row label="Latest recorded weight">{horse.data.latestWeight ? <>{horse.data.latestWeight.weightKg} kg · <time dateTime={horse.data.latestWeight.recordedAt}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(horse.data.latestWeight.recordedAt))}</time></> : 'Unavailable in this summary'}</Row>
          <Row label="Next medical review">Unavailable in this summary</Row>
        </dl>
        {!current ? <State error={availability.error} retry={availability.retry} /> :
          <AlertBanner type={current.availability === 'AVAILABLE' ? 'success' : 'warning'} title="Training impact">
            {current.availability === 'AVAILABLE' ? 'No active medical restriction. Other scheduling and readiness checks still apply.' : current.availability === 'LOCKED' ? 'Training is locked by the current medical restriction.' : current.reason || 'Training is limited. Follow the current exercise restrictions.'}
          </AlertBanner>}
        {!cases.data && <State error={cases.error} retry={cases.retry} />}
        {current?.exerciseRules?.length ? <div className="medical-stack"><h3>Exercise restrictions</h3>{current.exerciseRules.map((rule, index) => <p key={index}>{rule.ruleType}: {rule.exerciseTypeNote ?? `Exercise ${rule.exerciseId}`}</p>)}</div> : null}
      </Card>
      <aside className="medical-stack">
        <AlertBanner type="info" title="Summary only">Full clinical details — diagnosis detail, treatment plan and prescriptions — are available to the veterinary team only. Training Availability and restrictions are set by the Veterinarian.</AlertBanner>
        <Card title="Club-wide restrictions"><p>Training restrictions remain under veterinary control. This summary is read-only.</p></Card>
      </aside>
    </div>
  </>;
}
