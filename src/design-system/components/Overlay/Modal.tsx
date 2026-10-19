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
  /** Opt in while a form is dirty/pending; the owner provides explicit Save/Discard controls. */
  dismissible?: boolean;
}

/** Figma Modal Shell (75:235): radius/lg, elev/3; header 64, body 24, footer 72. */
export function Modal({ open, onClose, title, size = 'md', footer, children, className, dismissible = true }: ModalProps) {
  const ref = useModalDialog(open, () => { if (dismissible) onClose(); });
  const titleId = useId();
  return (
    <dialog ref={ref} aria-labelledby={titleId} className={cx(styles.modal, styles[size], className)}>
      {open && (
        <div className={styles.surface}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close" disabled={!dismissible} title={!dismissible ? 'Finish or discard changes before closing.' : undefined}>
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
