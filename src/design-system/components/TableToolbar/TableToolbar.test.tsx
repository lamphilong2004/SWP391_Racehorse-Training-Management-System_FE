import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TableToolbar } from './TableToolbar';

describe('TableToolbar', () => {
  it('reports exact server totals, submits and clears through the owning feature', async () => {
    const user = userEvent.setup(), clear = vi.fn(), submit = vi.fn((event) => event.preventDefault());
    render(<TableToolbar label="Horse filters" scope="server" resultCount={41} hasFilters onClear={clear} onSubmit={submit}>
      <label>Search<input name="search" /></label><button type="submit">Apply</button>
    </TableToolbar>);
    await user.type(screen.getByRole('textbox'), 'River');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(submit).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('41 kết quả');
    expect(screen.getByRole('status')).toHaveTextContent('toàn bộ danh sách');
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(clear).toHaveBeenCalledOnce();
  });
  it('labels page scope and never invents a total while loading', () => {
    render(<TableToolbar label="Loaded rows" scope="page" hasFilters={false} onClear={vi.fn()}><input aria-label="Search" /></TableToolbar>);
    expect(screen.getByRole('status')).toHaveTextContent('Chỉ lọc dữ liệu trên trang');
    expect(screen.getByRole('status')).not.toHaveTextContent('kết quả');
    expect(screen.getByRole('button', { name: 'Xóa bộ lọc' })).toBeDisabled();
  });
});
