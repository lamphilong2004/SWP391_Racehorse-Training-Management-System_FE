import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { currentMonth, monthLabel, viDate, vnd } from '../billing/billingApi';
import { gridCells, toGridBox, type MapBox } from './stableMapApi';
import { StableYardGrid } from './StableYardGrid';

const box = (id: number, rowNo: number, columnNo: number, extra: Partial<MapBox> = {}): MapBox =>
  ({ id, boxCode: `A-${String(id).padStart(2, '0')}`, rowNo, columnNo, boxStatus: 'ACTIVE', horse: null, ...extra });

describe('DEC-016 stable layout grid', () => {
  it('lays boxes out row by row and keeps an empty slot for a missing cell', () => {
    const cells = gridCells(2, 3, [box(1, 1, 1), box(2, 1, 2), box(6, 2, 3)]);
    expect(cells.map((cell) => cell?.id ?? null)).toEqual([1, 2, null, null, null, 6]);
  });

  it('derives the cell state from the horse and the operating status', () => {
    expect(toGridBox(box(1, 1, 1)).state).toBe('free');
    expect(toGridBox(box(1, 1, 1, { boxStatus: 'MAINTENANCE' })).state).toBe('maintenance');
    const occupied = toGridBox(box(1, 1, 1, { horse: { id: 9, horseCode: 'RH-009', name: 'Lam Kiếm', lifecycle: 'ACTIVE' } }));
    expect(occupied).toMatchObject({ state: 'occupied', horseName: 'Lam Kiếm', horseCode: 'RH-009' });
  });

  it('shows which horse is in which box and only lets selectable cells be clicked', () => {
    const onSelect = vi.fn();
    render(<StableYardGrid name="Khu chuồng A" rowCount={1} columnCount={3} onSelect={onSelect}
      selectable={(cell) => cell.state === 'free'}
      boxes={[
        { id: 1, boxCode: 'A-01', rowNo: 1, columnNo: 1, state: 'occupied', horseName: 'Lam Kiếm' },
        { id: 2, boxCode: 'A-02', rowNo: 1, columnNo: 2, state: 'free' },
        { id: 3, boxCode: 'A-03', rowNo: 1, columnNo: 3, state: 'maintenance' },
      ]} />);
    const grid = screen.getByRole('grid', { name: 'Khu chuồng A: 1 hàng × 3 cột' });
    expect(within(grid).getByLabelText('A-01: Có ngựa — Lam Kiếm')).toBeInTheDocument();
    expect(within(grid).getByLabelText('A-03: Đang bảo trì').tagName).not.toBe('BUTTON');
    expect(within(grid).getByLabelText('A-01: Có ngựa — Lam Kiếm').tagName).not.toBe('BUTTON');
    fireEvent.click(within(grid).getByRole('gridcell', { name: 'A-02: Còn trống' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });
});

describe('DEC-016 billing display helpers', () => {
  it('formats VND, dates and months for Vietnamese screens', () => {
    expect(vnd(1250000)).toBe(`${new Intl.NumberFormat('vi-VN').format(1250000)} ₫`);
    expect(vnd(null)).toBe('—');
    expect(viDate('2026-11-20')).toBe('20/11/2026');
    expect(monthLabel('2026-11')).toBe('Tháng 11/2026');
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
