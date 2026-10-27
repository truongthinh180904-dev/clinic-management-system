# ROADMAP & DANH SÁCH TASK GIAI ĐOẠN 2 (`PHASE-02`) — HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK)
## Hoàn thiện Tài chính, Kho Dược, Báo cáo, UI Chuyên nghiệp (`shadcn/ui` + `lucide-react` + `recharts`) và Quản trị Vận hành

- **Mã giai đoạn:** `PHASE-02`
- **Tài liệu đối chiếu Giai đoạn 1:** [`docs/phase-1/PHASE_1_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_TASKS.md), [`docs/phase-1/PHASE_1_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_REPORT.md), [`docs/phase-1/DATABASE_DESIGN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/DATABASE_DESIGN.md)
- **Báo cáo khảo sát `F2-01-01`:** [`docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md)
- **Tổng số Feature Giai đoạn 2:** `11 Features` (`F2-01` → `F2-11`)
- **Tổng số Task Giai đoạn 2:** `30 Tasks` (`P2-001` → `P2-030`)
- **Công nghệ bắt buộc:**
  - **Backend (`be/`):** Laravel Framework `^13.17`, PHP `^8.3`, PHPUnit `^12.5`, Laravel Pint, MySQL 8.0 (`DBQLPK`).
  - **Frontend (`fe/`):** Next.js `16.4.2` (App Router), React `19.3.0`, TypeScript `5`, Tailwind CSS `v4`, **`shadcn/ui`**, **`lucide-react`**, **`recharts`**.
- **Quy tắc bất biến:**
  1. Không chạy lệnh phá hủy dữ liệu (`migrate:fresh`, `migrate:reset`, `db:wipe`). Toàn bộ 30 bảng đã tồn tại trên `DBQLPK`.
  2. Mọi giao diện Giai đoạn 2 phải sử dụng hệ thống component **`shadcn/ui`** (`fe/components/ui/*`), icon **`lucide-react`** (không dùng emoji thô), và biểu đồ **`recharts`** chuyên nghiệp, chuẩn SaaS Y tế hiện đại (Clean Medical SaaS UI: bảng màu Slate/Blue/Emerald/Amber/Rose tinh tế, hiệu ứng hover/transition mượt, badge trạng thái rõ ràng, responsive).
  3. Mọi giao dịch tiền tệ (`Invoice`, `Payment`, `Expense`, `CashTransaction`) và tồn kho (`Product`, `InventoryTransaction`) bắt buộc dùng `DB::transaction()` kết hợp `lockForUpdate()` để chống Race Condition.

---

## BẢNG ÁNH XẠ 11 FEATURES (`F2-01` → `F2-11`) SANG 30 TASKS (`P2-001` → `P2-030`)

| Feature | Nội dung | Danh sách Tasks | Kết quả đầu ra |
|---|---|---|---|
| **`F2-01`** | Chuẩn hóa UI (`shadcn/ui` + `lucide-react`) và Layout quản trị | `P2-001`, `P2-002`, `P2-003` | Báo cáo khảo sát, bộ UI components `shadcn/ui`, `AdminShell` chuyên nghiệp |
| **`F2-02`** | Mở rộng RBAC Phase 2 & Dashboard tổng quan (`recharts`) | `P2-004`, `P2-005`, `P2-006` | Quyền RBAC Phase 2, API Dashboard & UI Dashboard biểu đồ `recharts` |
| **`F2-03`** | Hóa đơn và Thanh toán nhiều đợt | `P2-007`, `P2-008`, `P2-009` | API Hóa đơn, API Thu tiền nhiều đợt + ghi quỹ, UI Hóa đơn & Thu ngân |
| **`F2-04`** | Quản lý Công nợ | `P2-010`, `P2-011` | API Đối soát phải thu/đã thu/còn nợ & UI Quản lý Công nợ |
| **`F2-05`** | Thu chi và Quản lý Sổ quỹ | `P2-012`, `P2-013`, `P2-014` | API Danh mục chi & Phiếu chi, API Sổ quỹ `cash_transactions`, UI Sổ quỹ |
| **`F2-06`** | Quản lý Kho Thuốc & Vật tư | `P2-015`, `P2-016`, `P2-017` | API Sản phẩm, API Nhập/Xuất/Kiểm kê kho chống âm kho, UI Kho & Cảnh báo |
| **`F2-07`** | KPI Nhân viên | `P2-018`, `P2-019` | API Chỉ tiêu & Thực đạt KPI tự động, UI KPI & Biểu đồ hiệu suất |
| **`F2-08`** | Báo cáo Quản trị | `P2-020`, `P2-021` | API Báo cáo Tài chính/Khám bệnh/Kho & UI Trung tâm Báo cáo |
| **`F2-09`** | Import / Export Dữ liệu | `P2-022`, `P2-023`, `P2-024` | API Import CSV kèm lưu vết lỗi `import_errors`, API Export CSV & UI |
| **`F2-10`** | Thông báo, Cảnh báo & Phê duyệt | `P2-025`, `P2-026`, `P2-027` | API Cảnh báo & Thông báo, API Phê duyệt `approval_requests`, UI & Chuông Topbar |
| **`F2-11`** | Kiểm thử Tích hợp & Nghiệm thu Giai đoạn 2 | `P2-028`, `P2-029`, `P2-030` | E2E Tests Phase 2, Kiểm tra toàn diện BE/FE & Báo cáo `PHASE_2_REPORT.md` |

---

## CHI TIẾT 30 TASKS GIAI ĐOẠN 2 (`P2-001` → `P2-030`)

---

# FEATURE `F2-01` — CHUẨN HÓA UI (`shadcn/ui` + `lucide-react`) VÀ LAYOUT QUẢN TRỊ

### TASK `P2-001` (`F2-01-01`): Khảo sát hệ thống Giai đoạn 1 và lập kế hoạch triển khai Giai đoạn 2
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P1-030`
- **goal:** Khảo sát toàn diện hiện trạng repository sau Giai đoạn 1, đối chiếu `docs/phase-1/PHASE_1_TASKS.md`, và xuất báo cáo kế hoạch triển khai Giai đoạn 2 tại `docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md` cùng `docs/phase-2/PHASE_2_TASKS.md` mà không sửa code ứng dụng.
- **deliverables:**
  - `docs/phase-1/PHASE_1_TASKS.md`
  - `docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md`
  - `docs/phase-2/PHASE_2_TASKS.md`
- **test_commands:**
  - `test -s "$PROJECT_ROOT/docs/phase-1/PHASE_1_TASKS.md"`
  - `test -s "$PROJECT_ROOT/docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md"`
  - `test -s "$PROJECT_ROOT/docs/phase-2/PHASE_2_TASKS.md"`

---

### TASK `P2-002` (`F2-01-02`): Cài đặt thư viện UI (`lucide-react`, `recharts`, `clsx`, `tailwind-merge`, `class-variance-authority`) và xây dựng bộ `shadcn/ui` Core Design System
- **priority:** `P0`
- **status:** `READY`
- **dependencies:** `P2-001`
- **goal:** Tích hợp đầy đủ hệ sinh thái `shadcn/ui`, `lucide-react` và `recharts` vào `fe/`, xây dựng bộ UI components chuẩn thiết kế SaaS Phòng khám hiện đại (`fe/components/ui/*`) và hàm tiện ích `cn()` tại `fe/lib/utils.ts`.
- **scope:**
  1. Cập nhật/đảm bảo `fe/package.json` có cài đặt `lucide-react`, `recharts`, `clsx`, `tailwind-merge`, `class-variance-authority`.
  2. Tạo `fe/lib/utils.ts` với hàm `cn(...inputs: ClassValue[])`, hàm format tiền tệ `formatCurrency(amount: number | string)` (`vi-VN`, `VND`), hàm format ngày giờ `formatDate`, `formatDateTime`.
  3. Xây dựng đầy đủ các component chuẩn `shadcn/ui` tại `fe/components/ui/`:
     - `fe/components/ui/button.tsx` (`Button` với variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `success` và sizes: `default`, `sm`, `lg`, `icon`).
     - `fe/components/ui/card.tsx` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
     - `fe/components/ui/badge.tsx` (`Badge` với variants: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `info`).
     - `fe/components/ui/input.tsx` & `fe/components/ui/label.tsx` & `fe/components/ui/textarea.tsx`.
     - `fe/components/ui/table.tsx` (`Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`).
     - `fe/components/ui/tabs.tsx` (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`).
     - `fe/components/ui/dialog.tsx` (`Dialog`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogContent`, `DialogFooter`).
     - `fe/components/ui/progress.tsx` (`Progress` bar mượt mà cho KPI & Gói khám).
     - `fe/components/ui/stat-card.tsx` (`StatCard` hiển thị KPI card chuyên nghiệp có icon `lucide-react`, xu hướng tăng/giảm, subtitle).
     - `fe/components/ui/page-header.tsx` (`PageHeader` đồng nhất tiêu đề trang, mô tả, breadcrumb và cụm nút hành động).
- **deliverables:**
  - `fe/package.json`
  - `fe/lib/utils.ts`
  - `fe/components/ui/button.tsx`
  - `fe/components/ui/card.tsx`
  - `fe/components/ui/badge.tsx`
  - `fe/components/ui/input.tsx`
  - `fe/components/ui/label.tsx`
  - `fe/components/ui/textarea.tsx`
  - `fe/components/ui/table.tsx`
  - `fe/components/ui/tabs.tsx`
  - `fe/components/ui/dialog.tsx`
  - `fe/components/ui/progress.tsx`
  - `fe/components/ui/stat-card.tsx`
  - `fe/components/ui/page-header.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

### TASK `P2-003` (`F2-01-03`): Nâng cấp `AdminShell.tsx` và Layout Quản trị chuyên nghiệp với `shadcn/ui` & `lucide-react`
- **priority:** `P0`
- **status:** `READY`
- **dependencies:** `P2-002`
- **goal:** Thiết kế lại hoàn toàn `fe/components/layout/AdminShell.tsx` và `fe/app/login/page.tsx` theo chuẩn giao diện y tế chuyên nghiệp (`shadcn/ui` + `lucide-react`), tổ chức Sidebar phân nhóm khoa học cho cả Giai đoạn 1 và Giai đoạn 2.
- **scope:**
  1. Nâng cấp `fe/components/layout/AdminShell.tsx`:
     - Thay toàn bộ emoji bằng icon vector `lucide-react` (`LayoutDashboard`, `Users`, `CalendarClock`, `Stethoscope`, `Sparkles`, `PackageCheck`, `Receipt`, `CreditCard`, `Wallet`, `Boxes`, `Target`, `BarChart3`, `ArrowLeftRight`, `Bell`, `CheckCircle2`, `UserCog`, `ShieldCheck`, `LogOut`, `Menu`, `Search`).
     - Tổ chức Sidebar thành 4 nhóm rõ ràng, sang trọng:
       - **ĐIỀU HÀNH CHUNG:** Tổng quan (`/admin`), Phê duyệt (`/approvals`), Thông báo (`/notifications`).
       - **KHÁM CHỮA BỆNH:** Bệnh nhân (`/patients`), Lịch hẹn (`/appointments`), Lượt khám & Bệnh án (`/visits`), Dịch vụ (`/services`), Gói dịch vụ (`/packages`).
       - **TÀI CHÍNH & KHO DƯỢC:** Hóa đơn & Thu ngân (`/invoices`), Công nợ (`/debts`), Thu chi & Sổ quỹ (`/finance/cashbook`), Kho Thuốc & Vật tư (`/inventory`).
       - **QUẢN TRỊ & BÁO CÁO:** KPI Nhân viên (`/kpi`), Báo cáo Quản trị (`/reports`), Import / Export (`/data-transfer`), Nhân sự (`/employees`), Tài khoản & Quyền (`/users`).
     - Topbar hiện đại có: Thanh hiển thị tên phân hệ hiện tại, nút Chuông thông báo nhanh (`/notifications`), Badge vai trò màu sắc nổi bật, thông tin người dùng và nút Đăng xuất có hiệu ứng mượt.
     - Hỗ trợ responsive Drawer/Sidebar trên màn hình nhỏ.
  2. Nâng cấp `fe/app/login/page.tsx` sử dụng `Card`, `Input`, `Button`, `Badge` của `shadcn/ui` và icon `lucide-react`, có nút **"Điền nhanh tài khoản Demo (Admin / Bác sĩ / Tiếp đón)"** chỉ với 1 click để người dùng test cực kỳ tiện lợi.
- **deliverables:**
  - `fe/components/layout/AdminShell.tsx`
  - `fe/app/login/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-02` — MỞ RỘNG RBAC PHASE 2 & DASHBOARD TỔNG QUAN (`recharts`)

### TASK `P2-004` (`F2-02-01`): Mở rộng `RolePermissionSeeder` cho toàn bộ phân hệ Giai đoạn 2 và kiểm thử `Phase2PermissionSeederTest`
- **priority:** `P0`
- **status:** `READY`
- **dependencies:** `P2-003`
- **goal:** Bổ sung đầy đủ các permission keys của Giai đoạn 2 vào `be/database/seeders/RolePermissionSeeder.php`, phân bổ quyền chính xác cho 8 vai trò (`ADMIN`, `MANAGER`, `DOCTOR`, `RECEPTIONIST`, `CASHIER`, `ACCOUNTANT`, `EMPLOYEE`, `VIEWER`), bổ sung dữ liệu mẫu sản phẩm/quy tắc cảnh báo vào `DemoCatalogSeeder.php`, và kiểm thử bằng `Phase2PermissionSeederTest.php`.
- **scope:**
  1. Cập nhật `be/database/seeders/RolePermissionSeeder.php` bổ sung các quyền (idempotent `updateOrCreate`):
     - `debts.view` (Xem và đối soát công nợ)
     - `cash_transactions.view`, `cash_transactions.create` (Xem và tạo giao dịch sổ quỹ)
     - `products.view`, `products.create`, `products.update`, `products.delete` (Quản lý danh mục thuốc/vật tư)
     - `inventory.view`, `inventory.in`, `inventory.out`, `inventory.adjust` (Giao dịch nhập/xuất/kiểm kê kho)
     - `kpi_targets.view`, `kpi_targets.manage` (Xem và giao chỉ tiêu KPI nhân viên)
     - `imports.manage`, `exports.view` (Import/Export dữ liệu)
     - `notifications.view`, `approvals.view`, `approvals.manage`, `alert_rules.manage` (Thông báo, phê duyệt, quy tắc cảnh báo)
  2. Phân bổ quyền chuẩn:
     - `ADMIN`: Toàn quyền.
     - `MANAGER`: Có quyền xem/quản lý hầu hết nghiệp vụ vận hành, KPI, duyệt phiếu chi (`approvals.manage`), kho, báo cáo, import/export.
     - `CASHIER`: `invoices.*`, `payments.*`, `debts.view`, `cash_transactions.view`.
     - `ACCOUNTANT`: `invoices.view`, `payments.view`, `debts.view`, `expenses.*`, `cash_transactions.*`, `reports.view`, `exports.view`, `inventory.view`, `products.view`.
     - `VIEWER`: Chỉ giữ các quyền `.view` (tuyệt đối không có quyền `create`/`update`/`delete`/`manage`/`in`/`out`/`adjust`/`approve`).
  3. Cập nhật `be/database/seeders/DemoCatalogSeeder.php` thêm 5 sản phẩm vật tư/thuốc mẫu (`PRD-001`..`PRD-005`) và 3 quy tắc cảnh báo mẫu (`AlertRule`: `LOW_STOCK`, `PACKAGE_EXPIRING`, `OVERDUE_INVOICE`) khi không ở môi trường `production`.
  4. Tạo `be/tests/Feature/Phase2PermissionSeederTest.php` kiểm tra ma trận quyền mới và đảm bảo toàn bộ test cũ (`DatabaseSeederTest`) vẫn PASS 100%.
- **deliverables:**
  - `be/database/seeders/RolePermissionSeeder.php`
  - `be/database/seeders/DemoCatalogSeeder.php`
  - `be/tests/Feature/Phase2PermissionSeederTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=DatabaseSeederTest`
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=Phase2PermissionSeederTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-005` (`F2-02-02`): Xây dựng API Dashboard Tổng quan (`/api/v1/dashboard`) và `DashboardApiTest`
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P2-004`
- **goal:** Xây dựng `DashboardController` cung cấp dữ liệu thống kê tổng quan, biểu đồ doanh thu - thu chi, xu hướng lượt khám, top dịch vụ/bác sĩ và cảnh báo vận hành cho Dashboard quản trị.
- **scope:**
  1. Tạo `be/app/Http/Controllers/Api/V1/DashboardController.php` và đăng ký routes tại `be/routes/api.php` (yêu cầu `auth:sanctum`, `active_user`):
     - `GET /api/v1/dashboard/summary`: Trả về các chỉ số tổng hợp (Doanh thu kỳ hiện tại, Đã thực thu, Tổng công nợ phải thu, Tổng chi phí đã duyệt, Dòng tiền ròng, Tổng lượt khám hôm nay/trong kỳ, Số lịch hẹn hôm nay, Số bệnh nhân mới, Số mặt hàng cảnh báo tồn kho thấp, Số yêu cầu chờ phê duyệt). Hỗ trợ filter `?start_date=&end_date=`.
     - `GET /api/v1/dashboard/revenue-chart`: Trả về chuỗi thời gian (`date`, `invoiced_amount`, `collected_amount`, `expense_amount`, `net_cashflow`) theo ngày (mặc định 14 hoặc 30 ngày gần nhất) để vẽ biểu đồ `recharts`.
     - `GET /api/v1/dashboard/visit-trends`: Trả về thống kê lượt khám theo ngày và phân bổ theo trạng thái (`WAITING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
     - `GET /api/v1/dashboard/top-performers`: Trả về Top dịch vụ phổ biến, Top gói dịch vụ và hiệu suất bác sĩ.
  2. Viết `be/tests/Feature/DashboardApiTest.php` kiểm thử độ chính xác số học của tất cả chỉ số Dashboard.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/DashboardController.php`
  - `be/routes/api.php`
  - `be/tests/Feature/DashboardApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=DashboardApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-006` (`F2-02-03`): Xây dựng Giao diện Dashboard Tổng quan chuyên nghiệp với `shadcn/ui` & `recharts` tại `/admin`
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P2-005`
- **goal:** Nâng cấp hoàn toàn trang Dashboard Quản trị (`fe/app/admin/page.tsx`) thành bảng điều khiển điều hành phòng khám chuyên nghiệp sử dụng `shadcn/ui` (`StatCard`, `Card`, `Badge`, `Tabs`, `Table`) và biểu đồ `recharts` (`AreaChart` / `BarChart` doanh thu - thu chi, `PieChart` / `BarChart` trạng thái lượt khám).
- **scope:**
  1. Tạo `fe/types/dashboard.ts` và `fe/lib/api/dashboard.ts` kết nối tới `/api/v1/dashboard/*`.
  2. Thiết kế `fe/app/admin/page.tsx`:
     - Bộ lọc nhanh khoảng thời gian (`7 ngày qua`, `30 ngày qua`, `Tháng này`, hoặc chọn từ ngày - đến ngày).
     - Hàng 1: 4 thẻ KPI `StatCard` nổi bật (Tổng Doanh thu & Thực thu, Công nợ phải thu, Chi phí & Quỹ ròng, Lượt khám & Lịch hẹn hôm nay).
     - Hàng 2: Biểu đồ `ResponsiveContainer` + `AreaChart` / `BarChart` của `recharts` so sánh **Doanh thu phát sinh vs Thực thu vs Chi phí** theo ngày, kèm biểu đồ phân bổ **Trạng thái Lượt khám & Lịch hẹn**.
     - Hàng 3: Bảng Hiệu suất Bác sĩ / Top Dịch vụ và Khối **Lối tắt Nghiệp vụ Nhanh** + Cảnh báo tồn kho / Phê duyệt chờ xử lý.
- **deliverables:**
  - `fe/types/dashboard.ts`
  - `fe/lib/api/dashboard.ts`
  - `fe/app/admin/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-03` — HÓA ĐƠN VÀ THANH TOÁN NHIỀU ĐỢT

### TASK `P2-007` (`F2-03-01`): Xây dựng API Quản lý Hóa đơn (`/api/v1/invoices`) và `InvoiceApiTest`
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P2-004`
- **goal:** Xây dựng API quản lý vòng đời Hóa đơn (`invoices`) cho phép lập hóa đơn từ Lượt khám (`visit_id`), từ Gói dịch vụ (`patient_package_id`) hoặc hóa đơn dịch vụ trực tiếp cho bệnh nhân (`patient_id`), tự động sinh mã `invoice_code` (`INV-...`) an toàn tương tranh.
- **scope:**
  1. Tạo FormRequests (`StoreInvoiceRequest`, `UpdateInvoiceRequest`, `CancelInvoiceRequest`), `InvoiceResource`, và `InvoiceController`:
     - `GET /api/v1/invoices`: Danh sách hóa đơn có phân trang, tìm kiếm theo `invoice_code`, tên/mã/SĐT bệnh nhân, lọc theo `status` (`UNPAID`, `PARTIAL`, `PAID`, `CANCELLED`), `patient_id`, khoảng ngày `issued_at`.
     - `POST /api/v1/invoices`: Tạo hóa đơn mới. Kiểm tra `subtotal_amount >= 0`, `discount_amount >= 0`, `discount_amount <= subtotal_amount`. Tự động tính `total_amount = subtotal_amount - discount_amount`, khởi tạo `paid_amount = 0`, `remaining_amount = total_amount`, `status = (total_amount == 0 ? 'PAID' : 'UNPAID')`. Đồng bộ `visits.payment_status` nếu gắn với `visit_id`.
     - `GET /api/v1/invoices/{invoice}`: Chi tiết hóa đơn kèm `patient`, `visit`, `patientPackage`, danh sách `payments` và `creator`.
     - `PUT /api/v1/invoices/{invoice}`: Cập nhật giảm giá (`discount_amount`) khi hóa đơn chưa `CANCELLED` và `new_total >= paid_amount`, tự động tính lại `total_amount`, `remaining_amount` và `status`.
     - `PATCH /api/v1/invoices/{invoice}/cancel`: Hủy hóa đơn (`CANCELLED`) — chỉ cho phép hủy khi `paid_amount == 0` (nếu đã thu tiền thì chặn `422` để bảo vệ sổ quỹ).
  2. Ghi `AuditLog` cho các thao tác tạo/sửa/hủy hóa đơn.
  3. Viết `be/tests/Feature/InvoiceApiTest.php` kiểm thử toàn diện.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/InvoiceController.php`
  - `be/app/Http/Requests/Invoice/StoreInvoiceRequest.php`
  - `be/app/Http/Requests/Invoice/UpdateInvoiceRequest.php`
  - `be/app/Http/Resources/InvoiceResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/InvoiceApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=InvoiceApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-008` (`F2-03-02`): Xây dựng API Thanh toán Hóa đơn nhiều đợt (`/api/v1/payments`) tự động ghi Sổ quỹ và `PaymentApiTest`
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P2-007`
- **goal:** Xây dựng nghiệp vụ thu tiền hóa đơn hỗ trợ thanh toán 1 lần hoặc chia nhiều đợt (`payments`), khóa dòng hóa đơn bằng `lockForUpdate()`, chống thu vượt số tiền còn nợ, tự động cập nhật trạng thái hóa đơn (`PARTIAL` / `PAID`) và tự động ghi bút toán thu (`IN`) vào bảng `cash_transactions`.
- **scope:**
  1. Tạo `StorePaymentRequest`, `PaymentResource`, và `PaymentController`:
     - `GET /api/v1/payments`: Danh sách phiếu thu có phân trang, lọc theo `invoice_id`, `payment_method` (`CASH`, `BANK_TRANSFER`, `CARD`), khoảng ngày `payment_date`, từ khóa `payment_code` / `reference_code`.
     - `POST /api/v1/invoices/{invoice}/payments` (và `POST /api/v1/payments`):
       - Thực thi trong `DB::transaction()`.
       - Khóa hóa đơn `Invoice::whereKey($invoiceId)->lockForUpdate()->firstOrFail()`.
       - Chặn `422` nếu hóa đơn đang ở trạng thái `PAID` hoặc `CANCELLED`, hoặc nếu `amount <= 0`, hoặc nếu `amount > invoice->remaining_amount`.
       - Sinh mã `payment_code` (`PAY-...`) duy nhất, lưu bản ghi `Payment`.
       - Cập nhật `invoice->paid_amount += amount`, `invoice->remaining_amount = invoice->total_amount - invoice->paid_amount`, `invoice->status = (remaining_amount == 0 ? 'PAID' : 'PARTIAL')`.
       - Nếu hóa đơn gắn với `visit_id`, đồng bộ `visit->payment_status = invoice->status`.
       - Tự động tạo bản ghi `CashTransaction` (`transaction_code = 'CTX-...'`, `transaction_type = 'IN'`, `reference_type = 'Payment'`, `reference_id = $payment->id`, `amount = $payment->amount`, `payment_method = $payment->payment_method`, `transaction_date = $payment->payment_date`).
       - Ghi `AuditLog`.
     - `GET /api/v1/payments/{payment}`: Xem chi tiết phiếu thu.
  2. Viết `be/tests/Feature/PaymentApiTest.php` kiểm thử: thanh toán từng phần nhiều đợt (`UNPAID` → `PARTIAL` → `PAID`), chặn thu vượt công nợ, chặn thu hóa đơn đã hủy/đã tất toán, và kiểm tra bút toán `cash_transactions` được sinh tự động.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/PaymentController.php`
  - `be/app/Http/Requests/Payment/StorePaymentRequest.php`
  - `be/app/Http/Resources/PaymentResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/PaymentApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=PaymentApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-009` (`F2-03-03`): Xây dựng Giao diện Quản lý Hóa đơn & Thu ngân chuyên nghiệp (`/invoices`, `/invoices/[id]`)
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-008`
- **goal:** Xây dựng giao diện Quản lý Hóa đơn & Thu ngân nhiều đợt tại `fe/app/(admin)/invoices/page.tsx` và `fe/app/(admin)/invoices/[id]/page.tsx` sử dụng `shadcn/ui` và `lucide-react`.
- **scope:**
  1. Tạo `fe/types/invoice.ts` và `fe/lib/api/invoices.ts`.
  2. Trang danh sách `/invoices`:
     - 4 thẻ `StatCard` (Tổng giá trị hóa đơn, Đã thực thu, Còn nợ chưa thu, Số hóa đơn chờ thu).
     - Bộ lọc theo trạng thái (`Tất cả`, `Chưa thanh toán`, `Thanh toán một phần`, `Đã tất toán`, `Đã hủy`), tìm kiếm nhanh, bảng dữ liệu `shadcn/ui` Table có thanh tiến độ thanh toán trực quan.
     - Dialog **Lập Hóa đơn mới** (chọn Bệnh nhân, chọn Lượt khám/Gói khám hoặc nhập tiền dịch vụ, giảm giá, tự tính thành tiền).
     - Dialog **Thu tiền nhanh (Thanh toán đợt mới)**: Hiển thị số tiền còn nợ, cho phép nhập số tiền thu đợt này (có nút chọn nhanh 50% / 100% số nợ), chọn phương thức (`Tiền mặt`, `Chuyển khoản`, `Thẻ`), mã tham chiếu.
  3. Trang chi tiết `/invoices/[id]`:
     - Giao diện biên lai/hóa đơn y tế chuẩn đẹp, hiển thị lịch sử các đợt thanh toán (`payments`) và cho phép thu tiếp phần còn nợ hoặc in hóa đơn.
- **deliverables:**
  - `fe/types/invoice.ts`
  - `fe/lib/api/invoices.ts`
  - `fe/app/(admin)/invoices/page.tsx`
  - `fe/app/(admin)/invoices/[id]/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-04` — QUẢN LÝ CÔNG NỢ

### TASK `P2-010` (`F2-04-01`): Xây dựng API Theo dõi & Đối soát Công nợ (`/api/v1/debts`) và `DebtManagementApiTest`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-008`
- **goal:** Xây dựng `DebtController` phục vụ theo dõi tổng hợp số tiền phải thu, đã thu, còn nợ theo từng bệnh nhân, danh sách hóa đơn nợ và phân tích tuổi nợ (Aging Receivable).
- **scope:**
  1. Tạo `be/app/Http/Controllers/Api/V1/DebtController.php` và đăng ký routes:
     - `GET /api/v1/debts/summary`: Tổng hợp công nợ toàn phòng khám (`total_invoiced`, `total_collected`, `total_remaining_debt`, `debtor_patients_count`, `unpaid_invoices_count`, `partial_invoices_count`, và phân nhóm tuổi nợ: `0-7 ngày`, `8-30 ngày`, `> 30 ngày`).
     - `GET /api/v1/debts/patients`: Danh sách bệnh nhân đang có công nợ (`remaining_amount > 0`) kèm tổng phải thu, tổng đã trả, tổng còn nợ, số hóa đơn nợ, ngày phát sinh nợ gần nhất. Hỗ trợ tìm kiếm theo tên/mã/SĐT bệnh nhân và sắp xếp theo số nợ giảm dần.
     - `GET /api/v1/patients/{patient}/debts`: Chi tiết sổ công nợ của một bệnh nhân cụ thể (danh sách toàn bộ hóa đơn và lịch sử các đợt trả nợ của bệnh nhân đó).
  2. Viết `be/tests/Feature/DebtManagementApiTest.php` kiểm thử độ chính xác đối soát công nợ trước và sau khi thanh toán từng đợt.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/DebtController.php`
  - `be/routes/api.php`
  - `be/tests/Feature/DebtManagementApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=DebtManagementApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-011` (`F2-04-02`): Xây dựng Giao diện Quản lý Công nợ chuyên nghiệp (`/debts`)
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-010`
- **goal:** Xây dựng giao diện Quản lý Công nợ tại `fe/app/(admin)/debts/page.tsx` bằng `shadcn/ui`, `lucide-react` và `recharts` giúp kế toán/thu ngân theo dõi và thu hồi nợ trực quan.
- **scope:**
  1. Tạo `fe/types/debt.ts` và `fe/lib/api/debts.ts`.
  2. Xây dựng `fe/app/(admin)/debts/page.tsx`:
     - Thẻ KPI tổng hợp Phải thu / Đã thu / Còn nợ & Phân tích tuổi nợ (`0-7 ngày`, `8-30 ngày`, `Quá hạn > 30 ngày`).
     - Bảng danh sách Bệnh nhân còn nợ kèm thanh `Progress` tỷ lệ đã thanh toán.
     - Drawer/Dialog xem chi tiết các hóa đơn đang nợ của bệnh nhân và nút **"Thu nợ ngay"** (gọi trực tiếp API thanh toán đợt mới `/api/v1/invoices/{id}/payments` và cập nhật lại bảng công nợ tức thì).
- **deliverables:**
  - `fe/types/debt.ts`
  - `fe/lib/api/debts.ts`
  - `fe/app/(admin)/debts/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-05` — THU CHI VÀ QUẢN LÝ SỔ QUỸ

### TASK `P2-012` (`F2-05-01`): Xây dựng API Danh mục Chi phí & Phiếu chi (`/api/v1/expense-categories`, `/api/v1/expenses`) và `ExpenseApiTest`
- **priority:** `P1`
- **status:** `READY`
- **dependencies:** `P2-008`
- **goal:** Xây dựng API quản lý Danh mục chi phí (`expense_categories`) và Phiếu chi (`expenses`), hỗ trợ quy trình lập phiếu chi (`PENDING`), tự động tạo yêu cầu phê duyệt (`approval_requests`) và phê duyệt/từ chối phiếu chi (`APPROVED` / `REJECTED`).
- **scope:**
  1. Tạo `ExpenseCategoryController` (`/api/v1/expense-categories` CRUD).
  2. Tạo `ExpenseController` (`/api/v1/expenses`):
     - `GET /api/v1/expenses`: Lọc theo `category_id`, `approval_status` (`PENDING`, `APPROVED`, `REJECTED`), `payment_method`, khoảng ngày `expense_date`, tìm kiếm theo `expense_code`.
     - `POST /api/v1/expenses`: Sinh mã `expense_code` (`EXP-...`), tạo phiếu chi ở trạng thái `PENDING`, đồng thời tự động tạo bản ghi `ApprovalRequest` (`request_type = 'EXPENSE_APPROVAL'`, `reference_type = 'Expense'`, `reference_id = $expense->id`, `status = 'PENDING'`).
     - `PUT /api/v1/expenses/{expense}`: Chỉ cho phép sửa khi `approval_status == 'PENDING'`.
     - `PATCH /api/v1/expenses/{expense}/approve`: Phê duyệt phiếu chi (`APPROVED` — dùng `lockForUpdate()`, gán `approved_by`, `approved_at`), cập nhật `ApprovalRequest` tương ứng sang `APPROVED`, và **tự động ghi bút toán chi (`OUT`) vào bảng `cash_transactions`**.
     - `PATCH /api/v1/expenses/{expense}/reject`: Từ chối phiếu chi (`REJECTED`) kèm lý do từ chối.
  3. Viết `be/tests/Feature/ExpenseApiTest.php` kiểm thử đầy đủ vòng đời phiếu chi và ràng buộc không cho duyệt trùng 2 lần.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/ExpenseCategoryController.php`
  - `be/app/Http/Controllers/Api/V1/ExpenseController.php`
  - `be/app/Http/Requests/Expense/StoreExpenseRequest.php`
  - `be/app/Http/Requests/Expense/UpdateExpenseRequest.php`
  - `be/app/Http/Resources/ExpenseCategoryResource.php`
  - `be/app/Http/Resources/ExpenseResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/ExpenseApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=ExpenseApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-013` (`F2-05-02`): Xây dựng API Sổ quỹ & Giao dịch Quỹ (`/api/v1/cash-transactions`) và `CashTransactionApiTest`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-012`
- **goal:** Xây dựng `CashTransactionController` quản lý sổ quỹ tập trung (`cash_transactions`), hỗ trợ tra cứu lịch sử thu/chi (`IN`/`OUT`), lập phiếu thu/chi quỹ trực tiếp, và tính toán tồn quỹ đầu kỳ - thu trong kỳ - chi trong kỳ - tồn quỹ cuối kỳ theo từng phương thức (`CASH`, `BANK_TRANSFER`, `CARD`).
- **scope:**
  1. Tạo `CashTransactionController`, `StoreCashTransactionRequest`, `CashTransactionResource`:
     - `GET /api/v1/cash-transactions`: Danh sách giao dịch quỹ có phân trang, lọc theo `transaction_type` (`IN`, `OUT`), `payment_method`, khoảng ngày `transaction_date`, từ khóa `transaction_code` / `description`.
     - `GET /api/v1/cash-transactions/summary`: Báo cáo tổng hợp sổ quỹ theo kỳ (`opening_balance`, `total_in`, `total_out`, `net_change`, `closing_balance`, và phân tách theo `CASH`, `BANK_TRANSFER`, `CARD`).
     - `POST /api/v1/cash-transactions`: Tạo giao dịch thu/chi quỹ thủ công (ví dụ nộp tiền mặt vào quỹ đầu kỳ, rút quỹ gửi ngân hàng) kèm `AuditLog`.
  2. Viết `be/tests/Feature/CashTransactionApiTest.php` kiểm thử tính đối xứng giữa `Payment` (`IN`), `Expense` đã duyệt (`OUT`) và công thức tính tồn quỹ đầu kỳ/cuối kỳ.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/CashTransactionController.php`
  - `be/app/Http/Requests/CashTransaction/StoreCashTransactionRequest.php`
  - `be/app/Http/Resources/CashTransactionResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/CashTransactionApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=CashTransactionApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-014` (`F2-05-03`): Xây dựng Giao diện Thu chi & Sổ quỹ chuyên nghiệp (`/finance/cashbook`)
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-013`
- **goal:** Xây dựng giao diện Quản lý Thu chi & Sổ quỹ tại `fe/app/(admin)/finance/cashbook/page.tsx` bằng `shadcn/ui`, `lucide-react` và `recharts`.
- **scope:**
  1. Tạo `fe/types/finance.ts` và `fe/lib/api/finance.ts`.
  2. Trang `/finance/cashbook` sử dụng `Tabs` của `shadcn/ui` gồm 3 Tab:
     - **Tab 1 — Sổ quỹ & Dòng tiền (`Cashbook`):** 4 thẻ `StatCard` (Tồn đầu kỳ, Tổng Thu `IN`, Tổng Chi `OUT`, Tồn cuối kỳ), biểu đồ `recharts` đối chiếu Thu vs Chi, bảng lịch sử giao dịch quỹ và Modal tạo phiếu thu/chi quỹ.
     - **Tab 2 — Quản lý Phiếu chi (`Expenses`):** Danh sách phiếu chi, trạng thái duyệt (`PENDING` / `APPROVED` / `REJECTED`), nút lập phiếu chi mới và nút Duyệt / Từ chối nhanh cho Quản lý/Admin.
     - **Tab 3 — Danh mục Chi phí (`Expense Categories`):** Quản lý các nhóm chi phí vận hành.
- **deliverables:**
  - `fe/types/finance.ts`
  - `fe/lib/api/finance.ts`
  - `fe/app/(admin)/finance/cashbook/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-06` — QUẢN LÝ KHO THUỐC & VẬT TƯ Y TẾ

### TASK `P2-015` (`F2-06-01`): Xây dựng API Danh mục Sản phẩm & Tồn kho (`/api/v1/products`) và `ProductApiTest`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-004`
- **goal:** Xây dựng API quản lý Sản phẩm/Thuốc/Vật tư (`products`) có tự động tính toán số lượng tồn kho hiện tại (`current_stock` kiểu `DECIMAL(15,3)`) từ lịch sử giao dịch kho và gắn cờ cảnh báo khi `current_stock <= minimum_stock`.
- **scope:**
  1. Tạo `ProductController`, `StoreProductRequest`, `UpdateProductRequest`, `ProductResource`:
     - `GET /api/v1/products`: Danh sách sản phẩm kèm `current_stock` (tính bằng SQL subquery/aggregate: `SUM(CASE WHEN transaction_type='IN' THEN quantity WHEN transaction_type='OUT' THEN -quantity WHEN transaction_type='ADJUST' THEN quantity ELSE 0 END)`), trạng thái tồn kho (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`), lọc theo `status`, lọc chỉ lấy hàng sắp hết (`?low_stock_only=1`), tìm kiếm theo `product_code` hoặc `name`.
     - `POST /api/v1/products`: Tạo sản phẩm mới (tự sinh mã `PRD-...` nếu bỏ trống `product_code`), hỗ trợ nhập số lượng tồn đầu kỳ (`initial_stock` tùy chọn — nếu `> 0` thì tự tạo 1 dòng `InventoryTransaction` loại `IN`).
     - `GET /api/v1/products/{product}`, `PUT /api/v1/products/{product}`, `PATCH /api/v1/products/{product}/status`.
  2. Viết `be/tests/Feature/ProductApiTest.php` kiểm thử đầy đủ.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/ProductController.php`
  - `be/app/Http/Requests/Product/StoreProductRequest.php`
  - `be/app/Http/Requests/Product/UpdateProductRequest.php`
  - `be/app/Http/Resources/ProductResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/ProductApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=ProductApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-016` (`F2-06-02`): Xây dựng API Giao dịch Nhập / Xuất / Điều chỉnh Kho (`/api/v1/inventory-transactions`) chống âm kho và `InventoryTransactionApiTest`
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P2-015`
- **goal:** Xây dựng API giao dịch kho (`inventory_transactions`) hỗ trợ Nhập kho (`IN`), Xuất kho (`OUT`), Điều chỉnh kiểm kê (`ADJUST`) với khóa bi quan `lockForUpdate()` trên dòng `Product`, tuyệt đối không cho phép tồn kho sau giao dịch bị âm (`< 0`), và tự động sinh thông báo cảnh báo khi tồn kho rơi xuống dưới mức `minimum_stock`.
- **scope:**
  1. Tạo `InventoryTransactionController`, `StoreInventoryTransactionRequest`, `InventoryTransactionResource`:
     - `GET /api/v1/inventory-transactions`: Danh sách lịch sử nhập/xuất/điều chỉnh kho có phân trang, lọc theo `product_id`, `transaction_type` (`IN`, `OUT`, `ADJUST`), khoảng ngày `transaction_date`.
     - `GET /api/v1/inventory/summary`: Thống kê tổng số mặt hàng, số mặt hàng ổn định, số mặt hàng chạm ngưỡng cảnh báo (`LOW_STOCK`), số mặt hàng hết tồn (`OUT_OF_STOCK`), tổng lượt nhập/xuất trong kỳ.
     - `POST /api/v1/inventory-transactions`:
       - Thực thi trong `DB::transaction()`.
       - Khóa `Product::whereKey($productId)->lockForUpdate()->firstOrFail()`.
       - Tính `current_stock` hiện tại.
       - Nếu `transaction_type == 'OUT'`: bắt buộc `quantity > 0` và `quantity <= current_stock` (nếu vượt quá thì trả về `422 Unprocessable Entity` báo không đủ tồn kho).
       - Nếu `transaction_type == 'ADJUST'`: `quantity` có thể âm hoặc dương nhưng `current_stock + quantity` bắt buộc `>= 0`.
       - Lưu giao dịch kho và nếu tồn kho mới `<= product->minimum_stock`, tự động tạo `Notification` cảnh báo tồn kho thấp cho các user có vai trò `ADMIN` / `MANAGER`.
  2. Viết `be/tests/Feature/InventoryTransactionApiTest.php` kiểm thử nhập kho, xuất kho, chặn xuất kho vượt tồn, điều chỉnh kiểm kê và sinh thông báo cảnh báo tồn kho thấp.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/InventoryTransactionController.php`
  - `be/app/Http/Requests/Inventory/StoreInventoryTransactionRequest.php`
  - `be/app/Http/Resources/InventoryTransactionResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/InventoryTransactionApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=InventoryTransactionApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-017` (`F2-06-03`): Xây dựng Giao diện Quản lý Kho Thuốc & Vật tư (`/inventory`)
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-016`
- **goal:** Xây dựng giao diện Quản lý Kho & Cảnh báo Tồn kho tại `fe/app/(admin)/inventory/page.tsx` bằng `shadcn/ui` và `lucide-react`.
- **scope:**
  1. Tạo `fe/types/inventory.ts` và `fe/lib/api/inventory.ts`.
  2. Trang `/inventory`:
     - 4 thẻ `StatCard` (Tổng danh mục vật tư, Đủ tồn kho, Cảnh báo sắp hết `LOW_STOCK`, Đã hết hàng `OUT_OF_STOCK`).
     - Banner cảnh báo nổi bật nếu có mặt hàng dưới định mức tồn tối thiểu (`minimum_stock`).
     - `Tabs` chuyển đổi giữa **Danh mục Tồn kho Vật tư** và **Sổ cái Giao dịch Nhập / Xuất / Kiểm kê**.
     - Modal **Thêm/Sửa Sản phẩm Vật tư** và Modal **Tạo Phiếu Nhập / Xuất / Điều chỉnh Kho** (hiển thị tồn hiện tại và dự kiến tồn sau giao dịch theo thời gian thực).
- **deliverables:**
  - `fe/types/inventory.ts`
  - `fe/lib/api/inventory.ts`
  - `fe/app/(admin)/inventory/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-07` — KPI NHÂN VIÊN

### TASK `P2-018` (`F2-07-01`): Xây dựng API Chỉ tiêu & Đánh giá KPI Nhân viên (`/api/v1/kpi-targets`) và `KpiTargetApiTest`
- **priority:** `P1`
- **status:** `READY`
- **dependencies:** `P2-008`
- **goal:** Xây dựng `KpiTargetController` quản lý chỉ tiêu KPI của nhân sự (`kpi_targets`) và tự động đối chiếu kết quả thực tế (`actual_revenue`, `actual_visits`, `revenue_completion_rate`, `visits_completion_rate`) từ các lượt khám `COMPLETED` và hóa đơn của nhân viên đó trong kỳ `period_start` → `period_end`.
- **scope:**
  1. Tạo `KpiTargetController`, `StoreKpiTargetRequest`, `UpdateKpiTargetRequest`, `KpiTargetResource`:
     - `GET /api/v1/kpi-targets`: Danh sách chỉ tiêu KPI kèm số liệu thực tế (`actual_revenue`, `actual_visits`, `% hoàn thành doanh thu`, `% hoàn thành lượt khám`, trạng thái đánh giá `EXCEEDED` / `ON_TRACK` / `BEHIND`). Hỗ trợ lọc theo `employee_id`, khoảng kỳ hạn.
     - `POST /api/v1/kpi-targets`: Giao chỉ tiêu KPI mới cho nhân viên (chặn trùng kỳ hạn chồng lấn của cùng 1 nhân viên).
     - `PUT /api/v1/kpi-targets/{kpi_target}`, `DELETE /api/v1/kpi-targets/{kpi_target}`.
  2. Viết `be/tests/Feature/KpiTargetApiTest.php` kiểm thử giao KPI, chặn chồng lấn kỳ hạn và kiểm tra công thức tự động tính kết quả thực đạt từ lượt khám & hóa đơn.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/KpiTargetController.php`
  - `be/app/Http/Requests/KpiTarget/StoreKpiTargetRequest.php`
  - `be/app/Http/Requests/KpiTarget/UpdateKpiTargetRequest.php`
  - `be/app/Http/Resources/KpiTargetResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/KpiTargetApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=KpiTargetApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-019` (`F2-07-02`): Xây dựng Giao diện Quản lý KPI Nhân viên (`/kpi`) với `shadcn/ui` & `recharts`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-018`
- **goal:** Xây dựng giao diện Quản lý & Đánh giá KPI Nhân viên tại `fe/app/(admin)/kpi/page.tsx` sử dụng `shadcn/ui` (`Progress`, `StatCard`, `Badge`, `Dialog`) và biểu đồ `BarChart` của `recharts` so sánh Chỉ tiêu vs Thực đạt.
- **scope:**
  1. Tạo `fe/types/kpi.ts` và `fe/lib/api/kpi.ts`.
  2. Xây dựng `fe/app/(admin)/kpi/page.tsx`:
     - Thẻ KPI tổng quan (Tổng nhân sự được giao KPI, Tỷ lệ hoàn thành trung bình, Số nhân sự vượt chỉ tiêu, Tổng doanh thu thực đạt).
     - Biểu đồ `recharts` (`BarChart`) đối chiếu **Mục tiêu Doanh thu vs Thực đạt** và **Mục tiêu Lượt khám vs Thực đạt** của từng bác sĩ/nhân viên.
     - Bảng chi tiết KPI kèm thanh `Progress` trực quan và Modal giao/cập nhật chỉ tiêu KPI.
- **deliverables:**
  - `fe/types/kpi.ts`
  - `fe/lib/api/kpi.ts`
  - `fe/app/(admin)/kpi/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-08` — BÁO CÁO QUẢN TRỊ

### TASK `P2-020` (`F2-08-01`): Xây dựng API Báo cáo Quản trị (`/api/v1/reports`) và `ManagementReportApiTest`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-013`, `P2-016`
- **goal:** Xây dựng `ReportController` cung cấp 3 báo cáo quản trị cốt lõi: Báo cáo Tài chính & Lợi nhuận, Báo cáo Hoạt động Khám chữa bệnh, và Báo cáo Nhập Xuất Tồn Kho.
- **scope:**
  1. Tạo `be/app/Http/Controllers/Api/V1/ReportController.php` và đăng ký routes:
     - `GET /api/v1/reports/financial`: Tổng hợp doanh thu hóa đơn (`invoiced`), thực thu (`collected`), công nợ mới phát sinh, chi phí theo từng danh mục (`expenses_by_category`), thu/chi theo phương thức thanh toán (`by_payment_method`), và chuỗi dữ liệu theo ngày trong khoảng `start_date`..`end_date`.
     - `GET /api/v1/reports/clinical`: Tổng hợp số lượng lịch hẹn, tỷ lệ đến khám, số lượt khám theo trạng thái, số buổi gói đã sử dụng, thống kê lượt khám theo từng bác sĩ và dịch vụ.
     - `GET /api/v1/reports/inventory`: Báo cáo tổng hợp Nhập - Xuất - Tồn đầu kỳ / trong kỳ / cuối kỳ của từng sản phẩm vật tư.
  2. Viết `be/tests/Feature/ManagementReportApiTest.php` kiểm thử độ chính xác của cả 3 báo cáo.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/ReportController.php`
  - `be/routes/api.php`
  - `be/tests/Feature/ManagementReportApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=ManagementReportApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-021` (`F2-08-02`): Xây dựng Giao diện Trung tâm Báo cáo Quản trị (`/reports`) với `shadcn/ui` & `recharts`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-020`
- **goal:** Xây dựng giao diện Trung tâm Báo cáo Quản trị tại `fe/app/(admin)/reports/page.tsx` với bộ lọc kỳ báo cáo, 3 Tab phân hệ (`Báo cáo Tài chính`, `Báo cáo Khám bệnh`, `Báo cáo Kho Dược`), biểu đồ `recharts` và bảng phân tích chi tiết.
- **deliverables:**
  - `fe/types/report.ts`
  - `fe/lib/api/reports.ts`
  - `fe/app/(admin)/reports/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-09` — IMPORT / EXPORT DỮ LIỆU

### TASK `P2-022` (`F2-09-01`): Xây dựng API Import dữ liệu từ CSV (`/api/v1/imports`) kèm lưu vết `import_batches` & `import_errors` và `DataImportApiTest`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-015`
- **goal:** Xây dựng `ImportController` cho phép tải lên file CSV (hoặc mảng dữ liệu chuẩn hóa từ CSV/Excel) cho các module `patients`, `services`, `products`, lưu vết đầy đủ vào `import_batches` và ghi chi tiết từng dòng lỗi vào `import_errors` (`row_number`, `column_name`, `error_message`, `raw_data`).
- **scope:**
  1. Tạo `be/app/Http/Controllers/Api/V1/ImportController.php`:
     - `GET /api/v1/imports`: Danh sách lịch sử các đợt import (`import_batches`).
     - `GET /api/v1/imports/{batch}`: Xem chi tiết đợt import kèm danh sách lỗi `import_errors`.
     - `GET /api/v1/imports/templates/{module}`: Tải file CSV mẫu chuẩn header cho `patients`, `services`, `products`.
     - `POST /api/v1/imports/{module}`: Nhận file CSV upload (`file`) sử dụng `UploadedFile`. Đọc từng dòng, validate dữ liệu:
       - Dòng hợp lệ: tạo/cập nhật bản ghi vào bảng tương ứng (`patients`, `services`, `products`), tăng `success_rows`.
       - Dòng lỗi (thiếu trường bắt buộc, giá âm, trùng mã/SĐT không hợp lệ): ghi vào bảng `import_errors` kèm số dòng `row_number`, cột lỗi `column_name`, thông báo lỗi tiếng Việt và `raw_data`, tăng `error_rows`.
       - Cập nhật `import_batches.status` (`COMPLETED` hoặc `COMPLETED_WITH_ERRORS`) và `completed_at`.
  2. Viết `be/tests/Feature/DataImportApiTest.php` kiểm thử import thành công, import có dòng lỗi được ghi vào `import_errors`, và tải template mẫu.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/ImportController.php`
  - `be/app/Http/Resources/ImportBatchResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/DataImportApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=DataImportApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-023` (`F2-09-02`): Xây dựng API Export dữ liệu & Báo cáo ra CSV (`/api/v1/exports`) và `DataExportApiTest`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-022`
- **goal:** Xây dựng `ExportController` xuất dữ liệu chuẩn UTF-8 BOM CSV (mở trực tiếp trên Microsoft Excel không lỗi font tiếng Việt) cho Danh sách Bệnh nhân, Hóa đơn & Công nợ, Sổ quỹ Thu Chi, và Báo cáo Tồn kho.
- **scope:**
  1. Tạo `be/app/Http/Controllers/Api/V1/ExportController.php`:
     - `GET /api/v1/exports/patients`
     - `GET /api/v1/exports/invoices`
     - `GET /api/v1/exports/cashbook`
     - `GET /api/v1/exports/inventory`
     - Trả về `Content-Type: text/csv; charset=UTF-8` có BOM `\xEF\xBB\xBF` để hiển thị tiếng Việt có dấu hoàn hảo trên Excel.
  2. Viết `be/tests/Feature/DataExportApiTest.php` kiểm thử nội dung file CSV xuất ra và phân quyền RBAC.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/ExportController.php`
  - `be/routes/api.php`
  - `be/tests/Feature/DataExportApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=DataExportApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-024` (`F2-09-03`): Xây dựng Giao diện Trung tâm Import / Export Dữ liệu (`/data-transfer`)
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-023`
- **goal:** Xây dựng giao diện Trung tâm Import / Export Dữ liệu tại `fe/app/(admin)/data-transfer/page.tsx` bằng `shadcn/ui` và `lucide-react` (Tải file mẫu CSV, kéo thả/chọn file CSV để Import, xem lịch sử `import_batches` và bảng chi tiết dòng lỗi `import_errors`, cùng khu vực Xuất báo cáo CSV 1-click).
- **deliverables:**
  - `fe/types/data-transfer.ts`
  - `fe/lib/api/data-transfer.ts`
  - `fe/app/(admin)/data-transfer/page.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-10` — THÔNG BÁO, CẢNH BÁO VÀ PHÊ DUYỆT

### TASK `P2-025` (`F2-10-01`): Xây dựng API Quy tắc Cảnh báo & Thông báo (`/api/v1/notifications`, `/api/v1/alert-rules`) và `NotificationAndAlertApiTest`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-016`
- **goal:** Xây dựng API quản lý Quy tắc cảnh báo (`alert_rules`), Thông báo người dùng (`notifications`) và cơ chế quét cảnh báo tự động (`/api/v1/alerts/scan`: quét vật tư dưới định mức tồn kho, gói dịch vụ sắp hết hạn/hết buổi, hóa đơn nợ quá hạn).
- **scope:**
  1. Tạo `NotificationController` và `AlertRuleController`:
     - `GET /api/v1/notifications`: Danh sách thông báo của user đang đăng nhập kèm số lượng chưa đọc (`unread_count`), lọc `?unread_only=1`.
     - `PATCH /api/v1/notifications/{notification}/read`: Đánh dấu đã đọc 1 thông báo (`is_read = true`, `read_at = now()`).
     - `POST /api/v1/notifications/read-all`: Đánh dấu đã đọc tất cả thông báo của user.
     - `GET /api/v1/alert-rules`, `POST /api/v1/alert-rules`, `PUT /api/v1/alert-rules/{alert_rule}`: Cấu hình ngưỡng cảnh báo.
     - `POST /api/v1/alerts/scan`: Quét dữ liệu thực tế theo các `AlertRule` đang `ACTIVE` (Tồn kho thấp, Gói khám sắp hết hạn, Hóa đơn nợ) và sinh thông báo mới (chống tạo trùng thông báo chưa đọc cho cùng 1 đối tượng).
  2. Viết `be/tests/Feature/NotificationAndAlertApiTest.php` kiểm thử đầy đủ.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/NotificationController.php`
  - `be/app/Http/Controllers/Api/V1/AlertRuleController.php`
  - `be/app/Http/Resources/NotificationResource.php`
  - `be/app/Http/Resources/AlertRuleResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/NotificationAndAlertApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=NotificationAndAlertApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-026` (`F2-10-02`): Xây dựng API Phê duyệt Tập trung (`/api/v1/approval-requests`) và `ApprovalWorkflowApiTest`
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P2-025`
- **goal:** Xây dựng `ApprovalRequestController` quản lý tập trung các yêu cầu phê duyệt (`approval_requests` — duyệt phiếu chi `Expense`, yêu cầu điều chỉnh/hủy), tự động đồng bộ trạng thái sang bảng gốc (`expenses` + ghi `cash_transactions`) và gửi `Notification` tức thì cho người tạo yêu cầu.
- **scope:**
  1. Tạo `ApprovalRequestController`, `ApprovalRequestResource`:
     - `GET /api/v1/approval-requests`: Danh sách yêu cầu phê duyệt kèm thông tin người đề xuất (`requester`), người duyệt (`approver`) và chi tiết đối tượng gốc (`Expense`...), lọc theo `status` (`PENDING`, `APPROVED`, `REJECTED`), `request_type`.
     - `POST /api/v1/approval-requests/{approvalRequest}/approve`: Duyệt yêu cầu trong `DB::transaction()` + `lockForUpdate()`. Nếu `reference_type == 'Expense'`, tự động duyệt `Expense` và sinh bút toán `CashTransaction` (`OUT`) nếu chưa sinh; đồng thời tạo `Notification` báo cho `requested_by` biết yêu cầu đã được duyệt.
     - `POST /api/v1/approval-requests/{approvalRequest}/reject`: Từ chối yêu cầu (bắt buộc nhập `rejection_reason`), đồng bộ trạng thái `REJECTED` sang `Expense` và gửi `Notification` cho `requested_by`.
  2. Viết `be/tests/Feature/ApprovalWorkflowApiTest.php` kiểm thử luồng Tạo phiếu chi → Xuất hiện trong `approval_requests` → Admin duyệt → Tự động trừ quỹ `cash_transactions` & bắn `Notification` cho nhân viên đề xuất.
- **deliverables:**
  - `be/app/Http/Controllers/Api/V1/ApprovalRequestController.php`
  - `be/app/Http/Resources/ApprovalRequestResource.php`
  - `be/routes/api.php`
  - `be/tests/Feature/ApprovalWorkflowApiTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=ApprovalWorkflowApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-027` (`F2-10-03`): Xây dựng Giao diện Phê duyệt (`/approvals`), Trung tâm Thông báo (`/notifications`) và Chuông Thông báo Topbar
- **priority:** `P1`
- **status:** `READY`
- **dependencies:** `P2-026`
- **goal:** Xây dựng giao diện Trung tâm Phê duyệt (`/approvals`), Trung tâm Thông báo & Cấu hình Cảnh báo (`/notifications`) và tích hợp Badge số lượng thông báo chưa đọc trên thanh Topbar của `AdminShell.tsx`.
- **deliverables:**
  - `fe/types/notification.ts`
  - `fe/lib/api/notifications.ts`
  - `fe/app/(admin)/approvals/page.tsx`
  - `fe/app/(admin)/notifications/page.tsx`
  - `fe/components/layout/AdminShell.tsx`
- **test_commands:**
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

# FEATURE `F2-11` — KIỂM THỬ TÍCH HỢP, BẢO MẬT & NGHIỆM THU GIAI ĐOẠN 2

### TASK `P2-028` (`F2-11-01`): Kiểm thử tích hợp End-to-End Giai đoạn 2 (`Phase2EndToEndWorkflowTest`)
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P2-027`
- **goal:** Xây dựng bộ kiểm thử tích hợp xuyên suốt Giai đoạn 2 tại `be/tests/Feature/Phase2EndToEndWorkflowTest.php` kiểm chứng tính toàn vẹn dữ liệu giữa Khám bệnh → Hóa đơn → Thanh toán nhiều đợt → Công nợ → Sổ quỹ → Chi phí & Phê duyệt → Kho Dược & Cảnh báo → KPI → Báo cáo.
- **scope:**
  1. Kịch bản E2E 1: Bệnh nhân hoàn tất lượt khám → Tạo Hóa đơn 1.000.000đ → Thu đợt 1 (400.000đ) → Kiểm tra Công nợ còn 600.000đ (`PARTIAL`) → Thu đợt 2 (600.000đ) → Hóa đơn `PAID`, Sổ quỹ tăng đúng 1.000.000đ, KPI Bác sĩ tự động cộng doanh thu và lượt khám.
  2. Kịch bản E2E 2: Kế toán lập Phiếu chi 300.000đ (`PENDING`) → Quản lý duyệt qua `/api/v1/approval-requests/{id}/approve` → Phiếu chi `APPROVED`, Sổ quỹ tự động ghi `OUT` 300.000đ (Tồn quỹ còn 700.000đ), Kế toán nhận được `Notification`.
  3. Kịch bản E2E 3: Nhập kho 10 hộp vật tư (`minimum_stock = 5`) → Xuất kho 6 hộp (còn 4 hộp `<= 5`) → Tự động sinh cảnh báo `LOW_STOCK` → Thử xuất tiếp 5 hộp bị chặn `422`.
  4. Kịch bản E2E 4: Import CSV sản phẩm có cả dòng hợp lệ và dòng lỗi → Kiểm tra `import_batches` và `import_errors`, sau đó Export CSV và kiểm tra Báo cáo Quản trị.
- **deliverables:**
  - `be/tests/Feature/Phase2EndToEndWorkflowTest.php`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=Phase2EndToEndWorkflowTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`

---

### TASK `P2-029` (`F2-11-02`): Kiểm tra đồng bộ toàn diện Backend Test Suite, Pint, Frontend Typecheck, Lint & Production Build
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P2-028`
- **goal:** Chạy toàn bộ bộ kiểm thử của cả Giai đoạn 1 và Giai đoạn 2 trên Backend (`php artisan test && ./vendor/bin/pint --test`) và Frontend (`npx tsc --noEmit && npm run lint && npm run build`), đảm bảo 0 lỗi, 0 xung đột.
- **deliverables:**
  - Toàn bộ test suites trong `be/tests/Feature/` và các routes trong `fe/app/`
- **test_commands:**
  - `cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint --test`
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`

---

### TASK `P2-030` (`F2-11-03`): Hoàn thiện Tài liệu Kỹ thuật & Báo cáo Nghiệm thu Giai đoạn 2 (`docs/phase-2/PHASE_2_REPORT.md`)
- **priority:** `P0`
- **status:** `READY`
- **dependencies:** `P2-029`
- **goal:** Xuất tài liệu API Giai đoạn 2 (`docs/phase-2/API_DOCUMENTATION_PHASE_2.md`) và Báo cáo tổng kết bàn giao Giai đoạn 2 (`docs/phase-2/PHASE_2_REPORT.md`), chạy lại toàn bộ cổng chất lượng cuối cùng trước khi bàn giao cho người dùng review trên nhánh `dev`.
- **deliverables:**
  - `docs/phase-2/API_DOCUMENTATION_PHASE_2.md`
  - `docs/phase-2/PHASE_2_REPORT.md`
- **test_commands:**
  - `test -s "$PROJECT_ROOT/docs/phase-2/API_DOCUMENTATION_PHASE_2.md"`
  - `test -s "$PROJECT_ROOT/docs/phase-2/PHASE_2_REPORT.md"`
  - `cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint --test`
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`
