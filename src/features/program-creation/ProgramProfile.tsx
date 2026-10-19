import { useCallback } from 'react';
import { Card, ChartContainer, EmptyState, ErrorState, KeyValue, LoadingState, StatusBadge } from '../../design-system';
import type { HorseDetail } from '../horses/api/types';
import { ageInYears } from '../horses/shared/format';
import { useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import type { HorseSelection } from './programTypes';
import styles from './ProgramCreationPage.module.css';

/** SCR-TRAIN-003 S2: unsupported analytics stay explicitly unavailable rather than becoming fixture charts. */
export function ProgramProfile({ horse }: { horse: HorseSelection }) {
  const request = useFlowRequest();
  const load = useCallback((signal: AbortSignal) => request<HorseDetail>(`/api/horses/${horse.id}`, { signal }), [request, horse.id]);
  const resource = useResource(load), profile = resource.data;
  return <div className={styles.columns}><div className={styles.stack}><Card title="Training Profile" action={<span className="text-caption">Read-only</span>}>
    {resource.pending && <LoadingState label="Loading horse profile…" />}{resource.error && <ErrorState title="Profile unavailable" description={resource.error} onRetry={resource.reload} />}
    <div className={styles.profileFacts}><KeyValue label="Breed" value={profile?.breed ?? horse.breed ?? 'Not provided'} /><KeyValue label="Age" value={ageInYears(profile?.foaledDate ?? horse.foaledDate) == null ? 'Not provided' : `${ageInYears(profile?.foaledDate ?? horse.foaledDate)} yrs`} /><KeyValue label="Sex" value={profile?.sex ?? horse.sex ?? 'Not provided'} /><KeyValue label="Weight" value={profile?.latestWeight ? `${profile.latestWeight.weightKg} kg` : 'Not provided'} /><KeyValue label="Training Availability" value={<StatusBadge family="availability" status={profile?.trainingAvailability ?? horse.trainingAvailability} />} /></div>
  </Card><Card title="Fitness Summary"><EmptyState title="Fitness ratings unavailable" description="The approved contract does not expose fitness ratings. No rating is inferred from recorded metrics." /></Card><div className={styles.fields}>
    <ChartContainer title="Recent Training Load" seriesLabel="Recorded workload" values={[]} yTicks={[1, 0]} xLabels={[]} emptyTitle="Weekly load unavailable" emptyDescription="No approved weekly load series is exposed by the current contract." />
    <ChartContainer title="Recent Performance Trend" seriesLabel="Top speed" values={[]} yTicks={[1, 0]} xLabels={[]} emptyTitle="Top-speed trend unavailable" emptyDescription="No top-speed series is exposed by the current contract." />
  </div></div><div className={styles.stack}><Card title="Medical Restriction Summary"><StatusBadge family="availability" status={horse.trainingAvailability} /><p className="text-caption">Availability is read-only here. Clinical details stay with the veterinary team.</p></Card><Card title="Latest Session"><EmptyState title="Session summary unavailable" description="No latest-session summary was included with the horse profile." /></Card><Card title="Strengths & Development Needs"><EmptyState title="Assessment unavailable" description="No assessment is inferred from test data or client formulas." /></Card></div></div>;
}
