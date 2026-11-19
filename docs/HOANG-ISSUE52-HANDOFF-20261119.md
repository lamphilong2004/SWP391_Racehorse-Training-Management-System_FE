# Hoàng — issue #52 — bàn giao ngày 19/11/2026

Phạm vi theo [phân công](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/issues/52#issuecomment-6999240464): Template Library/phiên bản mẫu, duyệt/từ chối điều chỉnh, tài khoản/thông báo H3 và kiểm chứng đoạn nghiệp vụ Head Trainer. #56/#57/#58 đã merge; không làm lại. Bản bàn giao dành cho Draft PR, còn thiếu bằng chứng browser/ảnh như ghi dưới đây.

## Thay đổi và route

| Route | Trước | Sau / bằng chứng |
| --- | --- | --- |
| `/training/templates` | Nút lưu phiên bản mới bị vô hiệu khi xem bản cũ nhưng không chỉ cách tiếp tục. Lỗi lưu trữ còn hiện khi chuyển sang sao chép. | Hiện phiên bản mới nhất và nút mở bản đó; nêu rõ sao chép dùng bản đang xem. Xóa lỗi của thao tác trước khi mở xác nhận mới. 7 test gồm xem bản cũ → bản mới → editor, sao chép và lỗi API. |
| `/training/adjustment-requests` | Duyệt/từ chối làm hàng biến mất khỏi bộ lọc Chờ duyệt, không có xác nhận kết quả. | Hiện xác nhận từ response API, ngựa/chương trình và liên kết mở lại. Duyệt chỉ ghi quyết định, hướng dẫn chọn Đã duyệt để áp dụng. Về trang 1 sau quyết định; chặn submit trùng bằng ref; giữ lý do khi lỗi. 8 test gồm approval/rejection, lỗi chậm, quyền Trainer, validation và apply. |
| `/notifications`, drawer từ header | Đánh dấu mục cuối ở trang sau trong bộ lọc Chưa đọc có thể để người dùng ở trang rỗng ngoài tổng số trang mới. | Sau server xác nhận đã đọc, về trang 1 trong bộ lọc Chưa đọc. Giữ cách provider đọc lại unread count từ server. 29 test gồm badge/header/drawer, lỗi, đổi phiên đăng nhập, idempotency và phân trang. |
| `/account` | Đã có lưu hồ sơ, đổi mật khẩu, thông báo kết quả và guard rời trang. | Giữ source hiện có; thêm 4 test cho payload tên đã trim, giữ bản nháp mật khẩu khi lưu hồ sơ, guard, lỗi server, mismatch và retry. Email/vai trò giữ nguyên. Không đổi mật khẩu thật. |
| `/training/programs/new`, `/training/programs/1` | Wizard/workspace đã được nghiệm thu ở #57. | Giữ source. Test chương trình/route có trong lượt 129 focused tests. Luồng HTTP thật tạo/đọc lại được mô tả dưới đây; chưa có browser E2E của lượt này. |

Chỉ sửa ba component màn hình; thêm/cập nhật test và hồ sơ bằng chứng. Tái sử dụng `Button`, `AlertBanner`, drawer/modal và token/component chung; không thêm dependency, API, JWT/RBAC, schema hay nghiệp vụ.

## Kiểm chứng trên SQL Server local

- FE base: `c211075c9ce12e4207d4d68d08b70e72c770b512` cùng các thay đổi local trong bản bàn giao này. Không gọi đây là FE main đã merge bản sửa.
- BE main: `ee7fde6bc1789795ae0d7b561df2d13d4878c61d`, build Java 21 đạt. Không sửa source BE.
- DB test mới: `racehorse_local_hoang_issue52_20261119`. Installer chuẩn tạo schema và tài khoản/reference riêng, strict JDBC TLS, Hibernate validate. Không reset/reseed/đổi mật khẩu hoặc sửa hàng trong các DB cũ.
- Bộ dữ liệu: `QA-HOANG52-111932`; thử API lúc **11:19:32–11:19:37 ngày 19/11/2026, UTC+7**. HTTP qua FE proxy `127.0.0.1:5173` đến BE `127.0.0.1:8080`. Không HTTP fixture.
- [Ledger 50 request và kết quả](evidence/issue-52-hoang-final/api-smoke.json). [SQL readback trực tiếp](evidence/issue-52-hoang-final/sql-readback.txt).

| Role → màn tương ứng | Thao tác qua HTTP thật | Kết quả và đọc lại |
| --- | --- | --- |
| Club Manager/Vet → thiết lập ngựa | Tạo ngựa, phả hệ, owner, chuồng và baseline FIT | Các POST 201, PUT 200. Ngựa ID 1, `RH-001`, chuyển ACTIVE; HT đọc activation-status 200. |
| HT → Template Library | Tạo mẫu v1, lưu v2, tìm mẫu, đọc v1, sao chép v1, lưu trữ bản sao | Tạo/phiên bản/sao chép 201; đọc/lưu trữ 200. Bản v1 giữ mục tiêu gốc; bản sao đúng v1. |
| HT → wizard/chi tiết | Đọc gợi ý mẫu/Trainer phù hợp, tạo chương trình từ v2, đọc lại hai lần | POST `/api/training-programs` 201; GET chi tiết 200. Program 1 ACTIVE, ngựa 1, Trainer 3, templateVersionId 2. |
| HT → Template Library/chi tiết | Sau khi tạo chương trình, lưu mẫu v3 rồi GET chương trình mới | v3 được tạo 201; chương trình vẫn dùng source v2. SQL xác nhận latest=3, source=2. |
| Trainer → yêu cầu điều chỉnh | Gửi đề xuất mục tiêu rồi thử tự duyệt | Tạo 201; Trainer tự duyệt nhận 403. |
| HT → yêu cầu điều chỉnh | Duyệt request 1 rồi đọc lại trước áp dụng | POST approve 200, trạng thái APPROVED. Giai đoạn vẫn có mục tiêu cũ. |
| HT → áp dụng điều chỉnh | PUT phases với adjustmentRequestId=1 | 200; GET mới xác nhận `Controlled recovery`, customized=true; SQL có đúng một audit áp dụng. |
| Trainer/HT → từ chối | Trainer gửi request 2; HT thử lý do trống, sau đó lý do hợp lệ | 201; lý do trống 400; từ chối hợp lệ 200 REJECTED. Trainer GET đọc được cả APPROVED/REJECTED. |
| Trainer → thông báo | Đọc một mục, đọc lại cùng mục, đánh dấu tất cả và tải danh sách mới | PATCH/POST/GET 200. Unread 3 → 2 → 2 → 0. SQL có ba thông báo, tất cả read_at đã được lưu. |
| HT → tài khoản | PUT fullName của tài khoản test rồi GET mới | 200; tên lưu đúng, email/vai trò không đổi. SQL xác nhận hồ sơ tồn tại. |

Các thao tác trên được thực hiện bằng HTTP và đọc SQL. Chúng **không phải** bằng chứng bấm wizard, refresh trình duyệt, bố cục mobile hoặc full E2E bốn flow. Không ghi nhận password change thật là PASS; thao tác này chỉ được test với request fixture trong unit test.

## Cách kiểm tra bản sửa

Chạy trong FE worktree:

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=2 src/features/program-creation src/shared/notifications src/pages/AccountPage.test.tsx src/app/router.test.tsx src/app/mainFlowRoutes.test.tsx src/features/administration/accountApi.test.ts
node node_modules/eslint/bin/eslint.js src/features/program-creation/TemplateLibraryPage.tsx src/features/program-creation/TemplateLibraryPage.test.tsx src/features/program-creation/AdjustmentRequestsPage.tsx src/features/program-creation/AdjustmentRequestsPage.test.tsx src/features/administration/NotificationsPage.tsx src/shared/notifications/NotificationsProvider.test.tsx src/pages/AccountPage.test.tsx
npm run typecheck
npm run build
node scripts/design-system-policy.check.mjs
git diff --check
```

Kết quả: **129/129 focused tests**, ESLint các file sửa, typecheck, build và `PRODUCTION_BUNDLE_OK` đạt; design-system policy **7/7**. Trước sửa, 5 case mới thất bại; sau sửa đều đạt. Có tổng cộng 10 regression tests mới. Các thay đổi nhỏ sau lượt 129 test được kiểm tra lại trong log `verification-summary.json`.

Build vẫn phát cảnh báo từ `AppShell.module.css` không sửa trong lượt này:

```text
[lightningcss minify] Unknown at rule: @reference
```

Không thêm abstraction/dependency; giữ logic ở các màn sở hữu state. Không có phần có thể xóa thêm mà vẫn giữ đủ hành vi và bằng chứng kiểm thử đã giao.

## Phần còn chặn trước nghiệm thu UI

Computer Use dừng trên Windows vì không xác định chắc URL Chrome để thực thi policy. IAB mở localhost trước đó nhận `net::ERR_CONNECTION_TIMED_OUT`. Không dùng phương thức UI khác để vượt chặn. **Ảnh Before/After, desktop/mobile/keyboard browser smoke và wizard qua UI còn PENDING.**

Khi browser được dùng lại, kiểm tra:

1. Template Library: tìm mẫu test, mở v1, dùng **Xem phiên bản mới nhất**, kiểm tra editor bắt đầu từ bản mới nhất. Ảnh trước/sau ở drawer lịch sử và modal lỗi → mở sao chép.
2. Adjustment: dùng request PENDING mới trên DB test; duyệt/từ chối, đọc xác nhận và mở chi tiết; kiểm tra approved không tự đổi phases. Kiểm tra lỗi giữ lý do, submit chậm không gửi trùng.
3. Notifications: tạo hơn 20 thông báo test, lọc Chưa đọc, sang trang cuối rồi đánh dấu đọc mục cuối. Phải về trang 1, badge bằng unread API; kiểm tra drawer cùng tài khoản.
4. Account: sửa tên, lưu và refresh; nhập bản nháp chưa lưu rồi rời trang. Không thay mật khẩu demo dùng chung.
5. Chạy wizard chọn ngựa ACTIVE mới → mẫu/Trainer phù hợp → tạo → liên kết chi tiết → reload, rồi xử lý đề xuất Trainer. Chụp ở desktop và 390 px, xác nhận không tràn viewport.

Hoàng đã cho phép commit/push, mở Draft PR và cập nhật issue #52. Giữ Draft đến khi bổ sung đủ ảnh/browser; không coi việc code/API/SQL đạt là đã nghiệm thu toàn bộ yêu cầu có ảnh/browser.
