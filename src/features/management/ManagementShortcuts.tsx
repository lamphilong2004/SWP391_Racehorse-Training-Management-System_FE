import { useContext } from 'react';
import { Link } from 'react-router';
import { Card, EmptyState } from '../../design-system';
import { ManagementDestinationsContext } from './ManagementProvider';
import styles from './Management.module.css';

export function ManagementShortcuts() {
  const destinations = useContext(ManagementDestinationsContext);
  const registerHorse = destinations.registerHorse === '/horses/new' ? destinations.registerHorse : undefined;
  const roles = destinations.rolesPermissions?.readOnly === true ? destinations.rolesPermissions.to : undefined;
  return <Card title="Shortcuts" className={styles.figmaCard}>
    <div className={styles.shortcuts}>
      {registerHorse && <Link className={styles.linkButton} to={registerHorse}>+ Register Horse</Link>}
      {destinations.createUser && <Link className={styles.linkButton} to={destinations.createUser}>Create User</Link>}
      {roles && <Link className={styles.linkButton} to={roles}>Roles &amp; Permissions</Link>}
      {!registerHorse && !destinations.createUser && !roles && <EmptyState title="No shortcuts available" description="Use the workspace menu to open available screens." />}
    </div>
    <p className={styles.note}>Management Reports is not available.</p>
  </Card>;
}
