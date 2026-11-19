# Bản đồ đọc source FE trong phần bàn giao của Đức

Tài liệu để tìm nhanh file khi học code hoặc trình bày. Nó không thay thế Task Playbook/lịch sử Git để xác định tác giả, không tuyên bố mọi code trong các file liên kết đều do Đức viết.

## Mở code bằng VS Code

1. Mở thư mục FE, nhấn **Ctrl+P**, dán đường dẫn bắt đầu bằng `src/` ở bảng dưới.
2. Nhấn **Ctrl+Shift+O** để tìm tên component/hàm trong file.
3. Nhấn **F12** trên tên service/hàm để đi đến định nghĩa; **Alt+Left** quay lại vị trí vừa xem.
4. Chưa cần sửa code: đọc theo thứ tự màn hình → handler của nút → service → DTO/reader. Không đi vào `dist` hoặc `node_modules` để tìm source mình viết.

## Chức năng nào nằm ở đâu

| Màn/chức năng | File bắt đầu đọc | Đọc tiếp để hiểu dữ liệu |
|---|---|---|
| Danh sách, tạo và chi tiết ca Vet | [pages.tsx](../src/features/medical/pages.tsx): CaseListPage, CreateCasePage, CaseDetailPage | [service.ts](../src/features/medical/service.ts), [models.ts](../src/features/medical/models.ts) |
| Tab Khám, Chấn thương, Tái khám | [pages.tsx](../src/features/medical/pages.tsx): các MedicalForm trong CaseDetailPage | [MedicalForm.tsx](../src/features/medical/MedicalForm.tsx), [validation.ts](../src/features/medical/validation.ts) |
| Soạn phác đồ/giao việc Groom | [TreatmentPlanEditor.tsx](../src/features/medical/TreatmentPlanEditor.tsx) | TreatmentPlanPage trong pages.tsx gọi saveTreatment; task gửi theo assignedGroomUserId |
| Vì sao chưa đóng được ca | [CaseClosure.tsx](../src/features/medical/CaseClosure.tsx) | [errors.ts](../src/features/medical/errors.ts); luật cuối cùng ở Backend |
| Danh sách/chi tiết/xử lý sự cố | [Incidents.tsx](../src/features/medical/Incidents.tsx) | [incidentService.ts](../src/features/medical/incidentService.ts) kiểm DTO, action và phạm vi người xem |
| Việc điều trị của Groom | [GroomTasks.tsx](../src/features/medical/GroomTasks.tsx) | [groomService.ts](../src/features/medical/groomService.ts) đọc/hoàn thành đúng task được giao |
| Sức khỏe đàn ngựa | HerdHealthPage trong [pages.tsx](../src/features/medical/pages.tsx) | [horseRead.ts](../src/features/medical/horseRead.ts) đọc nhận dạng/health/availability đã cho phép |
| Tóm tắt y tế cho Head Trainer | [MedicalSummary.tsx](../src/features/medical/MedicalSummary.tsx) | [summaryService.ts](../src/features/medical/summaryService.ts) không dùng reader bệnh án Vet |
| Owner: My Horses/Profile/Health/Training | [OwnerPage.tsx](../src/features/owner/OwnerPage.tsx) | [OwnerProvider.tsx](../src/features/owner/OwnerProvider.tsx), [ownerApi.ts](../src/features/owner/ownerApi.ts), [ownerModel.ts](../src/features/owner/ownerModel.ts) |
| Phả hệ, sở hữu, xếp chuồng, Timeline | [HorseHistoryPanel.tsx](../src/features/horses/history/HorseHistoryPanel.tsx) | [historyApi.ts](../src/features/horses/history/historyApi.ts), [historyTypes.ts](../src/features/horses/history/historyTypes.ts) |
| HT ghi nhận readiness | [ReadinessReview.tsx](../src/features/horses/history/ReadinessReview.tsx) | parseChecklist/acknowledge trong historyApi.ts; không phải manual activation |
| Chăm sóc hằng ngày và kho trong phần hỗ trợ Flow 4 | [StableCarePage.tsx](../src/features/stable-care/StableCarePage.tsx) | [stableCareApi.ts](../src/features/stable-care/stableCareApi.ts), [careTaskPhase.ts](../src/features/stable-care/careTaskPhase.ts) |

## Đừng nhầm route, component và API

- Route là địa chỉ màn hình trên trình duyệt. Hằng số chung ở [routePaths.ts](../src/app/routePaths.ts), mount thực tế ở [router.tsx](../src/app/router.tsx). Xem thêm [medical/routes.tsx](../src/features/medical/routes.tsx) và [ownerApplicationRoutes.tsx](../src/features/owner/ownerApplicationRoutes.tsx) để hiểu adapter/mount của feature.
- Component là hàm React tạo giao diện và giữ state form, ví dụ TreatmentPlanEditor.
- Service là lớp gọi HTTP và chuyển dữ liệu, không phải database. Đường `/medical/cases/12` của FE khác `/api/medical/cases/12` của BE.
- `:caseId`, `:horseId` là biến của URL, không phải chữ phải nhập nguyên xi. ID phải lấy ở chính DB/bộ dữ liệu đang demo, không sao chép ID máy khác.

## Theo một lần bấm “Lưu phác đồ”

1. TreatmentPlanEditor giữ input trong React state và kiểm các trường bắt buộc.
2. Submit khóa nút/khóa gửi trùng rồi gọi onSave. Draft y tế không tự được ghi vào localStorage.
3. TreatmentPlanPage truyền onSave gọi `service.saveTreatment(caseId, request)`.
4. service.ts gửi PUT đến `/api/medical/cases/{caseId}/treatment-plan` qua shared requestApi/JWT.
5. Backend kiểm quyền, trạng thái ca và nghiệp vụ trước khi ghi; FE không làm bước SQL.
6. Sau khi API thành công mới cập nhật snapshot/đọc lại. Nếu đang pending hoặc API lỗi, không coi input là đã được lưu.

Đọc [authApi.ts](../src/shared/auth/authApi.ts) để hiểu envelope HTTP/ApiError và [runtime.tsx](../src/features/medical/runtime.tsx) để hiểu màn Vet lấy service từ đâu. Chỉ tham khảo shared auth/router, không sửa chúng khi chỉ cần giải thích một form.

## Ba điều thường bị hỏi

| Câu hỏi | Trả lời và điểm xem code |
|---|---|
| Groom tick xong có tự gỡ khóa không? | Không. Task hoàn thành và medical restriction là hai thao tác riêng; đọc GroomTasks, CaseClosure và service. |
| Owner thấy ngựa khác khi đổi URL không? | Backend kiểm quyền ở endpoint Owner; OwnerApi đọc profile trước các summary, không dùng danh sách mọi ngựa làm fallback. |
| Một bài test PASS có chứng minh SQL thật không? | Không. Xem test có inject fixture/mock hay dùng API thật; các báo cáo API/SQL cần pin SHA, DB, thời gian và readback riêng. |

Phần hướng dẫn này không đổi giao diện, nghiệp vụ, quyền hoặc dữ liệu. Các hướng dẫn Backend nằm trong thư mục `docs/duc-guides` của repo BE; đọc controller/service của đúng checkout, không lấy tài liệu làm bằng chứng API mới được triển khai.

Chọn đúng test theo thay đổi: [DUC-TEST-MAP.md](DUC-TEST-MAP.md).
