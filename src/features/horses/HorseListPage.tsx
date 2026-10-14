import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, DataTable, EmptyState, StatusBadge, TextField } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { primaryRole, useAuth } from '../../shared/auth/authState';
import { useApi } from '../../shared/hooks/useApi';
import { Resource } from '../../shared/ui/common';
import { horsesApi, type HorseSummary } from '../demoApi';

/** SCR-HORSE-001 Horse register (Flow 1). Club Manager registers horses; other staff roles read. */
export function HorseListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const horses = useApi(() => horsesApi.list(applied), [applied]);
  const isManager = user && primaryRole(user) === 'CLUB_MANAGER';
  return (
    <>
      <PageHeader
        title="Horses"
        description="Horse register — lifecycle, health and training availability"
        actions={isManager ? <Button onClick={() => navigate('/horses/new')}>Register horse</Button> : undefined}
      />
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(query.trim());
          }}
        >
          <TextField label="Search by name or code" value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
      </Card>
      <Resource {...horses} label="horses">
        {(page) => (
          <Card title={`${page.totalElements} horses`}>
            <DataTable<HorseSummary>
              caption="Horses"
              rows={page.items}
              rowKey={(h) => h.id}
              onRowClick={(h) => navigate(`/horses/${h.id}`)}
              empty={<EmptyState title="No horses found" description="Register a horse or change the search." />}
              columns={[
                { key: 'code', header: 'Code', render: (h) => h.horseCode },
                { key: 'name', header: 'Name', render: (h) => h.name },
                { key: 'breed', header: 'Breed', render: (h) => h.breed ?? '—' },
                { key: 'box', header: 'Box', render: (h) => h.currentBoxCode ?? '—' },
                { key: 'lifecycle', header: 'Lifecycle', render: (h) => <StatusBadge family="lifecycle" status={h.lifecycle} /> },
                { key: 'health', header: 'Health', render: (h) => (h.healthStatus ? <StatusBadge family="health" status={h.healthStatus as 'FIT'} /> : '—') },
                { key: 'availability', header: 'Training availability', render: (h) => <StatusBadge family="availability" status={h.trainingAvailability} /> },
              ]}
            />
          </Card>
        )}
      </Resource>
    </>
  );
}
