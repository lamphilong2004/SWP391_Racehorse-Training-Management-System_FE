import type { WeightRecord } from './baselineApi';

export type WeightHistoryEntry = Pick<WeightRecord, 'weightKg' | 'recordedAt'>;

export function prepareWeightHistory(records: readonly WeightHistoryEntry[]) {
  const valid: (WeightHistoryEntry & { timestamp: number })[] = [];
  let invalidCount = 0;
  for (const record of records) {
    const timestamp = Date.parse(record.recordedAt);
    if (!Number.isFinite(record.weightKg) || record.weightKg <= 0 || !Number.isFinite(timestamp)) {
      invalidCount += 1;
    } else {
      valid.push({ ...record, timestamp });
    }
  }
  valid.sort((a, b) => a.timestamp - b.timestamp);
  return { records: valid, invalidCount };
}

export function weightAxisTicks(values: readonly number[]) {
  if (!values.length) return [5, 4, 3, 2, 1, 0];
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const spread = maximum - minimum || Math.max(maximum * 0.1, 1);
  const lower = Math.max(0, minimum - spread * 0.15), upper = maximum + spread * 0.15;
  const rawStep = (upper - lower) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const scaled = rawStep / magnitude;
  const step = (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * magnitude;
  const first = Math.floor(lower / step) * step;
  const last = Math.ceil(upper / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= last + step * 0.001; tick += step) ticks.push(Number(tick.toPrecision(8)));
  return ticks.reverse();
}
