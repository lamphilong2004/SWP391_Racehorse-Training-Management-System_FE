/** Optional input shortcuts only. API values stay free text; there is always a manual alternative. */
export const COUNTRY_PRESETS = [
  ['Vietnam', 'Việt Nam'], ['United Kingdom', 'Vương quốc Anh'], ['Ireland', 'Ireland'],
  ['France', 'Pháp'], ['United States', 'Hoa Kỳ'], ['Australia', 'Úc'], ['New Zealand', 'New Zealand'],
  ['Japan', 'Nhật Bản'], ['Germany', 'Đức'], ['Italy', 'Ý'], ['Canada', 'Canada'],
  ['South Africa', 'Nam Phi'], ['Argentina', 'Argentina'], ['United Arab Emirates', 'Các Tiểu vương quốc Ả Rập Thống nhất'],
].map(([value, label]) => ({ value, label }));

export const UNIT_PRESETS = [
  ['kg', 'kg — kilôgam'], ['g', 'g — gam'], ['l', 'l — lít'], ['ml', 'ml — mililít'],
  ['cái', 'Cái'], ['hộp', 'Hộp'], ['gói', 'Gói'], ['bao', 'Bao'], ['cuộn', 'Cuộn'],
].map(([value, label]) => ({ value, label }));

export const CARE_TIME_PRESETS = ['06:00', '07:00', '08:00', '09:00', '12:00', '14:00', '16:00', '17:00', '18:00']
  .map(value => ({ value, label: value }));

export const MEAL_PRESETS = [
  { value: '07:00', label: '07:00 — Buổi sáng' },
  { value: '12:00', label: '12:00 — Buổi trưa' },
  { value: '17:00', label: '17:00 — Buổi chiều' },
];

export const EXPERIENCE_PRESETS = ['Mới bắt đầu', 'Có kinh nghiệm', 'Lâu năm']
  .map(value => ({ value, label: value }));

export const SURFACE_PRESETS = [
  { value: 'TURF', label: 'Sân cỏ' },
  { value: 'DIRT', label: 'Sân đất' },
  { value: 'SYNTHETIC', label: 'Sân tổng hợp' },
];
