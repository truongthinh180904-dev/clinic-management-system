# BÁO CÁO KHẢO SÁT HỆ THỐNG & KẾ HOẠCH TRIỂN KHAI GIAI ĐOẠN 2 (`F2-01-01` / `P2-001`)
## HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK — `PHASE-02`)

- **Mã nhiệm vụ:** `F2-01-01` (`P2-001`)
- **Mã giai đoạn:** `PHASE-02` — Hoàn thiện Tài chính, Kho Dược, Báo cáo, UI Chuyên nghiệp (`shadcn/ui` + `lucide-react` + `recharts`) và Quản trị Vận hành
- **Ngày lập báo cáo:** `2026-10-27`
- **Trạng thái khảo sát:** `COMPLETED (READ-ONLY SURVEY — KHÔNG SỬA CODE ỨNG DỤNG TRONG LẦN CHẠY ĐẦU TIÊN)`

---

## PHẦN 1 — KẾT QUẢ KHẢO SÁT 10 HẠNG MỤC KỸ THUẬT

### 1. Cấu trúc Repository hiện tại
- `be/`: Backend Laravel Framework `^13.17` (PHP `^8.3`), cấu trúc MVC chuẩn REST API (`/api/v1/*`), FormRequests, API Resources, RBAC Middleware, 30 Migrations, 30 Eloquent Models, 17 Feature Test files (`285 tests / 2,602 assertions PASS`).
- `fe/`: Frontend Next.js `16.4.2` (App Router), React `19.3.0`, TypeScript `5`, Tailwind CSS `v4` (`@tailwindcss/turbopack`).
- `docs/phase-1/`: Lưu trữ đầy đủ tài liệu Giai đoạn 1 (`PHASE_1_TASKS.md`, `PHASE_1_REPORT.md`, `API_DOCUMENTATION.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `DATABASE_RELATIONSHIPS.md`, `DEVELOPMENT.md`, `INITIAL_AUDIT.md`, `KNOWN_ISSUES.md`).
- `docs/phase-2/`: Thư mục tài liệu đặc tả và báo cáo của Giai đoạn 2 (`F2-01-01_SURVEY_AND_PLAN.md`, `PHASE_2_TASKS.md`).
- `qlpk-autonomous-framework/`: Bộ điều phối đa mô hình (`run-agy.sh`, `ROADMAP.md`, `PROGRESS.md`, `MORNING.md`, kèm bản lưu trữ `ROADMAP-PHASE-1-ARCHIVE.md` và `PROGRESS-PHASE-1-ARCHIVE.md`).

### 2. Git Status và Nhánh hiện tại
- **Nhánh hiện tại:** `dev` (sạch 100%, `git status -s` không có thay đổi dở dang).
- **Nhánh `main`:** Giữ nguyên ở commit nền `65e29e7`.
- **Cơ chế Auto-Commit:** Đã tích hợp trong `qlpk-autonomous-framework/run-agy.sh` — tự động commit lên nhánh `dev` sau mỗi Task đạt `DONE` (`Test PASS` + `Reviewer PASS`).

### 3. Các chức năng đã hoàn thành ở Giai đoạn 1 (`PHASE-01` — `30/30 Tasks DONE`)
1. **Hạ tầng & CSDL (`P1-001` → `P1-007`):**
   - Khởi tạo và migrate thành công **30 bảng nghiệp vụ** trên MySQL `DBQLPK`.
   - Hoàn thiện **30 Eloquent Models** (27 Entity Models + 3 Pivot Models `RolePermission`, `UserRole`, `PackageService`) kèm đầy đủ relationships và casts.
   - Seeders idempotent cho 8 vai trò (`ADMIN`, `MANAGER`, `DOCTOR`, `RECEPTIONIST`, `CASHIER`, `ACCOUNTANT`, `EMPLOYEE`, `VIEWER`), 37 quyền cơ bản, 8 dịch vụ mẫu, 3 gói khám mẫu, 3 danh mục chi phí mẫu.
2. **Xác thực & Phân quyền RBAC (`P1-008` → `P1-010`):**
   - API `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/logout` với Bearer Token, kiểm tra tài khoản `ACTIVE`, Rate Limiting (`429`) và ghi `audit_logs`.
   - Middleware `CheckActiveUser` (`active_user`), `CheckRole` (`role`), `CheckPermission` (`permission`).
   - Giao diện `/login` và khung quản trị `AdminShell.tsx`.
3. **Nhân sự & Tài khoản (`P1-011` → `P1-013`):**
   - CRUD Nhân viên (`/api/v1/employees`) và Tài khoản (`/api/v1/users`) kèm quy tắc bảo vệ không khóa/xóa `ADMIN` cuối cùng.
4. **Bệnh nhân, Dịch vụ & Gói dịch vụ (`P1-014` → `P1-019`):**
   - CRUD Bệnh nhân (`/api/v1/patients`) có sinh mã `patient_code` an toàn và cảnh báo trùng hồ sơ (`duplicate_warnings`).
   - CRUD Dịch vụ (`/api/v1/services`), Gói dịch vụ (`/api/v1/service-packages`), Cấu hình dịch vụ trong gói (`/api/v1/service-packages/{id}/services`) và Cấp gói cho bệnh nhân (`/api/v1/patients/{id}/packages`).
5. **Lịch hẹn, Lượt khám & Bệnh án (`P1-020` → `P1-025`):**
   - CRUD Lịch hẹn (`/api/v1/appointments`) có kiểm tra chống trùng khung giờ bác sĩ/KTV.
   - CRUD Lượt khám (`/api/v1/visits`) kèm tự động khấu trừ buổi gói (`used_sessions`) bằng `DB::transaction()` + `lockForUpdate()`.
   - Hồ sơ bệnh án (`/api/v1/visits/{visit}/medical-record`) bảo mật theo quyền y tế và ghi `audit_logs`.

### 4. Cấu trúc Frontend hiện tại (`fe/`)
- `fe/app/`:
  - `login/page.tsx`: Màn hình đăng nhập.
  - `admin/`: Trang tổng quan và các trang quản trị.
  - `(admin)/`: Nhóm route dùng chung layout `AdminShell` (`patients`, `appointments`, `visits`, `services`, `packages`, `employees`, `users`).
- `fe/components/layout/AdminShell.tsx`: Khung layout quản trị hiện đang dùng emoji icons và Tailwind thuần, **cần được nâng cấp lên chuẩn `shadcn/ui` + `lucide-react` chuyên nghiệp ở `F2-01`**.
- `fe/lib/api/`: Chứa `client.ts` (HTTP wrapper chuẩn) và các module API client (`auth.ts`, `patients.ts`, `appointments.ts`, `visits.ts`, `services.ts`, `packages.ts`, `employees.ts`, `users.ts`).
- `fe/types/`: Định nghĩa TypeScript interfaces cho các phân hệ Giai đoạn 1.

### 5. Các Dependency hiện tại & Dependency cần cài đặt ở Giai đoạn 2
- **Hiện có trong `fe/package.json`:** `next@16.4.2`, `react@19.3.0`, `react-dom@19.3.0`, `tailwindcss@^4`, `typescript@^5`.
- **Cần cài đặt bổ sung ở Task `P2-002` (`F2-01-02`):**
  - `lucide-react`: Bộ icon vector chuẩn y tế & quản trị doanh nghiệp.
  - `recharts`: Thư viện biểu đồ tương tác cho Dashboard, Tài chính, Sổ quỹ, KPI và Báo cáo.
  - `clsx`, `tailwind-merge`, `class-variance-authority`: Bộ tiện ích cốt lõi(`cn()`) để xây dựng các component chuẩn `shadcn/ui` (`Button`, `Card`, `Badge`, `Dialog`, `Tabs`, `Table`, `Input`, `Select`, `Progress`, `DropdownMenu`, `Skeleton`, `StatCard`).

### 6. Cách kết nối Laravel API
- Frontend kết nối qua `fe/lib/api/client.ts` tới `NEXT_PUBLIC_API_BASE_URL` (mặc định `http://localhost:8000/api/v1`).
- Tự động đính kèm header `Authorization: Bearer <token>` từ `localStorage` (`qlpk_token`).
- Mọi API Backend trả về JSON envelope thống nhất:
  ```json
  {
    "success": true,
    "message": "Thông báo tiếng Việt rõ ràng",
    "data": {},
    "meta": {},
    "errors": null
  }
  ```

### 7. Cơ chế Xác thực và Phân quyền (RBAC)
- Backend sử dụng custom `token_bearer` guard kết hợp `auth:sanctum` và middleware `active_user`, `role`, `permission`.
- Trong `RolePermissionSeeder.php`, các quyền `invoices.*`, `payments.*`, `expenses.*`, `reports.view`, `settings.*` đã được tạo sẵn, nhưng **cần bổ sung thêm các permission keys chuyên biệt cho Giai đoạn 2** ở Task `P2-004` (`F2-02-01`):
  - `cash_transactions.view`, `cash_transactions.create`
  - `products.view`, `products.create`, `products.update`, `products.delete`
  - `inventory.view`, `inventory.in`, `inventory.out`, `inventory.adjust`
  - `kpi_targets.view`, `kpi_targets.manage`
  - `imports.manage`, `exports.view`
  - `notifications.view`, `approvals.view`, `approvals.manage`, `alert_rules.manage`

### 8. Cấu trúc Database liên quan đến Giai đoạn 2 (Đã có sẵn trên `DBQLPK` — KHÔNG CẦN CHẠY MIGRATION MỚI)
Qua đối chiếu thực tế các file migration từ `2026_10_26_000015` đến `2026_10_26_000028` và `be/app/Models/`, **100% các bảng của Giai đoạn 2 đã tồn tại trên MySQL `DBQLPK`**:
1. `invoices` (`Invoice`): `id`, `invoice_code`, `patient_id`, `visit_id`, `patient_package_id`, `subtotal_amount`, `discount_amount`, `total_amount`, `paid_amount`, `remaining_amount`, `status` (`UNPAID`, `PARTIAL`, `PAID`, `CANCELLED`), `issued_at`, `created_by`.
2. `payments` (`Payment`): `id`, `payment_code`, `invoice_id`, `amount`, `payment_method` (`CASH`, `BANK_TRANSFER`, `CARD`), `reference_code`, `payment_date`, `received_by`, `note`.
3. `expense_categories` (`ExpenseCategory`): `id`, `name`, `description`, `status`.
4. `expenses` (`Expense`): `id`, `expense_code`, `category_id`, `amount`, `payment_method`, `expense_date`, `description`, `approval_status` (`PENDING`, `APPROVED`, `REJECTED`), `created_by`, `approved_by`, `approved_at`.
5. `cash_transactions` (`CashTransaction`): `id`, `transaction_code`, `transaction_type` (`IN`, `OUT`), `reference_type`, `reference_id`, `amount`, `payment_method`, `transaction_date`, `description`, `created_by`.
6. `products` (`Product`): `id`, `product_code`, `name`, `unit`, `minimum_stock` (`DECIMAL(15,3)`), `status`. *(Lưu ý kỹ thuật: Tồn kho hiện tại `current_stock` được tính chính xác tuyệt đối từ bảng sổ cái `inventory_transactions`: `SUM(IN) - SUM(OUT) + SUM(ADJUST)`, đảm bảo tính bất biến kế toán kho và không cần sửa bảng `products`)*.
7. `inventory_transactions` (`InventoryTransaction`): `id`, `product_id`, `transaction_type` (`IN`, `OUT`, `ADJUST`), `quantity` (`DECIMAL(15,3)`), `reference_type`, `reference_id`, `transaction_date`, `created_by`.
8. `kpi_targets` (`KpiTarget`): `id`, `employee_id`, `period_start`, `period_end`, `target_revenue` (`DECIMAL(15,2)`), `target_visits` (`INT`), `created_by`.
9. `notifications` (`Notification`): `id`, `user_id`, `type`, `title`, `message`, `reference_type`, `reference_id`, `is_read`, `created_at`, `read_at`.
10. `approval_requests` (`ApprovalRequest`): `id`, `request_type`, `reference_type`, `reference_id`, `requested_by`, `approved_by`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `reason`, `rejection_reason`, `created_at`, `approved_at`.
11. `alert_rules` (`AlertRule`): `id`, `name`, `alert_type` (`LOW_STOCK`, `PACKAGE_EXPIRING`, `OVERDUE_INVOICE`...), `threshold_value`, `threshold_days`, `threshold_sessions`, `status`.
12. `import_batches` (`ImportBatch`) & `import_errors` (`ImportError`): Quản lý lịch sử import CSV và chi tiết từng dòng lỗi (`row_number`, `column_name`, `error_message`, `raw_data`).

### 9. Những thành phần có thể tái sử dụng từ Giai đoạn 1
- **Backend:** Middleware RBAC (`CheckRole`, `CheckPermission`, `CheckActiveUser`), `AuditLog` model, cấu trúc FormRequest + JsonResource, pattern `DB::transaction()` + `lockForUpdate()` từ `VisitController`.
- **Frontend:** `fe/lib/api/client.ts`, `fe/lib/auth/auth-context.tsx`, cấu trúc route `(admin)/layout.tsx`.

### 10. Các Rủi ro Kỹ thuật, Task bị chặn (Dependencies) & Thứ tự Triển khai Đề xuất

#### A. Các rủi ro kỹ thuật & biện pháp kiểm soát
1. **Rủi ro sai lệch số học tiền tệ & công nợ khi thanh toán nhiều lần:**
   - *Giải pháp:* Luôn khóa dòng hóa đơn bằng `Invoice::whereKey($id)->lockForUpdate()->firstOrFail()` bên trong `DB::transaction()`. Kiểm tra nghiêm ngặt `amount > 0` và `amount <= invoice.remaining_amount` (trả về `422` nếu thu vượt nợ). Tự động tính lại `paid_amount = SUM(payments.amount)`, `remaining_amount = total_amount - paid_amount`, và cập nhật trạng thái `PARTIAL` / `PAID` đồng thời đồng bộ sang `visits.payment_status`.
2. **Rủi ro lệch sổ quỹ (`cash_transactions`) so với Phiếu thu (`payments`) và Phiếu chi (`expenses`):**
   - *Giải pháp:* Khi tạo `Payment` thành công, tự động sinh bản ghi `CashTransaction` (`transaction_type = IN`, `reference_type = Payment`). Khi `Expense` chuyển trạng thái sang `APPROVED`, tự động sinh bản ghi `CashTransaction` (`transaction_type = OUT`, `reference_type = Expense`) trong cùng một Database Transaction.
3. **Rủi ro xuất kho âm (`inventory_transactions`):**
   - *Giải pháp:* Khóa bản ghi `Product::whereKey($productId)->lockForUpdate()` trước khi tính tồn kho hiện tại (`current_stock`). Nếu `transaction_type = OUT` và `quantity > current_stock`, chặn giao dịch ngay lập tức với mã `422 Unprocessable Entity`.
4. **Rủi ro giao diện thiếu đồng nhất giữa các trang Phase 1 và Phase 2:**
   - *Giải pháp:* Triển khai `F2-01` (`P2-002`, `P2-003`) đầu tiên để xây dựng bộ `shadcn/ui` Design System (`fe/components/ui/*`), `lucide-react` icons và nâng cấp `AdminShell.tsx` trước khi code bất kỳ màn hình nghiệp vụ nào của Giai đoạn 2.

#### B. Các Task bị chặn nếu làm sai thứ tự (Dependency Blockers)
- `F2-04` (Công nợ) phụ thuộc trực tiếp vào `F2-03` (Hóa đơn & Thanh toán).
- `F2-05` (Sổ quỹ `cash_transactions`) phụ thuộc vào `F2-03` (Phiếu thu) và Phiếu chi (`expenses`).
- `F2-10` (Phê duyệt & Cảnh báo) phụ thuộc vào `F2-05` (Duyệt phiếu chi) và `F2-06` (Cảnh báo tồn kho thấp).
- `F2-02` (Dashboard biểu đồ thật) và `F2-08` (Báo cáo quản trị) cần API tổng hợp từ Hóa đơn, Thu chi, Lượt khám và Kho.

#### C. Thứ tự thực hiện đề xuất (30 Tasks `P2-001` → `P2-030` qua 11 Features `F2-01` → `F2-11`)
1. **`F2-01` (`P2-001` → `P2-003`)**: Khảo sát & Lập kế hoạch (`P2-001` - `DONE`) → Cài đặt `shadcn/ui`, `lucide-react`, `recharts` & bộ UI Components (`P2-002`) → Nâng cấp `AdminShell.tsx` & Layout Quản trị chuyên nghiệp (`P2-003`).
2. **`F2-02` (`P2-004` → `P2-006`)**: Mở rộng RBAC Permissions Phase 2 (`P2-004`) → API Dashboard Tổng quan (`P2-005`) → Giao diện Dashboard chuyên nghiệp với `shadcn/ui` & `recharts` (`P2-006`).
3. **`F2-03` (`P2-007` → `P2-009`)**: API Hóa đơn (`P2-007`) → API Thanh toán nhiều đợt + tự động ghi Sổ quỹ (`P2-008`) → Giao diện Hóa đơn & Thu ngân `shadcn/ui` (`P2-009`).
4. **`F2-04` (`P2-010` → `P2-011`)**: API Quản lý & Đối soát Công nợ (`P2-010`) → Giao diện Quản lý Công nợ & Thu nợ nhanh (`P2-011`).
5. **`F2-05` (`P2-012` → `P2-014`)**: API Danh mục Chi phí & Phiếu chi (`P2-012`) → API Sổ quỹ & Dòng tiền (`P2-013`) → Giao diện Thu chi & Sổ quỹ kèm biểu đồ dòng tiền (`P2-014`).
6. **`F2-06` (`P2-015` → `P2-017`)**: API Sản phẩm/Vật tư & tính tồn kho (`P2-015`) → API Nhập/Xuất/Điều chỉnh Kho chống âm kho (`P2-016`) → Giao diện Quản lý Kho & Cảnh báo tồn kho (`P2-017`).
7. **`F2-07` (`P2-018` → `P2-019`)**: API Chỉ tiêu & Thực đạt KPI Nhân viên (`P2-018`) → Giao diện KPI Nhân viên & Biểu đồ hiệu suất `recharts` (`P2-019`).
8. **`F2-08` (`P2-020` → `P2-021`)**: API Báo cáo Quản trị Tài chính, Khám bệnh & Kho (`P2-020`) → Giao diện Trung tâm Báo cáo Quản trị (`P2-021`).
9. **`F2-09` (`P2-022` → `P2-024`)**: API Import CSV kèm lưu vết lỗi `import_errors` (`P2-022`) → API Export CSV báo cáo/dữ liệu (`P2-023`) → Giao diện Trung tâm Import/Export (`P2-024`).
10. **`F2-10` (`P2-025` → `P2-027`)**: API Quy tắc Cảnh báo & Thông báo (`P2-025`) → API Phê duyệt Tập trung `approval_requests` (`P2-026`) → Giao diện Phê duyệt, Cảnh báo & Chuông thông báo Topbar (`P2-027`).
11. **`F2-11` (`P2-028` → `P2-030`)**: Kiểm thử tích hợp E2E Giai đoạn 2 (`P2-028`) → Kiểm thử đồng bộ toàn diện BE/FE & Lint/Build (`P2-029`) → Tài liệu kỹ thuật & Báo cáo Nghiệm thu Giai đoạn 2 (`P2-030`).
