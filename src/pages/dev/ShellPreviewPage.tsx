import { useParams } from 'react-router';
import { Button, Card, EmptyState } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { isRoleCode, ROLE_LABELS, type RoleCode } from '../../shared/auth/roles';
import { ROUTES } from '../../app/routePaths';
import { NotFoundPage } from '../NotFoundPage';
import styles from './ShellPreviewPage.module.css';

/** Demo personas from the Figma frames (SCR-ADMIN-001 user list). Preview only, never product data. */
const PREVIEW_USERS: Record<RoleCode, string> = {
  CLUB_MANAGER: 'Nguyen Thanh',
  HEAD_TRAINER: 'Le Quoc Bao',
  TRAINER: 'Nguyen Minh Khoa',
  WORK_RIDER: 'Pham Quang Huy',
  VETERINARIAN: 'Dr. Le',
  GROOM: 'Bui Van Hai',
  HORSE_OWNER: 'Tran Van Minh',
};

/** Renders the desktop shell for one role so the sidebar of every role can be reviewed against Figma. */
export function ShellPreviewPage() {
  const { role } = useParams();
  if (!role || !isRoleCode(role)) return <NotFoundPage />;
  return (
    <AppShell
      user={{ fullName: PREVIEW_USERS[role], role }}
      breadcrumb={[{ label: 'Components', to: ROUTES.devComponents }, { label: ROLE_LABELS[role] }]}
      searchPlaceholder="Search horses…"
      unreadCount={3}
    >
      <div className={styles.content}>
        <PageHeader
          title={`${ROLE_LABELS[role]} shell`}
          description="Sidebar, header and content area of the shared app shell"
          actions={
            <>
              <Button variant="secondary">Secondary</Button>
              <Button>Primary</Button>
            </>
          }
        />
        <Card title="Content area">
          <EmptyState title="Feature screens render here." description="Owned by the feature CORE tasks." />
        </Card>
      </div>
    </AppShell>
  );
}
