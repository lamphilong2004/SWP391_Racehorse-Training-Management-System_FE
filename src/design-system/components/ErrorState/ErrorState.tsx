import { cx } from '../../utils/cx';
import { AlertBanner } from '../AlertBanner/AlertBanner';
import { Button } from '../Button/Button';
import styles from './ErrorState.module.css';

export interface ErrorStateProps {
  title: string;
  /** What failed and what the user can do. Never show stack traces or server internals. */
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Error state for a data region that failed to load. There is no dedicated Figma frame; it is composed from the
 * approved Danger Alert / Banner (70:50) plus a Secondary Button (6:10) for retry.
 */
export function ErrorState({ title, description, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <AlertBanner type="danger" title={title} className={cx(styles.error, className)}>
      {description && <p>{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className={styles.retry}>
          {retryLabel}
        </Button>
      )}
    </AlertBanner>
  );
}
