/** Route id guard shared by medical pages: a positive integer of any length (e.g. 9, 57, 120). */
export const isPositiveIdParam = (value: string) => /^[1-9]\d*$/.test(value);
