import { useEffect, useState } from 'react';
import { clubDate } from './clubCalendar';

/** Roll over at club midnight and catch up when a sleeping browser returns. */
export function useClubToday() {
  const [today, setToday] = useState(clubDate);
  useEffect(() => {
    const update = () => setToday(clubDate());
    const nextMidnight = Date.parse(`${today}T00:00:00+07:00`) + 86400000;
    const timer = window.setTimeout(update, Math.max(1, nextMidnight - Date.now() + 50));
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [today]);
  return today;
}
