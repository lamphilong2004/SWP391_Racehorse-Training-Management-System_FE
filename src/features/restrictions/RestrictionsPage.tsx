import { useState, type FormEvent } from 'react';
import { AlertBanner, Button, Card, Checkbox, DataTable, EmptyState, SelectField, StatusBadge, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { primaryRole, useAuth } from '../../shared/auth/authState';
import { useAction, useApi } from '../../shared/hooks/useApi';
import { ActionError, Resource, Row, Stack } from '../../shared/ui/common';
import { fmtDate, fmtDateTime } from '../../shared/ui/format';
import { horsesApi, restrictionApi, trainingApi, type HorseSummary, type Restriction } from '../demoApi';

/**
 * MF-08 Medical Training Restriction (Veterinarian is the sole writer). Availability is derived:
 * no active restriction → AVAILABLE, LIMITED → LIMITED, LOCKED → LOCKED. One active restriction per horse (409).
 */
export function RestrictionsPage() {
  const { user } = useAuth();
  const isVet = user && primaryRole(user) === 'VETERINARIAN';
  const horses = useApi(() => horsesApi.list(), []);
  const restrictions = useApi(() => restrictionApi.list(), []);
  const [horseId, setHorseId] = useState('');
  const refresh = () => {
    horses.reload();
    restrictions.reload();
  };
  return (
    <>
      <PageHeader title="Training restrictions" description="Training Availability is set only by the Veterinarian. Lifting a restriction returns the horse to AVAILABLE." />
      <Resource {...horses} label="horses">
        {(page) => (
          <Card title="Training availability by horse">
            <DataTable<HorseSummary> caption="Availability" rows={page.items.filter((h) => h.lifecycle === 'ACTIVE')} rowKey={(h) => h.id}
              onRowClick={isVet ? (h) => setHorseId(String(h.id)) : undefined} selectedKey={Number(horseId) || undefined}
              empty={<EmptyState title="No ACTIVE horses" />}
              columns={[
                { key: 'h', header: 'Horse', render: (h) => `${h.name} · ${h.horseCode}` },
                { key: 'hs', header: 'Health', render: (h) => h.healthStatus ?? '—' },
                { key: 'a', header: 'Training availability', render: (h) => <StatusBadge family="availability" status={h.trainingAvailability} /> },
              ]} />
          </Card>
        )}
      </Resource>
      {isVet && horseId && <SetRestriction key={horseId} horseId={Number(horseId)} onDone={refresh} />}
      <Resource {...restrictions} label="restrictions">
        {(data) => (
          <Card title="Restrictions">
            <DataTable<Restriction> caption="Restrictions" rows={data.items} rowKey={(r) => r.id} empty={<EmptyState title="No restrictions" />}
              columns={[
                { key: 'h', header: 'Horse', render: (r) => horses.data?.items.find((h) => h.id === r.horseId)?.name ?? `#${r.horseId}` },
                { key: 'l', header: 'Level', render: (r) => <StatusBadge family="availability" status={r.level} /> },
                { key: 'r', header: 'Reason', render: (r) => r.reason },
                { key: 'e', header: 'Exercises', render: (r) => r.exerciseRules.map((x) => `${x.ruleType === 'PROHIBITED' ? '✕' : '✓'} ${x.exerciseName ?? ''}`).join(', ') || '—' },
                { key: 'f', header: 'Effective', render: (r) => fmtDateTime(r.effectiveAt) },
                { key: 'rv', header: 'Review', render: (r) => fmtDate(r.reviewDate) },
                { key: 's', header: 'State', render: (r) => (r.liftedAt ? `Lifted ${fmtDateTime(r.liftedAt)}` : 'ACTIVE') },
                { key: 'a', header: '', render: (r) => (isVet && !r.liftedAt ? <LiftButton id={r.id} onDone={refresh} /> : null) },
              ]} />
          </Card>
        )}
      </Resource>
    </>
  );
}

function LiftButton({ id, onDone }: { id: number; onDone: () => void }) {
  const action = useAction();
  return (
    <Stack gap="sm">
      <Button size="sm" variant="secondary" disabled={action.busy} onClick={async (e) => {
        e.stopPropagation();
        if (await action.run(() => restrictionApi.lift(id))) onDone();
      }}>{action.busy ? 'Lifting…' : 'Lift restriction'}</Button>
      {action.error && <small>{action.error}</small>}
    </Stack>
  );
}

function SetRestriction({ horseId, onDone }: { horseId: number; onDone: () => void }) {
  const action = useAction();
  const availability = useApi(() => horsesApi.availability(horseId), [horseId]);
  const exercises = useApi(() => trainingApi.exercises(), []);
  const [level, setLevel] = useState<'LIMITED' | 'LOCKED'>('LOCKED');
  const [reason, setReason] = useState('');
  const [review, setReview] = useState('');
  const [prohibited, setProhibited] = useState<number[]>([]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return action.setError('A reason is required.');
    if (level === 'LIMITED' && prohibited.length === 0) return action.setError('Select at least one prohibited exercise for LIMITED.');
    const rules = level === 'LIMITED' ? (exercises.data ?? []).map((x) => ({ exerciseDefinitionId: x.id, ruleType: prohibited.includes(x.id) ? 'PROHIBITED' : 'ALLOWED' })) : [];
    if (await action.run(() => restrictionApi.create(horseId, { level, reason: reason.trim(), effectiveAt: new Date().toISOString(), reviewDate: review || null, exerciseRules: rules }))) {
      setReason('');
      availability.reload();
      onDone();
    }
  };
  return (
    <Card title="Set training restriction">
      <Stack>
        <ActionError error={action.error} />
        {availability.data && availability.data.availability !== 'AVAILABLE' && (
          <AlertBanner type="warning" title={`Already ${availability.data.availability}`}>Lift the active restriction before setting a new one (one active restriction per horse).</AlertBanner>
        )}
        <form onSubmit={submit} noValidate>
          <Stack>
            <Row>
              <SelectField label="Level" value={level} onChange={(e) => setLevel(e.target.value as 'LIMITED' | 'LOCKED')}
                options={[{ value: 'LOCKED', label: 'LOCKED — no training' }, { value: 'LIMITED', label: 'LIMITED — per-exercise rules' }]} />
              <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <TextField label="Review date" type="date" value={review} onChange={(e) => setReview(e.target.value)} />
            </Row>
            {level === 'LIMITED' && (
              <Row>
                {(exercises.data ?? []).map((x) => (
                  <Checkbox key={x.id} label={`Prohibit ${x.name}`} checked={prohibited.includes(x.id)}
                    onChange={(e) => setProhibited((p) => (e.target.checked ? [...p, x.id] : p.filter((v) => v !== x.id)))} />
                ))}
              </Row>
            )}
            <Row><Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Set restriction'}</Button></Row>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}
