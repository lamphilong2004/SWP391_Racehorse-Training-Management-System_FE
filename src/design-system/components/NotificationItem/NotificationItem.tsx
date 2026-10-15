import type { IconName } from '../../icons/Icon';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './NotificationItem.module.css';

export interface NotificationItemProps {
  title: string;
  body: string;
  /** Context line (horse · code · module). */
  context?: string;
  time: string;
  read: boolean;
  /** Type icon, e.g. calendar · alert-triangle · shield-alert · activity · bell (default). */
  icon?: IconName;
  onClick?: () => void;
  className?: string;
}

/**
 * Figma Notification Item (239:566), shared by the Notification Drawer (SCR-NOTIF-001) and Center (SCR-NOTIF-002)
 * for all roles. State is READ / UNREAD only.
 */
export function NotificationItem({
  title,
  body,
  context,
  time,
  read,
  icon = 'bell',
  onClick,
  className,
}: NotificationItemProps) {
  const content = (
    <>
      <span className={styles.iconHolder}>
        <Icon name={icon} size={16} />
      </span>
      <span className={styles.content}>
        <span className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
          <span className={styles.time}>{time}</span>
          {!read && <span className={styles.dot} aria-label="Unread" role="img" />}
        </span>
        <span className={styles.body}>{body}</span>
        {context && <span className={styles.context}>{context}</span>}
      </span>
    </>
  );
  const classes = cx(styles.item, read ? styles.read : styles.unread, className);
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}
