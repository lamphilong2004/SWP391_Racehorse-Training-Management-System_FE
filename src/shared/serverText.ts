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
  // notification texts and gate errors added with the 2026-10-27 business-rule review
  'Pre-session check ABNORMAL': 'Kiểm tra trước buổi tập BẤT THƯỜNG',
  'The Groom recorded an ABNORMAL pre-session check; the session is blocked until the Veterinarian reviews it.': 'Groom ghi nhận kiểm tra trước buổi tập bất thường; buổi tập bị chặn cho đến khi Veterinarian xem xét.',
  'An incident was reported and awaits Veterinarian review.': 'Có sự cố mới đang chờ Veterinarian xem xét.',
  'The horse already has another session overlapping this time.': 'Ngựa đã có một buổi tập khác trùng khung giờ này.',
  'Work Rider has an overlapping session schedule.': 'Work Rider đã có buổi tập trùng khung giờ này.',
  'The scheduled time has passed; the Trainer must reschedule the session.': 'Đã quá giờ dự kiến của buổi tập; Trainer cần dời lịch trước khi bắt đầu.',
  'The scheduled time has passed; the Trainer must reschedule before a pre-session check.': 'Đã quá giờ dự kiến của buổi tập; Trainer cần dời lịch trước khi kiểm tra.',
  'The pre-session check opens 12 hours before the scheduled start.': 'Chỉ được kiểm tra trước buổi tập trong vòng 12 giờ trước giờ bắt đầu.',
  'The pre-session check is older than 12 hours before the scheduled start; ask the Groom for a new check.': 'Kết quả kiểm tra đã cũ hơn 12 giờ so với giờ bắt đầu; cần Groom kiểm tra lại.',
  'A pre-session check is already recorded; the session cannot move more than 12 hours after that check.': 'Buổi tập đã có kết quả kiểm tra; không thể dời lịch quá 12 giờ sau lần kiểm tra đó.',
  'A session cannot start before its scheduledStart; the Trainer must reschedule.': 'Chưa đến giờ bắt đầu dự kiến của buổi tập.',
  'Start is blocked until a Groom pre-session check is recorded.': 'Chưa thể bắt đầu: Groom chưa ghi kiểm tra trước buổi tập.',
  'Start is blocked by an ABNORMAL Groom pre-session check.': 'Không thể bắt đầu: kiểm tra trước buổi tập bất thường.',
  'The training program is not ACTIVE.': 'Chương trình huấn luyện không ở trạng thái Hoạt động.',
  'The session is medically blocked under the current restriction.': 'Buổi tập bị chặn bởi hạn chế y tế hiện tại.',
  'Only a SCHEDULED session can start.': 'Chỉ bắt đầu được buổi tập đang ở trạng thái Đã lên lịch.',
  'scheduledStart must be in the future. Choose a later time or reschedule the session.': 'Giờ bắt đầu phải ở tương lai. Hãy chọn thời điểm muộn hơn.',
  'periodStart must be today or later in Asia/Ho_Chi_Minh.': 'Ngày bắt đầu chương trình phải từ hôm nay trở đi (giờ Việt Nam).',
  'Unknown strength code.': 'Mã thế mạnh không hợp lệ.',
  'examinedAt cannot be in the future.': 'Ngày giờ khám không được ở tương lai.',
  'examinedAt cannot be before the horse was registered.': 'Ngày giờ khám không được trước ngày đăng ký ngựa.',
  'Use 8–64 characters, a letter and a digit, at most 72 UTF-8 bytes, and not your email.': 'Mật khẩu 8–64 ký tự, có chữ và số, không trùng email.',
  'Passwords must match.': 'Mật khẩu nhập lại chưa khớp.',
  'A user with this email already exists.': 'Email này đã có tài khoản.',
  'Acknowledge the Work Rider warnings before saving the session.': 'Hãy xác nhận đã đọc cảnh báo về Work Rider trước khi lưu buổi tập.',
  'The Groom is not notified for this session.': 'Chỉ báo được cho ngựa đang ở chuồng hoặc buổi tập bạn được giao.',
  'The horse is INJURED or QUARANTINED; the Veterinarian must re-examine it before a training program is created.': 'Ngựa đang chấn thương hoặc cách ly; Veterinarian cần tái khám trước khi lập chương trình huấn luyện.',
  'The horse is INJURED; the Veterinarian must re-examine it before training.': 'Ngựa đang chấn thương; Veterinarian cần tái khám trước khi tập.',
  'The horse is QUARANTINED; the Veterinarian must re-examine it before training.': 'Ngựa đang cách ly; Veterinarian cần tái khám trước khi tập.',
  'The horse already has an ACTIVE or PAUSED program in this period. Complete it or choose later dates.': 'Ngựa đã có chương trình đang hoạt động hoặc tạm dừng trong khoảng thời gian này. Hãy hoàn tất chương trình đó hoặc chọn ngày muộn hơn.',
  // notification titles
  'Pre-session check assigned': 'Được giao kiểm tra trước buổi tập',
  'Training incident reported': 'Có sự cố khi tập',
  'Critical monitoring alert': 'Cảnh báo giám sát nghiêm trọng',
  'Program adjustment requested': 'Có đề xuất điều chỉnh chương trình',
  'Program adjustment request decided': 'Đề xuất điều chỉnh đã được quyết định',
  'Training program assigned': 'Được giao chương trình huấn luyện',
  'Training session assigned': 'Được giao buổi tập',
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
];

export function serverText(text: string | null | undefined): string {
  if (!text) return '';
  if (TEXT[text]) return TEXT[text];
  for (const [pattern, render] of PATTERNS) { const match = text.match(pattern); if (match) return render(...match.slice(1)); }
  return text;
}
