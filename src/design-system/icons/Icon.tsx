import type { CSSProperties } from 'react';
import type { IconName } from './iconNames';
import styles from './Icon.module.css';

export type { IconName } from './iconNames';

const urls = import.meta.glob<string>('./svg/*.svg', { eager: true, query: '?url', import: 'default' });

function iconUrl(name: IconName): string {
  return urls[`./svg/${name}.svg`];
}

export interface IconProps {
  name: IconName;
  /** Rendered size in px. Figma uses 14 (badges), 16, 20 (nav, inputs) and 24. */
  size?: number;
  className?: string;
  /** Accessible label. Omit for decorative icons that sit next to a text label. */
  label?: string;
}

/**
 * Renders a Figma icon (./svg holds the exported assets, unmodified) as a CSS mask, so the exact geometry is
 * kept while the colour follows `currentColor` (status colours come from tokens).
 */
export function Icon({ name, size = 24, className, label }: IconProps) {
  const url = iconUrl(name);
  const style = {
    width: size,
    height: size,
    WebkitMaskImage: `url("${url}")`,
    maskImage: `url("${url}")`,
  } as CSSProperties;
  return (
    <span
      className={className ? `${styles.icon} ${className}` : styles.icon}
      style={style}
      data-icon={name}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
