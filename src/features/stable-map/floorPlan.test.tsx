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
    expect(screen.getByRole('button', { name: 'A-03: Đang bảo trì' })).toBeInTheDocument();
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
});
