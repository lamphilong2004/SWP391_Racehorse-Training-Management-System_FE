import { useId, useRef, type KeyboardEvent } from 'react';
import { cx } from '../../utils/cx';
import styles from './Tabs.module.css';

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for tab/panel ids so a panel can use `aria-labelledby={`${idPrefix}-tab-${value}`}`. */
  idPrefix?: string;
  className?: string;
}

/** Figma Tabs (71:108): underline style, 44px, active = Body Strong + 2px primary underline. */
export function Tabs({ items, value, onChange, label, idPrefix, className }: TabsProps) {
  const autoId = useId();
  const prefix = idPrefix ?? autoId;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const next = (index + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight') focusTab(index + 1);
    else if (event.key === 'ArrowLeft') focusTab(index - 1);
    else if (event.key === 'Home') focusTab(0);
    else if (event.key === 'End') focusTab(items.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div role="tablist" aria-label={label} className={cx(styles.bar, className)}>
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={`${prefix}-tab-${item.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${prefix}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.tab, selected && styles.active)}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
