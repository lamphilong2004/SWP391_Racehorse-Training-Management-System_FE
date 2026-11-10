import { Icon } from '../../icons/Icon';
import { cx } from '../../utils/cx';
import styles from './ChartContainer.module.css';

export interface ChartThreshold {
  value: number;
  /** End label, e.g. "Threshold 180 bpm". */
  label: string;
  /** Legend entry, defaults to "Threshold". */
  legend?: string;
}

export interface ChartContainerProps {
  title: string;
  /** Legend label of the series line. */
  seriesLabel: string;
  /** Values plotted left → right. Provide xValues to preserve real timestamp spacing; empty = Empty state. */
  values: number[];
  /** Optional timestamps for values, used to plot observations at their actual time intervals. */
  xValues?: number[];
  /** Y axis ticks, top → bottom (e.g. [190, 170, 150, 130, 110]). The first/last tick bound the plot. */
  yTicks: number[];
  /** X axis labels, spread evenly when xAxisTicks is omitted (e.g. ['0 min', '4', '8', '12', '16 min']). */
  xLabels: string[];
  /** Optional timestamp ticks; when present, labels are positioned proportionally to their actual time. */
  xAxisTicks?: { value: number; label: string }[];
  threshold?: ChartThreshold;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

/* Plot geometry from Figma Chart Container 73:272: axis gutter 40, plot 220 tall starting 20 below the top. */
const PLOT_TOP = 20;
const PLOT_HEIGHT = 220;

/**
 * Figma Chart Container (73:272): title + legend; series 2px primary; threshold 1.5px dashed danger with an end
 * label; Empty state never renders zeroes.
 */
export function ChartContainer({
  title,
  seriesLabel,
  values,
  xValues,
  yTicks,
  xLabels,
  xAxisTicks,
  threshold,
  emptyTitle = 'Không có dữ liệu trong khoảng thời gian này',
  emptyDescription = 'Dữ liệu đo sẽ hiện ở đây khi buổi tập bắt đầu ghi nhận.',
  className,
}: ChartContainerProps) {
  const max = Math.max(...yTicks);
  const min = Math.min(...yTicks);
  const toY = (value: number) => PLOT_TOP + ((max - value) / (max - min || 1)) * PLOT_HEIGHT;
  const isEmpty = values.length === 0;
  const timed = xValues?.length === values.length && xValues.every(Number.isFinite);
  const timeMin = timed ? Math.min(...xValues) : 0;
  const timeMax = timed ? Math.max(...xValues) : 0;
  const xPercent = (index: number) => timed
    ? timeMax === timeMin ? 50 : ((xValues[index] - timeMin) / (timeMax - timeMin)) * 100
    : values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
  const points = values
    .map((value, index) => `${xPercent(index)},${toY(value) - PLOT_TOP}`)
    .join(' ');
  const thresholdTop = threshold ? toY(threshold.value) : 0;
  const timeTicks = timed && xAxisTicks?.length ? xAxisTicks : undefined;
  const timedAxis = Boolean(timeTicks);
  const axisTicks = timeTicks
    ? timeTicks.filter((tick) => Number.isFinite(tick.value)).map((tick) => ({
      ...tick,
      position: timeMax === timeMin ? 50 : Math.max(0, Math.min(100, ((tick.value - timeMin) / (timeMax - timeMin)) * 100)),
    }))
    : [];

  return (
    <figure className={cx(styles.card, className)}>
      <figcaption className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.legend}>
          <span className={styles.legendItem}>
            <svg width="16" height="2" aria-hidden="true">
              <line x1="0" y1="1" x2="16" y2="1" className={styles.seriesStroke} />
            </svg>
            {seriesLabel}
          </span>
          {threshold && (
            <span className={styles.legendItem}>
              <svg width="16" height="2" aria-hidden="true">
                <line x1="0" y1="1" x2="16" y2="1" className={styles.legendThresholdStroke} />
              </svg>
              {threshold.legend ?? 'Ngưỡng'}
            </span>
          )}
        </span>
      </figcaption>

      <div className={styles.plot}>
        {yTicks.map((tick) => (
          <div key={tick} className={styles.tickRow} style={{ top: toY(tick) }}>
            <span className={styles.tickLabel}>{tick}</span>
            <span className={styles.gridline} />
          </div>
        ))}

        {isEmpty ? (
          <div className={styles.empty}>
            <Icon name="bar-chart" size={32} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>{emptyTitle}</p>
            <p className={styles.emptyDescription}>{emptyDescription}</p>
          </div>
        ) : (
          <>
            <svg
              className={styles.series}
              style={{ top: PLOT_TOP, height: PLOT_HEIGHT }}
              viewBox={`0 0 100 ${PLOT_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${seriesLabel}: ${values.join(', ')}`}
            >
              <polyline points={points} className={styles.seriesStroke} />
            </svg>
            <div className={styles.seriesMarkers} style={{ top: PLOT_TOP, height: PLOT_HEIGHT }} aria-hidden="true">
              {values.map((value, index) => (
                <span
                  key={`${index}-${value}`}
                  className={styles.seriesPoint}
                  style={{ left: `${xPercent(index)}%`, top: toY(value) - PLOT_TOP }}
                />
              ))}
            </div>
            {threshold && (
              <>
                <svg className={styles.threshold} style={{ top: thresholdTop - 1 }} height="2" aria-hidden="true">
                  <line x1="0" y1="1" x2="100%" y2="1" className={styles.thresholdStroke} />
                </svg>
                <span className={styles.thresholdLabel} style={{ top: thresholdTop - 19 }}>
                  {threshold.label}
                </span>
              </>
            )}
          </>
        )}
      </div>

      <div className={timedAxis ? `${styles.xAxis} ${styles.timedAxis}` : styles.xAxis}>
        {timedAxis
          ? axisTicks.map(({ label, position }, index) => (
            <span
              key={`${index}-${label}`}
              className={`${styles.xAxisTick}${index > 0 && index < axisTicks.length - 1 ? ` ${styles.xAxisTickMiddle}` : ''}`}
              style={{ left: `${position}%`, transform: `translateX(${position <= 0 ? '0' : position >= 100 ? '-100%' : '-50%'})` }}
              title={label}
            >
              {label}
            </span>
          ))
          : xLabels.map((label, index) => (
            <span key={`${index}-${label}`}>{label}</span>
          ))}
      </div>
    </figure>
  );
}
