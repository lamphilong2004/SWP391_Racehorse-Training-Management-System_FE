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

/**
 * Racing strengths a Club Manager may declare (BE HorseStrength / V20261027_01). API values stay English codes.
 * A declaration is the club's report, not a Head Trainer confirmation; leaving every box empty means "unknown".
 */
export const STRENGTH_GROUPS: { title: string; help: string; options: { value: string; label: string }[] }[] = [
  { title: 'Cự ly sở trường', help: 'Nước rút < 1.400 m · Dặm 1.400–1.999 m · Trung bình 2.000–2.399 m · Đường dài ≥ 2.400 m.', options: [
    { value: 'SPRINT', label: 'Nước rút' }, { value: 'MILE', label: 'Cự ly dặm' },
    { value: 'MIDDLE_DISTANCE', label: 'Cự ly trung bình' }, { value: 'STAYING', label: 'Đường dài' }] },
  { title: 'Mặt sân', help: 'Mặt sân ngựa đã chạy tốt.', options: [
    { value: 'TURF', label: 'Sân cỏ' }, { value: 'DIRT', label: 'Sân đất' }, { value: 'SYNTHETIC', label: 'Sân tổng hợp' }] },
  { title: 'Lối chạy', help: 'Vị trí ngựa thường giữ trong cuộc đua.', options: [
    { value: 'FRONT_RUNNER', label: 'Dẫn đầu' }, { value: 'STALKER', label: 'Bám đuổi' }, { value: 'CLOSER', label: 'Bứt phá cuối' }] },
  { title: 'Thể chất', help: 'Tố chất nổi bật quan sát được.', options: [
    { value: 'SPEED', label: 'Tốc độ' }, { value: 'ENDURANCE', label: 'Sức bền' },
    { value: 'STRENGTH', label: 'Sức mạnh' }, { value: 'BALANCE', label: 'Thăng bằng' }] },
];

const STRENGTH_ORDER = STRENGTH_GROUPS.flatMap((group) => group.options);

/** Codes in catalogue order, unknown codes dropped. */
export function sortStrengths(codes: readonly string[]): string[] {
  return STRENGTH_ORDER.map((option) => option.value).filter((value) => codes.includes(value));
}

export function strengthLabel(code: string): string {
  return STRENGTH_ORDER.find((option) => option.value === code)?.label ?? code;
}

export function strengthSummary(codes: readonly string[] | null | undefined): string {
  return codes?.length ? sortStrengths(codes).map(strengthLabel).join(' · ') : 'Chưa khai báo';
}
