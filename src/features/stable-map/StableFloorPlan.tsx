import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { AISLE_H, floorPlan, rowLetter, STALL_H, STALL_W, WALL, type StallRect } from './floorPlanGeometry';
import type { MapBox, MapYard } from './stableMapApi';
import styles from './stableMap.module.css';

type StallState = 'free' | 'occupied' | 'maintenance';
const stateOf = (box: MapBox): StallState => box.horse ? 'occupied' : box.boxStatus === 'MAINTENANCE' ? 'maintenance' : 'free';
const STATE_LABEL: Record<StallState, string> = { free: 'Còn trống', occupied: 'Có ngựa', maintenance: 'Đang bảo trì' };
const short = (name: string, max = 10) => name.length > max ? `${name.slice(0, max - 1)}…` : name;

/**
 * A bay horse standing in the stall, drawn from the side so it reads as a horse at a glance (four legs, raised neck,
 * head with ear and muzzle, mane and tail). Local units: body centred on (0, 0), hooves on y = 26; scaled to fit
 * between the back-wall fittings and the door plate.
 */
function Horse({ cx, cy }: { cx: number; cy: number }) {
  return <g className={styles.horse} transform={`translate(${cx} ${cy}) scale(0.82)`} aria-hidden="true">
    <ellipse className={styles.horseShadow} cx={2} cy={27} rx={27} ry={3.2} />
    <path className={styles.horseTail} d="M -22 -6 Q -33 0 -31 17" />
    {/* far legs (darker), then the body, then the near legs */}
    <path className={styles.horseLegFar} d="M -14 4 L -13 25 M 15 4 L 16 25" />
    <ellipse className={styles.horseBody} cx={0} cy={-1} rx={24} ry={11} />
    <path className={styles.horseBody} d="M 12 -9 Q 18 -16 23 -29 L 31 -27 Q 27 -14 22 2 Z" />
    <ellipse className={styles.horseBody} cx={31} cy={-24} rx={10.5} ry={5.6} transform="rotate(32 31 -24)" />
    <ellipse className={styles.horseMuzzle} cx={38} cy={-19} rx={3.6} ry={3.2} />
    <path className={styles.horseEar} d="M 23 -30 L 24.5 -38 L 28 -30 Z" />
    <circle className={styles.horseEye} cx={30} cy={-26} r={1.3} />
    <path className={styles.horseMane} d="M 13 -10 Q 19 -19 23.5 -30" />
    <path className={styles.horseLeg} d="M -18 5 L -19 25 M 10 6 L 11 25" />
    <path className={styles.horseHoof} d="M -21.5 25.5 L -16.5 25.5 M 8.5 25.5 L 13.5 25.5" />
  </g>;
}

/** Orange traffic cone for a stall under maintenance. */
function Cone({ cx, cy }: { cx: number; cy: number }) {
  return <g className={styles.cone} aria-hidden="true">
    <rect x={cx - 11} y={cy + 9} width={22} height={4} rx={1.5} />
    <path d={`M ${cx - 8} ${cy + 9} L ${cx - 2} ${cy - 13} L ${cx + 2} ${cy - 13} L ${cx + 8} ${cy + 9} Z`} />
    <path className={styles.coneStripe} d={`M ${cx - 5.2} ${cy - 1} L ${cx + 5.2} ${cy - 1} L ${cx + 4.2} ${cy - 5} L ${cx - 4.2} ${cy - 5} Z`} />
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
 * DEC-016 2D floor plan of one yard, drawn as a shed-row barn seen from above: timber outer walls, a concrete aisle
 * with sliding barn doors at both ends, and stalls facing the aisle. Each stall has straw bedding, wooden partitions,
 * a barred sliding door on the aisle side, a code sign on the back wall, a hay rack and a water bucket; the horse in it
 * is drawn facing the door with its name on the door plate. A Club Manager can drag a horse onto a free stall; the page
 * confirms the move before calling the API.
 */
export function StableFloorPlan({ yard, highlight, onSelect, selectable, onMove }: StableFloorPlanProps) {
  const plan = floorPlan(yard.rowCount, yard.columnCount);
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const patternId = `hatch-${uid}`;
  const strawId = `straw-${uid}`;
  const freshStrawId = `fresh-straw-${uid}`;
  const concreteId = `concrete-${uid}`;
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
    const backY = doorAtBottom ? y : y + STALL_H;
    const doorY = doorAtBottom ? y + STALL_H : y;
    if (!box) return <g key={`${rect.rowNo}-${rect.columnNo}`}><rect className={styles.stallEmpty} x={x + 3} y={y + 3} width={STALL_W - 6} height={STALL_H - 6} rx={4} /></g>;
    const state = stateOf(box);
    const clickable = selectable(box);
    const label = `${box.boxCode}: ${STATE_LABEL[state]}${box.horse ? ` — ${box.horse.name}` : ''}`;
    const floorFill = state === 'maintenance' ? `url(#${patternId})` : state === 'occupied' ? `url(#${strawId})` : `url(#${freshStrawId})`;
    // Back-wall fittings (sign, bucket, hay rack) sit just inside the back wall; the door plate just inside the door.
    const fittingY = doorAtBottom ? y + 6 : y + STALL_H - 19;
    const plateY = doorAtBottom ? y + STALL_H - 24 : y + 9;
    const bars = Array.from({ length: 9 }, (_, index) => x + 18 + index * ((STALL_W - 36) / 8));
    return <g key={box.id} id={`box-${box.boxCode}`} data-box-id={box.id} data-state={state}
      data-highlight={highlight === box.boxCode || undefined} data-drop={dropTarget === box.id || undefined}
      className={styles.stall} role={clickable ? 'button' : 'img'} tabIndex={clickable ? 0 : undefined} aria-label={label}
      onClick={() => activate(box)} onKeyDown={key(box)} onPointerDown={start(box)}
      style={{ cursor: onMove && box.horse ? 'grab' : clickable ? 'pointer' : 'default' }}>
      <title>{label}</title>
      <rect className={styles.stallFloor} x={x + 2} y={y + 2} width={STALL_W - 4} height={STALL_H - 4} rx={2} style={{ fill: floorFill }} />
      <rect className={styles.dropOverlay} x={x + 2} y={y + 2} width={STALL_W - 4} height={STALL_H - 4} rx={2} />
      {/* wooden partitions on three sides; the fourth side is the door onto the aisle */}
      <path className={styles.partition} d={`M ${x + 2} ${doorY} L ${x + 2} ${backY} L ${x + STALL_W - 2} ${backY} L ${x + STALL_W - 2} ${doorY}`} />
      <rect className={styles.signBoard} x={x + 6} y={fittingY} width={32} height={13} rx={2.5} />
      <text className={styles.stallCode} x={x + 22} y={fittingY + 9.5} textAnchor="middle">{box.boxCode}</text>
      <circle className={styles.bucket} cx={x + 50} cy={fittingY + 6.5} r={5} />
      <circle className={styles.bucketWater} cx={x + 50} cy={fittingY + 6.5} r={3} />
      <rect className={styles.hayRack} x={x + STALL_W - 32} y={fittingY + 1} width={24} height={11} rx={2} />
      <path className={styles.hay} d={`M ${x + STALL_W - 29} ${fittingY + 9} l 4 -6 M ${x + STALL_W - 24} ${fittingY + 10} l 3 -7 M ${x + STALL_W - 19} ${fittingY + 9} l 4 -6 M ${x + STALL_W - 14} ${fittingY + 10} l 3 -7`} />
      {/* barred sliding door on the aisle side */}
      <rect className={styles.door} x={x + 12} y={doorY - 3.5} width={STALL_W - 24} height={7} rx={2} />
      {bars.map((barX) => <line key={barX} className={styles.doorBar} x1={barX} x2={barX} y1={doorY - 2.5} y2={doorY + 2.5} />)}
      {state === 'occupied' && box.horse && <Horse cx={x + STALL_W / 2 - 4} cy={doorAtBottom ? y + 53 : y + 59} />}
      {state === 'maintenance' && <Cone cx={x + STALL_W / 2} cy={y + STALL_H / 2} />}
      <rect className={styles.plate} x={x + 10} y={plateY} width={STALL_W - 20} height={15} rx={7.5} />
      <circle className={styles.plateDot} cx={x + 18} cy={plateY + 7.5} r={3} />
      <text className={state === 'occupied' ? styles.stallName : styles.stallState} x={x + 25} y={plateY + 11}>
        {box.horse ? short(box.horse.name) : state === 'maintenance' ? 'Bảo trì' : 'Trống'}
      </text>
    </g>;
  };

  return <svg ref={svgRef} className={styles.floorPlan} viewBox={`0 0 ${plan.width} ${plan.height}`} width="100%"
    style={{ maxWidth: plan.width }} role="group" aria-label={`Mặt bằng ${yard.name}: ${yard.rowCount} dãy × ${yard.columnCount} ô`}
    onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; setGhost(null); setDropTarget(null); }}>
    <defs>
      <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="12" height="12" className={styles.hatchBase} /><rect width="6" height="12" className={styles.hatchLine} />
      </pattern>
      <pattern id={strawId} width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" className={styles.strawBase} />
        <path className={styles.strawStroke} d="M 1 3 l 5 2 M 8 1 l 4 4 M 3 9 l 6 -2 M 9 10 l 4 3 M 0 13 l 4 -1" />
      </pattern>
      <pattern id={freshStrawId} width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" className={styles.freshStrawBase} />
        <path className={styles.freshStrawStroke} d="M 1 3 l 5 2 M 8 1 l 4 4 M 3 9 l 6 -2 M 9 10 l 4 3 M 0 13 l 4 -1" />
      </pattern>
      <pattern id={concreteId} width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" className={styles.concreteBase} />
        <circle cx="5" cy="6" r="0.9" className={styles.concreteDot} /><circle cx="17" cy="15" r="0.8" className={styles.concreteDot} />
        <circle cx="11" cy="20" r="0.7" className={styles.concreteDot} /><path d="M 0 0 L 24 0" className={styles.concreteJoint} />
      </pattern>
      <filter id={shadowId} x="-5%" y="-5%" width="110%" height="115%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.18" />
      </filter>
    </defs>
    <g filter={`url(#${shadowId})`}>
      <rect className={styles.barnWall} x={WALL / 2} y={WALL / 2} width={plan.width - WALL} height={plan.height - WALL} rx={8} />
    </g>
    <rect className={styles.barnInside} x={plan.inner.x} y={plan.inner.y} width={plan.inner.width} height={plan.inner.height} />
    <rect className={styles.barnTrim} x={WALL - 1.5} y={WALL - 1.5} width={plan.width - 2 * WALL + 3} height={plan.height - 2 * WALL + 3} rx={3} />
    {plan.aisles.map((aisle, index) => <g key={index}>
      <rect className={styles.aisle} x={aisle.x} y={aisle.y} width={aisle.width} height={aisle.height} style={{ fill: `url(#${concreteId})` }} />
      <line className={styles.aisleLine} x1={aisle.x + 60} x2={aisle.x + aisle.width - 60} y1={aisle.y + AISLE_H / 2} y2={aisle.y + AISLE_H / 2} />
      <text className={styles.aisleText} x={aisle.x + aisle.width / 2} y={aisle.y + AISLE_H / 2 - 7} textAnchor="middle">Lối đi</text>
      {[0, plan.width - WALL - 4].map((gateX) => <g key={gateX} className={styles.gate}>
        <rect x={gateX} y={aisle.y + 5} width={WALL + 4} height={AISLE_H - 10} rx={1.5} />
        <path d={`M ${gateX} ${aisle.y + 5} L ${gateX + WALL + 4} ${aisle.y + AISLE_H - 5} M ${gateX + WALL + 4} ${aisle.y + 5} L ${gateX} ${aisle.y + AISLE_H - 5}`} />
      </g>)}
      <text className={styles.gateText} x={WALL + 8} y={aisle.y + AISLE_H / 2 + 15}>Cửa</text>
    </g>)}
    {plan.stalls.filter((rect) => rect.columnNo === 1).map((rect) => <g key={`row-${rect.rowNo}`}>
      <rect className={styles.rowPill} x={WALL + 5} y={rect.y + STALL_H / 2 - 10} width={44} height={20} rx={10} />
      <text className={styles.rowText} x={WALL + 27} y={rect.y + STALL_H / 2 + 4} textAnchor="middle">{`Dãy ${rowLetter(rect.rowNo)}`}</text>
    </g>)}
    {plan.stalls.map(stall)}
    {ghost && <g className={styles.ghost} pointerEvents="none">
      <circle cx={ghost.x} cy={ghost.y} r={18} />
      <text x={ghost.x} y={ghost.y - 24} textAnchor="middle">{ghost.name}</text>
    </g>}
  </svg>;
}
