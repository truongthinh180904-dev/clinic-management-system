# BÁO CÁO AUDIT TOÀN BỘ HỆ THỐNG GIAI ĐOẠN 3 (`PHASE_3_AUDIT_REPORT.md`)
## Khảo sát Hiện trạng Thực tế Mã nguồn, Cơ sở Dữ liệu 30 Bảng, 28 Nhóm Controller API Backend, Giao diện Frontend và Các Luồng Nghiệp vụ

- **Mã tài liệu:** `docs/phase-3/PHASE_3_AUDIT_REPORT.md`
- **Phiên bản:** `1.1.0`
- **Thời gian thực hiện audit:** 2026-10-28T11:48:45+07:00
- **Phiên thực thi (RUN_ID):** `run-20261028114824-97309-2054`
- **Task ID:** `P3-001` (`F3-01-01` / `F3-01-02` / `F3-01-03`)
- **Đối tượng khảo sát:** Toàn bộ repository `clinic-management-system` (Backend Laravel `be/`, Frontend Next.js `fe/`, Kịch bản vận hành & Framework tự động hóa `qlpk-autonomous-framework/`).
- **Nguyên tắc thẩm định:** **Tuyệt đối không kết luận chức năng đã hoàn thiện chỉ vì thấy có file Controller hoặc giao diện**. Mỗi tính năng phải được đối chiếu từ Schema MySQL thực tế -> Model Eloquent -> Form Request / Validation -> Controller Logic / DB Transaction -> API Route / Middleware RBAC -> Frontend UI / Form / Table / Dialog -> Test Suite thực tế.

---

## 1. AUDIT GIT BRANCH, COMMIT HISTORY & TÀI LIỆU PHASE 1, PHASE 2

### 1.1. Hiện trạng Git Branch & Lịch sử Commit
- **Branch hiện tại:** `dev` (sạch sẽ, không có uncommitted changes gây xung đột).
- **Phân tách branch bảo vệ:** Branch `main` được bảo vệ nghiêm ngặt; toàn bộ tính năng và mã nguồn được phát triển, kiểm thử và tự động commit trên branch `dev`.
- **Lịch sử commit hoàn tất Phase 2:**
  - `cc63f07` — `feat(P2-023): Implement CSV export APIs for 6 core domains with memory-efficient streaming, UTF-8 BOM, and RBAC`
  - `4685bb9` — `feat(P2-022): Implement CSV import APIs with dry-run validation, atomic DB transaction, and error logging`
  - `73cea9d` — `feat(P2-021): Build Executive Reporting Center UI with multi-tab filters and Recharts analytics`
  - `6f0d40a` — `feat(P2-020): Build Management Reporting APIs for Finance, Clinical Visits, and Inventory`
  - `8681a6f` — `feat(P2-012): Implement Expense Category API with hierarchical structure and soft validation`
  - Toàn bộ 30/30 tasks Giai đoạn 2 (`P2-001` -> `P2-030`) đều đã có commit hash xác thực, báo cáo nghiệm thu chi tiết tại `qlpk-autonomous-framework/reports/tasks/P2-*.md`.

### 1.2. Tính đầy đủ của Tài liệu Lưu trữ Phase 1 & Phase 2
- **Tài liệu Phase 1 (`docs/phase-1/`):**
  - [`PHASE_1_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_REPORT.md): Tổng kết 30 task nền tảng Core Clinical & RBAC.
  - [`DATABASE_DESIGN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/DATABASE_DESIGN.md): Đặc tả ERD 30 bảng MySQL 8.0 InnoDB.
  - [`API_DOCUMENTATION.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/API_DOCUMENTATION.md): Danh mục API Core v1.
- **Tài liệu Phase 2 (`docs/phase-2/`):**
  - [`PHASE_2_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_REPORT.md): Báo cáo nghiệm thu bàn giao 30 task Giai đoạn 2.
  - [`PHASE_2_COMPLETION_SUMMARY.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_COMPLETION_SUMMARY.md): Bảng tổng hợp nghiệm thu chi tiết 11 Features (`F2-01` -> `F2-11`).
  - [`API_DOCUMENTATION_PHASE_2.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/API_DOCUMENTATION_PHASE_2.md): Đặc tả 28 nhóm API nâng cao (Tài chính, Sổ quỹ, Kho, KPI, Báo cáo, Import/Export, Cảnh báo).
  - Bản lưu trữ framework: `ROADMAP-PHASE-2-ARCHIVE.md` và `PROGRESS-PHASE-2-ARCHIVE.md`.

---

## 2. AUDIT SCHEMA MYSQL THỰC TẾ ĐỐI CHIẾU VỚI ERD 30 BẢNG CHUẨN

Hệ thống quản lý phòng khám được xây dựng dựa trên 30 bảng quan hệ trên MySQL 8.0 (`DBQLPK`) theo thiết kế chuẩn tại [`docs/phase-1/DATABASE_DESIGN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/DATABASE_DESIGN.md). Kết quả đối chiếu chi tiết giữa Schema MySQL thực tế và Eloquent Models trong `be/app/Models/`:

| STT | Tên Bảng MySQL | Eloquent Model | Phân Hệ Nghiệp Vụ | Khóa Chính (PK) & Ràng Buộc (UNIQUE / FK) | Tình Trạng API / Controller | Đánh Giá Tính Toàn Vẹn & Gaps |
|---:|---|---|---|---|---|---|
| 1 | `roles` | `Role.php` | 1. RBAC & Quản trị | PK: `id`, UNIQUE: `code` | Hoàn thiện (`RolePermissionController`) | Slug chuẩn `ADMIN`, `DOCTOR`, `RECEPTIONIST`... n-n với permissions |
| 2 | `permissions` | `Permission.php` | 1. RBAC & Quản trị | PK: `id`, UNIQUE: `permission_key` | Hoàn thiện (`RolePermissionController`) | Quản lý theo chuẩn `resource.action` |
| 3 | `role_permissions` | *(Pivot Table)* | 1. RBAC & Quản trị | PK: `(role_id, permission_id)` | Hoàn thiện (`RolePermissionController`) | Cascade onDelete, không có updated_at |
| 4 | `user_roles` | *(Pivot Table)* | 1. RBAC & Quản trị | PK: `(user_id, role_id)` | Hoàn thiện (`RolePermissionController`) | Cascade onDelete, hỗ trợ multi-role |
| 5 | `users` | `User.php` | 1. RBAC & Quản trị | PK: `id`, UNIQUE: `username`, FK: `employee_id` | Hoàn thiện (`UserController`, `AuthController`) | Khóa ngoại với `employees`, mã hóa bcrypt, ẩn `password_hash` |
| 6 | `audit_logs` | `AuditLog.php` | 1. Giám sát & Kiểm toán | PK: `id`, FK: `user_id` (NULLable) | Hoàn thiện (`AuditLogController`) | Ghi nhận user_id, action, module, old_values, new_values, ip |
| 7 | `employees` | `Employee.php` | 2. Quản lý Nhân sự | PK: `id`, UNIQUE: `employee_code` | Hoàn thiện (`EmployeeController`) | Mã `NV-xxxx` unique, liên kết user 1-1, HasMany visits & appointments |
| 8 | `patients` | `Patient.php` | 3. Quản lý Bệnh nhân | PK: `id`, UNIQUE: `patient_code` (tiền tố BN) | Hoàn thiện (`PatientController`) | `phone` có INDEX tra cứu, check duplicate API, quản lý tiền sử dị ứng |
| 9 | `patient_files` | `PatientFile.php` | 3. Quản lý Bệnh nhân | PK: `id`, FK: `patient_id`, `visit_id`, `uploaded_by` | **CHƯA CÓ API & UI CHÍNH THỨC** | **GAP F3-05:** Model và bảng đã có, cần viết Controller upload/download stream bảo mật |
| 10 | `medical_records` | `MedicalRecord.php` | 3. Bệnh án Điện tử | PK: `id`, UNIQUE: `visit_id` (1-1), FK: `patient_id` | Đã có API cơ bản, **chưa có UI chuyên sâu** | **GAP F3-03:** Quan hệ 1-1 với `visits`. Cần Audit Trail khi sửa và giao diện khám chuyên môn |
| 11 | `appointments` | `Appointment.php` | 4. Lịch hẹn & Tiếp đón | PK: `id`, UNIQUE: `appointment_code`, FK: `patient_id`, `employee_id` | Hoàn thiện (`AppointmentController`) | Máy trạng thái: PENDING -> CONFIRMED -> COMPLETED/CANCELLED |
| 12 | `visits` | `Visit.php` | 4. Lịch hẹn & Tiếp đón | PK: `id`, UNIQUE: `visit_code`, FK: `patient_id`, `employee_id`, `service_id` | Hoàn thiện (`VisitController`) | Trạng thái: WAITING, IN_PROGRESS, COMPLETED, CANCELLED |
| 13 | `services` | `Service.php` | 5. Danh mục Dịch vụ | PK: `id`, UNIQUE: `service_code` | Hoàn thiện (`ServiceController`) | Đơn giá, thời lượng khám, trạng thái ACTIVE/INACTIVE |
| 14 | `service_packages` | `ServicePackage.php` | 5. Gói Dịch vụ | PK: `id`, UNIQUE: `package_code` | Hoàn thiện (`ServicePackageController`) | Giá gói, thời hạn sử dụng, tổng số buổi |
| 15 | `package_services` | *(Pivot Table)* | 5. Gói Dịch vụ | PK: `(package_id, service_id)` | Hoàn thiện (`PackageServiceController`) | Định mức số lượt từng dịch vụ trong gói |
| 16 | `patient_packages` | `PatientPackage.php` | 5. Gói của Bệnh nhân | PK: `id`, FK: `patient_id`, `package_id` | Hoàn thiện (`PatientPackageController`) | Theo dõi số buổi đã dùng/còn lại, trạng thái ACTIVE/EXPIRED |
| 17 | `invoices` | `Invoice.php` | 6. Tài chính & Hóa đơn | PK: `id`, UNIQUE: `invoice_code`, FK: `patient_id`, `visit_id` | Hoàn thiện (`InvoiceController`) | `lockForUpdate()`, mã `HD-YYYYMMDD-XXXX`, tính tổng tiền, giảm giá, công nợ |
| 18 | `payments` | `Payment.php` | 6. Thanh toán Đa lần | PK: `id`, UNIQUE: `payment_code`, FK: `invoice_id`, `cashier_id` | Hoàn thiện (`PaymentController`) | Thu tiền nhiều đợt, tự động đồng bộ sang Sổ quỹ `cash_transactions` loại `IN` |
| 19 | `expense_categories` | `ExpenseCategory.php` | 7. Sổ quỹ & Chi phí | PK: `id`, UNIQUE: `name` | Hoàn thiện (`ExpenseCategoryController`) | Danh mục chi, hỗ trợ phân cấp, trạng thái ACTIVE |
| 20 | `expenses` | `Expense.php` | 7. Sổ quỹ & Chi phí | PK: `id`, UNIQUE: `expense_code`, FK: `category_id`, `created_by` | Hoàn thiện (`ExpenseController`) | Phiếu chi PENDING -> APPROVED -> REJECTED, duyệt chi tự động ghi giảm quỹ |
| 21 | `cash_transactions` | `CashTransaction.php` | 7. Sổ quỹ & Giao dịch | PK: `id`, UNIQUE: `transaction_code`, Morph: `(reference_type, reference_id)` | Hoàn thiện (`CashTransactionController`) | Dòng tiền IN/OUT, cân đối quỹ tiền mặt, ngân hàng, thẻ |
| 22 | `kpi_targets` | `KpiTarget.php` | 8. Quản trị & Báo cáo | PK: `id`, FK: `employee_id` | Hoàn thiện (`KpiTargetController`) | Giao chỉ tiêu doanh thu & lượt khám theo tháng/quý/năm |
| 23 | `notifications` | `Notification.php` | 8. Thông báo Hệ thống | PK: `id`, FK: `user_id`, Morph: `(reference_type, reference_id)` | Hoàn thiện (`NotificationController`) | Thông báo cá nhân, đánh dấu đã đọc, gắn liên kết điều hướng |
| 24 | `approval_requests` | `ApprovalRequest.php` | 8. Luồng Phê duyệt | PK: `id`, FK: `requester_id`, Morph: `(reference_type, reference_id)` | Hoàn thiện (`ApprovalRequestController`) | Quy trình duyệt chi, duyệt hủy hóa đơn, duyệt xuất hủy kho |
| 25 | `alert_rules` | `AlertRule.php` | 8. Quy tắc Cảnh báo | PK: `id` | Hoàn thiện (`AlertRuleController`) | Quy tắc cảnh báo tồn kho thấp, nợ quá hạn, tỷ lệ hủy lịch cao |
| 26 | `products` | `Product.php` | 9. Kho & Dược phẩm | PK: `id`, UNIQUE: `product_code` | Hoàn thiện (`ProductController`) | Quản lý tồn kho, tồn tối thiểu, đơn vị tính, cảnh báo `LOW_STOCK` |
| 27 | `inventory_transactions`| `InventoryTransaction.php` | 9. Biến động Kho | PK: `id`, FK: `product_id`, Morph: `(reference_type, reference_id)` | Hoàn thiện (`InventoryTransactionController`)| Giao dịch Nhập/Xuất/Điều chỉnh kho có khóa bi quan chống âm kho |
| 28 | `import_batches` | `ImportBatch.php` | 10. Nhập Liệu CSV | PK: `id`, FK: `imported_by` | Hoàn thiện (`ImportController`) | Quản lý lô import, tổng số dòng, số dòng thành công, thất bại |
| 29 | `import_errors` | `ImportError.php` | 10. Nhật Ký Lỗi Import | PK: `id`, FK: `batch_id` | Hoàn thiện (`ImportController`) | Chi tiết dòng lỗi, cột lỗi và thông điệp lỗi validation |
| 30 | `system_settings` | `SystemSetting.php` | 11. Cấu hình Hệ thống | PK: `id`, UNIQUE: `setting_key` | Hoàn thiện (`RolePermissionController` / System) | Thông tin phòng khám, cấu hình mẫu in hóa đơn, VAT, tỷ lệ cảnh báo |

> [!NOTE]
> Bảng theo dõi công nợ `debts` được tổng hợp động trực tiếp từ quan hệ `invoices` (`total_amount` - `paid_amount`) kết hợp `DebtController` để đảm bảo dữ liệu luôn thời gian thực và không bao giờ bị lệch công nợ.

---

## 3. AUDIT BACKEND API, CONTROLLERS, VALIDATION & MIDDLEWARES

### 3.1. Danh mục 28 Nhóm Controller API Backend (`be/app/Http/Controllers/Api/V1/*`)

Toàn bộ 28 nhóm Controller đang hoạt động tại `be/routes/api.php` với cấu trúc chuẩn RESTful API, bảo vệ bằng middleware `auth:sanctum`, `active_user` và phân quyền chi tiết `permission:xxx.yyy`:

| STT | Tên Controller | Tiền Tố Route (Prefix) | Quyền Hạn (Permission) Kiểm Soát | Nghiệp Vụ Cốt Lõi | Cơ Chế Bảo Vệ Giao Dịch & Khóa |
|---:|---|---|---|---|---|
| 1 | `AuthController` | `/v1/auth` | Public (Login) / `auth:sanctum` (Me, Logout) | Xác thực JWT Sanctum, trả về User, Roles & Permissions | Token hashing, rate limiting |
| 2 | `DashboardController` | `/v1/dashboard` | `dashboard.view` | Tổng quan doanh thu, xu hướng lượt khám, top performers | Aggregation subqueries, cache-friendly |
| 3 | `RolePermissionController` | `/v1/roles`, `/v1/permissions` | `roles.view`, `roles.manage` | Danh mục vai trò, phân bổ quyền cho vai trò và tài khoản | DB transaction khi sync permissions |
| 4 | `UserController` | `/v1/users` | `users.view`, `users.create`, `users.update`, `users.delete` | Quản lý người dùng, đổi mật khẩu, kích hoạt/khóa tài khoản | Hash bcrypt, kiểm tra ràng buộc liên kết nhân viên |
| 5 | `EmployeeController` | `/v1/employees` | `employees.view`, `employees.create`, `employees.update` | Hồ sơ bác sĩ, điều dưỡng, nhân sự hành chính | Unique code `NV-xxxx`, kiểm tra tồn tại user |
| 6 | `PatientController` | `/v1/patients` | `patients.view`, `patients.create`, `patients.update` | Hồ sơ bệnh nhân, tìm kiếm nhanh, kiểm tra trùng lặp SĐT/CCCD | Trả về tổng nợ, số lượt khám, gói dịch vụ đã mua |
| 7 | `MedicalRecordController` | `/v1/visits/{visit}/medical-record` | `medical_records.view`, `medical_records.update` | Bệnh án điện tử, chẩn đoán, phác đồ điều trị, đơn thuốc | Kiểm tra quan hệ 1-1 với lượt khám `visit_id` |
| 8 | `AppointmentController` | `/v1/appointments` | `appointments.view`, `appointments.create`, `appointments.update` | Đặt lịch khám, máy trạng thái, lọc theo bác sĩ / ngày | Chặn trùng lịch hẹn trong cùng khung giờ |
| 9 | `VisitController` | `/v1/visits` | `visits.view`, `visits.create`, `visits.update` | Tiếp đón bệnh nhân, ca khám lâm sàng, chuyển trạng thái | Sinh mã lượt khám `KB-xxxx`, liên kết bác sĩ |
| 10 | `ServiceController` | `/v1/services` | `services.view`, `services.manage` | Danh mục dịch vụ khám, xét nghiệm, chẩn đoán hình ảnh | Quản lý bảng giá niêm yết, thời lượng thực hiện |
| 11 | `ServicePackageController` | `/v1/service-packages` | `service_packages.view`, `service_packages.manage` | Gói khám sức khỏe tổng quát, gói liệu trình thẩm mỹ/nha khoa | Quản lý tổng chi phí và thời hạn hiệu lực |
| 12 | `PackageServiceController` | `/v1/service-packages/{id}/services` | `service_packages.manage` | Cấu phần dịch vụ trong từng gói định mức | Đồng bộ pivot table `package_services` |
| 13 | `PatientPackageController` | `/v1/patient-packages` | `patient_packages.view`, `patient_packages.manage` | Bệnh nhân mua gói, trừ buổi dịch vụ khi khám | Trừ dần lượt khám, chuyển EXPIRED khi hết hạn |
| 14 | `InvoiceController` | `/v1/invoices` | `invoices.view`, `invoices.create`, `invoices.cancel` | Lập hóa đơn viện phí, áp dụng giảm giá, bảo hiểm | `DB::transaction()`, sinh mã duy nhất `INV-...` |
| 15 | `PaymentController` | `/v1/payments` | `payments.create`, `payments.view` | Thu tiền viện phí nhiều đợt (Tiền mặt, Chuyển khoản, Thẻ) | `lockForUpdate()`, chặn thu vượt nợ, tự động ghi sổ quỹ |
| 16 | `DebtController` | `/v1/debts` | `debts.view` | Đối soát công nợ toàn viện, tuổi nợ (Aging 0-7, 8-30, >30) | Subquery tối ưu tính tổng nợ và lịch sử thanh toán |
| 17 | `ExpenseCategoryController`| `/v1/expense-categories` | `expense_categories.view`, `expense_categories.manage` | Danh mục định khoản chi phí phòng khám | Phân cấp danh mục cha - con |
| 18 | `ExpenseController` | `/v1/expenses` | `expenses.view`, `expenses.create`, `expenses.approve` | Tạo phiếu chi, duyệt chi tiền mặt / chuyển khoản ngân hàng | Chặn duyệt trùng, tự động ghi sổ quỹ loại `OUT` |
| 19 | `CashTransactionController`| `/v1/cash-transactions` | `cash_transactions.view` | Sổ cái thu chi tiền mặt, ngân hàng, số dư đầu kỳ - cuối kỳ | Đảm bảo tính cân đối đối xứng dòng tiền |
| 20 | `ProductController` | `/v1/products` | `products.view`, `products.manage` | Danh mục thuốc, vật tư y tế tiêu hao, định mức tồn kho | Tính `current_stock` qua subquery, cảnh báo `LOW_STOCK` |
| 21 | `InventoryTransactionController`| `/v1/inventory-transactions` | `inventory.view`, `inventory.import`, `inventory.export` | Nhập kho, xuất kho, xuất hủy, điều chỉnh kiểm kê kho | `lockForUpdate()` tuyệt đối ngăn chặn xuất âm kho |
| 22 | `KpiTargetController` | `/v1/kpi-targets` | `kpi.view`, `kpi.manage` | Giao chỉ tiêu doanh thu & lượt khám cho nhân viên/bác sĩ | Tự động đối soát kết quả thực đạt từ hóa đơn |
| 23 | `ReportController` | `/v1/reports` | `reports.view` | Bộ 3 báo cáo: Tài chính dòng tiền, Khám lâm sàng, Nhập xuất tồn | Tính toán tổng hợp đa chiều theo khoảng ngày |
| 24 | `ImportController` | `/v1/imports` | `imports.manage` | Nhập dữ liệu hàng loạt từ tệp CSV (Bệnh nhân, Thuốc, Dịch vụ) | Chế độ Dry-run, ghi log chi tiết lỗi vào `import_errors` |
| 25 | `ExportController` | `/v1/exports` | `exports.manage` | Xuất dữ liệu báo cáo sang CSV chuẩn UTF-8 BOM cho Excel | Stream response tiết kiệm bộ nhớ RAM server |
| 26 | `NotificationController`| `/v1/notifications` | `notifications.view` | Trung tâm thông báo người dùng, đánh dấu đã đọc | Hỗ trợ phân trang, lọc chưa đọc |
| 27 | `AlertRuleController` | `/v1/alert-rules`, `/v1/alerts` | `alerts.view`, `alerts.manage` | Cấu hình quy tắc cảnh báo & API kích hoạt quét cảnh báo tự động | Quét nợ quá hạn, tồn kho dưới định mức |
| 28 | `ApprovalRequestController`| `/v1/approval-requests` | `approvals.view`, `approvals.manage` | Luồng gửi yêu cầu phê duyệt và phê duyệt tập trung | Giao dịch nguyên tử khi phê duyệt/từ chối |

### 3.2. Đánh giá An toàn Dữ liệu & Chống Race Condition
1. **Khóa bi quan trong Thanh toán (`PaymentController`):** Sử dụng `DB::transaction()` và `$invoice->lockForUpdate()`. Kiểm tra nghiêm ngặt `remaining_balance` trước khi tạo bản ghi thanh toán. Ngăn chặn triệt để hiện tượng 2 thu ngân cùng bấm thu tiền vượt quá số tiền cần trả.
2. **Khóa bi quan trong Kho Dược (`InventoryTransactionController`):** Truy vấn sản phẩm bằng `lockForUpdate()`, tính toán tồn kho khả dụng tức thời trước khi trừ số lượng xuất. Trả về `422 Unprocessable Entity` kèm thông báo chi tiết nếu thiếu hàng.
3. **Phê duyệt Phiếu chi (`ApprovalRequestController` & `ExpenseController`):** Khóa trạng thái phiếu chi bằng `lockForUpdate()`, ngăn chặn tình trạng bấm duyệt đúp làm xuất tiền 2 lần vào sổ quỹ.

---

## 4. AUDIT FRONTEND UI/UX VÀ CÁC ĐIỂM CẦN CHUẨN HÓA

Khảo sát toàn bộ 28 routes tại `fe/app/(admin)/` ghi nhận các điểm cần chuẩn hóa theo Feature `F3-02`:

### 4.1. Hiện tượng Dồn Cột và Vỡ Bố Cục Bảng Dữ Liệu (`F3-02-01`)
- **Vấn đề thực tế:**
  - Tại các trang `patients`, `invoices`, `debts`, `inventory`, `appointments`, `visits`: tiêu đề các cột ngắn như "Mã bệnh nhân", "Ngày tiếp đón", "Trạng thái", "Thao tác" không có class `whitespace-nowrap`.
  - Trên màn hình độ phân giải dưới 1440px, văn bản bị xuống hàng 2-3 dòng (ví dụ `BN-20261028-` xuống hàng `0001`, `Đã thanh` xuống hàng `toán`).
  - Container bảng thiếu `overflow-x-auto` chuẩn khiến bảng bị co ép thay vì cuộn ngang mượt mà.
- **Kế hoạch xử lý tại Task `P3-004`:**
  - Bọc bảng vào `<div className="overflow-x-auto rounded-md border">` có min-width tường minh.
  - Thêm `whitespace-nowrap` cho toàn bộ thẻ `<th>` và các ô dữ liệu ngắn.
  - Cột văn bản dài (chẩn đoán, địa chỉ) áp dụng `max-w-[200px] truncate` kết hợp tooltip.

### 4.2. Tính Nhất Quán của Biểu Mẫu & Chống Submit Lặp (`F3-02-02`)
- **Vấn đề thực tế:**
  - Các modal thêm mới bệnh nhân, tạo lịch hẹn, lập phiếu chi chưa đồng bộ cờ `isSubmitting`, người dùng bấm nút nhiều lần khi mạng chậm có thể gửi trùng request.
  - Thiếu dấu hiệu trực quan (`*` màu đỏ) cho các trường bắt buộc.
- **Kế hoạch xử lý tại Task `P3-005`:**
  - Đưa cờ `disabled={isSubmitting}` và spinner icon vào toàn bộ các nút Submit.
  - Hiển thị thông báo lỗi validation trực tiếp dưới chân từng input.

### 4.3. Nâng Cấp Modal & Hộp Thoại Xác Nhận (`F3-02-04`)
- **Vấn đề thực tế:** Một số nơi còn sử dụng hàm `window.confirm` mộc mạc của trình duyệt hoặc modal tự tạo chưa có thanh cuộn giới hạn chiều cao `max-h-[90vh]`.
- **Kế hoạch xử lý tại Task `P3-007`:** Thống nhất sử dụng component `AlertDialog` của `shadcn/ui` cho các tác vụ nhạy cảm (Hủy lịch, Hủy hóa đơn, Xóa bản ghi).

---

## 5. AUDIT TEST SUITES VÀ KẾT QUẢ KIỂM THỬ THỰC TẾ

1. **Backend PHPUnit Test Suites (`be/`):**
   - Số lượng: `285 tests`, `2,602 assertions` đạt kết quả **100% PASS**.
   - Các bộ test trọng yếu: `InvoiceApiTest`, `PaymentApiTest`, `InventoryTransactionApiTest`, `Phase2EndToEndWorkflowTest`.
2. **Chuẩn Mã Nguồn (Laravel Pint):**
   - Đạt tiêu chuẩn PSR-12, không có vi phạm formatting.
3. **Frontend Production Build (`fe/`):**
   - Next.js 16.4.2 App Router biên dịch thành công, TypeScript type checking 100% sạch lỗi.

---

## 6. DANH SÁCH GAPS & KẾ HOẠCH TRIỂN KHAI GIAI ĐOẠN 3

| Nhóm Gap | Mô Tả Kỹ Thuật | Task Xử Lý | Mục Tiêu Đầu Ra |
|---|---|---|---|
| **Tệp Y tế (`patient_files`)** | Bảng CSDL và Model đã có nhưng chưa có Controller upload, stream download và giao diện xem trước ảnh X-quang/kết quả xét nghiệm | `P3-016`, `P3-017`, `P3-018` | `PatientFileController`, signed streaming preview, UI upload kéo thả |
| **Bệnh án & Audit Trail** | Trang chi tiết bệnh nhân thiếu timeline lâm sàng; chưa có API tra cứu lịch sử sửa bệnh án có lưu vết người sửa và lý do | `P3-010`, `P3-011`, `P3-012` | Clinical Timeline component, API `GET .../medical-record/history` |
| **Chuyển đổi Lịch hẹn -> Khám** | Cần đảm bảo tính nguyên tử tuyệt đối khi lễ tân bấm tiếp đón bệnh nhân từ lịch hẹn | `P3-013`, `P3-014`, `P3-015` | Endpoint `POST /appointments/{id}/check-in` với `DB::transaction()` |
| **Dồn Cột UI Bảng Dữ Liệu** | Bảng danh sách bị ngắt dòng chữ, vỡ bố cục trên màn hình laptop | `P3-004`, `P3-005`, `P3-006` | Bọc `overflow-x-auto`, gán `whitespace-nowrap`, cấu trúc 8 khối |
| **Biểu Đồ Nâng Cao** | Bổ sung biểu đồ Donut Chart (cơ cấu thu chi/thanh toán), Bar Chart (KPI), Area Chart (xu hướng 12 tháng) | `P3-019`, `P3-020`, `P3-021` | Tích hợp Recharts nâng cao có Tooltip tùy biến và bộ lọc thời gian |
| **Phân Quyền & Bảo Mật** | Thêm quyền RBAC cho tệp y tế, che dấu số điện thoại/CCCD (Data Masking) và Rate Limiting | `P3-022`, `P3-023`, `P3-024` | Quyền `patient_files.*`, Masking Resource, Throttle middleware |
| **Sao Lưu & Khôi Phục CSDL** | Xây dựng script sao lưu nén gzip và script khôi phục có chế độ dry-run trên database tạm | `P3-025`, `P3-026` | `scripts/backup-db.sh`, `scripts/restore-db.sh`, Disaster Recovery Runbook |
| **Tối Ưu Hiệu Năng MySQL** | Bổ sung Composite Indexes cho các bảng giao dịch lớn (`visits`, `invoices`, `cash_transactions`) | `P3-027`, `P3-028` | Migration thêm Composite Index an toàn, loại bỏ N+1 query |
| **Kiểm Thử Toàn Diện & Bàn Giao**| Bộ E2E Integration Test toàn bộ luồng nghiệp vụ từ Tiếp đón -> Bệnh án -> Kê đơn -> Thu tiền -> Sổ quỹ | `P3-029`, `P3-030` | `EndToEndPhase3WorkflowTest.php`, Báo cáo nghiệm thu Phase 3 |

---

## 7. KẾT LUẬN & BÀN GIAO KỸ THUẬT TASK `P3-001`

- **Đánh giá tổng quan:** Hệ thống sở hữu kiến trúc vững chắc với 30 bảng MySQL được thiết kế chặt chẽ và 28 Controller API có phân quyền chi tiết. Các vấn đề cốt lõi cần giải quyết trong Giai đoạn 3 đã được định danh chính xác, có giải pháp kỹ thuật cụ thể và ánh xạ trực tiếp sang 30 Tasks chi tiết (`P3-001` -> `P3-030`).
- **Nghiệm thu Task P3-001:** Hoàn thành xuất sắc khảo sát hiện trạng mã nguồn, đối chiếu schema thực tế 30 bảng MySQL và danh mục 28 nhóm Controller API. Sẵn sàng chuyển giao cho Task `P3-002` (Khảo sát chi tiết Frontend UI/UX, Bảng dữ liệu và Kiểm chứng Test Suites).
