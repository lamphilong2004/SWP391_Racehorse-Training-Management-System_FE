import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './StableBoxTile.module.css';

export type StableBoxState = 'free' | 'occupied' | 'selected';

export interface StableBoxTileProps {
  boxId: string;
  state: StableBoxState;
  /** Shown when the box is occupied. */
  horseName?: string;
  /** Free boxes can be picked (Assign Stable Box). Occupied boxes are never selectable (BR-03 / BR-D01). */
  onSelect?: (boxId: string) => void;
  className?: string;
}

/** Figma Stable Box Tile (239:539): FREE · OCCUPIED (horse shown) · SELECTED (free box being assigned). */
export function StableBoxTile({ boxId, state, horseName, onSelect, className }: StableBoxTileProps) {
  const content = (
    <>
      <span className={styles.header}>
        <Icon name="warehouse" size={14} className={styles.boxIcon} />
        <span className={styles.boxId}>{boxId}</span>
      </span>
      {state === 'occupied' ? (
        <>
          <span className={styles.horse}>{horseName}</span>
          <span className={styles.occupiedLabel}>Occupied</span>
        </>
      ) : (
        <span className={styles.status}>
          <Icon name="check-circle" size={12} />
          <span>{state === 'selected' ? 'Selected' : 'Free'}</span>
        </span>
      )}
    </>
  );
  const classes = cx(styles.tile, styles[state], className);
  if (onSelect && state !== 'occupied') {
    return (
      <button type="button" className={classes} aria-pressed={state === 'selected'} onClick={() => onSelect(boxId)}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} data-state={state}>
      {content}
    </div>
  );
}
