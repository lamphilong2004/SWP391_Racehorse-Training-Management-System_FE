import type { ReactNode } from 'react';
import { AlertBanner, ErrorState, LoadingState } from '../../design-system';
import styles from './common.module.css';

/** Loading → error (with retry) → content, used by every demo screen so no screen crashes on missing data. */
export function Resource<T>({ data, error, loading, reload, label, children }: {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (error && data === undefined) return <ErrorState title={`Could not load ${label}`} description={error} onRetry={reload} />;
  if (loading || data === undefined) return <LoadingState label={`Loading ${label}…`} />;
  return <>{children(data)}</>;
}

export function ActionError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <AlertBanner type="danger" title="Action not completed">
      {error}
    </AlertBanner>
  );
}

export function Stack({ children, gap = 'md' }: { children: ReactNode; gap?: 'sm' | 'md' | 'lg' }) {
  return <div className={styles[`stack-${gap}`]}>{children}</div>;
}

export function Row({ children, wrap = true }: { children: ReactNode; wrap?: boolean }) {
  return <div className={wrap ? styles.row : styles.rowNoWrap}>{children}</div>;
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={styles[`grid-${cols}`]}>{children}</div>;
}

