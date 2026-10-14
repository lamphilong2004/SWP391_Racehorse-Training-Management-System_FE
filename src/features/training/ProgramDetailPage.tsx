import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, KeyValue, MetricCard, StatusBadge } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { primaryRole, useAuth } from '../../shared/auth/authState';
import { useApi } from '../../shared/hooks/useApi';
import { Grid, Resource, Stack } from '../../shared/ui/common';
import { INTENSITY_LABEL, fmtDate, fmtDateTime } from '../../shared/ui/format';
import { trainingApi, type Phase, type SessionSummary } from '../demoApi';
import { SessionStatusBadge } from './SessionStatusBadge';

/** SCR-TRAIN-002 Program Detail (Overview / Progress) with its sessions. */
export function ProgramDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTrainer = user && primaryRole(user) === 'TRAINER';
  const program = useApi(() => trainingApi.program(id), [id]);
  const sessions = useApi(() => trainingApi.sessions(`programId=${id}`), [id]);
  return (
    <Resource {...program} label="program">
      {(p) => (
        <Stack gap="lg">
          <PageHeader
            title={p.name}
            description={`${p.horse.name} · ${p.horse.horseCode} — ${p.sourceTemplate.name} (${p.sourceTemplate.templateCode} v${p.sourceTemplate.versionNo})`}
            actions={isTrainer && p.status === 'ACTIVE' ? <Button onClick={() => navigate(`/training/programs/${p.id}/sessions/new`)}>Create training session</Button> : undefined}
          />
          {p.trainingAvailability !== 'AVAILABLE' && (
            <AlertBanner type={p.trainingAvailability === 'LOCKED' ? 'danger' : 'warning'} title={`Horse is ${p.trainingAvailability}`}>
              {p.trainingAvailability === 'LOCKED' ? 'No session can be scheduled or started.' : 'Each exercise is checked against the Veterinarian restriction.'}
            </AlertBanner>
          )}
          <Grid cols={4}>
            <MetricCard label="Sessions" value={String(p.progress.total ?? 0)} caption={`${p.progress.upcoming ?? 0} upcoming`} />
            <MetricCard label="Completed" value={String(p.progress.completed ?? 0)} />
            <MetricCard label="Interrupted" value={String(p.progress.interrupted ?? 0)} />
            <MetricCard label="Evaluated" value={String(p.progress.evaluated ?? 0)} />
          </Grid>
          <Grid cols={2}>
            <Card title="Overview">
              <Stack gap="sm">
                <KeyValue label="Status" value={<StatusBadge family="program" status={p.status} />} />
                <KeyValue label="Goals" value={p.goals ?? '—'} />
                <KeyValue label="Period" value={`${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}`} />
                <KeyValue label="Trainer" value={p.trainer?.fullName ?? '—'} />
                <KeyValue label="Created by" value={p.createdBy.fullName} />
              </Stack>
            </Card>
            <Card title="Phases">
              <DataTable<Phase> caption="Phases" rows={p.phases} rowKey={(ph) => ph.id} columns={[
                { key: 'o', header: '#', render: (ph) => ph.phaseOrder },
                { key: 'n', header: 'Phase', render: (ph) => ph.name },
                { key: 'd', header: 'Dates', render: (ph) => `${fmtDate(ph.startDate)} – ${fmtDate(ph.endDate)}` },
                { key: 'i', header: 'Intensity range', render: (ph) => `${INTENSITY_LABEL[ph.intensityMin ?? ''] ?? '—'} → ${INTENSITY_LABEL[ph.intensityMax ?? ''] ?? '—'}` },
              ]} />
            </Card>
          </Grid>
          <Resource {...sessions} label="sessions">
            {(rows) => (
              <Card title="Training sessions">
                <DataTable<SessionSummary> caption="Sessions" rows={rows} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/training/sessions/${s.id}`)}
                  empty={<EmptyState title="No sessions yet" />}
                  columns={[
                    { key: 'c', header: 'Session', render: (s) => s.sessionCode },
                    { key: 't', header: 'Scheduled', render: (s) => fmtDateTime(s.scheduledStart) },
                    { key: 'p', header: 'Phase', render: (s) => s.phaseName },
                    { key: 'r', header: 'Work Rider', render: (s) => s.workRider.fullName },
                    { key: 'pc', header: 'Pre-check', render: (s) => s.preCheckResult ?? 'Pending' },
                    { key: 's', header: 'Status', render: (s) => <SessionStatusBadge session={s} /> },
                  ]} />
              </Card>
            )}
          </Resource>
        </Stack>
      )}
    </Resource>
  );
}
