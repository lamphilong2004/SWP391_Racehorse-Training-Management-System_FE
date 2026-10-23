import type { FormEventHandler, ReactNode } from 'react';
import { Button } from '../Button/Button';
import styles from './TableToolbar.module.css';

export interface TableToolbarProps {
  label: string;
  children: ReactNode;
  /** Exact API count only. Omit while unavailable; never derive a database total from a page. */
  resultCount?: number;
  scope: 'server' | 'page';
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onClear: () => void;
  hasFilters: boolean;
}

/** Controlled presentation: feature owns query, pagination, requests and authorization. */
export function TableToolbar({ label, children, resultCount, scope, onSubmit, onClear, hasFilters }: TableToolbarProps) {
  return <section className={styles.toolbar} aria-label={label}>
    <form className={styles.fields} onSubmit={onSubmit ?? ((event) => event.preventDefault())}>
      {children}
      <Button type="button" variant="tertiary" disabled={!hasFilters} onClick={onClear}>Xóa bộ lọc</Button>
    </form>
    <p className={styles.summary} role="status">
      {resultCount !== undefined && <strong>{resultCount.toLocaleString('vi-VN')} kết quả · </strong>}
      {scope === 'server' ? 'Lọc trên toàn bộ danh sách' : 'Chỉ lọc dữ liệu trên trang đang tải'}
    </p>
  </section>;
}
