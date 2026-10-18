import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertBanner, Button, Card, ErrorState, LoadingState } from '../../../design-system';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { ApiError } from '../../../shared/auth/authApi';
import { useHorseHistoryService } from './historyService';
import type { ReadinessChecklist } from './historyTypes';
import styles from './history.module.css';

export function ReadinessReview({ horseId }: { horseId: number }) {
  const { user, expiresAt } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.some((r) => ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN'].includes(r))) return null;
  return <Review key={`${user.id}:${expiresAt}:${horseId}`} id={horseId} />;
}
function Review({ id }: { id: number }) {
  const service = useHorseHistoryService(); const { user, handleApiError } = useAuth();
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [success, setSuccess] = useState(false), [writeError, setWriteError] = useState<number>();
  const source = useMemo(() => ({ id, service, revision }), [id, service, revision]);
  const currentSource = useRef(source);
  useEffect(() => { currentSource.current = source; }, [source]);
  const mounted = useRef(false), locked = useRef(false);
  const [result, setResult] = useState<{ source: object; value?: ReadinessChecklist; error?: number }>();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true; const abort = new AbortController();
    service.checklist(id, abort.signal).then((value) => { if (active) setResult({ source, value }); }, (e: unknown) => { if (active && !handleApiError(e)) setResult({ source, error: e instanceof ApiError ? e.status : 500 }); });
    return () => { active = false; abort.abort(); };
  }, [source, service, id, handleApiError]);
  const current = result?.source === source ? result : undefined;
  const acknowledge = async () => {
    if (locked.current) return; locked.current = true; setBusy(true); setWriteError(undefined); setSuccess(false);
    try {
      await service.acknowledge(id);
      if (mounted.current && currentSource.current === source) { setSuccess(true); setRevision((n) => n + 1); }
    } catch (e) { if (mounted.current && currentSource.current === source && !handleApiError(e)) setWriteError(e instanceof ApiError ? e.status : 500); }
    finally { if (mounted.current) { locked.current = false; setBusy(false); } }
  };
  return <Card title="Head Trainer readiness review">
    <p className={styles.subtitle}>Recommended before training. This acknowledgement does not approve activation or change health, availability or lifecycle.</p>
    {service.source === 'sample' && <p className={styles.subtitle}>Sample acknowledgement · saved in this browser.</p>}
    {success && <AlertBanner type="success" title="Readiness review recorded" />}
    {writeError !== undefined && <AlertBanner type="danger" title={writeError === 403 ? 'Only the Head Trainer can record this review.' : writeError === 404 ? 'Horse not found.' : 'Review was not confirmed. Try again later.'} />}
    {current?.error !== undefined ? <ErrorState title={current.error === 403 ? 'Access denied' : current.error === 404 ? 'Horse not found' : 'Readiness unavailable'} description="The current activation checklist could not be loaded." onRetry={current.error === 403 || current.error === 404 ? undefined : () => setRevision((n) => n + 1)} /> : !current?.value ? <LoadingState label="Loading readiness checklist…" /> : <>
      <ul className={styles.checklist}>{current.value.checklist.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{item.requirement === 'RECOMMENDED' ? item.state === 'REVIEWED' ? 'Reviewed · non-blocking' : 'Recommended · non-blocking' : item.state === 'SATISFIED' ? 'Complete' : 'Pending'}</span></li>)}</ul>
      {user!.roles.includes('HEAD_TRAINER') && <Button disabled={busy} onClick={() => void acknowledge()}>{busy ? 'Recording review…' : 'Record readiness review'}</Button>}
    </>}
  </Card>;
}
