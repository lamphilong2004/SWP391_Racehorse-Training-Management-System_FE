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
  /** Values plotted left → right at even spacing. Empty = Empty state (never rendered as zeroes). */
  values: number[];
  /** Y axis ticks, top → bottom (e.g. [190, 170, 150, 130, 110]). The first/last tick bound the plot. */
  yTicks: number[];
  /** X axis labels, spread evenly (e.g. ['0 min', '4', '8', '12', '16 min']). */
  xLabels: string[];
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
  yTicks,
  xLabels,
  threshold,
  emptyTitle = 'No data for this period',
  emptyDescription = 'Samples will appear here once the session records data.',
  className,
}: ChartContainerProps) {
  const max = Math.max(...yTicks);
  const min = Math.min(...yTicks);
  const toY = (value: number) => PLOT_TOP + ((max - value) / (max - min || 1)) * PLOT_HEIGHT;
  const isEmpty = values.length === 0;
  const points = values
    .map((value, index) => `${values.length === 1 ? 0 : (index / (values.length - 1)) * 100},${toY(value) - PLOT_TOP}`)
    .join(' ');
  const thresholdTop = threshold ? toY(threshold.value) : 0;

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
              {threshold.legend ?? 'Threshold'}
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

      <div className={styles.xAxis}>
        {xLabels.map((label, index) => (
          // Axis labels can repeat (two samples in the same minute); position keeps keys unique.
          <span key={`${index}-${label}`}>{label}</span>
        ))}
      </div>
    </figure>
  );
}
