# Đức — kịch bản thao tác demo Vet/Groom và hỗ trợ Flow 4

## Chọn đúng môi trường trước khi trình bày

- Bản đã tập dượt đọc lại ngày 19/11: FE main `0e49e04a160bdb476a528565fefea35476023aac`, BE main `ee7fde6bc1789795ae0d7b561df2d13d4878c61d`.
- Máy Đức: FE `http://127.0.0.1:5190`, BE `http://127.0.0.1:8081`, DB `racehorse_local_duc_20261111`. Không mặc định launcher/link 5173 đang chạy cùng bản này.
- Trên máy Long: Long xác nhận FE/BE SHA, DB, nhãn dữ liệu và tài khoản của môi trường đó. Dùng bộ Y mới nhất cho Đức và bộ L cho phần Long. Không lấy ID ngựa/ca/task của máy Đức nhập sang máy khác.
- Mỗi lần đổi role: bấm tên người dùng → Đăng xuất → đăng nhập role tiếp theo. Mật khẩu lấy từ bộ tài khoản được cấp riêng, không chép vào tài liệu/GitHub.
- Phân công gốc: Đức trình bày Flow 3; Flow 4 dưới đây là phần hỗ trợ kiểm chứng cho Long. Không tự tạo lại dữ liệu/seed DB để có ảnh.

## Flow 3 — trình bày bằng bộ Y đã chuẩn bị trên máy demo

Giữ nguyên ngày giờ đang được form điền nếu đúng thời điểm demo. Các câu chữ sau chỉ là dữ liệu minh họa phần mềm, không phải hướng dẫn điều trị thật. Chỉ ghi trên bộ demo được cho phép.

| Bước / role | Bấm đâu và nhập gì | Kết quả cần nhìn thấy / câu nói |
|---|---|---|
| 1. Vet — Bác sĩ thú y | Sự cố `/incidents` → tìm đúng nhãn bộ Y → mở báo cáo Bỏ ăn của **Sương Mai** → Đóng sự cố → xác nhận | Đã xử lý; refresh còn trạng thái này. “Báo cáo không cần điều trị có thể đóng trực tiếp.” |
| 2. Vet — ca tối thiểu | Báo cáo móng/chân của **Sương Mai** → Mở ca y tế → tab **Khám**. Triệu chứng: `Kiểm tra theo báo cáo móng/chân - demo`; tình trạng: **Khỏe** → Lưu lần khám → Đóng ca → xác nhận | Ca Đã đóng và sự cố liên quan tự Đã xử lý. Không bắt tạo phác đồ/tái khám nếu checklist không yêu cầu. |
| 3. Vet — ca đầy đủ | Báo cáo mức cao của **Hắc Phong** → Mở ca y tế → **Khám**. Triệu chứng: `Đi không đều chân trước trái - demo`; chẩn đoán: `Chấn thương chân trước trái - dữ liệu demo`; mức độ Trung bình; tình trạng **Chấn thương** → Lưu lần khám | Lần khám lưu ở đúng ca/ngựa. “Vet ghi nhận sức khỏe; báo cáo của Groom tự nó không quyết định chẩn đoán.” |
| 4. Vet — chấn thương | Tab **Chấn thương** → Vị trí: chọn vùng phù hợp hoặc **Khác** rồi nhập `Chân trước trái - demo`; mức độ Trung bình; hồi phục **Chưa hồi phục** → Lưu chấn thương | Vị trí hiển thị bằng chữ theo DEC-015. |
| 5. Vet — phác đồ | Tab **Điều trị** → **Mở trình soạn phác đồ điều trị**. Điều trị/dùng thuốc: `Theo chỉ định thú y trong kịch bản demo; không dùng thuốc thực tế`; chăm sóc: `Theo dõi biểu hiện đi lại`; nghỉ ngơi: `Theo kế hoạch thú y`; ngày tái khám: ngày phù hợp trong kịch bản | Đây là tab Điều trị, không phải tab tên Phác đồ. |
| 6. Vet — giao Groom | Thêm công việc cho Groom → chọn **đúng tên tài khoản Groom sẽ đăng nhập**; hướng dẫn: `Quan sát biểu hiện và ghi nhận theo chỉ định - demo`; ngày thực hiện: hôm nay; khung giờ: giờ phù hợp → **Lưu phác đồ điều trị** | Chỉ nói đã lưu sau khi server xác nhận. “Groom nhận công việc từ phác đồ, không tự đưa quyết định y tế.” |
| 7. Vet — hạn chế | Hạn chế tập luyện `/medical/restrictions` → mở form thêm, chọn đúng Hắc Phong → Khóa; lý do `Hạn chế theo ca demo Hắc Phong` → lưu theo form | Sức khỏe và khả năng tập luyện là hai trạng thái riêng. Không tự đặt ngưỡng/cấm bài ngoài dữ liệu được duyệt. Form restriction hiện không có ô chọn ca; không nói đã gắn caseId bằng UI. |
| 8. Vet — gắn báo cáo vào ca | Sự cố **Tuyết Sơn** → mục **Gắn vào ca đang mở** → chọn ca đang mở của chính Tuyết Sơn → **Gắn vào ca** | Một báo cáo mới được liên kết hồ sơ đang theo dõi của cùng ngựa; không phải tự kết luận “bệnh giống nhau nên chữa giống nhau”. |
| 9. Groom — Nhân viên chăm sóc | Đăng xuất Vet → đăng nhập Groom được giao → **Công việc điều trị** `/care/tasks` → đúng ngày, đúng Tuyết Sơn/bộ Y → hoàn thành đúng việc; refresh | Việc vẫn hoàn thành và không bấm lại được. Nếu không thấy: kiểm ngày, tên Groom và ca/task, không đổi quyền. “Hoàn thành công việc không tự gỡ khóa y tế.” |
| 10. Vet — hồi phục | Đăng nhập Vet → ca **Thiên Mã** bộ Y (đã có việc Groom hoàn thành) → **Tái khám**. Hồi phục: **Đã hồi phục**; kết quả: `Tái khám theo kịch bản demo, đủ điều kiện hồi phục`; tình trạng **Khỏe** → Lưu lần tái khám | Có bản ghi tái khám. Nếu còn restriction, khả năng tập vẫn Khóa. |
| 11. Vet — gỡ/đóng | Hạn chế tập luyện → đúng Thiên Mã → **Gỡ hạn chế** → **Xác nhận gỡ hạn chế**. Quay lại ca → đọc checklist → Đóng ca → xác nhận → refresh | Chỉ đóng khi server cho phép. Khả năng tập Sẵn sàng sau quyết định gỡ; ca Đã đóng; sự cố liên quan được xử lý. Không hứa đóng một ca sẽ gỡ mọi restriction. |
| 12. Head Trainer — Huấn luyện viên trưởng | Đăng nhập HT → **Tóm tắt y tế** `/medical/summary` → chọn đúng ngựa → xem sức khỏe và khả năng tập riêng | Chỉ tóm tắt theo quyền, không có chẩn đoán/thuốc/ghi chú lâm sàng. |

Nếu cần đi nguyên chuỗi trên một ngựa, dùng riêng một ca demo mới đã được chuẩn bị và đúng Groom. Bộ Y gốc dùng nhiều ngựa để các nhánh độc lập, không tự trộn các ca của Sương Mai/Hắc Phong/Tuyết Sơn/Thiên Mã thành cùng một hồ sơ.

## Flow 4 — đoạn hỗ trợ Long, đúng role và dữ liệu bộ L

| Role | Thao tác / dữ liệu dễ nhập | Kết quả cần nói |
|---|---|---|
| Club Manager — Quản lý CLB | `/stable` → An Khang đúng nhãn bộ L → xem kế hoạch chăm sóc/dinh dưỡng, Groom và ngày hiệu lực | Lịch chăm sóc được giao rõ ngày/giờ. Dùng plan có sẵn để tránh trùng khoảng thời gian. |
| Groom | `/care/daily` → đúng ngày → tìm An Khang/nhãn bộ L → Hoàn thành việc đã đến giờ → refresh; chỉ vào việc tương lai 23:30 để xem | Việc đến giờ ghi người/thời gian; việc chưa đến giờ không có nút hoàn thành. Chọn đúng ngày, không chờ chuông thông báo mới tìm việc. |
| Groom | Cùng dòng → **Báo bất thường** → loại Bỏ ăn, mức Thấp, thời điểm hiện tại, mô tả `Quan sát bất thường tại chuồng - demo` → Gửi sự cố → Theo dõi báo cáo | Server trả mã báo cáo và liên kết đúng ngựa/công việc. Báo bất thường không tự thay trạng thái sức khỏe hay xuất kho. |
| Groom | `/inventory` → đúng Cỏ khô Timothy/bộ L → **Đề nghị bổ sung** → số lượng `3`; lý do `Đề nghị thêm vật tư cho lịch chăm sóc demo` → Gửi yêu cầu bổ sung | Có yêu cầu, tồn kho không tăng vì chưa thực nhận. |
| Club Manager | `/inventory` → đúng vật tư → **Nhập / xuất**. Biến động `15`; lý do `Nhập vật tư cho demo` → **Ghi biến động thực tế** → refresh | Nếu tồn trước là q thì tồn sau q+15, không mặc định luôn là 15. |
| Club Manager | Cùng vật tư → biến động `-2`; lý do `Xuất vật tư cho chăm sóc demo` → ghi → refresh → xem Lịch sử nhập xuất | Tồn q+13, có hai phiếu và người ghi. Groom hoàn thành chăm sóc không tự trừ kho; Groom không có quyền ghi nhập/xuất. |

## Xem lại ngay trên máy Đức — không ghi thêm

Bộ `QA-DUC-20261119-612344` đã xử lý xong, **không dùng để bấm lại nguyên chuỗi**:

1. Vet → `/medical/cases/7`: ca Đã đóng; mở các tab Hồ sơ/Khám/Chấn thương/Điều trị/Tái khám để giải thích bản ghi đã lưu.
2. Vet → `/incidents/12`: báo cáo phát sinh từ chăm sóc đã xử lý, trạng thái ngựa tải bình thường.
3. Groom → `/care/tasks`: task 6 checked/khóa; `/care/daily` tìm nhãn QA: việc cho ăn 7 hoàn thành, việc 23:59 chưa hoàn thành.
4. Club Manager → `/inventory`: tìm nhãn QA → tồn **13 kg**, hai phiếu +15/-2, yêu cầu bổ sung 3.
5. HT → `/medical/summary?horseId=7`: tóm tắt, ngựa AVAILABLE. Đừng dùng ID này sang DB khác.

Đã tập dượt đọc 6 route trên main `0e49e04` bằng API thật, không HTTP fixture và không có thao tác ghi nghiệp vụ. Đây là kiểm tra đọc lại, không phải chạy lại toàn bộ chuỗi ghi sau merge.

## Bàn giao sang huấn luyện và câu trả lời dự phòng

- Trước phối hợp: xác nhận cùng môi trường/DB, nhãn ngựa, user Trainer, Groom, Rider, program/session và khung giờ. Hoàng phụ trách lập chương trình; Tiến phụ trách buổi tập/precheck/Rider.
- AVAILABLE chỉ là điều kiện y tế. Cần có program/session phân công đúng người, Groom precheck đạt, không còn chặn y tế và đến giờ thì Rider mới được bắt đầu. Không đổi RBAC hoặc làm API trả thành công giả để vượt bước.
- Ngựa QA 7 hiện chưa có assignment Trainer/Rider; 403 đúng phạm vi **không chứng minh Rider tập lại được**. Chờ người phụ trách Flow 2 xác nhận bằng thao tác trên đúng bộ dữ liệu.
- Ảnh đính kèm sự cố: chưa triển khai theo contract đã chốt; không hứa có upload. Thuốc đang là text; không tự tạo danh mục/đơn thuốc mới.
- Thông báo Trainer khi có phác đồ: chưa có bằng chứng trong lượt này. Chưa tuyên bố cả 4 flow PASS hay máy Long đã chạy thành công.
- Khi lỗi: ghi role, route, ngựa/ca/task, FE/BE SHA, DB, thời gian, HTTP/status và ảnh không chứa token/mật khẩu. Gặp 409 thì đọc checklist và tải lại, không gửi lặp hay chỉnh DB để vượt điều kiện.

[Biên bản tập dượt đọc lại main mới](evidence/duc-local-main-20261119/main-rehearsal-readonly.json).
