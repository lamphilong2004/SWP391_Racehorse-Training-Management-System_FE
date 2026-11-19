# Chọn test cho phần Medical, Groom, Owner và History

Đọc cùng [bản đồ source](DUC-CODE-MAP.md). Đây là mục lục các test đã có, không phải báo cáo chạy mới hoặc lời khẳng định mọi nhánh đều được phủ.

## Chọn theo điều vừa sửa

| Nội dung cần kiểm tra | Test hiện có | Ví dụ hành vi test đang kiểm |
|---|---|---|
| Soạn/lưu phác đồ | [TreatmentPlanEditor.test.tsx](../src/features/medical/TreatmentPlanEditor.test.tsx) | Giữ input khi lỗi, task đã lưu, chọn Groom theo tên, validation và trạng thái dirty khi pending |
| Điều hướng và các màn ca y tế | [integration.test.tsx](../src/features/medical/integration.test.tsx) | Lưu qua adapter/route, Back/guard trong luồng phác đồ và các màn y tế |
| Sự cố và nguồn báo cáo | [Incidents.test.tsx](../src/features/medical/Incidents.test.tsx) | Vet mở/gắn/đóng ca theo response thật của fixture; Groom chỉ đọc báo cáo phù hợp; tình trạng ngựa loading/error/retry |
| Groom hoàn thành việc điều trị | [GroomTasks.test.tsx](../src/features/medical/GroomTasks.test.tsx) | Chờ server xác nhận, chống nhấp đúp, đọc lại, filter và bỏ response cũ khi rời màn |
| Liên kết Vet → Groom | [crossRole.test.tsx](../src/features/medical/crossRole.test.tsx) | Phác đồ giao việc → phiên Groom → hoàn thành → Vet đọc lại; dùng fixture có kiểm soát, không phải SQL Server thật |
| Reader dữ liệu/role HT | [horseRead.test.tsx](../src/features/medical/horseRead.test.tsx), [MedicalSummary.test.tsx](../src/features/medical/MedicalSummary.test.tsx) | Nhận dạng/summary hợp lệ, quyền và dữ liệu được phép hiển thị |
| Owner API | [ownerApi.test.ts](../src/features/owner/ownerApi.test.ts) | Ba endpoint chi tiết đúng, profile sai id bị chặn, trường thiếu không thành metric giả, HTTP lỗi không fallback sample |
| Owner UI/mount | [OwnerPage.test.tsx](../src/features/owner/OwnerPage.test.tsx), [ownerApplicationRoutes.test.tsx](../src/features/owner/ownerApplicationRoutes.test.tsx) | Trang Owner và binding/redirect của ứng dụng, tách với việc kiểm SQL |
| Timeline/checklist/readiness | [history.test.ts](../src/features/horses/history/history.test.ts), [historyFlow.test.tsx](../src/features/horses/history/historyFlow.test.tsx), [historyApplication.test.tsx](../src/features/horses/history/historyApplication.test.tsx) | 5 mandatory + 1 recommended, 204 acknowledge, ngày giờ/phân trang, lỗi HTTP và không tự đổi lifecycle |
| Chăm sóc/kho | [StableCarePage.test.tsx](../src/features/stable-care/StableCarePage.test.tsx), [stableCareApi.test.ts](../src/features/stable-care/stableCareApi.test.ts) | Role, lịch, task, báo bất thường, yêu cầu bổ sung, nhập/xuất và giữ draft khi lỗi |
| Nhãn quá giờ/cần làm | [careTaskPhase.test.ts](../src/features/stable-care/careTaskPhase.test.ts) | Mốc quá giờ 60 phút, việc đã hoàn thành/hủy không đổi lại trạng thái, nhãn dinh dưỡng |

## Chạy ở Terminal của thư mục FE

Sau khi đã cài dependencies đúng lockfile, chọn nhóm liên quan thay vì chạy lại toàn bộ mọi lần sửa:

```powershell
# Chỉ form phác đồ và các route y tế liên quan
npx vitest run src/features/medical/TreatmentPlanEditor.test.tsx src/features/medical/integration.test.tsx

# Owner hoặc History
npx vitest run src/features/owner
npx vitest run src/features/horses/history

# Chăm sóc/kho và các helper thời gian
npx vitest run src/features/stable-care

# TypeScript + bundle Production, chưa khởi động API hay deploy
npm run build
```

Muốn kiểm toàn module y tế thì dùng `npx vitest run src/features/medical`. Lint có thể chọn file vừa sửa bằng `npx eslint <duong-dan-file>`; thay placeholder bằng đường dẫn thật. Scripts hợp lệ nằm trong [package.json](../package.json).

## Đọc kết quả cho đúng

- `passed` nghĩa các assertion trong lượt test đó đạt, không phải mọi màn đều đã chạy bằng browser hay SQL.
- File dùng vi.mock/fetch fixture/sample adapter không chứng minh API thật hoặc trạng thái DB. Có mô phỏng HTTP 500 cũng không có nghĩa Backend thật vừa bị 500.
- Cảnh báo console cần đọc riêng với failed assertion. Khi test fail, lưu tên case, dòng lỗi và thay đổi gây lỗi; không xóa assertion để làm xanh số lượng.
- Không gọi build, test fixture hay ảnh preview là FE → BE → SQL PASS. Dùng [báo cáo runtime](DUC-LOCAL-MAIN-SMOKE-20261119.md) để xem SHA/DB/time của những lượt thật đã được ghi nhận.
- Chỉ sửa Markdown/comment không cần tự ghi dữ liệu demo hoặc chạy seed để chứng minh đã kiểm tra. Với thay đổi logic, chọn tests liên quan rồi mới mở rộng khi có lỗi hoặc lo ngại cụ thể.
