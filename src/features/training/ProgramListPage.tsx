import { useNavigate } from 'react-router';
import { Button, Card, DataTable, EmptyState, StatusBadge } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { primaryRole, useAuth } from '../../shared/auth/authState';
import { useApi } from '../../shared/hooks/useApi';
import { Resource } from '../../shared/ui/common';
import { fmtDate } from '../../shared/ui/format';
import { trainingApi, type Program } from '../demoApi';

/** SCR-TRAIN-001 Horse Training Programs (Head Trainer landing) / SCR-TRAIN-025 My Assigned Programs (Trainer). */
export function ProgramListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isHT = user && primaryRole(user) === 'HEAD_TRAINER';
  const programs = useApi(() => trainingApi.programs(), []);
  return (
    <>
      <PageHeader
        title={isHT ? 'Horse Training Programs' : 'Assigned Programs'}
        description={isHT ? 'Create programs from the Program Template Library and assign a Trainer' : 'Programs the Head Trainer assigned to you'}
        actions={isHT ? <Button onClick={() => navigate('/training/programs/new')}>Create training program</Button> : undefined}
      />
      <Resource {...programs} label="programs">
        {(rows) => (
          <Card title={`${rows.length} programs`}>
            <DataTable<Program>
              caption="Training programs"
              rows={rows}
              rowKey={(p) => p.id}
              onRowClick={(p) => navigate(`/training/programs/${p.id}`)}
              empty={<EmptyState title="No programs yet" description={isHT ? 'Create a program for an ACTIVE horse.' : 'No program is assigned to you yet.'} />}
              columns={[
                { key: 'horse', header: 'Horse', render: (p) => `${p.horse.name} · ${p.horse.horseCode}` },
                { key: 'name', header: 'Program', render: (p) => p.name },
                { key: 'template', header: 'Source template', render: (p) => `${p.sourceTemplate.templateCode} v${p.sourceTemplate.versionNo}` },
                { key: 'trainer', header: 'Trainer', render: (p) => p.trainer?.fullName ?? '—' },
                { key: 'period', header: 'Period', render: (p) => `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` },
                { key: 'avail', header: 'Availability', render: (p) => <StatusBadge family="availability" status={p.trainingAvailability} /> },
                { key: 'status', header: 'Status', render: (p) => <StatusBadge family="program" status={p.status} /> },
              ]}
            />
          </Card>
        )}
      </Resource>
    </>
  );
}
