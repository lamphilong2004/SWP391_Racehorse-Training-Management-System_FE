import { useId, type ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './Overlay.module.css';
import { useModalDialog } from './useModalDialog';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** md 560 / lg 720. */
  size?: 'md' | 'lg';
  /** Footer actions, Cancel first then the primary action. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Figma Modal Shell (75:235): radius/lg, elev/3; header 64, body 24, footer 72. */
export function Modal({ open, onClose, title, size = 'md', footer, children, className }: ModalProps) {
  const ref = useModalDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog ref={ref} aria-labelledby={titleId} className={cx(styles.modal, styles[size], className)}>
      {open && (
        <div className={styles.surface}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <Icon name="x" size={20} />
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
