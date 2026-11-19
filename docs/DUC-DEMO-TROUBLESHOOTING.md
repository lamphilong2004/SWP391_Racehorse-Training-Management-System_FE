# Gỡ vướng khi demo phần Vet/Groom/Owner/History

Tài liệu xử lý thao tác thường gặp, bổ sung cho [kịch bản demo](DUC-DEMO-RUNBOOK-20261119.md) và [bản đồ code](DUC-CODE-MAP.md). Không thay dữ liệu cố định do Leader giao cho buổi review; không dùng ID ở báo cáo QA như ID chung của mọi máy.

## Bắt đầu bằng ba thông tin

1. Đang đăng nhập ai? Nhìn tên/role ở góc phải; đăng xuất trước khi đổi sang role tiếp theo.
2. Đang ở môi trường nào? Localhost của máy mình khác localhost của máy Long. Kiểm FE/BE/DB của phiên demo hiện hành, không dựa vào một link cũ đang còn mở.
3. Đang chọn ngựa/ca/task nào? Tìm tên ngựa và nhãn bộ dữ liệu, rồi mới đối chiếu ID của chính môi trường đó.

## Chọn theo biểu hiện

| Biểu hiện | Thao tác kiểm tra trên UI | Điều cần nhớ |
|---|---|---|
| Không tìm thấy Thiên Mã/ca #2 | Vet → danh sách ca → xóa filter cũ → tìm theo tên; đối chiếu bộ final được Leader chuẩn bị | Tên/ID trong bộ final không mặc định tồn tại trong DB QA cũ. Không mở ca #2 của ngựa khác để thay thế. |
| Groom không thấy việc điều trị | `/care/tasks` → kiểm ngày/filter ngựa/trạng thái; Vet kiểm đúng Groom theo tên trong phác đồ đã lưu | Chỉ chọn người nhận trên form mà chưa lưu thành công chưa phải giao việc. Groom không tự cấp việc cho mình. |
| Groom không thấy buổi precheck | Vào lịch đúng ngày; Trainer đọc lại buổi và Groom đã phân công; kiểm đúng mã session | Task điều trị ở `/care/tasks` và precheck trước buổi tập là hai luồng khác nhau. |
| Có việc nhưng chưa bấm hoàn thành được | Kiểm việc đã xong/đã hủy, ngày và khung giờ Việt Nam; đọc message server nếu có | Không đổi giờ máy hoặc chỉnh SQL để ép hợp lệ. Việc tương lai trong lịch chăm sóc chưa được hoàn thành. |
| Đã tick Groom nhưng ca chưa đóng được | Vet mở lại ca → đọc checklist; xem task thuộc đúng phác đồ, tái khám mới nhất và restriction gắn ca | Groom hoàn thành không tự ghi RECOVERED, không tự gỡ hạn chế. Backend kiểm lại lúc POST đóng ca. |
| Đã ghi Khỏe/Đã hồi phục nhưng vẫn Khóa | Vet vào quản lý hạn chế → chọn đúng ngựa → xem và gỡ restriction khi đúng kịch bản/đủ điều kiện | Sức khỏe và khả năng tập là hai trạng thái. Đóng ca cũng không tự gỡ mọi khóa. |
| Ngựa Sẵn sàng nhưng Rider không bắt đầu | Kiểm program/session được giao, đúng Rider, precheck đạt và khung giờ tập | AVAILABLE chỉ là điều kiện y tế. 403 do chưa phân công không chứng minh luồng Rider đã chạy lại. |
| Owner không thấy chỉ số/biểu đồ | Kiểm đúng ngựa sở hữu, tab và thông báo unavailable; đọc HTTP của profile/summary | Chưa có dữ liệu khác với giá trị 0; không tự điền metric hoặc đổi sang tài khoản nhân viên để giả Owner đã xem được. |
| HT ghi readiness nhưng ngựa chưa ACTIVE | Mở checklist xem các điều kiện bắt buộc còn thiếu | Đánh giá HT là khuyến nghị, không phải nút kích hoạt thủ công. |
| Gửi đề nghị bổ sung mà kho không tăng | Mở bảng yêu cầu và kiểm server đã xác nhận; Manager ghi nhận hàng thực nhận bằng Nhập/xuất | Yêu cầu bổ sung không phải phiếu nhập. Hoàn thành cho ăn không tự trừ kho. |

## Không thấy trong danh sách chưa chắc là không có

Phân biệt **rỗng sau khi đọc thành công**, **đọc lỗi** và **chỉ đọc một phần**. Một request 200 chỉ xác nhận trang vừa nhận, không tự chứng minh mọi trang đều đã được tải.

| Chỗ cần kiểm tra | Giới hạn hiện tại trong source | Cách xử lý an toàn |
|---|---|---|
| Checklist đóng ca Vet | [CaseClosure.tsx](../src/features/medical/CaseClosure.tsx) đọc trang 0 của task (20 dòng) và restriction (100 dòng), chưa duyệt mọi trang | Đọc thông báo khi BE nhận yêu cầu đóng ca. Nếu bị từ chối, kiểm task/hạn chế còn lại qua danh sách tương ứng; không coi checklist xanh là bằng chứng đầy đủ. Trang sửa phác đồ có vòng tải mọi trang task riêng trong [pages.tsx](../src/features/medical/pages.tsx). |
| Gắn sự cố vào ca đang mở | [incidentService.ts](../src/features/medical/incidentService.ts) chỉ lọc ca OPEN của đúng ngựa trong 100 ca đầu. [Incidents.tsx](../src/features/medical/Incidents.tsx) còn chuyển lỗi đọc thành danh sách rỗng | Kiểm request danh sách ca có lỗi không, đúng ngựa/DB và các trang trong màn ca y tế. Không vội mở ca mới chỉ vì bộ chọn trống. |
| Groom chọn ngựa báo sự cố tại chuồng | [Incidents.tsx](../src/features/medical/Incidents.tsx) chỉ đọc tối đa 100 ngựa ACTIVE ở trang đầu rồi lọc ngựa có currentBoxCode | Kiểm đúng mã ngựa, trạng thái và chuồng hiện hành trong nguồn được phép xem. Không nhập bừa ID hoặc đổi quyền để ép báo cáo. |

Khi kiểm tra Network, chỉ ghi method/path/status và thông báo đã bỏ thông tin riêng tư; không sao chép Authorization, JWT hoặc bệnh án. Muốn kết luận **không tồn tại bản ghi** cần kết quả đọc lại Backend bao phủ đúng phạm vi/phân trang trong môi trường hiện hành. Tài liệu này ghi nhận giới hạn FE, chưa sửa chúng và không phải bằng chứng SQL PASS.

## Khi màn hình báo lỗi

- **Đang tải:** chờ request kết thúc, không coi là không có dữ liệu. Màn sự cố có loading riêng cho tình trạng ngựa.
- **401:** phiên không còn hợp lệ; đăng nhập lại bằng tài khoản thuộc đúng bộ dữ liệu.
- **403:** kiểm role và assignment; không đổi RBAC để bỏ chặn.
- **404:** kiểm ngựa/ca/task trong đúng DB và URL; không nhập ID lấy từ máy khác.
- **409/lỗi nghiệp vụ:** đọc lý do, tải lại trạng thái trước khi gửi lần nữa. Một thao tác có thể đã được người khác xử lý.
- **Mất mạng/500:** giữ nguyên input nếu form còn mở; kiểm Network/log và kết quả đọc lại trước khi thử gửi một thao tác ghi lần nữa. Không bấm Save liên tục để tìm toast thành công.

Đây là hướng dẫn quan sát, không khẳng định mọi form đã có cùng mức bảo vệ draft. Chẳng hạn guard phác đồ không tự chứng minh form khám có khả năng phục hồi qua refresh.

## Báo lỗi đủ để tái hiện

Ghi ngắn theo mẫu sau; không kèm mật khẩu/JWT:

```text
Môi trường / FE SHA / BE SHA / tên DB:
Thời gian và role đang đăng nhập:
Tên ngựa + nhãn bộ dữ liệu + id ca/task/session:
Route và các bước đã bấm:
Kết quả mong đợi / kết quả thực tế:
API method + path + status, message đã bỏ thông tin riêng tư:
Sau tải lại, dữ liệu thực tế là gì:
```

Mục này không yêu cầu reset/seed, chạy script retire database hay tạo tài khoản khác để xử lý lỗi giao diện. Việc chuẩn bị lại bộ demo phải theo đúng hướng dẫn/môi trường do Leader xác nhận.
