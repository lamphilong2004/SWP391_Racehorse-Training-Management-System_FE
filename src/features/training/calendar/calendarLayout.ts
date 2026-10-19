import type { CalendarSession } from '../assigned/supportingApi';

export const CALENDAR_HOUR_HEIGHT = 64;
export const CALENDAR_CARD_HEIGHT = 112;
export const CALENDAR_LANE_WIDTH = 150;
export interface CalendarPlacement {
  session: CalendarSession;
  minute: number;
  height: number;
  lane: number;
  lanes: number;
}

/** Partition visible card intervals, including their minimum readable height.
 * The start remains the server's time; minimum height is only a display size.
 */
export function calendarLayout(sessions: CalendarSession[]): CalendarPlacement[] {
  const entries = sessions.map((session) => {
    const start = new Date(session.scheduledStart);
    const end = session.scheduledEnd ? Date.parse(session.scheduledEnd) : NaN;
    const duration = Number.isFinite(end) ? Math.max(0, (end - start.getTime()) / 60000) : 0;
    return { session, minute: start.getHours() * 60 + start.getMinutes(), height: Math.max(CALENDAR_CARD_HEIGHT, duration / 60 * CALENDAR_HOUR_HEIGHT), lane: 0, lanes: 1 };
  }).sort((a, b) => a.minute - b.minute || a.session.id - b.session.id);
  let group: CalendarPlacement[] = [], laneEnds: number[] = [], groupEnd = -Infinity;
  function finishGroup() {
    group.forEach((entry) => { entry.lanes = laneEnds.length; });
    group = []; laneEnds = []; groupEnd = -Infinity;
  }
  for (const entry of entries) {
    const top = entry.minute / 60 * CALENDAR_HOUR_HEIGHT;
    if (top >= groupEnd) finishGroup();
    let lane = laneEnds.findIndex((end) => end <= top);
    if (lane < 0) lane = laneEnds.length;
    entry.lane = lane;
    laneEnds[lane] = top + entry.height;
    groupEnd = Math.max(groupEnd, laneEnds[lane]);
    group.push(entry);
  }
  finishGroup();
  return entries;
}
