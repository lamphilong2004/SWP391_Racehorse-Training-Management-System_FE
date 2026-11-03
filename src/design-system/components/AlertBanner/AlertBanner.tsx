import { useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { IconName } from '../../icons/Icon';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './AlertBanner.module.css';
import { FeedbackHostContext } from './FeedbackHostContext';

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
  feedback?: boolean;
}

export function AlertBanner({ feedback = false, ...props }: AlertBannerProps) {
  const host = useContext(FeedbackHostContext);
  return feedback && host
    ? createPortal(<FeedbackAlert key={`${props.type}:${props.title}`} {...props} />, host)
    : <AlertContent {...props} />;
}

function FeedbackAlert(props: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (props.type !== 'success' || props.children) return;
    const timer = window.setTimeout(() => setDismissed(true), 6500);
    return () => window.clearTimeout(timer);
  }, [props.type, props.children]);
  return dismissed ? null : <AlertContent {...props} onDismiss={() => setDismissed(true)} />;
}

function AlertContent({ type = 'info', title, children, className, onDismiss }: AlertBannerProps & { onDismiss?: () => void }) {
  const urgent = type === 'danger' || type === 'warning';
  return (
    <div className={cx(styles.banner, styles[type], onDismiss && styles.feedback, className)} role={urgent ? 'alert' : 'status'}>
      <Icon name={ICONS[type]} size={20} className={styles.icon} />
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.body}>{children}</div>}
      </div>
      {onDismiss && <button type="button" className={styles.dismiss} aria-label={`Ẩn thông báo ${title}`} onClick={onDismiss}><Icon name="x" size={16} /></button>}
    </div>
  );
}
