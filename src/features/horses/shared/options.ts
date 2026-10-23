import type { SelectOption } from '../../../design-system';
import { viLabel } from '../../../shared/viLabels';

/**
 * Display suggestions for Figma 282:2377. The contract's sex/breed fields remain free text;
 * RegisterHorsePage also permits custom values and does not treat these as a closed vocabulary.
 */
// Values stay the stored English words; labels are Vietnamese.
export const SEX_OPTIONS: SelectOption[] = ['Colt', 'Filly', 'Stallion', 'Mare', 'Gelding'].map((v) => ({ value: v, label: viLabel(v) }));

/** Stored sex is free text and often upper case (MALE); show a Vietnamese label (or title case) without changing the value. */
export function sexLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const titled = value.trim().toLowerCase().replace(/(^|[\s/-])\p{L}/gu, (letter) => letter.toUpperCase());
  return viLabel(titled);
}

export const BREED_OPTIONS: SelectOption[] = ['Thoroughbred', 'Arabian', 'Quarter Horse', 'Standardbred']
  .map((v) => ({ value: v, label: v }));
