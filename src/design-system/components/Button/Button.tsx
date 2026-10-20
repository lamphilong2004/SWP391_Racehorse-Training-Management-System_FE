import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Figma Button (6:28). Primary = one per screen. Destructive = Deactivate / Cancel session only,
   * never "Delete permanently" (BR-D07).
   */
  variant?: ButtonVariant;
  /** sm 32 / md 40 / lg 48. */
  size?: ButtonSize;
  /** Controlled pending state; never implies a successful server write. */
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', type = 'button', className, loading = false, disabled, children, ...rest }: ButtonProps) {
  return <button {...rest} type={type} disabled={disabled || loading} aria-busy={loading || rest['aria-busy']}
    aria-disabled={disabled || loading || rest['aria-disabled']}
    className={cx(styles.button, styles[variant === 'danger' ? 'destructive' : variant], styles[size], className)}>
    {loading ? <><span className={styles.pendingLabel}>{children}</span><span className={styles.spinner} aria-hidden="true" /></> : children}
  </button>;
}
