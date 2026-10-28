/** Club scheduling is in Vietnam time, even when the browser uses another timezone. */
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function clubDateTime(value = new Date()): string {
  const parts = Object.fromEntries(formatter.formatToParts(value).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function clubDate(value = new Date()): string { return clubDateTime(value).slice(0, 10); }

export function parseClubDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const result = new Date(`${value}:00+07:00`);
  return Number.isFinite(result.getTime()) && clubDateTime(result) === value ? result : null;
}

export function sessionPeriodError(start: Date, end?: Date, phase?: { startDate: string; endDate: string }, program?: { periodStart: string; periodEnd: string }, now = new Date()): string | null {
  if (start.getTime() <= now.getTime()) return 'Giờ bắt đầu phải ở tương lai, tính theo giờ Việt Nam. Hãy chọn giờ khác.';
  const dates = [clubDate(start), ...(end ? [clubDate(end)] : [])];
  if (phase && dates.some((date) => date < phase.startDate || date > phase.endDate)) return 'Cả giờ bắt đầu và kết thúc phải nằm trong thời gian giai đoạn.';
  if (program && dates.some((date) => date < program.periodStart || date > program.periodEnd)) return 'Cả giờ bắt đầu và kết thúc phải nằm trong thời gian chương trình.';
  return null;
}
