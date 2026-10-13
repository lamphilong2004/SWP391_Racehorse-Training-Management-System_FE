import { Link } from 'react-router';
import { ROUTES } from '../app/routePaths';
import { EmptyState } from '../design-system';
import styles from './NotFoundPage.module.css';

/** Fallback for paths whose screen has not been built yet (feature CORE tasks add them). */
export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <EmptyState title="Page not found." description="This screen is not available yet." />
      <Link to={ROUTES.designSystem} className={styles.link}>
        Back to the design system
      </Link>
    </div>
  );
}
