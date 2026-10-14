import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, SelectField, StatusBadge, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { useAction, useApi } from '../../shared/hooks/useApi';
import { ActionError, Grid, Resource, Row, Stack } from '../../shared/ui/common';
import { todayIso } from '../../shared/ui/format';
import { horsesApi, trainingApi } from '../demoApi';

function plusDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * SCR-TRAIN-003 Create Training Program (condensed for the demo): ACTIVE horse → recommended template (labels + reasons,
 * no scores) → customise → assign Trainer (recommendations) → activate. Phases default from the template version.
 */
export function ProgramCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const horses = useApi(() => horsesApi.list(), []);
  const [horseId, setHorseId] = useState(params.get('horseId') ?? '');
  const [templateId, setTemplateId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [name, setName] = useState('Race Preparation 1600m');
  const [goals, setGoals] = useState('Target: Autumn Cup 1600m — 01 Nov 2026');
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(plusDays(todayIso(), 17));
  const action = useAction();
  const hid = Number(horseId) || 0;
  const recs = useApi(() => (hid ? trainingApi.templateRecs(hid) : Promise.resolve([])), [hid]);
  const trainers = useApi(() => (hid ? trainingApi.trainerRecs(hid, Number(templateId) || undefined) : Promise.resolve([])), [hid, templateId]);
  const availability = useApi(() => (hid ? horsesApi.availability(hid) : Promise.resolve(null)), [hid]);
  const selected = recs.data?.find((r) => String(r.item.id) === templateId)?.item;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hid || !selected || !trainerId) return action.setError('Select a horse, a template and a Trainer.');
    if (end < start) return action.setError('The end date must not be before the start date.');
    const created = await action.run(() =>
      trainingApi.createProgram({ horseId: hid, templateVersionId: selected.templateVersionId, trainerUserId: Number(trainerId), name, goals, periodStart: start, periodEnd: end }),
    );
    if (created) navigate(`/training/programs/${created.id}`, { replace: true });
  };

  return (
    <>
      <PageHeader title="Create training program" description="The source template is never modified (DEC-005). The horse must be ACTIVE and not LOCKED." />
      <form onSubmit={submit} noValidate>
        <Stack gap="lg">
          <ActionError error={action.error} />
          <Card title="1 · Horse">
            <Resource {...horses} label="horses">
              {(page) => (
                <Row>
                  <SelectField label="Horse" value={horseId} onChange={(e) => { setHorseId(e.target.value); setTemplateId(''); setTrainerId(''); }}
                    placeholder="Select an ACTIVE horse"
                    options={page.items.filter((h) => h.lifecycle === 'ACTIVE').map((h) => ({ value: String(h.id), label: `${h.name} · ${h.horseCode} (${h.trainingAvailability})` }))} />
                  {availability.data && <StatusBadge family="availability" status={availability.data.availability} />}
                </Row>
              )}
            </Resource>
            {availability.data?.availability === 'LOCKED' && (
              <AlertBanner type="danger" title="Training LOCKED">{availability.data.reason} — a program cannot be created (BR-13).</AlertBanner>
            )}
          </Card>
          {hid > 0 && (
            <Card title="2 · Program template (system recommendation — you decide)">
              <Resource {...recs} label="templates">
                {(list) => (
                  <Stack gap="sm">
                    {list.map((r) => (
                      <label key={r.item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="radio" name="template" checked={templateId === String(r.item.id)} onChange={() => setTemplateId(String(r.item.id))} />
                        <span>
                          <strong>{r.item.name}</strong> · {r.item.templateCode} v{r.item.versionNo} — <em>{r.label.replaceAll('_', ' ')}</em>
                          <br />
                          <small>{[...r.reasons, ...r.warnings].join(' · ')} · Phases: {r.item.phases.map((p) => p.name).join(' → ')}</small>
                        </span>
                      </label>
                    ))}
                  </Stack>
                )}
              </Resource>
            </Card>
          )}
          {selected && (
            <Card title="3 · Customise for this horse">
              <Grid cols={2}>
                <TextField label="Program name" value={name} onChange={(e) => setName(e.target.value)} />
                <TextField label="Goals / target" value={goals} onChange={(e) => setGoals(e.target.value)} helperText="Race fields are deferred (DEC-007) — the target is kept as text." />
                <TextField label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                <TextField label="End date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Grid>
            </Card>
          )}
          {selected && (
            <Card title="4 · Assign a Trainer">
              <Resource {...trainers} label="trainers">
                {(list) => (
                  <SelectField label="Trainer" value={trainerId} onChange={(e) => setTrainerId(e.target.value)} placeholder="Select a Trainer"
                    options={list.map((r) => ({ value: String(r.item.id), label: `${r.item.fullName} — ${r.label.replaceAll('_', ' ')} (${r.reasons.join('; ')})` }))} />
                )}
              </Resource>
            </Card>
          )}
          <Row>
            <Button type="submit" disabled={action.busy || !selected || !trainerId}>{action.busy ? 'Activating…' : 'Activate program'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/training/programs')}>Cancel</Button>
          </Row>
        </Stack>
      </form>
    </>
  );
}
