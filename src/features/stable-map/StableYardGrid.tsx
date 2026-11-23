import type { ReactNode } from 'react';
import { Icon } from '../../design-system';
import { gridCells, healthLabel, type HealthKey } from './stableMapApi';
import styles from './stableMap.module.css';

export type CellState = 'free' | 'occupied' | 'maintenance' | 'selected';
export interface GridBox { id: number; boxCode: string; rowNo: number; columnNo: number; state: CellState; horseName?: string; horseCode?: string; health?: HealthKey }

const STATE_LABEL: Record<CellState, string> = { free: 'Còn trống', occupied: 'Có ngựa', maintenance: 'Đang bảo trì', selected: 'Đã chọn' };

/**
 * DEC-016: one yard drawn as its real rows x columns grid (row 1 at the top, column 1 on the left). Each cell is one
 * box; the horse in it is shown by name. `onSelect` makes a cell clickable; `selectable` limits which cells are.
 */
export function StableYardGrid({ name, rowCount, columnCount, boxes, onSelect, selectable, footer, compact, highlight, matchIds }: {
  name: string; rowCount: number; columnCount: number; boxes: GridBox[];
  onSelect?: (box: GridBox) => void; selectable?: (box: GridBox) => boolean; footer?: ReactNode;
  /** Narrower cells, so a 10-column yard fits inside a dialog without scrolling sideways. */
  compact?: boolean;
  /** Box code to emphasise (e.g. opened from a horse profile). */
  highlight?: string | null;
  /** Search / quick filter: boxes outside this set are dimmed. */
  matchIds?: ReadonlySet<number> | null;
}) {
  const cells = gridCells(rowCount, columnCount, boxes);
  return (
    <div className={styles.yardGrid} role="grid" aria-label={`${name}: ${rowCount} hàng × ${columnCount} cột`} data-compact={compact || undefined}
      style={{ gridTemplateColumns: `${compact ? 20 : 28}px repeat(${columnCount}, minmax(${compact ? 62 : 76}px, 1fr))` }}>
      <span aria-hidden className={styles.corner} />
      {Array.from({ length: columnCount }, (_, index) => <span key={`c${index}`} aria-hidden className={styles.axis}>{index + 1}</span>)}
      {Array.from({ length: rowCount }, (_, row) => (
        <div key={`r${row}`} role="row" className={styles.gridRow}>
          <span className={styles.axis} aria-hidden>{String.fromCharCode(65 + row)}</span>
          {cells.slice(row * columnCount, (row + 1) * columnCount).map((box, column) => {
            if (!box) return <span key={`e${column}`} role="gridcell" className={styles.cellEmpty}>—</span>;
            const label = `${box.boxCode}: ${STATE_LABEL[box.state]}${box.horseName ? ` — ${box.horseName}` : ''}`;
            const marks = { 'data-health': box.health, 'data-dim': (matchIds && !matchIds.has(box.id)) || undefined };
            const content = <>
              <span className={styles.cellCode}>{box.boxCode}</span>
              {box.horseName ? <span className={styles.cellHorse}>{box.horseName}</span> : null}
              {box.health && box.state === 'occupied' ? <span className={styles.cellHealth} data-health={box.health}>{healthLabel(box.health)}</span> : null}
              <span className={styles.cellState}>
                {box.state === 'maintenance' ? <Icon name="alert-triangle" size={12} /> : box.state === 'occupied' ? <Icon name="horseshoe" size={12} /> : <Icon name="check-circle" size={12} />}
                {STATE_LABEL[box.state]}
              </span>
            </>;
            const clickable = onSelect && (!selectable || selectable(box));
            return clickable
              ? <button key={box.id} type="button" role="gridcell" aria-label={label} title={label} aria-pressed={box.state === 'selected'} id={`box-${box.boxCode}`}
                className={styles.cell} data-state={box.state} data-highlight={highlight === box.boxCode || undefined} {...marks} onClick={() => onSelect(box)}>{content}</button>
              : <span key={box.id} role="gridcell" aria-label={label} title={label} id={`box-${box.boxCode}`} className={styles.cell} data-state={box.state} data-highlight={highlight === box.boxCode || undefined} {...marks}>{content}</span>;
          })}
        </div>
      ))}
      {footer}
    </div>
  );
}

export function GridLegend() {
  return <ul className={styles.legend} aria-label="Chú thích sơ đồ">
    <li data-state="free">Còn trống</li><li data-state="occupied">Có ngựa</li><li data-state="maintenance">Đang bảo trì</li>
  </ul>;
}
