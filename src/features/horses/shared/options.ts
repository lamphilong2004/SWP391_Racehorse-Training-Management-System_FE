import type { SelectOption } from '../../../design-system';

/**
 * NEEDS CLARIFICATION (physical-schema.md §11 #3): horse.sex and horse.breed are free text in DB-01 and the approved
 * value lists are not decided. Figma 282:2377 draws both as selects ("Filly", "Thoroughbred"). These lists are an
 * ASSUMPTION kept in one place so they can be replaced by the approved lists without touching the pages.
 */
export const SEX_OPTIONS: SelectOption[] = ['Colt', 'Filly', 'Stallion', 'Mare', 'Gelding'].map((v) => ({ value: v, label: v }));

export const BREED_OPTIONS: SelectOption[] = ['Thoroughbred', 'Arabian', 'Quarter Horse', 'Standardbred', 'Other']
  .map((v) => ({ value: v, label: v }));
