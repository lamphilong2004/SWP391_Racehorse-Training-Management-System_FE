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
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  caption?: string;
  onRowClick?: (row: T) => void;
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
  selectedKey,
  empty,
  className,
}: DataTableProps<T>) {
  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
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
            return (
              <tr
                key={key}
                className={cx(styles.row, onRowClick && styles.clickable, selected && styles.selected)}
                aria-selected={onRowClick ? selected : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => onRowKeyDown(event, row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cx(styles.cell, column.align === 'right' && styles.right)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
