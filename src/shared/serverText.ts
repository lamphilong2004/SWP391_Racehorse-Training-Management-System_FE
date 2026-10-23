/**
 * Vietnamese display text for fixed English strings the Backend returns (activation checklist, horse timeline).
 * The Backend is unchanged; any text not listed here is shown exactly as the server sent it.
 */
const TEXT: Record<string, string> = {
  // GET /api/horses/{id}/activation-status checklist (labels and state descriptions)
  'Horse identity': 'Nhận dạng ngựa',
  'Horse identity is valid.': 'Thông tin nhận dạng hợp lệ.',
  'Horse identity is incomplete.': 'Thông tin nhận dạng chưa đầy đủ.',
  Pedigree: 'Phả hệ',
  'Pedigree is valid.': 'Phả hệ hợp lệ.',
  'Pedigree is incomplete.': 'Phả hệ chưa đầy đủ.',
  Owner: 'Chủ ngựa',
  'A valid owner is linked to the horse.': 'Đã liên kết chủ ngựa hợp lệ.',
  'A valid owner is not linked to the horse.': 'Chưa liên kết chủ ngựa hợp lệ.',
  'Free stable box': 'Ô chuồng trống',
  'A free stable box is assigned to the horse.': 'Đã xếp một ô chuồng trống cho ngựa.',
  'A free stable box is not assigned to the horse.': 'Chưa xếp ô chuồng trống cho ngựa.',
  'Veterinarian baseline': 'Khám ban đầu của Veterinarian',
  'A valid Veterinarian baseline is recorded.': 'Đã có kết quả khám ban đầu hợp lệ của Veterinarian.',
  'A valid Veterinarian baseline is not recorded.': 'Chưa có kết quả khám ban đầu hợp lệ của Veterinarian.',
  'Head Trainer readiness review': 'Đánh giá sẵn sàng của Head Trainer',
  'Recommended review; this item is non-blocking and does not gate activation.': 'Nên đánh giá; mục này không bắt buộc và không chặn việc kích hoạt.',
  // GET /api/horses/{id}/timeline event titles
  'Horse activated': 'Ngựa được kích hoạt',
  'Stable assignment started': 'Bắt đầu xếp chuồng',
  'Ownership changed': 'Thay đổi quyền sở hữu',
  'Veterinary examination recorded': 'Đã ghi lần khám thú y',
  'Medical restriction applied': 'Áp dụng hạn chế y tế',
  'Medical restriction lifted': 'Gỡ hạn chế y tế',
  'Training program activated': 'Kích hoạt chương trình huấn luyện',
  'Training session started': 'Bắt đầu buổi tập',
  'Incident reported': 'Báo cáo sự cố',
  // notification titles
  'Pre-session check assigned': 'Được giao kiểm tra trước buổi tập',
  'Training incident reported': 'Có sự cố khi tập',
  'Critical monitoring alert': 'Cảnh báo giám sát nghiêm trọng',
  'Program adjustment requested': 'Có đề xuất điều chỉnh chương trình',
  'Program adjustment request decided': 'Đề xuất điều chỉnh đã được quyết định',
  'Training program assigned': 'Được giao chương trình huấn luyện',
  'Training session assigned': 'Được giao buổi tập',
  // candidate suitability reasons and session start messages
  'Available for the requested schedule': 'Rảnh vào lịch đã chọn',
  'Active club template': 'Mẫu đang dùng của câu lạc bộ',
  'Pre-session check found an abnormality — the session must not start.': 'Kiểm tra trước buổi tập phát hiện bất thường — không được bắt đầu buổi tập.',
};
/** Notification messages are built by the Backend from fixed templates with ids/codes inside. */
const PATTERNS: [RegExp, (...groups: string[]) => string][] = [
  [/^Pre-session check assigned for session (\S+)\.$/, (code) => `Bạn được giao kiểm tra trước buổi tập ${code}.`],
  [/^Incident (\S+) was reported for session (\S+)\.$/, (incident, session) => `Sự cố ${incident} đã được báo cho buổi tập ${session}.`],
  [/^Critical heart rate threshold reached in session (\S+)\.$/, (id) => `Nhịp tim vượt ngưỡng nghiêm trọng trong buổi tập ${id}.`],
  [/^A Trainer requested an adjustment for program (\S+)\.$/, (id) => `Một Trainer đã đề xuất điều chỉnh chương trình ${id}.`],
  [/^Your adjustment request for program (\S+) was (APPROVED|REJECTED)\.$/, (id, status) => `Đề xuất điều chỉnh chương trình ${id} của bạn đã ${status === 'APPROVED' ? 'được duyệt' : 'bị từ chối'}.`],
  [/^Session (\S+) has been assigned to you\.$/, (code) => `Bạn được giao buổi tập ${code}.`],
  [/^You have been assigned to (.+)\.$/, (name) => `Bạn được giao phụ trách ${name}.`],
  [/^Trainer specialization matches a required template skill: (.+)$/, (skills) => `Chuyên môn của Trainer khớp kỹ năng mẫu yêu cầu: ${skills}`],
  [/^No Trainer specialization matches the template's required skills: (.+)$/, (skills) => `Chưa có chuyên môn nào của Trainer khớp kỹ năng mẫu yêu cầu: ${skills}`],
  [/^Specialization matches the template: (.+)$/, (skills) => `Chuyên môn khớp mẫu: ${skills}`],
  [/^Specializations: (.+)$/, (skills) => `Chuyên môn: ${skills}`],
  [/^Current active programs: (\d+)$/, (count) => `Chương trình đang phụ trách: ${count}`],
  [/^Training is LOCKED by the Veterinarian: (.*)$/, (reason) => `Veterinarian đã khóa tập luyện: ${reason}`],
  [/^Prohibited by the Veterinarian restriction: (.+)$/, (names) => `Bị cấm theo hạn chế của Veterinarian: ${names}`],
];

export function serverText(text: string | null | undefined): string {
  if (!text) return '';
  if (TEXT[text]) return TEXT[text];
  for (const [pattern, render] of PATTERNS) { const match = text.match(pattern); if (match) return render(...match.slice(1)); }
  return text;
}
