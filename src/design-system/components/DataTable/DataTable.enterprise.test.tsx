import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
it('preserves table semantics and keyboard row actions in the scrolling region', async () => {
  const user = userEvent.setup(), action = vi.fn();
  const rows = Array.from({ length: 21 }, (_, id) => ({ id, name: `Ngựa Ánh Dương ${id} · ${'LongIdentifier'.repeat(8)}` }));
  render(<DataTable caption="Registry" rows={rows} rowKey={row => row.id} onRowClick={action}
    columns={[{ key: 'name', header: 'Horse', render: row => row.name }]} />);
  expect(screen.getByRole('region', { name: 'Registry' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByRole('table', { name: 'Registry' })).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(22);
  await user.click(screen.getAllByRole('row')[1]); await user.keyboard('{Enter}');
  expect(action).toHaveBeenCalledTimes(2); expect(action).toHaveBeenLastCalledWith(rows[0]);
});
it('renders an honest empty state without invented rows', () => {
  render(<DataTable caption="Empty registry" rows={[]} rowKey={() => 0} empty="Không có kết quả"
    columns={[{ key: 'name', header: 'Horse', render: () => 'must not render' }]} />);
  expect(screen.getByText('Không có kết quả')).toBeInTheDocument(); expect(screen.queryByText('must not render')).not.toBeInTheDocument();
});
