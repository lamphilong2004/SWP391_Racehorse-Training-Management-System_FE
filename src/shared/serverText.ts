/**
 * Vietnamese display text for fixed English strings the Backend returns (activation checklist, horse timeline,
 * notifications, audit summaries).
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
  // audit_log.safe_summary (GET /api/admin/audit-log, management recent activity)
  'User logged out.': 'Người dùng đã đăng xuất.',
  'Account change.': 'Thay đổi tài khoản.',
  'Approved role assigned.': 'Đã gán vai trò được duyệt.',
  'Registration approved.': 'Đã duyệt yêu cầu đăng ký.',
  'Registration rejected.': 'Đã từ chối yêu cầu đăng ký.',
  'Training program created.': 'Đã tạo chương trình huấn luyện.',
  'Training session scheduled.': 'Đã lên lịch buổi tập.',
  'Trainer assigned.': 'Đã phân công Trainer.',
  'Trainer assignment changed.': 'Đã đổi Trainer phụ trách.',
  'Explicit Groom assignment updated.': 'Đã cập nhật Groom được phân công kiểm tra.',
  'Scheduled session details changed.': 'Đã đổi thông tin buổi tập đã lên lịch.',
  'Scheduled session exercises replaced.': 'Đã thay danh sách bài tập của buổi.',
  'Session started after server-side gates passed.': 'Buổi tập bắt đầu sau khi qua mọi điều kiện kiểm tra.',
  'Session resumed after medical gate passed.': 'Buổi tập tiếp tục sau khi qua kiểm tra y tế.',
  'Trainer acknowledged Work Rider warnings.': 'Trainer đã xác nhận cảnh báo về Work Rider.',
  'Recommended non-blocking readiness review acknowledged.': 'Đã ghi nhận đánh giá sẵn sàng (khuyến nghị, không bắt buộc).',
  'Template archived.': 'Đã lưu trữ mẫu chương trình.',
  // horse photo upload (POST /api/horses/{id}/photos)
  'Upload a valid JPEG, PNG, or WebP image no larger than 5 MiB.': 'Hãy tải ảnh JPEG, PNG hoặc WebP hợp lệ, tối đa 5 MB.',
};
/** DEC-005 adjustment request types as they appear inside audit summaries. */
const ADJUSTMENT: Record<string, string> = {
  PHASE_WORKLOAD_INTENSITY: 'khối lượng / cường độ giai đoạn', PHASE_TIMELINE: 'thời gian giai đoạn', PHASE_OBJECTIVE: 'mục tiêu giai đoạn',
  PHASE_STRUCTURE: 'cấu trúc giai đoạn', TOTAL_DURATION: 'tổng thời gian chương trình', PRIMARY_GOAL: 'mục tiêu chính',
  SOURCE_TEMPLATE: 'mẫu gốc', OTHER_STRUCTURAL: 'thay đổi cấu trúc khác',
};
const adjustment = (type: string) => ADJUSTMENT[type] ?? type;
/** Notification messages and audit summaries are built by the Backend from fixed templates with ids/codes inside. */
const PATTERNS: [RegExp, (...groups: string[]) => string][] = [
  [/^Pre-session check assigned for session (\S+)\.$/, (code) => `Bạn được giao kiểm tra trước buổi tập ${code}.`],
  [/^Incident (\S+) was reported for session (\S+)\.$/, (incident, session) => `Sự cố ${incident} đã được báo cho buổi tập ${session}.`],
  [/^Critical heart rate threshold reached in session (\S+)\.$/, (id) => `Nhịp tim vượt ngưỡng nghiêm trọng trong buổi tập ${id}.`],
  [/^A Trainer requested an adjustment for program (\S+)\.$/, (id) => `Một Trainer đã đề xuất điều chỉnh chương trình ${id}.`],
  [/^Your adjustment request for program (\S+) was (APPROVED|REJECTED)\.$/, (id, status) => `Đề xuất điều chỉnh chương trình ${id} của bạn đã ${status === 'APPROVED' ? 'được duyệt' : 'bị từ chối'}.`],
  [/^Session (\S+) has been assigned to you\.$/, (code) => `Bạn được giao buổi tập ${code}.`],
  [/^You have been assigned to (.+)\.$/, (name) => `Bạn được giao phụ trách ${name}.`],
  [/^Template version (\d+) (created|saved)\.$/, (n, verb) => `Đã ${verb === 'created' ? 'tạo' : 'lưu'} phiên bản mẫu ${n}.`],
  [/^Adjustment requested: (\S+)\.$/, (type) => `Đã gửi đề xuất điều chỉnh: ${adjustment(type)}.`],
  [/^Adjustment request (approved|rejected): (\S+)\.$/, (status, type) => `Đề xuất điều chỉnh ${adjustment(type)} đã ${status === 'approved' ? 'được duyệt' : 'bị từ chối'}.`],
];

export function serverText(text: string | null | undefined): string {
  if (!text) return '';
  if (TEXT[text]) return TEXT[text];
  for (const [pattern, render] of PATTERNS) { const match = text.match(pattern); if (match) return render(...match.slice(1)); }
  return text;
}
