/**
 * Vietnamese display text for fixed English strings the Backend returns (activation checklist, horse timeline,
 * notifications, audit summaries).
 * The Backend is unchanged; a bare reason code (e.g. PRE_CHECK_ABNORMAL) uses its viLabel, any other text not listed
 * here is shown exactly as the server sent it.
 */
import { SERVER_ERROR_PATTERNS, SERVER_ERROR_TEXT } from './serverErrors';
import { viLabel } from './viLabels';

const TEXT: Record<string, string> = {
  ...SERVER_ERROR_TEXT,
  // Flow 4 fixed server messages; preserve arbitrary user-entered notes verbatim.
  'This role cannot perform the stable-care action.': 'Vai trò của bạn không được thực hiện thao tác chăm sóc này.',
  'Choose today or later and at most 366 days per plan.': 'Chọn ngày bắt đầu từ hôm nay trở đi; mỗi kế hoạch tối đa 366 ngày.',
  'Choose an ACTIVE Groom.': 'Chọn một Groom đang hoạt động.',
  'Horse must have exactly one stable assignment on every task date.': 'Ngựa cần có đúng một ô chuồng trong từng ngày công việc. Hãy kiểm tra lịch xếp chuồng.',
  'A plan cannot move to another horse.': 'Không thể chuyển kế hoạch sang ngựa khác.',
  'This plan has historical or completed tasks. Preserve its log and create a non-overlapping future plan.': 'Kế hoạch có công việc trong quá khứ hoặc đã hoàn thành. Hãy giữ lịch sử và tạo kế hoạch cho khoảng ngày tương lai không trùng lịch hiện có.',
  'Duplicate task type and slot in this plan.': 'Loại công việc và khung giờ đang bị trùng trong kế hoạch.',
  'An overlapping task already exists for this horse, type and slot.': 'Ngựa đã có công việc cùng loại và khung giờ trong khoảng ngày này.',
  'A nutrition plan already covers this horse in the selected period.': 'Ngựa đã có kế hoạch dinh dưỡng trong khoảng ngày được chọn.',
  'Duplicate meal and component.': 'Bữa ăn và thành phần đang bị trùng.',
  'Future tasks cannot be completed early.': 'Chưa thể hoàn thành công việc của ngày tương lai.',
  'Assigned daily-care task was not found.': 'Không tìm thấy công việc chăm sóc được giao cho bạn.',
  'Daily-care task was not found.': 'Không tìm thấy công việc chăm sóc.',
  'Task assignment changed. Refresh before trying again.': 'Phân công vừa thay đổi. Hãy tải lại công việc và kiểm tra trước khi thử lại.',
  'Completed or past tasks cannot be cancelled or reassigned.': 'Không thể hủy hoặc đổi Groom cho công việc đã hoàn thành hay đã qua ngày.',
  'Cancelled tasks cannot be reassigned.': 'Không thể đổi Groom cho công việc đã hủy.',
  'This task is cancelled and cannot be completed.': 'Công việc đã hủy nên không thể đánh dấu hoàn thành.',
  'This plan has recorded task changes. Manage pending tasks individually to preserve history.': 'Kế hoạch đã có lịch sử thay đổi. Hãy điều chỉnh từng việc chưa thực hiện để giữ nguyên lịch sử.',
  'The plan changed while completing this task. Refresh your assignments and review before trying again.': 'Kế hoạch vừa thay đổi. Hãy tải lại công việc được giao và kiểm tra trước khi thử lại.',
  'An inventory item with this name and unit already exists.': 'Đã có vật tư cùng tên và đơn vị.',
  'Units cannot change after stock movements.': 'Không thể đổi đơn vị sau khi đã có lịch sử nhập/xuất.',
  'Stock movement must be nonzero and within the supported precision.': 'Số lượng nhập/xuất phải khác 0 và nằm trong giới hạn cho phép.',
  'Stock changed, item is inactive, or quantity is insufficient. Refresh and review before submitting again.': 'Tồn kho đã thay đổi, vật tư đã ngừng sử dụng hoặc không đủ số lượng. Hãy tải lại tồn kho và kiểm tra trước khi gửi lại.',
  'Inventory item is inactive.': 'Vật tư đã ngừng sử dụng.',
  'Only the assigned Groom can report an incident for a care task due today or earlier.': 'Chỉ Groom được phân công mới được báo bất thường cho công việc đến hạn hôm nay hoặc trước đó.',
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
  'The pre-session check opens 12 hours before the scheduled start.': 'Chưa đến thời gian kiểm tra. Groom có thể kiểm tra từ 12 giờ trước giờ bắt đầu buổi tập.',
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
  // audit_log.safe_summary (audit log, Club Manager recent activity)
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
};
/** DEC-005 adjustment request types as they appear inside audit summaries. */
const ADJUSTMENT: Record<string, string> = {
  PHASE_WORKLOAD_INTENSITY: 'khối lượng / cường độ giai đoạn', PHASE_TIMELINE: 'thời gian giai đoạn', PHASE_OBJECTIVE: 'mục tiêu giai đoạn',
  PHASE_STRUCTURE: 'cấu trúc giai đoạn', TOTAL_DURATION: 'tổng thời gian chương trình', PRIMARY_GOAL: 'mục tiêu chính',
  SOURCE_TEMPLATE: 'mẫu gốc', OTHER_STRUCTURAL: 'thay đổi cấu trúc khác',
};
const adjustment = (type: string) => ADJUSTMENT[type] ?? type;
/** Notification messages are built by the Backend from fixed templates with ids/codes inside. */
const PATTERNS: [RegExp, (...groups: string[]) => string][] = [
  [/^Pre-session check assigned for session (\S+)\.$/, (code) => `Bạn được giao kiểm tra trước buổi tập ${code}.`],
  [/^Incident (\S+) was reported for session (\S+)\.$/, (incident, session) => `Sự cố ${incident} đã được báo cho buổi tập ${session}.`],
  [/^Critical heart rate threshold reached in session (\S+)\.$/, (id) => `Nhịp tim vượt ngưỡng nghiêm trọng trong buổi tập ${id}.`],
  [/^A Trainer requested an adjustment for program (\S+)\.$/, (id) => `Một Trainer đã đề xuất điều chỉnh chương trình ${id}.`],
  [/^Your adjustment request for program (\S+) was (APPROVED|REJECTED)\.$/, (id, status) => `Đề xuất điều chỉnh chương trình ${id} của bạn đã ${status === 'APPROVED' ? 'được duyệt' : 'bị từ chối'}.`],
  [/^Session (\S+) has been assigned to you\.$/, (code) => `Bạn được giao buổi tập ${code}.`],
  [/^You have been assigned to (.+)\.$/, (name) => `Bạn được giao phụ trách ${name}.`],
  [/^Training is locked by the Veterinarian: (.+)$/, (reason) => `Veterinarian đã khóa tập luyện: ${reason}`],
  [/^Template version (\d+) (created|saved)\.$/, (n, verb) => `Đã ${verb === 'created' ? 'tạo' : 'lưu'} phiên bản mẫu ${n}.`],
  [/^Adjustment requested: (\S+)\.$/, (type) => `Đã gửi đề xuất điều chỉnh: ${adjustment(type)}.`],
  [/^Adjustment request (approved|rejected): (\S+)\.$/, (status, type) => `Đề xuất điều chỉnh ${adjustment(type)} đã ${status === 'approved' ? 'được duyệt' : 'bị từ chối'}.`],
  ...SERVER_ERROR_PATTERNS,
];

export function serverText(text: string | null | undefined): string {
  if (!text) return '';
  if (TEXT[text]) return TEXT[text];
  for (const [pattern, render] of PATTERNS) { const match = text.match(pattern); if (match) return render(...match.slice(1)); }
  if (/^[A-Z][A-Z0-9_]+$/.test(text)) return viLabel(text);
  return text;
}
