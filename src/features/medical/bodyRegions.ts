export const BODY_REGIONS = ['Head', 'Neck', 'Shoulder', 'Left Forelimb', 'Right Forelimb', 'Back', 'Left Hindlimb', 'Right Hindlimb'];
/** Stored bodyRegion stays the English value above (free text in the API); only the display is Vietnamese. */
const REGION_LABELS: Record<string, string> = { Head: 'Đầu', Neck: 'Cổ', Shoulder: 'Vai', 'Left Forelimb': 'Chân trước trái', 'Right Forelimb': 'Chân trước phải', Back: 'Lưng', 'Left Hindlimb': 'Chân sau trái', 'Right Hindlimb': 'Chân sau phải' };
// DEC-015 cho phép vị trí chấn thương là chữ tự do, không yêu cầu mô hình 3D.
// Bảng chỉ dịch các tên quen thuộc để hiển thị; nếu Vet nhập vùng khác thì giữ
// nguyên câu chữ đó, không ép sang một vùng sai hay thay thành 'không biết'.
export const regionLabel = (region: string) => REGION_LABELS[region] ?? region;
