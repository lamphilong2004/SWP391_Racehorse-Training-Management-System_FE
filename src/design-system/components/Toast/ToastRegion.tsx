import { Icon } from '../../icons/Icon';
import { Button } from '../Button/Button';
import { cx } from '../../utils/cx';
import styles from './ToastRegion.module.css';

export interface ToastMessage { id: string; message: string; tone?: 'info' | 'success' | 'error' }
export interface ToastRegionProps { items: readonly ToastMessage[]; onDismiss: (id: string) => void }
/** Controlled feedback only: success must come from a confirmed operation. No API, timers or storage. */
export function ToastRegion({ items, onDismiss }: ToastRegionProps) {
  const unique = items.filter((item, i) => items.findIndex((other) => other.id === item.id) === i);
  return <div className={styles.region} aria-label="Thông báo phản hồi">
    {unique.map(({ id, message, tone = 'info' }) => <div key={id} role={tone === 'error' ? 'alert' : 'status'} aria-atomic="true" className={cx(styles.toast, styles[tone])}>
      <Icon name={tone === 'error' ? 'alert-triangle' : tone === 'success' ? 'check-circle' : 'info'} />
      <p>{message}</p><Button variant="icon" aria-label={`Ẩn ${message}`} onClick={() => onDismiss(id)}><Icon name="x" /></Button>
    </div>)}
  </div>;
}
