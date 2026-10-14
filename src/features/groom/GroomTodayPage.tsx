import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, SelectField, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { useAction, useApi } from '../../shared/hooks/useApi';
import { ActionError, Resource, Row, Stack } from '../../shared/ui/common';
import { fmtDateTime, todayIso } from '../../shared/ui/format';
import { trainingApi, type SessionSummary } from '../demoApi';

const ITEMS = [
  { key: 'generalCondition', label: 'General condition', hint: 'Alert, normal posture, no signs of distress' },
  { key: 'appetiteBehaviour', label: 'Appetite & behaviour', hint: 'Ate the morning feed; behaving as usual' },
  { key: 'legsHooves', label: 'Legs & hooves', hint: 'No heat, no visible swelling, shoes secure' },
  { key: 'movement', label: 'Movement when led out', hint: 'Sound when walked out of the box — no visible lameness' },
  { key: 'temperature', label: 'Temperature', hint: 'Take if something seems off' },
] as const;
type ItemKey = (typeof ITEMS)[number]['key'];

/** SCR-DASH-004 Groom Today (pre-session checks) + SCR-TRAIN-007 Pre-Session Check. */
export function GroomTodayPage() {
  const [date, setDate] = useState(todayIso());
  const sessions = useApi(() => trainingApi.groomSessions(date), [date]);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  return (
    <>
      <PageHeader title="Groom Today" description="Pre-session checks for today's training sessions. You record observations only — the Veterinarian decides." />
      <Card>
        <Row>
          <TextField label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelected(null); }} />
          <Link to="/care/tasks/treatment">Treatment tasks →</Link>
        </Row>
      </Card>
      <Resource {...sessions} label="sessions">
        {(rows) => (
          <Card title="Sessions needing a pre-session check">
            <DataTable<SessionSummary> caption="Sessions" rows={rows} rowKey={(s) => s.id} onRowClick={(s) => setSelected(s)} selectedKey={selected?.id}
              empty={<EmptyState title="No scheduled sessions for this date" />}
              columns={[
                { key: 't', header: 'Time', render: (s) => fmtDateTime(s.scheduledStart) },
                { key: 'h', header: 'Horse', render: (s) => `${s.horse.name} · ${s.horse.horseCode}` },
                { key: 'c', header: 'Session', render: (s) => s.sessionCode },
                { key: 'r', header: 'Work Rider', render: (s) => s.workRider.fullName },
                { key: 'p', header: 'Pre-check', render: (s) => s.preCheckResult ?? 'Pending' },
              ]} />
          </Card>
        )}
      </Resource>
      {selected && <PreCheckForm key={selected.id} session={selected} onDone={() => sessions.reload()} />}
    </>
  );
}

function PreCheckForm({ session, onDone }: { session: SessionSummary; onDone: () => void }) {
  const action = useAction();
  const [items, setItems] = useState<Record<ItemKey, { result: 'NORMAL' | 'ABNORMAL'; observation: string }>>(
    () => Object.fromEntries(ITEMS.map((i) => [i.key, { result: 'NORMAL', observation: '' }])) as Record<ItemKey, { result: 'NORMAL' | 'ABNORMAL'; observation: string }>,
  );
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<{ id: number; overallResult: 'ALL_NORMAL' | 'ABNORMAL' } | null>(
    session.preCheckResult ? { id: 0, overallResult: session.preCheckResult } : null,
  );
  const [incident, setIncident] = useState<{ code: string } | null>(null);
  const [type, setType] = useState('HOOF_OR_LEG_PROBLEM');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const anyAbnormal = Object.values(items).some((i) => i.result === 'ABNORMAL');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { result: v.result, observation: v.observation.trim() || null }])),
      notes: notes.trim() || null,
    };
    const saved = await action.run(() => trainingApi.preCheck(session.id, body));
    if (saved) {
      setResult(saved);
      onDone();
    }
  };

  const report = async (e: FormEvent) => {
    e.preventDefault();
    if (!result?.id) return action.setError('Reload the page to report the incident for this check.');
    const abnormal = Object.entries(items).filter(([, v]) => v.result === 'ABNORMAL').map(([k, v]) => `${ITEMS.find((i) => i.key === k)?.label}: ${v.observation || 'abnormal'}`);
    const created = await action.run(() =>
      trainingApi.createIncident({ horseId: session.horse.id, preSessionCheckId: result.id, incidentType: type, observedSeverity: severity,
        description: (description.trim() || abnormal.join('; ')).slice(0, 2000), observedAt: new Date().toISOString() }),
    );
    if (created) setIncident({ code: created.incidentCode });
  };

  return (
    <Card title={`Pre-session check — ${session.horse.name} · ${session.sessionCode}`}>
      <Stack>
        <ActionError error={action.error} />
        {!result && (
          <form onSubmit={submit} noValidate>
            <Stack>
              {ITEMS.map((item) => (
                <Row key={item.key}>
                  <SelectField label={`${item.label} — ${item.hint}`} value={items[item.key].result}
                    onChange={(e) => setItems((s) => ({ ...s, [item.key]: { ...s[item.key], result: e.target.value as 'NORMAL' | 'ABNORMAL' } }))}
                    options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'ABNORMAL', label: 'Abnormal' }]} />
                  <TextField label="Observation (optional)" value={items[item.key].observation}
                    onChange={(e) => setItems((s) => ({ ...s, [item.key]: { ...s[item.key], observation: e.target.value } }))} />
                </Row>
              ))}
              <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              {anyAbnormal && <AlertBanner type="warning" title="Abnormal observation">Saving marks the horse NOT FIT to train now. The session will stay blocked. You can then report an incident.</AlertBanner>}
              <Row><Button type="submit" disabled={action.busy}>{action.busy ? 'Saving…' : 'Complete pre-session check'}</Button></Row>
            </Stack>
          </form>
        )}
        {result?.overallResult === 'ALL_NORMAL' && <AlertBanner type="success" title="ALL NORMAL — handed over to the Work Rider">The Work Rider can now start the session.</AlertBanner>}
        {result?.overallResult === 'ABNORMAL' && (
          <Stack>
            <AlertBanner type="danger" title="ABNORMAL — NOT FIT TO TRAIN">Session must NOT start — it stays blocked. You cannot change Health Status, Training Availability or restrictions; the Veterinarian reviews the incident.</AlertBanner>
            {incident ? (
              <AlertBanner type="info" title={`Incident ${incident.code} reported`}>The Veterinarian has been notified through the incident queue.</AlertBanner>
            ) : result.id ? (
              <form onSubmit={report} noValidate>
                <Stack>
                  <Row>
                    <SelectField label="Incident type" value={type} onChange={(e) => setType(e.target.value)}
                      options={['OFF_FEED', 'COLIC_SIGNS', 'FEVER', 'HOOF_OR_LEG_PROBLEM', 'OTHER'].map((v) => ({ value: v, label: v.replaceAll('_', ' ') }))} />
                    <SelectField label="Observed severity" value={severity} onChange={(e) => setSeverity(e.target.value)} options={['LOW', 'MEDIUM', 'HIGH'].map((v) => ({ value: v, label: v }))} />
                  </Row>
                  <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                  <Row><Button type="submit" disabled={action.busy}>{action.busy ? 'Reporting…' : 'Report incident'}</Button></Row>
                </Stack>
              </form>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
