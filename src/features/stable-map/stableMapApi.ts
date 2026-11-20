import { requestApi } from '../../shared/auth/authApi';
import type { GridBox } from './StableYardGrid';

/** DEC-016 stable layout contract (GET /api/stable-map, POST /api/stable-yards, PATCH /api/stable-boxes/{id}/status). */
export type BoxOperatingStatus = 'ACTIVE' | 'MAINTENANCE';
export interface MapHorse { id: number; horseCode: string; name: string; lifecycle: string }
export interface MapBox { id: number; boxCode: string; rowNo: number; columnNo: number; boxStatus: BoxOperatingStatus; horse: MapHorse | null }
export interface MapYard { id: number; yardCode: string; name: string; rowCount: number; columnCount: number; occupied: number; free: number; maintenance: number; boxes: MapBox[] }
export interface OutsideBox { id: number; boxCode: string; horse: MapHorse }
export interface StableMap {
  totalCapacity: number; activeBoxes: number; occupied: number; free: number; maintenance: number;
  limits: { maxYards: number; maxRows: number; maxColumns: number };
  yards: MapYard[]; outsideLayout: OutsideBox[];
}
export interface CreateYardBody { yardCode: string; name: string; rowCount: number; columnCount: number }

export function createStableMapApi(token: string, onError: (cause: unknown) => boolean) {
  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    try {
      return await requestApi<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { token });
    } catch (cause) { onError(cause); throw cause; }
  }
  return {
    map: () => call<StableMap>('/api/stable-map'),
    createYard: (body: CreateYardBody) => call<StableMap>('/api/stable-yards', 'POST', body),
    setBoxStatus: (boxId: number, status: BoxOperatingStatus, reason: string) =>
      call<StableMap>(`/api/stable-boxes/${boxId}/status`, 'PATCH', { status, reason }),
  };
}
export type StableMapApi = ReturnType<typeof createStableMapApi>;

export function toGridBox(box: MapBox): GridBox {
  return {
    id: box.id, boxCode: box.boxCode, rowNo: box.rowNo, columnNo: box.columnNo,
    state: box.horse ? 'occupied' : box.boxStatus === 'MAINTENANCE' ? 'maintenance' : 'free',
    horseName: box.horse?.name, horseCode: box.horse?.horseCode,
  };
}

/** Cells in row-major order with empty slots filled, so the grid always shows rows x columns. */
export function gridCells<T extends { rowNo: number; columnNo: number }>(rowCount: number, columnCount: number, boxes: T[]): (T | null)[] {
  const byPosition = new Map(boxes.map((box) => [`${box.rowNo}:${box.columnNo}`, box]));
  const cells: (T | null)[] = [];
  for (let row = 1; row <= rowCount; row++) for (let column = 1; column <= columnCount; column++) cells.push(byPosition.get(`${row}:${column}`) ?? null);
  return cells;
}
