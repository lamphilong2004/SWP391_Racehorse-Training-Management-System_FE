import { Link, type LinkProps } from 'react-router';
import { cx } from '../../utils/cx';
import type { ButtonSize, ButtonVariant } from './Button';
import styles from './Button.module.css';

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Navigation keeps link semantics and uses the same controls, focus and tokens as Button. */
export function ButtonLink({ variant = 'secondary', size = 'md', className, ...props }: ButtonLinkProps) {
  return <Link {...props} className={cx(styles.button, styles.navigation, styles[variant === 'danger' ? 'destructive' : variant], styles[size], className)} />;
}
