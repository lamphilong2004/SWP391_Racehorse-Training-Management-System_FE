import type { SelectOption } from '../../../design-system';

/**
 * Display suggestions for Figma 282:2377. The contract's sex/breed fields remain free text;
 * RegisterHorsePage also permits custom values and does not treat these as a closed vocabulary.
 */
export const SEX_OPTIONS: SelectOption[] = ['Colt', 'Filly', 'Stallion', 'Mare', 'Gelding'].map((v) => ({ value: v, label: v }));

export const BREED_OPTIONS: SelectOption[] = ['Thoroughbred', 'Arabian', 'Quarter Horse', 'Standardbred']
  .map((v) => ({ value: v, label: v }));
