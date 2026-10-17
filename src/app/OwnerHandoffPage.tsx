import { Link } from 'react-router';
import { EmptyState } from '../design-system';
import { AppShell } from '../layout/AppShell';
import { useAuth } from '../shared/auth/AuthProvider';

/** Route handoff only: does not replace the undelivered CORE-025/041 screens or perform mutations. */
export function OwnerHandoffPage({ title }: { title: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return <AppShell user={{ fullName: user.fullName, role: user.roles[0] }} breadcrumb={[{ label: 'Training' }, { label: title }]}>
    <EmptyState title={`${title} unavailable`} description="This screen is not available in this build." />
    <Link to="/dashboard">Back to workspace</Link>
  </AppShell>;
}
