import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { currentMonth, invoiceDisplayStatus, monthLabel, paymentDisplayStatus, viDate, vietQrImageUrl, vnd } from '../billing/billingApi';
import { gridCells, matchesFilter, matchesQuery, normalizeSearch, toGridBox, type MapBox } from './stableMapApi';
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

  it('shows an unpaid invoice past its due date as overdue and an expired VNPay link as expired', () => {
    expect(invoiceDisplayStatus({ status: 'ISSUED', dueDate: '2000-01-01' })).toBe('OVERDUE');
    expect(invoiceDisplayStatus({ status: 'PAID', dueDate: '2000-01-01' })).toBe('PAID');
    expect(invoiceDisplayStatus({ status: 'ISSUED', dueDate: '2999-01-01' })).toBe('ISSUED');
    const payment = { id: 1, provider: 'VNPAY', txnRef: 'T', amount: 1, status: 'PENDING' as const, bankCode: null, cardType: null,
      providerTransactionNo: null, responseCode: null, confirmedVia: null, createdAt: '2026-11-20T01:00:00Z', confirmedAt: null,
      expiresAt: '2026-11-20T01:15:00Z' };
    expect(paymentDisplayStatus(payment, Date.parse('2026-11-20T01:10:00Z'))).toBe('PENDING');
    expect(paymentDisplayStatus(payment, Date.parse('2026-11-20T01:20:00Z'))).toBe('EXPIRED');
  });
});

describe('DEC-016 VietQR transfer', () => {
  it('builds the VietQR quick link with the club account, the exact total and the invoice code', () => {
    const url = vietQrImageUrl({ bankBin: '970436', bankName: 'Vietcombank', accountNo: '0123456789', accountName: 'CLB DUA NGUA G2', amount: 750000, content: 'HD2026110018' });
    expect(url).toBe('https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=750000&addInfo=HD2026110018&accountName=CLB%20DUA%20NGUA%20G2');
  });
});

describe('DEC-016 stable map search and quick filters', () => {
  const horse = (healthStatus?: 'FIT' | 'MONITORING' | 'INJURED' | 'QUARANTINED' | null) =>
    ({ id: 2, horseCode: 'RH-002', name: 'Hoàng Kim', lifecycle: 'ACTIVE', healthStatus });

  it('finds a horse or a stall without diacritics, case or separators', () => {
    expect(normalizeSearch('Hoàng Kim Đức')).toBe('hoangkimduc');
    const occupied = box(6, 1, 6, { horse: horse('FIT') });
    for (const query of ['hoang kim', 'HOÀNG', 'rh002', 'RH-002', 'a06', 'A-06', '']) expect(matchesQuery(occupied, query)).toBe(true);
    expect(matchesQuery(occupied, 'Phong Vân')).toBe(false);
  });

  it('filters by occupancy, maintenance and horses that need attention', () => {
    const free = box(1, 1, 1);
    const maintenance = box(2, 1, 2, { boxStatus: 'MAINTENANCE' });
    const fit = box(3, 1, 3, { horse: horse('FIT') });
    const injured = box(4, 1, 4, { horse: horse('INJURED') });
    const unknown = box(5, 1, 5, { horse: horse() });
    const all = [free, maintenance, fit, injured, unknown];
    const ids = (filter: Parameters<typeof matchesFilter>[1]) => all.filter((b) => matchesFilter(b, filter)).map((b) => b.id);
    expect(ids('all')).toEqual([1, 2, 3, 4, 5]);
    expect(ids('occupied')).toEqual([3, 4, 5]);
    expect(ids('free')).toEqual([1]);
    expect(ids('maintenance')).toEqual([2]);
    expect(ids('attention')).toEqual([4]);
    expect(toGridBox(injured).health).toBe('INJURED');
    expect(toGridBox(unknown).health).toBe('UNKNOWN');
    expect(toGridBox(free).health).toBeUndefined();
  });
});
