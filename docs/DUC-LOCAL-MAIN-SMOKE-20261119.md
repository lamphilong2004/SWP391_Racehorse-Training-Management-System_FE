# Đức — kiểm thử main với API và SQL Server thật, 19/11/2026

## Bản chạy và dữ liệu

- FE main: `d6f17f719b6d7819fb8e2eb82c22bbc270630c5e`.
- BE main: `ee7fde6bc1789795ae0d7b561df2d13d4878c61d`, JAR build lại từ main sạch ngày 19/11.
- Khoảng thử: **10:40–10:49 ngày 19/11/2026, giờ Việt Nam (UTC+7)**; giờ kiểm SQL nằm trong file readback.
- FE development `http://127.0.0.1:5190`, proxy BE `http://127.0.0.1:8081`, SQL Server local `racehorse_local_duc_20261111`, TLS thật/JPA validate.
- Bộ mới `QA-DUC-20261119-612344`, ngựa RH-007/id 7. Tạo bằng API; không reset/seed lại DB, không thay mật khẩu, không sửa sáu ngựa cũ. DB vẫn có 19 tài khoản.
- Chạy trực tiếp source main và JAR mới; **không dùng launcher/artifacts 11/11**. Leader vẫn phụ trách đối chiếu launcher trên máy Long.

Đây là browser/API/SQL thật, không intercept HTTP và không sample fallback. Chuỗi ghi SQL dưới đây được pin tại `d6f17f7`; xem mục đọc lại sau merge #61 để phân biệt với main mới.

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

- [Chặn đóng ca](evidence/duc-local-main-20261119/local-closure-blocked.png) · [Groom đã làm](evidence/duc-local-main-20261119/local-groom-treatment-done.png) · [Ca đã đóng — đọc lại trên c211075 lúc 10:57 UTC+7](evidence/duc-local-main-20261119/local-latest-main-closed.png).
- [Chăm sóc](evidence/duc-local-main-20261119/local-daily-care.png) · [Kho](evidence/duc-local-main-20261119/local-inventory.png).
- [HT summary](evidence/duc-local-main-20261119/local-head-summary.png) · [Herd Health](evidence/duc-local-main-20261119/local-herd-health.png) · [Danh sách ca](evidence/duc-local-main-20261119/local-case-list.png).

Ảnh `local-case-closed.png` cũ chỉ chụp màn đang tải, không dùng làm bằng chứng trạng thái ca đã đóng. Đính chính liên kết ảnh, giữ nguyên SHA, thời gian, SQL readback và nội dung các lượt thử cũ.

## PR #61 và phần còn lại

- Lỗi guard khi lưu pending đã sửa tại `920ab43ba88d012572e39c90c2abc5e706d60658`. Long re-review/approve rồi merge #61 vào main `c211075c9ce12e4207d4d68d08b70e72c770b512`; tác giả không tự approve/merge/dismiss review.
- Hai deferred test tái hiện FAIL trên HEAD cũ, sau sửa cả **120/120 medical tests**, lint, typecheck/build/bundle guard và policy **7/7 PASS**. Chrome kiểm delayed success/failure/Back, giữ draft và Back hợp lệ sau success.
- Guard mới chỉ phủ route soạn phác đồ, không tuyên bố đã bảo vệ mọi form khám/chấn thương. Không lưu bản nháp y tế vào browser storage.
- Chuỗi ghi nghiệp vụ ở trên không gặp lỗi ngoài dự kiến. Ở lượt bổ sung bên dưới phát hiện lỗi hiển thị loading nhỏ, đã sửa riêng trong #64, chưa nằm trong main được thử. Ảnh sự cố vẫn chờ quyết định contract/phạm vi; không triển khai thêm. Quy tắc tổng distanceM thuộc phạm vi đang chốt, không thay đổi trong batch này.
- Chưa thử lại full bốn flow. Groom precheck → Rider → Trainer/Owner, Template/Trainer/điều chỉnh, Owner/nhân sự và thông báo Trainer về phác đồ không được xác nhận bởi lượt này. Đây là báo cáo đoạn Vet/Groom/HT y tế và chăm sóc/kho của Đức.
- Mật khẩu, token, DPAPI/account files không nằm trong gói bằng chứng này. Các bản ghi QA được giữ để đọc lại; không xóa dữ liệu lịch sử.

## Đọc lại trên main sau merge #61

- FE local đã fast-forward tới `c211075c9ce12e4207d4d68d08b70e72c770b512`; BE giữ `ee7fde6`.
- Lúc **10:57 ngày 19/11, UTC+7**, browser/API thật đọc lại ca 7 CLOSED, không còn nút ghi khám; task Groom 6 vẫn checked/disabled; tồn kho vẫn 13 kg. Không gửi thêm thao tác ghi nghiệp vụ.
- Chạy regression Chrome deferred success/failure/Back trên main `c211075`: PASS. Lượt này dùng HTTP fixture có kiểm soát, không phải API ghi SQL thật.
- Không chạy lại toàn bộ chuỗi ghi hoặc full bốn flow sau merge; bằng chứng ghi thật vẫn là pin `d6f17f7` ở trên.
- Ảnh main mới: [Ca](evidence/duc-local-main-20261119/local-latest-main-closed.png) · [Groom](evidence/duc-local-main-20261119/local-latest-main-groom.png) · [Kho](evidence/duc-local-main-20261119/local-latest-main-stock.png).


## Bổ sung theo phân công mới — 11:03–11:04, UTC+7

FE main `c211075c9ce12e4207d4d68d08b70e72c770b512`; BE main và DB giữ nguyên. Không dùng HTTP fixture cho lượt ghi này.

| Role → route | Thao tác | API / đọc lại |
|---|---|---|
| CM, API setup | Thêm nutrition plan cho đúng ngựa QA 7, Groom 6, hôm nay 00:00, HAY 1 kg | POST nutrition-plans 201; không sửa plan/ngựa cũ |
| Groom → `/care/daily` | Hoàn thành nutrition task **7** rồi refresh | POST tasks/7/complete 200; SQL completed_by=6; tồn trước/sau **13 kg**, số phiếu kho vẫn **2** |
| Groom → cùng dòng → Báo bất thường | Bỏ ăn, mức thấp, mô tả có nhãn QA; gửi và mở Theo dõi báo cáo | POST incidents 201 → **incident 12**, horseId=7, careTaskId=7, reportedBy=6; refresh vẫn đọc được |
| Vet → `/incidents/12` | Đọc đúng báo cáo và đóng sự cố | POST incidents/12/review 200; refresh + SQL **RESOLVED** |
| HT, API read | Kiểm tra bàn giao trạng thái sau xử lý | GET horses/7/training-availability 200 → **AVAILABLE** |
| Trainer / Work Rider, API read | Kiểm tra phạm vi quyền | Hai GET trả **403 đúng phạm vi**: ngựa QA chưa có program/session được giao. Chưa nghiệm thu việc Trainer/Rider bắt đầu tập lại; bàn giao ID ngựa 7 cho người phụ trách Flow 2, không bypass phân công. |

- [SQL bổ sung](evidence/duc-local-main-20261119/local-supplement-readback.txt): **SUPPLEMENT_SQL_READBACK_PASS**; [SELECT/assertions](evidence/duc-local-main-20261119/local-supplement-readback.sql). Giữ nguyên 19 tài khoản.
- Ảnh: [Hoàn thành cho ăn](evidence/duc-local-main-20261119/local-care-no-auto-stock.png) · [Biên nhận báo cáo](evidence/duc-local-main-20261119/local-care-incident-receipt.png) · [Groom đọc lại](evidence/duc-local-main-20261119/local-care-incident-detail.png) · [Vet đã xử lý](evidence/duc-local-main-20261119/local-care-incident-vet-resolved.png).
- Phát hiện thẻ tình trạng ngựa hiển thị “Không tải được” khi request còn pending, sau đó dữ liệu vẫn lên đúng. Sửa nhỏ và ảnh trước/sau ở **PR #64**, chưa merge: loading đúng, lỗi thật có retry; 29 focused tests/lint/typecheck/build/bundle và policy 13/13 PASS. Chrome delay/error trong #64 là fixture riêng, không tính là SQL E2E.
- Lượt ghi mới chỉ phủ care/incident bổ sung; không chạy lại nguyên chuỗi medical ghi trên main c211075. Không suy ra full bốn flow PASS.
