import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartContainer } from '../../design-system';
import { WeightHistoryChart } from './WeightHistoryChart';
import { prepareWeightHistory, weightAxisTicks } from './weightHistory';

describe('weight history chart', () => {
  it('shows an honest empty state when no weight has been recorded', () => {
    render(<WeightHistoryChart records={[]} />);
    expect(screen.getByText('Chưa có bản ghi cân nặng')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Lịch sử cân nặng' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.seriesPoint')).toHaveLength(0);
  });

  it('renders one point and its history with kg and Vietnam local time', () => {
    render(<WeightHistoryChart records={[{ weightKg: 421.25, recordedAt: '2026-11-09T03:00:00.000Z' }]} />);
    expect(screen.getByText('421.25 kg')).toBeInTheDocument();
    expect(screen.getByText(/10:00 9 thg 11, 2026/)).toBeInTheDocument();
    const markers = document.querySelectorAll('.seriesPoint');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveStyle({ left: '50%', top: '96.25px' });
    expect(screen.getByRole('list', { name: 'Lịch sử cân nặng' })).toBeInTheDocument();
  });

  it('keeps a single timestamp tick when multiple readings share the same time', () => {
    render(<WeightHistoryChart records={[
      { weightKg: 421, recordedAt: '2026-11-09T03:00:00.000Z' },
      { weightKg: 422, recordedAt: '2026-11-09T03:00:00.000Z' },
    ]} />);
    expect(document.querySelectorAll('.xAxisTick')).toHaveLength(1);
    const markers = document.querySelectorAll('.seriesPoint');
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveStyle({ left: '50%' });
    expect(markers[1]).toHaveStyle({ left: '50%' });
  });

  it('sorts newest-first input chronologically and plots irregular timestamp gaps proportionally', () => {
    const records = [
      { weightKg: 425, recordedAt: '2026-11-09T10:00:00.000Z' },
      { weightKg: 422, recordedAt: '2026-11-09T02:00:00.000Z' },
      { weightKg: 421, recordedAt: '2026-11-09T02:00:00.000Z' },
      { weightKg: 420, recordedAt: '2026-11-09T01:00:00.000Z' },
    ];
    const prepared = prepareWeightHistory(records);
    expect(prepared.records.map((record) => record.weightKg)).toEqual([420, 422, 421, 425]);
    render(<WeightHistoryChart records={records} />);
    const list = screen.getByRole('list', { name: 'Lịch sử cân nặng' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent?.match(/\d+(?:\.\d+)? kg/)?.[0])).toEqual(['425 kg', '422 kg', '421 kg', '420 kg']);
    const series = document.querySelector('polyline');
    expect(series?.getAttribute('points')).toMatch(/^0,[^ ]+ 11\.11111111111111,[^ ]+ 11\.11111111111111,[^ ]+ 100,/);
    const markers = document.querySelectorAll<HTMLElement>('.seriesPoint');
    const points = series!.getAttribute('points')!.split(' ').map((point) => point.split(',').map(Number));
    expect(markers).toHaveLength(points.length);
    markers.forEach((marker, index) => {
      expect(parseFloat(marker.style.left)).toBeCloseTo(points[index][0]);
      expect(parseFloat(marker.style.top)).toBeCloseTo(points[index][1]);
    });
  });

  it('ignores malformed dates without crashing and keeps axis bounds around real weights', () => {
    const prepared = prepareWeightHistory([
      { weightKg: 420, recordedAt: 'not-a-date' },
      { weightKg: 0, recordedAt: '2026-11-09T00:00:00Z' },
      { weightKg: 512.5, recordedAt: '2026-11-10T00:00:00Z' },
    ]);
    expect(prepared.invalidCount).toBe(2);
    expect(prepared.records).toHaveLength(1);
    const ticks = weightAxisTicks([512.5]);
    expect(ticks[0]).toBeGreaterThan(512.5);
    expect(ticks[ticks.length - 1]).toBeLessThan(512.5);
    render(<WeightHistoryChart records={[{ weightKg: 512.5, recordedAt: 'invalid' }]} />);
    expect(screen.getByText(/không hợp lệ nên không được vẽ/)).toBeInTheDocument();
    expect(screen.getByText('Chưa có bản ghi cân nặng')).toBeInTheDocument();
  });

  it('keeps evenly-spaced plots for existing consumers without timestamp coordinates', () => {
    render(<ChartContainer title="Example" seriesLabel="Series" values={[1, 2, 3]} yTicks={[4, 3, 2, 1, 0]} xLabels={['A', 'B', 'C']} />);
    expect(document.querySelector('polyline')?.getAttribute('points')).toMatch(/^0,[^ ]+ 50,[^ ]+ 100,/);
    const markers = document.querySelectorAll<HTMLElement>('.seriesPoint');
    expect(Array.from(markers, (marker) => marker.style.left)).toEqual(['0%', '50%', '100%']);
    const axis = document.querySelector('.xAxis');
    expect(axis?.className).not.toContain('timedAxis');
    expect(within(axis as HTMLElement).getByText('A')).not.toHaveAttribute('style');
  });

  it('marks the intermediate timestamp tick so narrow layouts can remove it without shifting endpoints', () => {
    render(<ChartContainer
      title="Timed"
      seriesLabel="Weights"
      values={[420, 421, 422]}
      xValues={[0, 5, 10]}
      xAxisTicks={[{ value: 0, label: '01/11' }, { value: 5, label: '06/11' }, { value: 10, label: '11/11' }]}
      yTicks={[430, 425, 420, 415, 410]}
      xLabels={[]}
    />);
    const ticks = document.querySelectorAll('.xAxisTick');
    expect(ticks).toHaveLength(3);
    expect(ticks[1].className).toContain('xAxisTickMiddle');
    expect(ticks[0]).toHaveStyle({ left: '0%' });
    expect(ticks[2]).toHaveStyle({ left: '100%' });
  });
});
