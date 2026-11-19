# Đức — kiểm thử main với API và SQL Server thật, 19/11/2026

## Bản chạy và dữ liệu

- FE main: `d6f17f719b6d7819fb8e2eb82c22bbc270630c5e`.
- BE main: `ee7fde6bc1789795ae0d7b561df2d13d4878c61d`, JAR build lại từ main sạch ngày 19/11.
- Khoảng thử: **10:40–10:49 ngày 19/11/2026, giờ Việt Nam (UTC+7)**; giờ kiểm SQL nằm trong file readback.
- FE development `http://127.0.0.1:5190`, proxy BE `http://127.0.0.1:8081`, SQL Server local `racehorse_local_duc_20261111`, TLS thật/JPA validate.
- Bộ mới `QA-DUC-20261119-612344`, ngựa RH-007/id 7. Tạo bằng API; không reset/seed lại DB, không thay mật khẩu, không sửa sáu ngựa cũ. DB vẫn có 19 tài khoản.
- Chạy trực tiếp source main và JAR mới; **không dùng launcher/artifacts 11/11**. Leader vẫn phụ trách đối chiếu launcher trên máy Long.

Đây là browser/API/SQL thật, không intercept HTTP và không sample fallback. Bản phác đồ pending trong PR #61 được kiểm riêng trên `920ab43`, không được gộp với kết quả main này.

## Màn và thao tác đã thử

| Vai trò → route | Thao tác thực tế | Phản hồi và đọc lại |
| --- | --- | --- |
| Vet → `/incidents/9` | Tiếp nhận sự cố mới, mở ca | Review POST 200; case 7 gắn incident 9 |
| Vet → `/medical/cases/7` → Khám/Chấn thương | Ghi lần khám, vị trí chấn thương, mức độ | POST 201; GET và SQL có bản ghi của đúng ca/ngựa |
| Vet → `/medical/cases/7/treatment-plan` | Nhập hướng dẫn, chọn Groom và giao việc | PUT 200; task điều trị 6 được giao user 6 |
| Vet → `/medical/cases/7` | Xin đóng khi chưa hồi phục/chưa xong việc/còn khóa | API 409 theo luật; nút Đóng ca trên UI bị khóa |
| Groom → `/care/tasks` | Hoàn thành đúng task 6 | POST 200; refresh vẫn checked, SQL có completed_by=6 và thời gian |
| Vet → `/medical/cases/7` → Tái khám | Ghi RECOVERED + FIT | POST 201; khả năng tập vẫn LOCKED, không tự gỡ hạn chế |
| Vet → `/medical/restrictions?horseId=7` | Xác nhận gỡ hạn chế id 5 | POST 200; SQL lifted_at có giá trị |
| Vet → `/medical/cases/7` | Xác nhận đóng khi đủ checklist | POST 200; refresh/SQL CLOSED, incident 9 tự RESOLVED |
| Vet → `/incidents/10` | Gắn báo cáo vào ca 8 đang mở của đúng ngựa | Review POST 200, medicalCaseId=8 |
| Vet → `/medical/cases/8` | Một lần khám FIT rồi đóng ca tối thiểu | Không bắt tạo phác đồ/tái khám; CLOSED và incident 10 RESOLVED |
| Vet → `/incidents/11` | Đóng trực tiếp sự cố không cần ca | Review POST 200; refresh/SQL RESOLVED |
| Vet → `/medical/cases/new` | Chọn ngựa qua picker, tạo ca độc lập 9; khám rồi đóng | POST 201/200; danh sách tìm đúng nhãn QA, SQL CLOSED |
| Vet → `/medical/herd-health` | Xem tổng quan sức khỏe và khả năng tập riêng | API 200, bảy ngựa; nhãn sức khỏe/tập tách riêng |
| HT → `/medical/summary?horseId=7` | Xem tóm tắt không lâm sàng | UI/GET 200; phản hồi case summary không có reason/exam/diagnosis/plan |
| Groom → `/care/daily` | Lọc ngựa QA, hoàn thành việc 00:00 | POST 200, refresh/SQL task 4 đã hoàn thành; task 5 lúc 23:59 không có nút Hoàn thành |
| Manager → `/inventory` | Nhập 15 kg rồi xuất 2 kg, có lý do | Hai POST 201; refresh và SQL tồn 13, hai stock_movement +15/-2 |
| Groom → `/inventory` | Đề nghị bổ sung 3 kg | POST 201; replenishment có bản ghi nhưng tồn vẫn 15 trước lần xuất, cuối cùng 13 |

Hạn chế **gắn caseId** được tạo qua API setup vì màn tạo restriction hiện không có ô chọn ca. Thao tác gỡ hạn chế dùng UI thật. Không suy ra đã kiểm UI tạo mọi dạng restriction/quy tắc bài tập.

## Phân quyền và SQL

- Groom GET chi tiết ca lâm sàng: **403**.
- Groom POST nhập/xuất kho: **403**, tồn không đổi.
- HT GET ca: chỉ nhận summary, không có nội dung lâm sàng.
- [SQL readback](evidence/duc-local-main-20261119/sql-readback.txt): **SQL_READBACK_PASS**. Có xác nhận case 7/8/9 CLOSED; incident 9/10/11 RESOLVED; task 6 và task 4 hoàn thành bởi đúng Groom; task tương lai chưa hoàn thành; restriction 5 được gỡ; kho 13 kg; số tài khoản 19.
- [API responses và SHA](evidence/duc-local-main-20261119/result.json) phân biệt setup/verification API với request do UI phát sinh. 409 đóng ca sớm và hai 403 là kết quả mong đợi.

## Ảnh thực tế

- [Chặn đóng ca](evidence/duc-local-main-20261119/local-closure-blocked.png) · [Groom đã làm](evidence/duc-local-main-20261119/local-groom-treatment-done.png) · [Ca đã đóng](evidence/duc-local-main-20261119/local-case-closed.png).
- [Chăm sóc](evidence/duc-local-main-20261119/local-daily-care.png) · [Kho](evidence/duc-local-main-20261119/local-inventory.png).
- [HT summary](evidence/duc-local-main-20261119/local-head-summary.png) · [Herd Health](evidence/duc-local-main-20261119/local-herd-health.png) · [Danh sách ca](evidence/duc-local-main-20261119/local-case-list.png).

## PR #61 và phần còn lại

- Lỗi guard khi lưu pending đã sửa tại `920ab43ba88d012572e39c90c2abc5e706d60658`, push cùng PR #61 và chuyển Ready để Long re-review; không tự merge/dismiss review.
- Hai deferred test tái hiện FAIL trên HEAD cũ, sau sửa cả **120/120 medical tests**, lint, typecheck/build/bundle guard và policy **7/7 PASS**. Chrome kiểm delayed success/failure/Back, giữ draft và Back hợp lệ sau success.
- Guard mới chỉ phủ route soạn phác đồ, không tuyên bố đã bảo vệ mọi form khám/chấn thương. Không lưu bản nháp y tế vào browser storage.
- Không gặp lỗi sản phẩm ngoài dự kiến trong các thao tác main đã thử ở trên. Ảnh sự cố vẫn chờ quyết định contract/phạm vi; không triển khai thêm. Quy tắc tổng distanceM thuộc phạm vi đang chốt, không thay đổi trong batch này.
- Chưa thử lại full bốn flow. Groom precheck → Rider → Trainer/Owner, Template/Trainer/điều chỉnh, Owner/nhân sự và thông báo Trainer về phác đồ không được xác nhận bởi lượt này. Đây là báo cáo đoạn Vet/Groom/HT y tế và chăm sóc/kho của Đức.
- Mật khẩu, token, DPAPI/account files không nằm trong gói bằng chứng này. Các bản ghi QA được giữ để đọc lại; không xóa dữ liệu lịch sử.
