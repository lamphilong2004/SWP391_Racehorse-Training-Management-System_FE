import { EmptyState } from '../design-system';
import styles from './NotFoundPage.module.css';

/** Fallback for paths whose screen has not been built yet (feature CORE tasks add them). */
export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <EmptyState title="Page not found." description="This screen is not available yet." />
    </div>
  );
}
