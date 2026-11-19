/** Route id guard shared by medical pages: a positive integer of any length (e.g. 9, 57, 120). */
// Guard này chỉ kiểm dạng chuỗi: không dấu âm, không số 0 ở đầu, chỉ chữ số.
// Nó không chứng minh id tồn tại hoặc vừa giới hạn số an toàn của JavaScript;
// màn/service còn phải kiểm Number.isSafeInteger và quyền truy cập trước API.
export const isPositiveIdParam = (value: string) => /^[1-9]\d*$/.test(value);
