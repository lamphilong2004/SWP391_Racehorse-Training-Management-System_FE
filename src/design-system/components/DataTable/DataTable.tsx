import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './DataTable.module.css';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Rendered cell content. Status cells use StatusBadge, never colour alone. */
  render: (row: T) => ReactNode;
  width?: number | string;
  /** Numeric columns are right-aligned (Figma Table 73:117). */
  align?: 'left' | 'right';
  /** Keep short values such as dates and times on one line. */
  nowrap?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  caption?: string;
  onRowClick?: (row: T) => void;
  isRowClickable?: (row: T) => boolean;
  /** Set false when a native button or radio already provides keyboard access. */
  focusableRows?: boolean;
  selectedKey?: string | number;
  /** Rendered across all columns when `rows` is empty (use EmptyState). */
  empty?: ReactNode;
  className?: string;
}

/** Figma Table (73:117): header 44 on bg/subtle, rows 56 with a bottom border; hover and selected states. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  isRowClickable,
  focusableRows = true,
  selectedKey,
  empty,
  className,
}: DataTableProps<T>) {
  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className={styles.scroll} role="region" aria-label={caption ?? 'Bảng dữ liệu'} tabIndex={0}>
    <table className={cx(styles.table, className)}>
      {caption && <caption className="visually-hidden">{caption}</caption>}
      <thead>
        <tr className={styles.headerRow}>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={cx(styles.headerCell, column.align === 'right' && styles.right)}
              style={{ width: column.width }}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && empty ? (
          <tr>
            <td className={styles.emptyCell} colSpan={columns.length}>
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey !== undefined && key === selectedKey;
            const clickable = Boolean(onRowClick) && (isRowClickable?.(row) ?? true);
            return (
              <tr
                key={key}
                className={cx(styles.row, clickable && styles.clickable, selected && styles.selected)}
                aria-selected={clickable ? selected : undefined}
                tabIndex={clickable && focusableRows ? 0 : undefined}
                onClick={clickable ? event => {
                  if (event.target instanceof Element && event.target.closest('a, button, input, label, select, textarea, [role="button"], [role="link"]')) return;
                  onRowClick?.(row);
                } : undefined}
                onKeyDown={clickable && focusableRows ? (event) => onRowKeyDown(event, row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cx(styles.cell, column.align === 'right' && styles.right, column.nowrap && styles.nowrap)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
    </div>
  );
}
