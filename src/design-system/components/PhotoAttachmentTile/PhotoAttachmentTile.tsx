import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './PhotoAttachmentTile.module.css';

export type PhotoAttachmentTileProps =
  | { state: 'empty'; onAdd?: () => void; className?: string }
  | { state: 'attached'; fileName: string; onRemove?: () => void; className?: string };

/**
 * Figma Photo Attachment Tile (239:499) for MF-12 incident photos (BR-28): Empty (add) · Attached (placeholder +
 * remove). UI only — image storage is unresolved (Q-18), so no upload or preview is implemented here.
 */
export function PhotoAttachmentTile(props: PhotoAttachmentTileProps) {
  if (props.state === 'empty') {
    return (
      <button type="button" className={cx(styles.tile, styles.empty, props.className)} onClick={props.onAdd}>
        <Icon name="plus" size={20} className={styles.addIcon} />
        <span className={styles.addLabel}>Thêm ảnh</span>
      </button>
    );
  }
  return (
    <div className={cx(styles.tile, styles.attached, props.className)}>
      <Icon name="image" size={28} className={styles.imageIcon} />
      <span className={styles.fileName}>{props.fileName}</span>
      <button
        type="button"
        className={styles.remove}
        onClick={props.onRemove}
        aria-label={`Xóa ${props.fileName}`}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
