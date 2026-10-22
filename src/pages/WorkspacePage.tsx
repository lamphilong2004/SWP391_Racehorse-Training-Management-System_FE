import { useCallback } from 'react';
import { AppShell } from '../layout/AppShell';
import { Button, ButtonLink, Card, DataTable, EmptyState, ErrorState, Icon, LoadingState, MetricCard, StatusBadge, type IconName } from '../design-system';
import { ROUTES } from '../app/routePaths';
import { useAuth } from '../shared/auth/AuthProvider';
import { ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import { NAVIGATION } from '../layout/navigation';
import { useFlowRequest } from '../features/main-flows/api';
import { useResource } from '../features/main-flows/useResource';
import type { HorseDetail, Page } from '../features/horses/api/types';
import styles from './WorkspacePage.module.css';

type WorkspaceAction = { title: string; description: string; label: string; to: string; icon: IconName };
const WORKSPACES: Record<RoleCode, { description: string; primary: WorkspaceAction; actions: WorkspaceAction[] }> = {
  VETERINARIAN: {
    description: 'Review new arrivals, follow medical cases and manage the health of your horses.',
    primary: { title: 'Medical cases', description: '', label: 'Open medical cases', to: ROUTES.medical, icon: 'stethoscope' },
    actions: [
      { title: 'Horse profiles & baseline', description: 'Choose a horse, review its profile and record the initial health examination.', label: 'View horses', to: ROUTES.horses, icon: 'horseshoe' },
      { title: 'Medical cases', description: 'Open examinations, restrictions, treatment plans and recovery records.', label: 'View cases', to: ROUTES.medical, icon: 'stethoscope' },
      { title: 'Herd health', description: 'Review the herd health overview and identify horses requiring attention.', label: 'View herd health', to: ROUTES.herdHealth, icon: 'activity' },
      { title: 'Incident review', description: 'Review reported observations and continue the medical response.', label: 'Review incidents', to: ROUTES.incidents, icon: 'shield-alert' },
    ],
  },
  HEAD_TRAINER: {
    description: 'Review horse readiness, choose a reusable strategy and assign the right Trainer.',
    primary: { title: 'Create program', description: '', label: 'Create program', to: ROUTES.trainingProgramCreate, icon: 'plus' },
    actions: [
      { title: 'Horse readiness', description: 'Review profiles, baseline health and availability before planning training.', label: 'Review horses', to: ROUTES.horses, icon: 'horseshoe' },
      { title: 'Program Templates', description: 'Compare reusable strategies and their saved versions.', label: 'Browse templates', to: ROUTES.programTemplates, icon: 'book-open' },
      { title: 'Horse Training Programs', description: 'Open horse programs, pinned template versions and Trainer assignments.', label: 'View programs', to: ROUTES.trainingPrograms, icon: 'clipboard-list' },
      { title: 'Training Schedule', description: 'Review the sessions scheduled for the club.', label: 'View schedule', to: ROUTES.trainingSchedule, icon: 'calendar' },
    ],
  },
  GROOM: {
    description: 'Your assigned pre-session observations and care tasks, ready to open.',
    primary: { title: 'Today', description: '', label: 'Open Today & prechecks', to: ROUTES.groomToday, icon: 'clipboard-list' },
    actions: [
      { title: 'Today & prechecks', description: 'Find your assigned horse and complete all five pre-session observations.', label: 'Open pre-session checks', to: ROUTES.groomToday, icon: 'clipboard-list' },
      { title: 'Treatment tasks', description: 'Follow the Veterinarian’s instructions and record completed care.', label: 'View treatment tasks', to: ROUTES.careTasks, icon: 'check-circle' },
      { title: 'Reported incidents', description: 'Follow the handling status of observations you reported.', label: 'View incidents', to: ROUTES.incidents, icon: 'alert-triangle' },
    ],
  },
  WORK_RIDER: {
    description: 'Review your assigned rides, check readiness and follow the Trainer’s instructions.',
    primary: { title: 'Assignments', description: '', label: 'Open my assignments', to: ROUTES.assignments, icon: 'play' },
    actions: [
      { title: 'Today’s rides', description: 'Open today’s sessions and review the assigned exercise plans.', label: 'View today’s rides', to: ROUTES.myRides, icon: 'calendar' },
      { title: 'My assignments', description: 'Review readiness checks and start only when every gate is clear.', label: 'View assignments', to: ROUTES.assignments, icon: 'clipboard-list' },
      { title: 'Riding history', description: 'Revisit completed rides and your submitted feedback.', label: 'View riding history', to: ROUTES.ridingHistory, icon: 'history' },
    ],
  },
  HORSE_OWNER: {
    description: 'Your horses, their health and their training — in one read-only portal.',
    primary: { title: 'My Horses', description: '', label: 'Open My Horses', to: ROUTES.myHorses, icon: 'horseshoe' },
    actions: [
      { title: 'My Horses', description: 'View your horse profiles, pedigree, stable, health and training summaries.', label: 'View my horses', to: ROUTES.myHorses, icon: 'horseshoe' },
      { title: 'Notifications', description: 'Open updates available to your account.', label: 'View notifications', to: ROUTES.notifications, icon: 'bell' },
    ],
  },
  CLUB_MANAGER: {
    description: 'Manage horse registration and review the club register.',
    primary: { title: 'Register Horse', description: '', label: 'Register Horse', to: '/horses/new', icon: 'plus' },
    actions: [
      { title: 'Horse register', description: 'View registered horses and their current profiles.', label: 'View horses', to: ROUTES.horses, icon: 'horseshoe' },
      { title: 'Pending activation', description: 'Complete the requirements for newly registered horses.', label: 'Review pending horses', to: ROUTES.pendingActivation, icon: 'clipboard-list' },
    ],
  },
  TRAINER: {
    description: 'Open your assigned programs, plan sessions and review results.',
    primary: { title: 'Assigned Programs', description: '', label: 'Open assigned programs', to: ROUTES.assignedPrograms, icon: 'clipboard-list' },
    actions: [
      { title: 'Assigned Programs', description: 'Review the horse-specific programs assigned to you.', label: 'View assigned programs', to: ROUTES.assignedPrograms, icon: 'clipboard-list' },
      { title: 'Training Calendar', description: 'Plan sessions within the approved program and medical limits.', label: 'View calendar', to: ROUTES.trainingCalendar, icon: 'calendar' },
      { title: 'Performance', description: 'Review session results and evaluations.', label: 'View performance', to: ROUTES.performance, icon: 'bar-chart' },
    ],
  },
};

export function WorkspacePage() {
  const { user } = useAuth();
  if (!user) return null;
  const role = user.roles[0], workspace = WORKSPACES[role];
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role }} breadcrumb={[{ label: 'Dashboard' }]}>
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><p className={styles.eyebrow}>YOUR WORKSPACE</p><h1 className="text-h1">{NAVIGATION[role].workspaceLabel}</h1><p className={styles.description}>{workspace.description}</p></div>
        <ButtonLink variant="primary" to={workspace.primary.to}><Icon name={workspace.primary.icon} size={18} />{workspace.primary.label}</ButtonLink>
      </header>
      <section className={styles.welcome} aria-label="Workspace overview">
        <div className={styles.welcomeIcon}><Icon name={workspace.primary.icon} size={28} /></div>
        <div><span className={styles.eyebrow}>{ROLE_LABELS[role]}</span><h2>Welcome, {user.fullName}</h2><p>Choose a task below to continue your work.</p></div>
        <span className={styles.access}><Icon name="shield-check" size={16} />Role-based access</span>
      </section>
      <section aria-labelledby="workspace-actions-title" className={styles.section}>
        <div className={styles.sectionHeading}><h2 id="workspace-actions-title">Quick actions</h2><span>Open a workspace</span></div>
        <div className={styles.actionGrid}>{workspace.actions.map((action) => <Card key={action.to} className={styles.actionCard}>
          <span className={styles.actionIcon}><Icon name={action.icon} size={24} /></span><h3>{action.title}</h3><p>{action.description}</p>
          <ButtonLink to={action.to}>{action.label}<Icon name="chevron-right" size={16} /></ButtonLink>
        </Card>)}</div>
      </section>
      {role === 'VETERINARIAN' && <VeterinaryArrivals />}
      <footer className={styles.identity}><span><Icon name="user" size={16} />{user.email}</span><span>{ROLE_LABELS[role]} · {user.userCode}</span><ButtonLink variant="tertiary" to={ROUTES.account}>View account</ButtonLink></footer>
    </div>
  </AppShell>;
}

function VeterinaryArrivals() {
  const request = useFlowRequest();
  const load = useCallback((signal: AbortSignal) => request<Page<HorseDetail>>('/api/horses?lifecycle=DRAFT&page=0&size=6', { signal }), [request]);
  const resource = useResource(load), data = resource.data;
  return <section className={styles.section} aria-labelledby="arrivals-title">
    <div className={styles.sectionHeading}><div><h2 id="arrivals-title">New arrivals</h2><p>Draft horses from the club register. Open a profile to review its onboarding requirements.</p></div><Button variant="secondary" onClick={resource.reload}><Icon name="history" size={16} />Refresh</Button></div>
    {resource.pending && <LoadingState label="Loading new arrivals…" />}
    {resource.error && <ErrorState title="New arrivals unavailable" description={resource.error} onRetry={resource.reload} />}
    {data && <><div className={styles.metrics}><MetricCard label="Draft horses" value={String(data.totalItems)} caption="In the club register" /><MetricCard label="Shown here" value={String(data.items.length)} caption="Latest six draft profiles" /></div>
      <Card><div className={styles.table} role="region" aria-label="New arrival horses" tabIndex={0}><DataTable<HorseDetail> caption="New arrival horses" rows={data.items} rowKey={(horse) => horse.id} empty={<EmptyState title="No draft horses" description="New registrations appear here when saved by the Club Manager." />} columns={[
        { key: 'horse', header: 'Horse', render: (horse) => <div className={styles.horseName}><strong>{horse.name}</strong><span>{horse.horseCode}</span></div> },
        { key: 'box', header: 'Stable', render: (horse) => horse.currentBoxCode ?? 'Not assigned' },
        { key: 'status', header: 'Status', render: (horse) => <StatusBadge family="lifecycle" status={horse.lifecycle} /> },
        { key: 'health', header: 'Health', render: (horse) => horse.healthStatus ? <StatusBadge family="health" status={horse.healthStatus} /> : 'Not recorded' },
        { key: 'actions', header: 'Actions', render: (horse) => <div className={styles.rowActions}><ButtonLink size="sm" to={`/horses/${horse.id}`}>View profile</ButtonLink>{!horse.healthStatus && <ButtonLink size="sm" to={`/horses/${horse.id}/baseline`}>Record baseline</ButtonLink>}</div> },
      ]} /></div></Card></>}
  </section>;
}
