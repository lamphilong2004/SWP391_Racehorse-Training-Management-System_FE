/**
 * DEC-016 2D floor plan geometry (top-down barn view). Rows are paired around a shared aisle like a real shed-row barn:
 * row A faces down onto the aisle, row B faces up onto it; a third row starts a second pair. All sizes in SVG units.
 */
export const STALL_W = 92;
export const STALL_H = 104;
export const AISLE_H = 46;
export const PAIR_GAP = 22;
export const WALL = 10;
export const LABEL_W = 56;

export interface StallRect { rowNo: number; columnNo: number; x: number; y: number; doorSide: 'top' | 'bottom' }
export interface AisleRect { x: number; y: number; width: number; height: number }
export interface FloorPlan { width: number; height: number; stalls: StallRect[]; aisles: AisleRect[]; inner: { x: number; y: number; width: number; height: number } }

export function floorPlan(rowCount: number, columnCount: number): FloorPlan {
  const left = WALL + LABEL_W;
  const top = WALL;
  const rowsWidth = columnCount * STALL_W;
  const stalls: StallRect[] = [];
  const aisles: AisleRect[] = [];
  const pairs = Math.ceil(rowCount / 2);
  const pairHeight = 2 * STALL_H + AISLE_H;
  for (let pair = 0; pair < pairs; pair++) {
    const pairTop = top + pair * (pairHeight + PAIR_GAP);
    const upperRow = pair * 2 + 1;
    const lowerRow = upperRow + 1;
    for (let column = 1; column <= columnCount; column++) {
      const x = left + (column - 1) * STALL_W;
      stalls.push({ rowNo: upperRow, columnNo: column, x, y: pairTop, doorSide: 'bottom' });
      if (lowerRow <= rowCount) stalls.push({ rowNo: lowerRow, columnNo: column, x, y: pairTop + STALL_H + AISLE_H, doorSide: 'top' });
    }
    aisles.push({ x: left - LABEL_W, y: pairTop + STALL_H, width: rowsWidth + LABEL_W, height: AISLE_H });
  }
  const lastPairRows = rowCount - (pairs - 1) * 2;
  const innerHeight = (pairs - 1) * (pairHeight + PAIR_GAP) + (lastPairRows === 2 ? pairHeight : STALL_H + AISLE_H);
  const inner = { x: left - LABEL_W, y: top, width: rowsWidth + LABEL_W, height: innerHeight };
  return { width: inner.width + 2 * WALL, height: innerHeight + 2 * WALL, stalls, aisles, inner };
}

/** Row letter used on the plan and in messages (row 1 = A). */
export const rowLetter = (rowNo: number) => String.fromCharCode(64 + rowNo);
