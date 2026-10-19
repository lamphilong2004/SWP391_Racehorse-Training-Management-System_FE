import type { ReactNode } from 'react';
import type { IconName } from '../../icons/Icon';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './AlertBanner.module.css';

export type AlertBannerType = 'info' | 'success' | 'warning' | 'danger' | 'simulated';

const ICONS: Record<AlertBannerType, IconName> = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-octagon',
  simulated: 'flask-conical',
};

export interface AlertBannerProps {
  /** Figma Alert / Banner (70:26). Simulated is dashed and not dismissable. */
  type?: AlertBannerType;
  title: string;
  children?: ReactNode;
  className?: string;
}

export function AlertBanner({ type = 'info', title, children, className }: AlertBannerProps) {
  const urgent = type === 'danger' || type === 'warning';
  return (
    <div className={cx(styles.banner, styles[type], className)} role={urgent ? 'alert' : 'status'}>
      <Icon name={ICONS[type]} size={20} className={styles.icon} />
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.body}>{children}</div>}
      </div>
    </div>
  );
}
