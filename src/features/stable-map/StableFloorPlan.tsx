import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { AISLE_H, floorPlan, rowLetter, STALL_H, STALL_W, WALL, type StallRect } from './floorPlanGeometry';
import type { MapBox, MapYard } from './stableMapApi';
import styles from './stableMap.module.css';

type StallState = 'free' | 'occupied' | 'maintenance';
const stateOf = (box: MapBox): StallState => box.horse ? 'occupied' : box.boxStatus === 'MAINTENANCE' ? 'maintenance' : 'free';
const STATE_LABEL: Record<StallState, string> = { free: 'Còn trống', occupied: 'Có ngựa', maintenance: 'Đang bảo trì' };
const short = (name: string, max = 11) => name.length > max ? `${name.slice(0, max - 1)}…` : name;

/** Top-down horse: body, neck and head towards the stall door, tail towards the back wall. */
function Horse({ cx, cy, facing }: { cx: number; cy: number; facing: 'top' | 'bottom' }) {
  const dir = facing === 'bottom' ? 1 : -1;
  return <g className={styles.horse} aria-hidden="true">
    <path className={styles.horseTail} d={`M ${cx} ${cy - dir * 22} q ${-4} ${-dir * 8} ${2} ${-dir * 16}`} />
    <ellipse cx={cx} cy={cy} rx={11} ry={21} />
    <ellipse cx={cx} cy={cy + dir * 22} rx={5.5} ry={9} />
    <ellipse cx={cx} cy={cy + dir * 32} rx={6} ry={7} />
    <ellipse className={styles.horseEar} cx={cx - 3.5} cy={cy + dir * 26} rx={1.6} ry={2.6} />
    <ellipse className={styles.horseEar} cx={cx + 3.5} cy={cy + dir * 26} rx={1.6} ry={2.6} />
  </g>;
}

export interface StableFloorPlanProps {
  yard: MapYard;
  highlight?: string | null;
  /** Click or Enter on a stall. */
  onSelect: (box: MapBox) => void;
  selectable: (box: MapBox) => boolean;
  /** Club Manager only: drag a horse onto a free stall to move it there. */
  onMove?: (from: MapBox, to: MapBox) => void;
}

/**
 * DEC-016 2D floor plan of one yard, drawn as a shed-row barn seen from above: stalls face a shared aisle, each stall
 * has a door on the aisle side and a feeder on the back wall, the horse in it is drawn facing the door. A Club Manager
 * can drag a horse onto a free stall; the page confirms the move before calling the API.
 */
export function StableFloorPlan({ yard, highlight, onSelect, selectable, onMove }: StableFloorPlanProps) {
  const plan = floorPlan(yard.rowCount, yard.columnCount);
  const patternId = `hatch-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ from: MapBox; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; name: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const byPosition = new Map(yard.boxes.map((box) => [`${box.rowNo}:${box.columnNo}`, box]));
  const byId = new Map(yard.boxes.map((box) => [box.id, box]));
  const canDrop = (box?: MapBox) => !!box && !box.horse && box.boxStatus === 'ACTIVE';

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current; const matrix = svg?.getScreenCTM?.();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  const boxUnder = (clientX: number, clientY: number) => {
    const node = document.elementFromPoint?.(clientX, clientY)?.closest?.('[data-box-id]');
    return node ? byId.get(Number(node.getAttribute('data-box-id'))) : undefined;
  };
  const start = (box: MapBox) => (event: PointerEvent<SVGGElement>) => {
    if (!onMove || !box.horse || event.button !== 0) return;
    drag.current = { from: box, x: event.clientX, y: event.clientY, moved: false };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current; if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.moved = true;
    setGhost({ ...toSvg(event.clientX, event.clientY), name: current.from.horse?.name ?? '' });
    const target = boxUnder(event.clientX, event.clientY);
    setDropTarget(canDrop(target) ? target!.id : null);
  };
  const end = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current; drag.current = null;
    setGhost(null); setDropTarget(null);
    if (!current?.moved) return;
    suppressClick.current = true;
    const target = boxUnder(event.clientX, event.clientY);
    if (onMove && target && canDrop(target)) onMove(current.from, target);
  };
  const activate = (box: MapBox) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (selectable(box)) onSelect(box);
  };
  const key = (box: MapBox) => (event: KeyboardEvent<SVGGElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && selectable(box)) { event.preventDefault(); onSelect(box); }
  };

  const stall = (rect: StallRect) => {
    const box = byPosition.get(`${rect.rowNo}:${rect.columnNo}`);
    const x = rect.x; const y = rect.y; const doorY = rect.doorSide === 'bottom' ? y + STALL_H : y;
    const feederY = rect.doorSide === 'bottom' ? y + 6 : y + STALL_H - 14;
    if (!box) return <g key={`${rect.rowNo}-${rect.columnNo}`}><rect className={styles.stallEmpty} x={x + 2} y={y + 2} width={STALL_W - 4} height={STALL_H - 4} rx={4} /></g>;
    const state = stateOf(box);
    const clickable = selectable(box);
    const label = `${box.boxCode}: ${STATE_LABEL[state]}${box.horse ? ` — ${box.horse.name}` : ''}`;
    const textY = rect.doorSide === 'bottom' ? y + 32 : y + 20;
    return <g key={box.id} id={`box-${box.boxCode}`} data-box-id={box.id} data-state={state}
      data-highlight={highlight === box.boxCode || undefined} data-drop={dropTarget === box.id || undefined}
      className={styles.stall} role={clickable ? 'button' : 'img'} tabIndex={clickable ? 0 : undefined} aria-label={label}
      onClick={() => activate(box)} onKeyDown={key(box)} onPointerDown={start(box)}
      style={{ cursor: onMove && box.horse ? 'grab' : clickable ? 'pointer' : 'default' }}>
      <title>{label}</title>
      <rect className={styles.stallFloor} x={x + 2} y={y + 2} width={STALL_W - 4} height={STALL_H - 4} rx={3}
        fill={state === 'maintenance' ? `url(#${patternId})` : undefined} />
      <rect className={styles.feeder} x={x + STALL_W - 26} y={feederY} width={18} height={8} rx={2} />
      <line className={styles.door} x1={x + 22} x2={x + STALL_W - 22} y1={doorY} y2={doorY} />
      <text className={styles.stallCode} x={x + 8} y={rect.doorSide === 'bottom' ? y + 18 : y + STALL_H - 8}>{box.boxCode}</text>
      {box.horse
        ? <><Horse cx={x + STALL_W / 2} cy={y + STALL_H / 2 + (rect.doorSide === 'bottom' ? 4 : -4)} facing={rect.doorSide} />
          <text className={styles.stallName} x={x + STALL_W / 2} y={rect.doorSide === 'bottom' ? y + STALL_H - 6 : y + 14} textAnchor="middle">{short(box.horse.name)}</text></>
        : <text className={styles.stallState} x={x + STALL_W / 2} y={textY + 26} textAnchor="middle">{state === 'maintenance' ? 'Bảo trì' : 'Trống'}</text>}
    </g>;
  };

  return <svg ref={svgRef} className={styles.floorPlan} viewBox={`0 0 ${plan.width} ${plan.height}`} width="100%"
    style={{ maxWidth: plan.width }} role="group" aria-label={`Mặt bằng ${yard.name}: ${yard.rowCount} dãy × ${yard.columnCount} ô`}
    onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; setGhost(null); setDropTarget(null); }}>
    <defs>
      <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" className={styles.hatchBase} /><line x1="0" y1="0" x2="0" y2="8" className={styles.hatchLine} />
      </pattern>
    </defs>
    <rect className={styles.barnWall} x={WALL / 2} y={WALL / 2} width={plan.width - WALL} height={plan.height - WALL} rx={6} />
    <rect className={styles.barnInside} x={plan.inner.x} y={plan.inner.y} width={plan.inner.width} height={plan.inner.height} />
    {plan.aisles.map((aisle, index) => <g key={index}>
      <rect className={styles.aisle} x={aisle.x} y={aisle.y} width={aisle.width} height={aisle.height} />
      <line className={styles.aisleLine} x1={aisle.x + 8} x2={aisle.x + aisle.width - 8} y1={aisle.y + AISLE_H / 2} y2={aisle.y + AISLE_H / 2} />
      <text className={styles.aisleText} x={aisle.x + aisle.width / 2} y={aisle.y + AISLE_H / 2 - 6} textAnchor="middle">Lối đi</text>
      <rect className={styles.gate} x={0} y={aisle.y + 8} width={WALL + 2} height={AISLE_H - 16} />
      <rect className={styles.gate} x={plan.width - WALL - 2} y={aisle.y + 8} width={WALL + 2} height={AISLE_H - 16} />
      <text className={styles.gateText} x={WALL + 4} y={aisle.y + AISLE_H / 2 + 14}>Cửa</text>
    </g>)}
    {plan.stalls.filter((rect) => rect.columnNo === 1).map((rect) =>
      <text key={`row-${rect.rowNo}`} className={styles.rowText} x={WALL + 8} y={rect.y + STALL_H / 2 + 4}>{`Dãy ${rowLetter(rect.rowNo)}`}</text>)}
    {plan.stalls.map(stall)}
    {ghost && <g className={styles.ghost} pointerEvents="none">
      <circle cx={ghost.x} cy={ghost.y} r={18} />
      <text x={ghost.x} y={ghost.y - 24} textAnchor="middle">{ghost.name}</text>
    </g>}
  </svg>;
}
