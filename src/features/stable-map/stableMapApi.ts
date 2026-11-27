import { requestApi } from '../../shared/auth/authApi';
import type { GridBox } from './StableYardGrid';
import { clubDate } from '../../shared/clubCalendar';

/** DEC-016 stable layout contract (GET /api/stable-map, POST /api/stable-yards, PATCH /api/stable-boxes/{id}/status). */
export type BoxOperatingStatus = 'ACTIVE' | 'MAINTENANCE';
export type HorseHealth = 'FIT' | 'MONITORING' | 'INJURED' | 'QUARANTINED';
/** healthStatus: horse summary status from GET /api/stable-map; absent on an older backend, null when not assessed. */
export interface MapHorse { id: number; horseCode: string; name: string; lifecycle: string; healthStatus?: HorseHealth | null }
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
    /** The horse leaves the stable from today; the box is free at once and history is kept. */
    releaseBox: (boxId: number, reason: string) => call<StableMap>(`/api/stable-boxes/${boxId}/release`, 'POST', { reason }),
    /** Move a horse to another box from today (existing Flow 1 API: the old stay ends yesterday), then reload the map. */
    moveHorse: async (horseId: number, toBoxId: number, reason: string) => {
      await call<unknown>(`/api/horses/${horseId}/stable-assignments`, 'POST', { stableBoxId: toBoxId, effectiveFrom: clubDate(), reason });
      return call<StableMap>('/api/stable-map');
    },
  };
}
export type StableMapApi = ReturnType<typeof createStableMapApi>;

export function toGridBox(box: MapBox): GridBox {
  return {
    id: box.id, boxCode: box.boxCode, rowNo: box.rowNo, columnNo: box.columnNo,
    state: box.horse ? 'occupied' : box.boxStatus === 'MAINTENANCE' ? 'maintenance' : 'free',
    horseName: box.horse?.name, horseCode: box.horse?.horseCode, health: box.horse ? healthOf(box.horse) : undefined,
  };
}

/** Cells in row-major order with empty slots filled, so the grid always shows rows x columns. */
export function gridCells<T extends { rowNo: number; columnNo: number }>(rowCount: number, columnCount: number, boxes: T[]): (T | null)[] {
  const byPosition = new Map(boxes.map((box) => [`${box.rowNo}:${box.columnNo}`, box]));
  const cells: (T | null)[] = [];
  for (let row = 1; row <= rowCount; row++) for (let column = 1; column <= columnCount; column++) cells.push(byPosition.get(`${row}:${column}`) ?? null);
  return cells;
}

export const HEALTH_LABEL: Record<HorseHealth, string> = { FIT: 'Khỏe mạnh', MONITORING: 'Đang theo dõi', INJURED: 'Chấn thương', QUARANTINED: 'Cách ly' };
/** Health shown on the map: the horse's summary status, or "unknown" when it has not been assessed (or is not sent). */
export type HealthKey = HorseHealth | 'UNKNOWN';
export const healthOf = (horse: MapHorse | null | undefined): HealthKey => horse?.healthStatus ?? 'UNKNOWN';
export const healthLabel = (key: HealthKey) => key === 'UNKNOWN' ? 'Chưa đánh giá sức khỏe' : HEALTH_LABEL[key];

/** Quick filters of the stable map. "attention" = a horse that is monitored, injured or quarantined. */
export type MapFilter = 'all' | 'occupied' | 'free' | 'maintenance' | 'attention';
const needsAttention = (box: MapBox) => !!box.horse && ['MONITORING', 'INJURED', 'QUARANTINED'].includes(box.horse.healthStatus ?? '');
export function matchesFilter(box: MapBox, filter: MapFilter): boolean {
  switch (filter) {
    case 'occupied': return !!box.horse;
    case 'free': return !box.horse && box.boxStatus === 'ACTIVE';
    case 'maintenance': return !box.horse && box.boxStatus === 'MAINTENANCE';
    case 'attention': return needsAttention(box);
    default: return true;
  }
}

/** Lower case without Vietnamese diacritics, so "hoang kim" finds "Hoàng Kim" and "a06" finds "A-06". */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
export function matchesQuery(box: MapBox, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return [box.boxCode, box.horse?.name, box.horse?.horseCode].some((value) => value && normalizeSearch(value).includes(needle));
}
