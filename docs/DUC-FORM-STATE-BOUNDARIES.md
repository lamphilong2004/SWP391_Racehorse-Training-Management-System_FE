# Dữ liệu đang nhập được giữ đến đâu?

Hướng dẫn đọc hành vi hiện có của form trong phạm vi bàn giao Đức, đối chiếu FE `9aaf934`. Đây là tài liệu giải thích, chưa bổ sung khả năng lưu nháp hoặc sửa các giới hạn nêu dưới. Để tìm màn và API, đọc [bản đồ source](DUC-CODE-MAP.md); để chọn tests, đọc [bản đồ kiểm thử](DUC-TEST-MAP.md).

## 1. Hiểu đúng trạng thái form

- **State trong bộ nhớ:** nội dung React đang giữ khi form còn được dựng. Khi component bị gỡ rồi dựng lại, state cũ không tự quay lại. Đổi tab bằng cách ẩn nội dung khác với rời route sang trang khác.
- **Dirty:** form xác định có thay đổi chưa lưu. Mỗi form có cách xác định riêng; không mặc định mọi ô đều được tính.
- **Pending/busy:** đang chờ thao tác gửi kết thúc. Nút bị khóa không có nghĩa dữ liệu đã lưu; chống nhấp đúp cũng không bảo đảm một lần thử lại sau mất mạng không tạo thêm bản ghi.
- **Guard:** cảnh báo trước khi rời hoặc bỏ thay đổi. Guard không lưu nội dung, không phải autosave và không tự khôi phục qua refresh.

## 2. Đối chiếu từng nhóm form

| Form / nơi đọc | Khi lỗi hoặc đổi tab | Hủy / rời trang | Giới hạn phải nhớ |
|---|---|---|---|
| Khám, chấn thương, tái khám và tạo ca — [MedicalForm.tsx](../src/features/medical/MedicalForm.tsx), [pages.tsx](../src/features/medical/pages.tsx) | Validation/API lỗi không xóa `values`. Các panel khám/chấn thương/tái khám được ẩn bằng `hidden`, nên chỉ đổi tab trong cùng ca vẫn giữ form mounted và nội dung đang nhập. | `MedicalForm` không tự gắn `UnsavedChangesGuard`. Nút Hủy nếu được truyền vào gọi thẳng callback của trang cha; không có xác nhận bỏ nháp riêng trong component này. | Giữ input khi lỗi không bảo đảm giữ sau khi rời route, refresh hoặc remount. Form không tự reset sau `onSave`; trang cha quyết định tải lại/điều hướng, có thể làm form được dựng lại. |
| Phác đồ — [TreatmentPlanEditor.tsx](../src/features/medical/TreatmentPlanEditor.tsx) và `TreatmentPlanPage` trong [pages.tsx](../src/features/medical/pages.tsx) | So sánh `plan` với `savedSnapshot`; lỗi giữ plan và dirty. Chỉ cập nhật snapshot sau khi `onSave` thành công. | Guard nằm ở trang cha. Khi dirty, Hủy/Quay lại/Back gây điều hướng sẽ hỏi tiếp tục chỉnh sửa hay hủy thay đổi. Dirty vẫn được báo lên cha khi đang gửi, chưa coi pending là đã lưu. | Nháp chỉ ở bộ nhớ. Tải lại sau lưu đọc dữ liệu server; đó không phải khôi phục nội dung chưa lưu. Không tự ghi thuốc/chẩn đoán vào browser storage. |
| Báo cáo sự cố của Groom — [IncidentReportModal.tsx](../src/shared/incidents/IncidentReportModal.tsx) | Lỗi gửi giữ nội dung nếu modal còn mở; khóa gửi trùng. `dirty` chỉ xét loại, mức độ và mô tả sau trim, không xét riêng thay đổi ngựa/thời điểm. | Icon đóng và Escape phụ thuộc `dismissible = !busy && !dirty`. Nút **Hủy** vẫn gọi thẳng `onClose` khi không busy, kể cả dirty; không có hộp xác nhận bỏ nháp riêng hoặc route guard trong modal này. | Hủy rồi mở lại reset form. Chỉ sửa ngựa/thời điểm chưa chắc bật dirty. Không suy từ việc Escape bị chặn rằng mọi cách rời modal đều được bảo vệ. |
| Kế hoạch chăm sóc/dinh dưỡng, đổi Groom/hủy việc, thông tin vật tư và ghi kho/đề nghị bổ sung — [StableCarePage.tsx](../src/features/stable-care/StableCarePage.tsx) | Plan/Item so snapshot; Task/Stock xét các trường đã nhập. `useAction` giữ editor khi lỗi, chỉ gọi callback thành công sau khi thao tác API hoàn tất. | `EditorProtection` kết hợp guard điều hướng và xác nhận bỏ thay đổi. Chọn **Tiếp tục chỉnh sửa** giữ form; xác nhận bỏ mới đóng theo callback. | Các editor truyền `dirty && !action.busy` vào guard: không được khẳng định luôn chặn rời/refresh khi pending. Nháp không lưu bền vững; kết quả gửi có thể cần đọc lại nếu đã rời trang. |

## 3. Những ranh giới dễ gây mất nháp

[UnsavedChangesGuard.tsx](../src/design-system/components/UnsavedChangesGuard/UnsavedChangesGuard.tsx) chặn điều hướng trong router khi dirty, nhưng cố ý cho đi đến `/login` khi hết phiên/đăng xuất. Với refresh/đóng trang, guard chỉ yêu cầu cảnh báo `beforeunload`; việc hiện cảnh báo do trình duyệt quyết định. Người dùng vẫn có thể đồng ý rời, và không có cơ chế khôi phục nháp được cài trong guard.

Đổi tài khoản/phiên còn có thể dựng lại cây màn: [MedicalAccess](../src/features/medical/runtime.tsx) và [IncidentAccess](../src/features/medical/Incidents.tsx) dùng key theo user và hạn phiên; Stable Care dùng user/token. Modal sự cố còn có key theo nguồn, ngựa và thời điểm đầu vào. Các key giúp tránh tái sử dụng state sai ngữ cảnh, không chuyển nháp cho người dùng mới và không phải backup. Không lưu nội dung y tế, mật khẩu hoặc token vào localStorage/sessionStorage để bổ sung khả năng phục hồi.

Với modal dùng chung, xem [Modal.tsx](../src/design-system/components/Overlay/Modal.tsx) và [useModalDialog.ts](../src/design-system/components/Overlay/useModalDialog.ts): `dismissible` điều khiển Escape/icon đóng, không tự thay thế callback của nút Hủy trong footer. Không có cơ chế bảo vệ mọi form chỉ bằng việc bọc nó trong `Modal`.

## 4. Kiểm chứng một lần lưu

1. Xác nhận đúng role, ngựa/ca/task và phiên demo. Sửa một trường chưa tạo request ghi.
2. Bấm gửi một lần; chờ phản hồi. Lỗi validation giữ input để sửa, chưa gửi được API không phải đã lưu. Lỗi mạng/500 cũng **không đủ kết luận server chưa ghi**: có thể phản hồi bị mất sau khi xử lý.
3. Trước khi gửi lại thao tác tạo bản ghi sau mất mạng, đọc lại danh sách/chi tiết được phép xem để tránh tạo trùng. Đối chiếu đúng bản ghi, không chỉ nhìn toast.
4. API xác nhận và dữ liệu đọc lại là bằng chứng ứng dụng; muốn tuyên bố SQL PASS phải có bằng chứng môi trường và readback riêng. Các fixture tests bên dưới không thay thế bước đó.

| Bằng chứng có thể đọc trong tests hiện có | Điều đang được kiểm tra |
|---|---|
| [MedicalForm.test.tsx](../src/features/medical/MedicalForm.test.tsx) | Mã không hợp lệ, hủy không lưu, trường vượt giới hạn vẫn giữ input. |
| [TreatmentPlanEditor.test.tsx](../src/features/medical/TreatmentPlanEditor.test.tsx) | Lỗi giữ nội dung; dirty chỉ được xóa sau xác nhận lưu. |
| [integration.test.tsx](../src/features/medical/integration.test.tsx) | Khám giữ input khi 409 và đổi tab; route phác đồ có guard, kể cả Back lúc pending. |
| [IncidentReportModal.test.tsx](../src/shared/incidents/IncidentReportModal.test.tsx) | Chống gửi/đóng khi pending, lỗi cho thử lại, đóng/mở lại reset form. |
| [StableCarePage.test.tsx](../src/features/stable-care/StableCarePage.test.tsx) | Giữ lý do sau conflict, xác nhận bỏ nháp, xử lý tài khoản đổi và lỗi gửi đề nghị. |
| [UnsavedChangesGuard.test.tsx](../src/design-system/components/UnsavedChangesGuard/UnsavedChangesGuard.test.tsx) | Back/Escape/tiếp tục chỉnh sửa, không chặn đến login, cảnh báo unload và không ghi nháp vào storage. |

Đây là đối chiếu source và tên tests, không phải báo cáo chạy tests mới hay cam kết mọi form đã đạt đủ yêu cầu UX. Các giới hạn mất nháp được ghi nhận để quyết định sửa riêng; batch tài liệu giữ nguyên hành vi, dữ liệu và tài khoản hiện tại.
