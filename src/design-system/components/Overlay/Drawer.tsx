import { useId, type ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './Overlay.module.css';
import { useModalDialog } from './useModalDialog';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Caption line under the title ("Supporting context"). */
  subtitle?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  dismissible?: boolean;
}

/** Figma Drawer Shell (75:267): right side, 480px, elev/3, header 64, body 24, footer 72. */
export function Drawer({ open, onClose, title, subtitle, footer, children, className, dismissible = true }: DrawerProps) {
  const ref = useModalDialog(open, () => { if (dismissible) onClose(); });
  const titleId = useId();
  return (
    <dialog ref={ref} aria-labelledby={titleId} className={cx(styles.drawer, className)}>
      {open && (
        <div className={cx(styles.surface, styles.drawerSurface)}>
          <header className={styles.header}>
            <div className={styles.titleGroup}>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Đóng" disabled={!dismissible} title={!dismissible ? 'Hãy lưu hoặc hủy thay đổi trước khi đóng.' : undefined}>
              <Icon name="x" size={20} />
            </button>
          </header>
          <div className={cx(styles.body, styles.drawerBody)}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
