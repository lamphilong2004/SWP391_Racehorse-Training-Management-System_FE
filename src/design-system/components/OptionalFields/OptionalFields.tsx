import { useId, useState, type ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import styles from './OptionalFields.module.css';

export function OptionalFields({ label, reveal = false, children }: { label: string; reveal?: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const visible = expanded || reveal;
  return <div className={styles.group}>
    {reveal ? <p className={styles.label}>{label}</p> : <button type="button" className={styles.toggle}
      aria-expanded={visible} aria-controls={id} onClick={() => setExpanded(!expanded)}>
      <Icon name="chevron-down" size={16} />{label}
    </button>}
    <div id={id} hidden={!visible}><div className={styles.fields}>{children}</div></div>
  </div>;
}
