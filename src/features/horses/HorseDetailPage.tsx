import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, KeyValue, SelectField, StatusBadge, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { primaryRole, useAuth } from '../../shared/auth/authState';
import { useAction, useApi } from '../../shared/hooks/useApi';
import { ActionError, Grid, Resource, Row, Stack } from '../../shared/ui/common';
import { fmtDate, fmtDateTime, todayIso } from '../../shared/ui/format';
import { horsesApi, type HorseDetail } from '../demoApi';

/** SCR-HORSE-002 profile + onboarding steps 1.2 (pedigree, owner, box), 1.3 (Vet baseline), 1.4 (HT review). */
export function HorseDetailPage() {
  const id = Number(useParams().id);
  const { user } = useAuth();
  const role = user ? primaryRole(user) : null;
  const navigate = useNavigate();
  const horse = useApi(() => horsesApi.get(id), [id]);
  const activation = useApi(() => horsesApi.activation(id), [id]);
  const availability = useApi(() => horsesApi.availability(id), [id]);
  const refresh = () => {
    horse.reload();
    activation.reload();
    availability.reload();
  };
  const canSeeActivation = role === 'CLUB_MANAGER' || role === 'HEAD_TRAINER' || role === 'VETERINARIAN';

  return (
    <Resource {...horse} label="horse">
      {(h) => (
        <Stack gap="lg">
          <PageHeader title={`${h.name} · ${h.horseCode}`} description={`${h.breed ?? '—'} · ${h.sex ?? '—'} · foaled ${fmtDate(h.foaledDate)}`} />
          <Row>
            <StatusBadge family="lifecycle" status={h.lifecycle} />
            {h.healthStatus && <StatusBadge family="health" status={h.healthStatus as 'FIT'} />}
            <StatusBadge family="availability" status={h.trainingAvailability} />
          </Row>
          {h.lifecycle === 'ACTIVE' && <AlertBanner type="success" title="ACTIVE">Activated automatically {fmtDateTime(h.activatedAt)} — the horse can enter training.</AlertBanner>}
          {availability.data && availability.data.availability !== 'AVAILABLE' && (
            <AlertBanner type={availability.data.availability === 'LOCKED' ? 'danger' : 'warning'} title={`Training ${availability.data.availability}`}>
              {availability.data.reason}
            </AlertBanner>
          )}
          <Grid cols={2}>
            <Card title="Profile">
              <Stack gap="sm">
                <KeyValue label="Country of origin" value={h.countryOfOrigin ?? '—'} />
                <KeyValue label="Registration no." value={h.registrationNo ?? '—'} />
                <KeyValue label="Sire" value={h.pedigree.sire.name ?? h.pedigree.sire.horseCode ?? '—'} />
                <KeyValue label="Dam" value={h.pedigree.dam.name ?? h.pedigree.dam.horseCode ?? '—'} />
                <KeyValue label="Owner" value={h.currentOwnerships.map((o) => `${o.owner.fullName} (${o.sharePercentage}%)`).join(', ') || '—'} />
                <KeyValue label="Stable box" value={h.currentAssignment ? `${h.currentAssignment.yard ?? ''} ${h.currentAssignment.boxCode}`.trim() : '—'} />
                <KeyValue label="Latest weight" value={h.latestWeight ? `${h.latestWeight.weightKg} kg` : '—'} />
              </Stack>
            </Card>
            {canSeeActivation && (
              <Resource {...activation} label="activation status">
                {(a) => (
                  <Card title="Activation checklist">
                    <Stack gap="sm">
                      {a.checklist.map((c) => (
                        <KeyValue key={c.item} label={c.item.replaceAll('_', ' ')} value={`${c.complete ? '✓ Complete' : '○ Pending'} — ${c.detail}`} />
                      ))}
                      <KeyValue label="Head Trainer readiness review" value={`${a.readinessReview.reviewed ? 'Reviewed' : 'Recommended'} — does not block activation`} />
                    </Stack>
                  </Card>
                )}
              </Resource>
            )}
          </Grid>
          {role === 'CLUB_MANAGER' && h.lifecycle === 'DRAFT' && <ManagerSteps horse={h} onDone={refresh} />}
          {role === 'VETERINARIAN' && <BaselineCard horse={h} onDone={refresh} />}
          {role === 'VETERINARIAN' && h.lifecycle === 'ACTIVE' && (
            <Card title="Training restriction (Veterinarian)">
              <Row>
                <Button variant="secondary" onClick={() => navigate('/medical/restrictions')}>Set or lift training restriction</Button>
                <Button variant="secondary" onClick={() => navigate('/medical')}>Medical cases & incidents</Button>
              </Row>
            </Card>
          )}
          {role === 'HEAD_TRAINER' && <ReadinessCard horseId={h.id} onDone={refresh} />}
        </Stack>
      )}
    </Resource>
  );
}

function ManagerSteps({ horse, onDone }: { horse: HorseDetail; onDone: () => void }) {
  const owners = useApi(() => horsesApi.owners(), []);
  const boxes = useApi(() => horsesApi.boxes(), []);
  const action = useAction();
  const [sire, setSire] = useState(horse.pedigree.sire.name ?? '');
  const [dam, setDam] = useState(horse.pedigree.dam.name ?? '');
  const [owner, setOwner] = useState('');
  const [box, setBox] = useState('');
  const hasPedigree = Boolean(horse.pedigree.sire.name || horse.pedigree.sire.horseId) && Boolean(horse.pedigree.dam.name || horse.pedigree.dam.horseId);

  const savePedigree = async (e: FormEvent) => {
    e.preventDefault();
    if (!sire.trim() || !dam.trim()) return action.setError('Sire and dam are required.');
    if (await action.run(() => horsesApi.pedigree(horse.id, { sire: { name: sire.trim() }, dam: { name: dam.trim() } }))) onDone();
  };
  const saveOwner = async (e: FormEvent) => {
    e.preventDefault();
    if (!owner) return action.setError('Select an owner.');
    if (await action.run(() => horsesApi.addOwner(horse.id, { ownerUserId: Number(owner), sharePercentage: 100, effectiveFrom: todayIso(), isManagingOwner: true }))) {
      setOwner('');
      onDone();
    }
  };
  const saveBox = async (e: FormEvent) => {
    e.preventDefault();
    if (!box) return action.setError('Select a free stable box.');
    if (await action.run(() => horsesApi.assignBox(horse.id, { stableBoxId: Number(box), effectiveFrom: todayIso() }))) {
      boxes.reload();
      onDone();
    }
  };

  return (
    <Card title="Onboarding — step 1.2 (Club Manager)">
      <Stack>
        <ActionError error={action.error} />
        <form onSubmit={savePedigree} noValidate>
          <Row>
            <TextField label="Sire" value={sire} onChange={(e) => setSire(e.target.value)} />
            <TextField label="Dam" value={dam} onChange={(e) => setDam(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={action.busy}>{hasPedigree ? 'Update pedigree' : 'Save pedigree'}</Button>
          </Row>
        </form>
        {horse.currentOwnerships.length === 0 && (
          <form onSubmit={saveOwner} noValidate>
            <Row>
              <SelectField label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Select owner"
                options={(owners.data ?? []).map((o) => ({ value: String(o.id), label: o.fullName }))} />
              <Button type="submit" variant="secondary" disabled={action.busy}>Record owner (100%)</Button>
            </Row>
          </form>
        )}
        {!horse.currentAssignment && (
          <form onSubmit={saveBox} noValidate>
            <Row>
              <SelectField label="Stable box" value={box} onChange={(e) => setBox(e.target.value)} placeholder="Select a free box"
                options={(boxes.data ?? []).filter((b) => b.status === 'FREE').map((b) => ({ value: String(b.id), label: `${b.yard ?? ''} ${b.boxCode}`.trim() }))} />
              <Button type="submit" variant="secondary" disabled={action.busy}>Assign box</Button>
            </Row>
          </form>
        )}
        <AlertBanner type="info" title="Next: Veterinarian baseline">The Veterinarian records the baseline examination (weight + health status). Activation is automatic.</AlertBanner>
      </Stack>
    </Card>
  );
}

function BaselineCard({ horse, onDone }: { horse: HorseDetail; onDone: () => void }) {
  const action = useAction();
  const [weight, setWeight] = useState('');
  const [health, setHealth] = useState('FIT');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  if (horse.lifecycle !== 'DRAFT' || done) return null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const kg = Number(weight);
    if (!weight || !Number.isFinite(kg) || kg <= 0) return action.setError('Enter a weight in kg greater than 0.');
    if (await action.run(() => horsesApi.baseline(horse.id, { weightKg: kg, healthStatus: health, clinicalNotes: notes || null }))) {
      setDone(true);
      onDone();
    }
  };
  return (
    <Card title="Baseline examination — step 1.3 (Veterinarian)">
      <form onSubmit={submit} noValidate>
        <Stack>
          <ActionError error={action.error} />
          <Row>
            <TextField label="Weight (kg)" type="number" min="1" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            <SelectField label="Health status" value={health} onChange={(e) => setHealth(e.target.value)}
              options={['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'].map((v) => ({ value: v, label: v }))} />
            <TextField label="Clinical notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Record baseline'}</Button>
          </Row>
        </Stack>
      </form>
    </Card>
  );
}

function ReadinessCard({ horseId, onDone }: { horseId: number; onDone: () => void }) {
  const action = useAction();
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  return (
    <Card title="Readiness review — step 1.4 (Head Trainer, recommended, non-blocking)">
      <Stack>
        <ActionError error={action.error} />
        {ok && <AlertBanner type="success" title="Readiness review recorded" />}
        <Row>
          <Button variant="secondary" disabled={action.busy || ok} onClick={async () => {
            const done = await action.run(async () => {
              await horsesApi.readiness(horseId);
              return true;
            });
            if (done) {
              setOk(true);
              onDone();
            }
          }}>Mark readiness reviewed</Button>
          <Button onClick={() => navigate(`/training/programs/new?horseId=${horseId}`)}>Create training program</Button>
        </Row>
      </Stack>
    </Card>
  );
}
