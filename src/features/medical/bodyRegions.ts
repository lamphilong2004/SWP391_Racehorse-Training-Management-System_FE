export const BODY_REGIONS = ['Head', 'Neck', 'Shoulder', 'Left Forelimb', 'Right Forelimb', 'Back', 'Left Hindlimb', 'Right Hindlimb'];
/** Stored bodyRegion stays the English value above (free text in the API); only the display is Vietnamese. */
const REGION_LABELS: Record<string, string> = { Head: 'Đầu', Neck: 'Cổ', Shoulder: 'Vai', 'Left Forelimb': 'Chân trước trái', 'Right Forelimb': 'Chân trước phải', Back: 'Lưng', 'Left Hindlimb': 'Chân sau trái', 'Right Hindlimb': 'Chân sau phải' };
export const regionLabel = (region: string) => REGION_LABELS[region] ?? region;
