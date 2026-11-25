import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AISLE_H, floorPlan, STALL_H } from './floorPlanGeometry';
import { StableFloorPlan } from './StableFloorPlan';
import type { MapBox, MapYard } from './stableMapApi';

const box = (id: number, rowNo: number, columnNo: number, extra: Partial<MapBox> = {}): MapBox =>
  ({ id, boxCode: `A-${String(id).padStart(2, '0')}`, rowNo, columnNo, boxStatus: 'ACTIVE', horse: null, ...extra });
const yard = (boxes: MapBox[], rowCount = 2, columnCount = 2): MapYard =>
  ({ id: 1, yardCode: 'A', name: 'Khu chuồng A', rowCount, columnCount, occupied: 0, free: 0, maintenance: 0, boxes });

describe('DEC-016 floor plan geometry', () => {
  it('pairs rows around a shared aisle like a shed-row barn', () => {
    const plan = floorPlan(2, 10);
    const rowA = plan.stalls.filter((s) => s.rowNo === 1);
    const rowB = plan.stalls.filter((s) => s.rowNo === 2);
    expect(rowA).toHaveLength(10);
    expect(rowB).toHaveLength(10);
    expect(plan.aisles).toHaveLength(1);
    expect(rowA[0].doorSide).toBe('bottom');
    expect(rowB[0].doorSide).toBe('top');
    expect(plan.aisles[0].y).toBe(rowA[0].y + STALL_H);
    expect(rowB[0].y).toBe(rowA[0].y + STALL_H + AISLE_H);
  });

  it('starts a second barn section for a third row and keeps one aisle per pair', () => {
    const plan = floorPlan(3, 4);
    expect(plan.stalls).toHaveLength(12);
    expect(plan.aisles).toHaveLength(2);
    const rowC = plan.stalls.find((s) => s.rowNo === 3)!;
    expect(rowC.doorSide).toBe('bottom');
    expect(rowC.y).toBeGreaterThan(plan.aisles[0].y + AISLE_H);
  });
});

describe('DEC-016 2D floor plan', () => {
  const horse = { id: 9, horseCode: 'RH-009', name: 'Lam Kiếm', lifecycle: 'ACTIVE' };

  it('draws every stall with its state and the horse inside', () => {
    render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse }), box(2, 1, 2), box(3, 2, 1, { boxStatus: 'MAINTENANCE' }), box(4, 2, 2)])}
      onSelect={vi.fn()} selectable={() => true} />);
    expect(screen.getByRole('group', { name: 'Mặt bằng Khu chuồng A: 2 dãy × 2 ô' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' })).toBeInTheDocument();
    const maintenance = screen.getByRole('button', { name: 'A-03: Đang bảo trì' });
    // Inline style, because the stylesheet's fill would beat a fill attribute and hide the hatch.
    expect(maintenance.querySelector('rect')?.getAttribute('style')).toMatch(/fill: url\("?#hatch-/);
    expect(screen.getAllByText('Lối đi')).toHaveLength(1);
  });

  it('opens a stall by click or keyboard and keeps view-only stalls inert', () => {
    const onSelect = vi.fn();
    render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse }), box(2, 1, 2), box(3, 2, 1), box(4, 2, 2)])}
      onSelect={onSelect} selectable={(b) => !!b.horse} />);
    fireEvent.click(screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' }), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('img', { name: 'A-02: Còn trống' })).toBeInTheDocument();
  });

  it('moves a horse when it is dragged onto a free stall, never onto an occupied or maintenance one', () => {
    const onMove = vi.fn();
    const free = box(2, 1, 2);
    render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse }), free, box(3, 2, 1, { boxStatus: 'MAINTENANCE' }), box(4, 2, 2)])}
      onSelect={vi.fn()} selectable={() => true} onMove={onMove} />);
    const group = screen.getByRole('group');
    const source = screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' });
    const target = screen.getByRole('button', { name: 'A-02: Còn trống' });
    const maintenance = screen.getByRole('button', { name: 'A-03: Đang bảo trì' });
    const original = document.elementFromPoint;
    try {
      document.elementFromPoint = () => maintenance;
      fireEvent.pointerDown(source, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
      fireEvent.pointerMove(group, { clientX: 60, clientY: 10, pointerId: 1 });
      fireEvent.pointerUp(group, { clientX: 60, clientY: 10, pointerId: 1 });
      expect(onMove).not.toHaveBeenCalled();
      document.elementFromPoint = () => target;
      fireEvent.pointerDown(source, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
      fireEvent.pointerMove(group, { clientX: 120, clientY: 10, pointerId: 1 });
      fireEvent.pointerUp(group, { clientX: 120, clientY: 10, pointerId: 1 });
      expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), free);
    } finally {
      document.elementFromPoint = original;
    }
  });

  it('opens a stall on the next click after a drag that ended on another stall', async () => {
    const onSelect = vi.fn();
    const free = box(2, 1, 2);
    render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse }), free, box(3, 2, 1), box(4, 2, 2)])}
      onSelect={onSelect} selectable={() => true} onMove={vi.fn()} />);
    const group = screen.getByRole('group');
    const source = screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' });
    const original = document.elementFromPoint;
    try {
      document.elementFromPoint = () => screen.getByRole('button', { name: 'A-02: Còn trống' });
      fireEvent.pointerDown(source, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
      fireEvent.pointerMove(group, { clientX: 120, clientY: 10, pointerId: 1 });
      fireEvent.pointerUp(group, { clientX: 120, clientY: 10, pointerId: 1 });
    } finally {
      document.elementFromPoint = original;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole('button', { name: 'A-03: Còn trống' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });
});

describe('DEC-016 floor plan: health, hover card, search and pulse', () => {
  const injured = { id: 9, horseCode: 'RH-009', name: 'Lam Kiếm', lifecycle: 'ACTIVE', healthStatus: 'INJURED' as const };
  const fit = { id: 10, horseCode: 'RH-010', name: 'Ánh Dương', lifecycle: 'ACTIVE', healthStatus: 'FIT' as const };

  it('colours each horse by its health and treats a missing status as not assessed', () => {
    const { container } = render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse: injured }), box(2, 1, 2, { horse: fit }),
      box(3, 2, 1, { horse: { id: 11, horseCode: 'RH-011', name: 'Cũ', lifecycle: 'ACTIVE' } }), box(4, 2, 2)])}
      onSelect={vi.fn()} selectable={() => true} />);
    expect(container.querySelector('#box-A-01')?.getAttribute('data-health')).toBe('INJURED');
    expect(container.querySelector('#box-A-02')?.getAttribute('data-health')).toBe('FIT');
    expect(container.querySelector('#box-A-03')?.getAttribute('data-health')).toBe('UNKNOWN');
    expect(container.querySelector('#box-A-04')?.hasAttribute('data-health')).toBe(false);
  });

  it('shows a hover card with the horse, its health and what the user can do', () => {
    render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse: injured }), box(2, 1, 2), box(3, 2, 1), box(4, 2, 2)])}
      onSelect={vi.fn()} selectable={() => true} onMove={vi.fn()} />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' }));
    expect(screen.getByText('Khu chuồng A · dãy A, cột 1')).toBeInTheDocument();
    expect(screen.getByText('Chấn thương')).toBeInTheDocument();
    expect(screen.getByText('Bấm để xem chi tiết · Kéo sang ô trống để chuyển chuồng')).toBeInTheDocument();
    fireEvent.pointerLeave(screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' }));
    expect(screen.queryByText('Chấn thương')).not.toBeInTheDocument();
  });

  it('offers no drag hint to a role that cannot move horses, and opens the card on keyboard focus', () => {
    render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse: fit }), box(2, 1, 2), box(3, 2, 1), box(4, 2, 2)])}
      onSelect={vi.fn()} selectable={(b) => !!b.horse} />);
    fireEvent.focus(screen.getByRole('button', { name: 'A-01: Có ngựa — Ánh Dương' }));
    expect(screen.getByText('Khỏe mạnh')).toBeInTheDocument();
    expect(screen.getByText('Bấm để xem chi tiết')).toBeInTheDocument();
    expect(screen.queryByText(/Kéo sang ô trống/)).not.toBeInTheDocument();
  });

  it('dims stalls outside the search result and pulses the stall that just received a horse', () => {
    const { container } = render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse: injured }), box(2, 1, 2), box(3, 2, 1), box(4, 2, 2)])}
      onSelect={vi.fn()} selectable={() => true} matchIds={new Set([1])} pulse="A-01" />);
    expect(container.querySelector('#box-A-01')?.hasAttribute('data-dim')).toBe(false);
    expect(container.querySelector('#box-A-02')?.hasAttribute('data-dim')).toBe(true);
    expect(container.querySelector('#box-A-01')?.hasAttribute('data-pulse')).toBe(true);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'A-02: Còn trống' }));
    expect(screen.queryByText('Còn trống', { selector: 'div' })).not.toBeInTheDocument();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' }));
    expect(screen.getByText('Chấn thương')).toBeInTheDocument();
  });
});

describe('DEC-016 floor plan: review fixes (accessible health, card at the edges)', () => {
  const injured = { id: 9, horseCode: 'RH-009', name: 'Lam Kiếm', lifecycle: 'ACTIVE', healthStatus: 'INJURED' as const };
  const unassessed = { id: 10, horseCode: 'RH-010', name: 'Ánh Dương', lifecycle: 'ACTIVE' };

  it('announces each horse\'s health as the stall description, also when it was never assessed', () => {
    render(<StableFloorPlan yard={yard([box(1, 1, 1, { horse: injured }), box(2, 1, 2, { horse: unassessed }), box(3, 2, 1), box(4, 2, 2)])}
      onSelect={vi.fn()} selectable={() => true} />);
    expect(screen.getByRole('button', { name: 'A-01: Có ngựa — Lam Kiếm' })).toHaveAccessibleDescription('Sức khỏe: Chấn thương');
    expect(screen.getByRole('button', { name: 'A-02: Có ngựa — Ánh Dương' })).toHaveAccessibleDescription('Sức khỏe: Chưa đánh giá sức khỏe');
    expect(screen.getByRole('button', { name: 'A-03: Còn trống' })).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the hover card inside the plan for the first and last column', () => {
    const boxes = Array.from({ length: 10 }, (_, index) => box(index + 1, 1, index + 1, { horse: { ...injured, id: 100 + index } }));
    const { container } = render(<StableFloorPlan yard={yard(boxes, 1, 10)} onSelect={vi.fn()} selectable={() => true} />);
    const tip = () => container.querySelector('[data-align]');
    fireEvent.focus(container.querySelector('#box-A-01')!);
    expect(tip()?.getAttribute('data-align')).toBe('start');
    fireEvent.focus(container.querySelector('#box-A-05')!);
    expect(tip()?.getAttribute('data-align')).toBe('center');
    fireEvent.focus(container.querySelector('#box-A-10')!);
    expect(tip()?.getAttribute('data-align')).toBe('end');
  });
});
