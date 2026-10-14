import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Figma Button (6:28). Primary = one per screen. Destructive = Deactivate / Cancel session only,
   * never "Delete permanently" (BR-D07).
   */
  variant?: ButtonVariant;
  /** sm 32 / md 40 / lg 48. */
  size?: ButtonSize;
}

export function Button({ variant = 'primary', size = 'md', type = 'button', className, ...rest }: ButtonProps) {
  return <button type={type} className={cx(styles.button, styles[variant], styles[size], className)} {...rest} />;
}
