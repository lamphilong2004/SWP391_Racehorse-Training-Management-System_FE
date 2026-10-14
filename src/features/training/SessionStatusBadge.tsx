import { StatusBadge } from '../../design-system';
import type { SessionSummary } from '../demoApi';

/** BLOCKED is derived (never a stored status): shown instead of SCHEDULED when the server reports blocked = true. */
export function SessionStatusBadge({ session }: { session: Pick<SessionSummary, 'status' | 'blocked' | 'blockedReasons'> }) {
  const onlyMissingCheck = session.blockedReasons.length === 1 && session.blockedReasons[0] === 'PRE_CHECK_MISSING';
  if (session.status === 'SCHEDULED' && session.blocked && !onlyMissingCheck) return <StatusBadge family="session" status="BLOCKED" />;
  return <StatusBadge family="session" status={session.status} />;
}
