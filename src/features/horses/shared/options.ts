import type { SelectOption } from '../../../design-system';

/**
 * Display suggestions for Figma 282:2377. The contract's sex/breed fields remain free text;
 * RegisterHorsePage also permits custom values and does not treat these as a closed vocabulary.
 */
export const SEX_OPTIONS: SelectOption[] = ['Colt', 'Filly', 'Stallion', 'Mare', 'Gelding'].map((v) => ({ value: v, label: v }));

/** Stored sex is free text and often upper case (MALE); show it in title case without changing the value. */
export function sexLabel(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim().toLowerCase().replace(/(^|[\s/-])\p{L}/gu, (letter) => letter.toUpperCase()) : null;
}

export const BREED_OPTIONS: SelectOption[] = ['Thoroughbred', 'Arabian', 'Quarter Horse', 'Standardbred']
  .map((v) => ({ value: v, label: v }));
