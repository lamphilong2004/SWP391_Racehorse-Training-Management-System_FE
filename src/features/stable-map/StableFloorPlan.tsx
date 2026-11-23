import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { AISLE_H, floorPlan, rowLetter, STALL_H, STALL_W, WALL, type StallRect } from './floorPlanGeometry';
import type { MapBox, MapYard } from './stableMapApi';
import styles from './stableMap.module.css';

type StallState = 'free' | 'occupied' | 'maintenance';
const stateOf = (box: MapBox): StallState => box.horse ? 'occupied' : box.boxStatus === 'MAINTENANCE' ? 'maintenance' : 'free';
const STATE_LABEL: Record<StallState, string> = { free: 'Còn trống', occupied: 'Có ngựa', maintenance: 'Đang bảo trì' };
const short = (name: string, max = 12) => name.length > max ? `${name.slice(0, max - 1)}…` : name;

/** Horse head in profile (facing left) on a 24 × 24 grid; drawn inside a round avatar. */
const HORSE_HEAD = 'M 3.2 16.8 C 2.2 16.4 1.9 15.2 2.4 14.2 L 6.6 7.4 C 7.1 6.5 7.6 5.6 8 4.8 L 8.3 2 L 9.6 4.2 '
  + 'L 10.6 1.8 L 11.2 4.6 C 15.2 5.4 19 8.6 20.4 13.2 C 21.1 15.6 21.3 18.6 21.3 22 L 13.2 22 '
  + 'C 13 19.4 12.2 17.4 10.9 15.9 C 10.2 16.9 8.8 17.6 7.2 17.6 C 5.7 17.6 4.3 17.3 3.2 16.8 Z';

/** The horse avatar: tinted circle, head silhouette (long face, muzzle, two ears, arched neck), eye, nostril, mane. */
function HorseAvatar({ cx, cy }: { cx: number; cy: number }) {
  const scale = 1.3;
  return <g className={styles.avatar} aria-hidden="true">
    <circle className={styles.avatarRing} cx={cx} cy={cy} r={18} />
    <g transform={`translate(${cx - 11.6 * scale} ${cy - 12 * scale}) scale(${scale})`}>
      <path className={styles.horseHead} d={HORSE_HEAD} />
      <circle className={styles.horseEye} cx={8.7} cy={8.7} r={0.95} />
      <circle className={styles.horseEye} cx={3.5} cy={14.7} r={0.65} />
      <path className={styles.horseMane} d="M 11.2 4.6 C 14.6 5.6 17.6 8.2 19 11.8" />
    </g>
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
 * DEC-016 2D floor plan of one yard in an architectural style: a shed-row barn seen from above with thin walls, a
 * shared aisle with sliding doors at both ends, and stalls whose sliding door opens onto the aisle. Each stall is a
 * card: code and status at the top, the horse (avatar, name, code) or the free / maintenance state in the middle.
 * A Club Manager can drag a horse onto a free stall; the page confirms the move before calling the API.
 */
export function StableFloorPlan({ yard, highlight, onSelect, selectable, onMove }: StableFloorPlanProps) {
  const plan = floorPlan(yard.rowCount, yard.columnCount);
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const patternId = `hatch-${uid}`;
  const shadowId = `shadow-${uid}`;
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
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current; if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    // Capture only once it is a real drag: capturing on press would retarget a plain click to the svg.
    if (!current.moved) svgRef.current?.setPointerCapture?.(event.pointerId);
    current.moved = true;
    setGhost({ ...toSvg(event.clientX, event.clientY), name: current.from.horse?.name ?? '' });
    const target = boxUnder(event.clientX, event.clientY);
    setDropTarget(canDrop(target) ? target!.id : null);
  };
  const end = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current; drag.current = null;
    setGhost(null); setDropTarget(null);
    if (!current?.moved) return;
    // Swallow only the click the browser may fire for this same drag; a drop on another stall fires none.
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
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
    const { x, y } = rect;
    const doorAtBottom = rect.doorSide === 'bottom';
    const doorY = doorAtBottom ? y + STALL_H : y;
    if (!box) return <g key={`${rect.rowNo}-${rect.columnNo}`}><rect className={styles.stallEmpty} x={x + 4} y={y + 4} width={STALL_W - 8} height={STALL_H - 8} rx={8} /></g>;
    const state = stateOf(box);
    const clickable = selectable(box);
    const label = `${box.boxCode}: ${STATE_LABEL[state]}${box.horse ? ` — ${box.horse.name}` : ''}`;
    const midX = x + STALL_W / 2;
    // Content sits away from the door edge: code row near the back wall, details towards the door.
    const top = doorAtBottom ? y : y + 8;
    return <g key={box.id} id={`box-${box.boxCode}`} data-box-id={box.id} data-state={state}
      data-highlight={highlight === box.boxCode || undefined} data-drop={dropTarget === box.id || undefined}
      className={styles.stall} role={clickable ? 'button' : 'img'} tabIndex={clickable ? 0 : undefined} aria-label={label}
      onClick={() => activate(box)} onKeyDown={key(box)} onPointerDown={start(box)}
      style={{ cursor: onMove && box.horse ? 'grab' : clickable ? 'pointer' : 'default' }}>
      <title>{label}</title>
      <rect className={styles.stallFloor} x={x + 4} y={y + 4} width={STALL_W - 8} height={STALL_H - 8} rx={8}
        style={state === 'maintenance' ? { fill: `url(#${patternId})` } : undefined} />
      <rect className={styles.dropOverlay} x={x + 4} y={y + 4} width={STALL_W - 8} height={STALL_H - 8} rx={8} />
      {/* sliding stall door: an opening in the aisle wall with the door leaf drawn beside it */}
      <line className={styles.doorOpening} x1={x + 18} x2={x + STALL_W - 18} y1={doorY} y2={doorY} />
      <line className={styles.doorLeaf} x1={x + 14} x2={x + STALL_W / 2 + 4} y1={doorY + (doorAtBottom ? -3 : 3)} y2={doorY + (doorAtBottom ? -3 : 3)} />
      <text className={styles.stallCode} x={x + 11} y={top + 20}>{box.boxCode}</text>
      <circle className={styles.statusDot} cx={x + STALL_W - 15} cy={top + 16} r={4} />
      {state === 'occupied' && box.horse && <>
        <HorseAvatar cx={midX} cy={top + 46} />
        <text className={styles.stallName} x={midX} y={top + 78} textAnchor="middle">{short(box.horse.name)}</text>
        <text className={styles.stallSub} x={midX} y={top + 90} textAnchor="middle">{box.horse.horseCode}</text>
      </>}
      {state === 'free' && <>
        <circle className={styles.emptyRing} cx={midX} cy={top + 46} r={18} />
        <text className={styles.stallState} x={midX} y={top + 82} textAnchor="middle">Còn trống</text>
      </>}
      {state === 'maintenance' && <>
        <circle className={styles.maintRing} cx={midX} cy={top + 46} r={18} />
        <path className={styles.maintIcon} d={`M ${midX - 7} ${top + 53} L ${midX + 3} ${top + 43} M ${midX + 1} ${top + 39} a 5 5 0 1 0 6 6`} />
        <text className={styles.stallState} x={midX} y={top + 82} textAnchor="middle">Bảo trì</text>
      </>}
    </g>;
  };

  return <svg ref={svgRef} className={styles.floorPlan} viewBox={`0 0 ${plan.width} ${plan.height}`} width="100%"
    style={{ maxWidth: plan.width }} role="group" aria-label={`Mặt bằng ${yard.name}: ${yard.rowCount} dãy × ${yard.columnCount} ô`}
    onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; setGhost(null); setDropTarget(null); }}>
    <defs>
      <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="10" height="10" className={styles.hatchBase} /><rect width="3" height="10" className={styles.hatchLine} />
      </pattern>
      <filter id={shadowId} x="-3%" y="-6%" width="106%" height="116%">
        <feDropShadow dx="0" dy="2" stdDeviation="5" floodOpacity="0.10" />
      </filter>
    </defs>
    <rect className={styles.barnWall} x={WALL / 2} y={WALL / 2} width={plan.width - WALL} height={plan.height - WALL} rx={10} filter={`url(#${shadowId})`} />
    <rect className={styles.barnInside} x={plan.inner.x} y={plan.inner.y} width={plan.inner.width} height={plan.inner.height} rx={4} />
    {plan.aisles.map((aisle, index) => <g key={index}>
      <rect className={styles.aisle} x={aisle.x} y={aisle.y} width={aisle.width} height={aisle.height} />
      <line className={styles.aisleLine} x1={aisle.x + 70} x2={aisle.x + aisle.width - 40} y1={aisle.y + AISLE_H / 2} y2={aisle.y + AISLE_H / 2} />
      <rect className={styles.aisle} x={aisle.x + aisle.width / 2 - 34} y={aisle.y + AISLE_H / 2 - 9} width={68} height={18} />
      <text className={styles.aisleText} x={aisle.x + aisle.width / 2} y={aisle.y + AISLE_H / 2 + 4} textAnchor="middle">Lối đi</text>
      {/* sliding barn doors at both aisle ends */}
      {[1.5, plan.width - 1.5].map((gateX) => <g key={gateX} className={styles.gate}>
        <line x1={gateX} x2={gateX} y1={aisle.y + 6} y2={aisle.y + AISLE_H - 6} />
      </g>)}
      <text className={styles.gateText} x={WALL + 6} y={aisle.y + AISLE_H / 2 + 4}>Cửa</text>
    </g>)}
    {plan.stalls.filter((rect) => rect.columnNo === 1).map((rect) => <text key={`row-${rect.rowNo}`} className={styles.rowText}
      x={WALL + 28} y={rect.y + STALL_H / 2 + 4} textAnchor="middle">{`Dãy ${rowLetter(rect.rowNo)}`}</text>)}
    {plan.stalls.map(stall)}
    {ghost && <g className={styles.ghost} pointerEvents="none">
      <HorseAvatar cx={ghost.x} cy={ghost.y} />
      <rect className={styles.ghostPill} x={ghost.x - (ghost.name.length * 3.4 + 10)} y={ghost.y + 21} width={ghost.name.length * 6.8 + 20} height={18} rx={9} />
      <text x={ghost.x} y={ghost.y + 34} textAnchor="middle">{ghost.name}</text>
    </g>}
  </svg>;
}
