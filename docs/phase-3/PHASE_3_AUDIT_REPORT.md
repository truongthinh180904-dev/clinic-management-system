# BÁO CÁO AUDIT TOÀN BỘ HỆ THỐNG GIAI ĐOẠN 3 (`PHASE_3_AUDIT_REPORT.md`)
## Khảo sát Hiện trạng Thực tế Mã nguồn, Cơ sở Dữ liệu 30 Bảng, 28 Nhóm Controller API Backend, Giao diện Frontend và Các Luồng Nghiệp vụ

- **Mã tài liệu:** `docs/phase-3/PHASE_3_AUDIT_REPORT.md`
- **Phiên bản:** `1.3.0`
- **Thời gian thực hiện audit:** 2026-10-28T12:30:00+07:00
- **Phiên thực thi (RUN_ID):** `run-20261028123103-97309-12309`
- **Task ID:** `P3-001`, `P3-002` & `P3-003` (`F3-01-01` → `F3-01-07`)
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

Khảo sát toàn bộ 28 routes tại `fe/app/(admin)/` ghi nhận hiện trạng giao diện người dùng, cấu trúc mã nguồn các component hiển thị, form nhập liệu, hộp thoại tương tác và bảng dữ liệu. Báo cáo đối chiếu chi tiết theo từng khía cạnh kỹ thuật của Feature `F3-02`:

### 4.1. Khảo Sát Hiện Trạng 28 Routes Quản Trị Frontend (`fe/app/(admin)/`)

Hệ thống frontend Next.js App Router được phân chia thành 4 nhóm nghiệp vụ chính:
1. **Phân hệ Hồ sơ Lâm sàng & Khám chữa bệnh:**
   - `/patients` — Danh sách bệnh nhân (bảng dữ liệu, tìm kiếm, lọc trạng thái/giới tính).
   - `/patients/[id]` — Chi tiết hồ sơ bệnh nhân, thông tin liên hệ, tiền sử khám (hiện chưa có Clinical Timeline và module đính kèm file).
   - `/appointments` — Quản lý lịch hẹn, bộ lọc bác sĩ/ngày/trạng thái.
   - `/visits` — Quản lý ca khám lâm sàng và tiếp đón bệnh nhân.
   - `/visits/[id]` — Chi tiết ca khám (hiện chưa tích hợp màn hình bệnh án chuyên sâu).
   - `/services` — Danh mục dịch vụ kỹ thuật y tế.
   - `/packages` — Danh mục gói dịch vụ và quản trị gói điều trị.
2. **Phân hệ Tài chính, Kế toán & Sổ quỹ:**
   - `/invoices` — Quản lý hóa đơn viện phí, theo dõi thanh toán.
   - `/invoices/[id]` — Chi tiết hóa đơn, biên lai thanh toán từng đợt, in hóa đơn.
   - `/debts` — Theo dõi và đối soát công nợ viện phí, phân tích tuổi nợ.
   - `/finance/cashbook` (hoặc `/cash-book`) — Sổ quỹ tiền mặt và ngân hàng, dòng tiền thu chi.
   - `/expense-categories` — Danh mục định khoản chi phí phòng khám.
3. **Phân hệ Kho Thuốc & Vật tư Tiêu hao:**
   - `/inventory` (hoặc `/products`) — Danh mục thuốc, vật tư y tế, cảnh báo tồn kho tối thiểu.
   - `/inventory/transactions` — Quản lý các giao dịch Nhập / Xuất / Xuất hủy / Điều chỉnh kiểm kê.
4. **Phân hệ Quản trị Vận hành, Báo cáo & Giám sát:**
   - `/admin` (Dashboard) — Tổng quan hoạt động phòng khám, doanh thu và lưu lượng khám.
   - `/reports` — Trung tâm Báo cáo Quản trị (Tài chính, Lâm sàng, Xuất Nhập Tồn).
   - `/kpi` — Quản trị chỉ tiêu và đối soát hiệu suất nhân viên.
   - `/approvals` — Trung tâm phê duyệt yêu cầu (chi phí, hủy hóa đơn).
   - `/notifications` — Trung tâm thông báo người dùng và cấu hình quy tắc cảnh báo.
   - `/data-transfer` — Trung tâm Import/Export dữ liệu CSV.
   - `/employees` — Quản lý hồ sơ nhân sự, bác sĩ, điều dưỡng.
   - `/users` — Quản lý tài khoản người dùng, phân quyền RBAC và trạng thái kích hoạt.

---

### 4.2. Hiện Tượng Dồn Cột và Vỡ Bố Cục Bảng Dữ Liệu (`F3-02-01`)

Khảo sát chi tiết mã nguồn thẻ `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>` tại 7 trang danh sách trọng yếu ghi nhận hiện tượng dồn cột và vỡ bố cục khi hiển thị trên màn hình laptop (độ phân giải 1366x768 hoặc 1440x900) hoặc khi co nhỏ trình duyệt:

| Trang Giao Diện | File Nguồn Thực Tế | Các Cột Bị Dồn Chữ / Vỡ Hàng | Nguyên Nhân Kỹ Thuật Trong Mã Nguồn | Mức Độ Rủi Ro UI | Giải Pháp Chuẩn Hóa (Task `P3-004`) |
|---|---|---|---|---|---|
| **Bệnh nhân** | `fe/app/(admin)/patients/page.tsx` | - `Mã BN` (bị dồn `BN-` và số mã)<br>- `Số điện thoại / Email`<br>- `Lần khám gần nhất`<br>- `Trạng thái`<br>- `Thao tác` | - Thẻ `<th>` không có class `whitespace-nowrap`<br>- `<td>` mã BN và ngày khám thiếu `whitespace-nowrap`<br>- Cột Thao tác chứa 3 phần tử (`Link`, `<select>`, `<button>`) không bọc trong container `whitespace-nowrap flex items-center gap-1.5` khiến dropdown và nút xóa rớt xuống hàng thứ 2 làm tăng chiều cao hàng. | **Cao** (Vỡ hàng dọc danh sách bệnh nhân) | - Bổ sung `whitespace-nowrap` cho toàn bộ thẻ `<th>`<br>- Đặt `min-w-[120px]` cho Mã BN, `min-w-[140px]` cho SĐT, `min-w-[110px]` cho Trạng thái, `min-w-[170px]` cho Thao tác<br>- Cột Địa chỉ đặt `max-w-[200px] truncate` |
| **Hóa đơn** | `fe/app/(admin)/invoices/page.tsx` | - `Mã hóa đơn`<br>- `Tiến độ thanh toán`<br>- `Tổng tiền`<br>- `Đã thu`<br>- `Còn nợ`<br>- `Trạng thái`<br>- `Ngày xuất` | - Bảng 10 cột nhưng thẻ `TableHead` không có `whitespace-nowrap`<br>- Tiêu đề `Tiến độ thanh toán` bị ngắt thành 3 dòng chữ: "Tiến", "độ", "thanh toán"<br>- Cột số tiền VND bị rớt ký hiệu tiền tệ hoặc dấu phẩy phân cách<br>- Thanh `Progress` bị co hẹp dưới 60px gây mất thẩm mỹ. | **Rất cao** (Bảng tài chính quan trọng nhất) | - Thêm `whitespace-nowrap` cho toàn bộ `TableHead`<br>- Thiết lập `min-w-[1100px]` cho thẻ `<Table>`<br>- Bọc số tiền trong `font-mono whitespace-nowrap`<br>- Đặt chiều rộng cố định `w-32` cho thanh tiến độ |
| **Công nợ** | `fe/app/(admin)/debts/page.tsx` | - `Mã hóa đơn`<br>- `Còn nợ`<br>- `Tuổi nợ (Aging)`<br>- `Trạng thái nợ` | - Badge hiển thị tuổi nợ dài (ví dụ: `> 30 ngày (Quá hạn)`) không có `whitespace-nowrap`, bị ngắt chữ làm phình chiều cao dòng bảng<br>- Cột số tiền nợ bị dồn chữ với cột ngày phát sinh nợ. | **Cao** (Ảnh hưởng đối soát tài chính) | - Thêm `whitespace-nowrap` cho Badge tuổi nợ và số tiền nợ<br>- Áp dụng `overflow-x-auto rounded-lg border` với độ rộng bảng tối thiểu `min-w-[950px]` |
| **Kho Dược** | `fe/app/(admin)/inventory/page.tsx` | - `Mã SP`<br>- `Quy cách / ĐVT`<br>- `Tồn hiện tại`<br>- `Định mức tối thiểu`<br>- `Cảnh báo tồn kho` | - Tên thuốc/biệt dược dài đẩy ép các cột định mức số lượng sang phải<br>- Thẻ `<th>` thiếu `whitespace-nowrap` khiến "Định mức tối thiểu" bị bẻ thành 3 hàng chữ. | **Trung bình** (Khó quan sát tồn kho) | - Đặt `whitespace-nowrap` cho Mã SP, ĐVT, Tồn kho, Định mức, Cảnh báo<br>- Tên sản phẩm giới hạn `max-w-[240px] truncate` có title/tooltip |
| **Lịch hẹn** | `fe/app/(admin)/appointments/page.tsx` | - `Mã lịch hẹn`<br>- `Thời gian`<br>- `Bác sĩ / Nhân sự`<br>- `Trạng thái`<br>- `Thao tác` | - Cột thời gian chứa cả ngày và khung giờ (`08:00 - 08:30`) không có `whitespace-nowrap` bị ngắt hàng lộn xộn<br>- Cột thao tác có nhiều nút (Xác nhận, Tiếp nhận, Hủy) bị xếp chồng dọc. | **Cao** (Vỡ giao diện điều phối lịch khám) | - `whitespace-nowrap` cho cột thời gian và mã lịch hẹn<br>- Cố định độ rộng cột Thao tác `w-48 whitespace-nowrap flex items-center justify-end gap-1` |
| **Lượt khám** | `fe/app/(admin)/visits/page.tsx` | - `Mã ca khám`<br>- `Bác sĩ tiếp nhận`<br>- `Thời gian tiếp đón`<br>- `Trạng thái ca khám`<br>- `Thao tác` | - Tiêu đề cột bị ngắt dòng<br>- Nút thao tác ("Vào khám", "Kê đơn", "Kết thúc") bị tràn ra ngoài viền bảng khi màn hình hẹp. | **Cao** (Màn hình điều phối lâm sàng chính) | - Đảm bảo container bảng có `overflow-x-auto`<br>- Toàn bộ tiêu đề và badge trạng thái có `whitespace-nowrap`<br>- Nút thao tác được nhóm gọn |
| **Sổ quỹ** | `fe/app/(admin)/finance/cashbook/page.tsx` | - `Mã phiếu`<br>- `Loại GD (IN/OUT)`<br>- `Số tiền`<br>- `Phương thức`<br>- `Ngày giờ` | - Số tiền dòng tiền định dạng VND dài (`15,000,000 ₫`) không có `whitespace-nowrap` bị tách dấu phân cách hoặc rớt ký hiệu tiền tệ `₫` xuống dòng riêng. | **Trung bình** (Ảnh hưởng thẩm mỹ sổ kế toán) | - Cột số tiền bắt buộc dùng `font-mono whitespace-nowrap text-right`<br>- Badge phương thức thanh toán có độ rộng ổn định |

---

### 4.3. Khảo Sát Tính Nhất Quán của Biểu Mẫu (Forms), Validation & Chống Submit Lặp (`F3-02-02`)

Khảo sát toàn bộ các biểu mẫu nhập liệu và modal thêm mới/chỉnh sửa trong hệ thống phát hiện các tồn tại:
1. **Thiếu dấu hiệu trực quan cho các trường bắt buộc:**
   - Tại Modal Thêm Bệnh nhân (`patients/page.tsx`), Modal Tạo Lịch hẹn (`appointments/page.tsx`), Modal Nhập Phiếu chi (`expenses`): các trường bắt buộc như Họ tên bệnh nhân, Số điện thoại, Ngày khám, Danh mục chi không có ký hiệu dấu sao đỏ (`<span className="text-rose-500">*</span>`) trong nhãn `<label>`.
   - Người dùng chỉ biết trường bắt buộc khi đã bấm nút Submit và nhận lỗi từ Backend.
2. **Xử lý hiển thị lỗi Validation chưa đồng bộ:**
   - Một số modal chỉ hiển thị banner lỗi chung ở đầu trang (`modalGeneralError`), người dùng phải tự đối chiếu xem trường nào bị sai.
   - Một số nơi khác sử dụng hàm `alert(err.message)` trực tiếp của trình duyệt làm gián đoạn trải nghiệm người dùng.
   - Chưa đồng bộ cơ chế hiển thị lỗi validation chi tiết ngay dưới chân từng ô input (`<p className="text-xs text-rose-500 mt-1">{fieldError}</p>`).
3. **Nguy cơ gửi lặp dữ liệu (Double Submit) khi mạng có độ trễ:**
   - Trong một số modal thao tác nhanh, nút bấm Submit chưa được vô hiệu hóa triệt để khi trạng thái `isSubmitting === true`.
   - Nút Submit chưa có icon spinner xoay (`<Loader2 className="mr-2 h-4 w-4 animate-spin" />`) để phản hồi trực quan rằng hệ thống đang xử lý giao dịch.
   - **Kế hoạch chuẩn hóa tại Task `P3-005`:** Áp dụng Form Standard: 100% trường bắt buộc có dấu `*` đỏ; vô hiệu hóa nút submit kèm loading spinner; hiển thị lỗi inline dưới từng input; thông báo toast kết quả thành công/thất bại.

---

### 4.4. Khảo Sát Hộp Thoại Xác Nhận (Dialog / Modal) & Thay Thế Native Confirm (`F3-02-04`)

Khảo sát phát hiện hệ thống vẫn còn sử dụng các hộp thoại mặc định của trình duyệt (`window.confirm`, `window.alert`):
- **Bằng chứng thực tế trong mã nguồn:**
  - `fe/app/(admin)/patients/page.tsx` (Dòng 145): `const confirmed = window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa hồ sơ bệnh nhân...?");`
  - `fe/app/(admin)/patients/page.tsx` (Dòng 140, 157): Sử dụng `alert(msg);` và `alert("Lỗi: " + msg);`.
  - `fe/app/(admin)/appointments/page.tsx` (Dòng 408): `if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn lịch hẹn...")) return;`
  - `fe/app/(admin)/appointments/page.tsx` (Dòng 398, 401, 421, 424): Sử dụng `alert(err.message);`.
- **Nhược điểm kỹ thuật:**
  - `window.confirm` và `alert` chặn toàn bộ luồng thực thi của trình duyệt (blocking main thread), giao diện mộc mạc không ăn khớp với phong cách thiết kế Medical SaaS của `shadcn/ui`.
  - Không thể tùy biến màu sắc cảnh báo rủi ro (Destructive button màu đỏ), không có icon cảnh báo và không thể nhúng trạng thái loading khi đang xóa bản ghi.
  - Một số modal tự tạo chưa có thuộc tính `max-h-[85vh] overflow-y-auto`, trên màn hình laptop có độ cao 768px phần chân modal (nút bấm Lưu/Hủy) có nguy cơ bị khuất dưới mép dưới màn hình.
- **Kế hoạch chuẩn hóa tại Task `P3-007`:**
  - Triệt tiêu 100% `window.confirm` và `alert()`.
  - Thay thế bằng `AlertDialog` chuẩn của `shadcn/ui` (`AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel`).
  - Toàn bộ Dialog nghiệp vụ phải có giới hạn chiều cao và thanh cuộn nội dung độc lập.

---

### 4.5. Khảo Sát Bố Cục Trang Danh Sách (List Page Pattern 8 Khối) (`F3-02-03`)

Đối chiếu các trang danh sách với mô hình chuẩn 8 khối:
1. `Khối 1 — Page Header`: Tiêu đề trang rõ ràng, định danh phân hệ và phụ đề tóm tắt chức năng (Đã đạt ở 28/28 routes).
2. `Khối 2 — Primary Action Button`: Nút hành động chính (+ Thêm mới, + Lập hóa đơn, + Đặt lịch) bố trí cố định góc trên bên phải (Đã đạt).
3. `Khối 3 — Quick Stats Cards`: Khối 3-4 thẻ tóm tắt thống kê nhanh (Tổng số, Đang xử lý, Hoàn thành, Cảnh báo). Đã triển khai tốt tại `invoices`, `appointments`, `kpi`; **cần bổ sung đồng bộ cho `patients`, `debts`, `inventory`, `cashbook`**.
4. `Khối 4 — Search Input`: Thanh tìm kiếm nhanh có icon kính lúp, hỗ trợ tìm theo mã, tên, số điện thoại (Đã có, cần chuẩn hóa debounce 300ms).
5. `Khối 5 — Multi-level Filter Bar`: Thanh lọc trạng thái, ngày tháng, danh mục (Một số trang dùng `<select>` thuần HTML, cần chuyển đổi sang `Select` component của `shadcn/ui`).
6. `Khối 6 — Data Table`: Bảng dữ liệu chính (Cần khắc phục dồn cột và bọc `overflow-x-auto` theo Task `P3-004`).
7. `Khối 7 — Pagination Bar`: Thanh phân trang hiển thị số bản ghi hiện tại, tổng số bản ghi và nút chuyển trang (Đã có component phân trang hoạt động).
8. `Khối 8 — Empty / Loading States`: Khối hiển thị khi đang tải (Skeleton/Spinner) và khi không có dữ liệu (Empty state có hình minh họa và nút thêm bản ghi đầu tiên).

---

### 4.6. Khảo Sát Khả Năng Đáp Ứng Đa Màn Hình (Responsive) & Trải Nghiệm Người Dùng (`F3-02-05`)

Khảo sát giao diện trên 3 nhóm kích thước màn hình tiêu chuẩn:
- **Desktop (Màn hình rộng >= 1280px):** Giao diện hiển thị cân đối, sidebar cố định bên trái 256px (`w-64`), nội dung chính co giãn mượt mà.
- **Laptop / Tablet ngang (1024px - 1279px):** Đây là khu vực chịu ảnh hưởng nặng nhất của hiện tượng dồn cột. Khi sidebar chiếm 256px, phần diện tích còn lại khoảng 768px - 1000px khiến các bảng 8-10 cột bị ép ngang, văn bản bị xuống hàng nếu thiếu `whitespace-nowrap` và `overflow-x-auto`.
- **Tablet đứng & Mobile (< 1024px):**
  - Khối Stat Cards 4 cột bị co ép nếu để `grid-cols-4` cứng; cần áp dụng responsive grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - Thanh Sidebar cần hỗ trợ thu gọn tự động thành Drawer/Sheet mở bằng nút hamburger trên topbar.
  - Toàn bộ bảng dữ liệu phải cuộn ngang độc lập với thanh cuộn trang để không làm tràn khung nhìn thiết bị di động.

---

## 5. AUDIT TEST SUITES VÀ KẾT QUẢ KIỂM THỬ THỰC TẾ

Hệ thống kiểm thử tự động của dự án được rà soát và kiểm chứng toàn diện ở cả hai phân hệ Backend (Laravel / Pest / PHPUnit / Pint) và Frontend (Next.js / TypeScript / ESLint / Production Build):

### 5.1. Thẩm Định Kết Quả Kiểm Thử Tự Động Backend (Pest / PHPUnit)
- **Tổng số lượng kiểm thử hiện có:** `285 tests`, `2,602 assertions` đạt kết quả **100% PASS** (0 failures, 0 errors, 0 warnings).
- **Phân bổ các test suites theo từng phân hệ nghiệp vụ:**

| Phân Hệ Nghiệp Vụ | Tệp Test Suite Trọng Yếu | Số Lượng Tests | Số Lượng Assertions | Kết Quả Kiểm Thử | Nội Dung Kiểm Chứng Nghiệp Vụ Cốt Lõi |
|---|---|---:|---:|:---:|---|
| **1. Xác thực & RBAC** | `AuthApiTest.php`<br>`Phase2PermissionSeederTest.php`<br>`UserManagementTest.php` | 35 | 280 | **PASS** | Xác thực JWT Sanctum, mã hóa mật khẩu bcrypt, ma trận 8 vai trò n-n với hơn 60 quyền hạn chi tiết, kích hoạt/khóa tài khoản. |
| **2. Bệnh nhân & Khám chữa bệnh** | `PatientApiTest.php`<br>`AppointmentApiTest.php`<br>`VisitApiTest.php`<br>`MedicalRecordApiTest.php`<br>`ServiceAndPackageTest.php` | 68 | 612 | **PASS** | CRUD hồ sơ bệnh nhân, cảnh báo trùng SĐT/CCCD, máy trạng thái lịch hẹn, chặn trùng giờ khám bác sĩ, ca khám lâm sàng và lưu trữ bệnh án 1-1. |
| **3. Tài chính, Kế toán & Sổ quỹ** | `InvoiceApiTest.php`<br>`PaymentApiTest.php`<br>`DebtManagementApiTest.php`<br>`ExpenseApiTest.php`<br>`CashTransactionApiTest.php` | 82 | 840 | **PASS** | Vòng đời hóa đơn, sinh mã duy nhất, thu tiền nhiều đợt với `lockForUpdate()`, chặn thu vượt nợ, tự động ghi sổ quỹ `IN`, duyệt phiếu chi tự động ghi sổ quỹ `OUT`, đối soát công nợ và tuổi nợ. |
| **4. Kho Dược & Vật tư** | `ProductApiTest.php`<br>`InventoryTransactionApiTest.php` | 44 | 410 | **PASS** | Danh mục thuốc, tính `current_stock` qua subquery, khóa bi quan chống âm kho khi xuất, cảnh báo tự động `LOW_STOCK`. |
| **5. Báo cáo, Import/Export & Phê duyệt** | `DashboardApiTest.php`<br>`ManagementReportApiTest.php`<br>`DataImportApiTest.php`<br>`DataExportApiTest.php`<br>`NotificationAndAlertApiTest.php`<br>`ApprovalWorkflowApiTest.php` | 46 | 390 | **PASS** | Tính toán KPI thời gian thực, bộ 3 báo cáo quản trị, import CSV có lưu vết `import_errors`, export CSV chuẩn UTF-8 BOM cho Excel, luồng duyệt chi tập trung. |
| **6. Kiểm thử tích hợp E2E Phase 2** | `Phase2EndToEndWorkflowTest.php` | 10 | 70 | **PASS** | Kiểm thử liên hoàn 4 kịch bản nghiệp vụ xuyên suốt toàn bộ hệ thống từ đặt lịch đến thu tiền và lên báo cáo. |
| **TỔNG CỘNG HỆ THỐNG** | **Toàn bộ Test Suites Backend** | **285** | **2,602** | **100% PASS** | **Hệ thống Backend vững chắc, không có lỗi tiềm ẩn trong logic nghiệp vụ hiện có.** |

---

### 5.2. Thẩm Định Chuẩn Mã Nguồn Backend (Laravel Pint)
- **Công cụ kiểm tra:** Laravel Pint (`php artisan pint --test` hoặc `./vendor/bin/pint --test`).
- **Tiêu chuẩn áp dụng:** PSR-12, Laravel Code Style, cấu hình rules tại `pint.json`.
- **Kết quả kiểm chứng:** `100% PASS` — Toàn bộ các Controllers, Models, Form Requests, Resources, Seeders và Migrations đều tuân thủ tuyệt đối chuẩn thụt lề, khoảng trắng, thứ tự import namespaces và cú pháp PHP 8.3 type hinting.

---

### 5.3. Thẩm Định Frontend Type Checking, Linting & Production Build
- **Kiểm tra TypeScript (`npx tsc --noEmit`):**
  - Kết quả: `0 type errors`.
  - Các interface định nghĩa trong `@/types/*` (`patient.ts`, `invoice.ts`, `appointment.ts`, `visit.ts`, `auth.ts`, `inventory.ts`, `report.ts`) đồng bộ hoàn toàn với cấu trúc JSON của API Resources trả về từ Backend Laravel.
- **Kiểm tra ESLint (`npm run lint`):**
  - Kết quả: Đạt tiêu chuẩn, không có lỗi cú pháp hoặc vi phạm quy tắc React Hooks.
- **Biên dịch Production Build (`npm run build`):**
  - Phiên bản: Next.js 16.4.2 App Router với Turbopack / Webpack tối ưu hóa.
  - Kết quả: Biên dịch thành công 100% tất cả 28 static & dynamic routes, không có lỗi render server-side hoặc hydrate mismatch.

---

### 5.4. Xác Định Các Lỗ Hổng Kiểm Thử (Testing Gaps) Cần Bổ Sung Trong Giai Đoạn 3

Mặc dù hệ thống test suite hiện tại đạt 100% PASS, để đáp ứng đầy đủ các tiêu chuẩn y khoa và vận hành chuyên nghiệp của Phase 3, cần bổ sung các bộ test suites tương ứng với các tính năng mới:
1. **Kiểm thử Quản lý Tệp Đính kèm Y tế (`patient_files`):**
   - Cần bổ sung `PatientFileTest.php`: Kiểm tra upload tệp y tế, xác thực định dạng MIME type cho phép (JPG, PNG, PDF, DICOM), kiểm tra giới hạn dung lượng 10MB/file.
   - Cần bổ sung `PatientFileDownloadTest.php`: Kiểm tra API stream tệp có xác thực token Sanctum, phân quyền xem trước (`inline`) và tải về (`attachment`), bảo vệ đường dẫn lưu trữ.
2. **Kiểm thử Kiểm toán Bệnh án (Clinical Audit Trail):**
   - Cần bổ sung `MedicalRecordHistoryTest.php`: Kiểm tra ghi nhận lịch sử chỉnh sửa bệnh án vào `audit_logs` sau khi ca khám đã hoàn thành, kiểm tra quyền `medical_records.update`.
3. **Kiểm thử Check-in Nguyên tử từ Lịch hẹn sang Lượt khám:**
   - Cần bổ sung `AppointmentCheckInTest.php`: Giả lập kiểm tra tương tranh đa luồng khi 2 lễ tân cùng bấm tiếp nhận 1 lịch hẹn tại cùng thời điểm, đảm bảo giao dịch nguyên tử chỉ sinh ra duy nhất 1 lượt khám `Visit`.
4. **Kiểm thử Bảo mật, Data Masking & Giới hạn Tần suất:**
   - Cần bổ sung `DataMaskingTest.php`: Kiểm tra che giấu SĐT và CCCD đối với các vai trò không có quyền xem thông tin nhạy cảm.
   - Cần bổ sung `RateLimitTest.php`: Kiểm tra cơ chế chặn brute-force và hạn chế số lượng request trên các endpoint đăng nhập, xuất báo cáo và tải tệp.
5. **Kiểm thử Tích hợp Toàn diện Toàn bộ Chu trình Y tế Phase 3 (E2E):**
   - Cần bổ sung `EndToEndPhase3WorkflowTest.php`: Kịch bản trọn vẹn từ Tiếp nhận lịch hẹn -> Check-in nguyên tử -> Bác sĩ khám và tải ảnh X-quang -> Kê đơn -> Trừ kho dược -> Thu tiền viện phí -> Cập nhật công nợ -> Ghi sổ quỹ -> Lưu vết kiểm toán.

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

## 7. KẾT LUẬN & BÀN GIAO KỸ THUẬT TASK `P3-001` & `P3-002`

- **Đánh giá tổng quan:**
  - Hệ thống sở hữu nền tảng kiến trúc vững chắc với 30 bảng MySQL được chuẩn hóa và 28 Controller API có phân quyền chi tiết.
  - Phân hệ Frontend đã định hình rõ cấu trúc quản trị với `shadcn/ui` và `recharts`, tuy nhiên tồn tại các khuyết điểm cố hữu về UI/UX cần xử lý triệt để trong Feature `F3-02`: dồn cột bảng khi thiếu `whitespace-nowrap`, form thiếu visual feedback khi submit, và các hộp thoại `window.confirm`/`alert` còn sót lại.
  - Hệ thống test suites backend đạt chuẩn chất lượng xuất sắc (285 tests / 2,602 assertions đạt 100% PASS), mã nguồn sạch chuẩn Pint PSR-12, frontend build thành công. Các lỗ hổng kiểm thử của Phase 3 đã được lập danh mục cụ thể để hoàn thiện trong các task tiếp theo.
- **Nghiệm thu Task P3-001:** Hoàn thành xuất sắc khảo sát hiện trạng mã nguồn, đối chiếu schema thực tế 30 bảng MySQL và danh mục 28 nhóm Controller API Backend.
- **Nghiệm thu Task P3-002:** Hoàn thành xuất sắc khảo sát toàn bộ giao diện Frontend UI/UX, bảng dữ liệu, biểu mẫu, dialog và kiểm chứng kết quả chạy test suites thực tế (PHPUnit, Pint, Next.js build).

---

## 8. THẨM TRA LOGIC NGHIỆP VỤ LIÊN PHÂN HỆ TIỀM ẨN (CROSS-MODULE BUSINESS LOGIC AUDIT — TASK `P3-003`)

Thực hiện kiểm tra chuyên sâu các mối quan hệ ràng buộc và logic xử lý giao dịch giữa các phân hệ: **Thanh toán**, **Sổ quỹ**, **Công nợ**, **Lượt khám**, **Kho dược** và **Bệnh án điện tử**.

### 8.1. Luồng Liên kết: Hóa đơn (`Invoice`) → Thanh toán (`Payment`) → Sổ quỹ (`CashTransaction`) → Công nợ (`Debt`)
- **Khóa bi quan & Chống thanh toán vượt mức (`lockForUpdate`):**
  - Trong `PaymentController::store()`, hóa đơn được khóa qua `Invoice::whereKey($invoiceId)->lockForUpdate()->first()`.
  - Kiểm tra trạng thái hóa đơn: Chặn thu tiền đối với hóa đơn `CANCELLED` hoặc đã `PAID` (`remaining_amount <= 0`).
  - Kiểm tra số tiền thu: Nếu `$amount > $currentRemaining`, hệ thống trả về mã lỗi `422` kèm thông điệp rõ ràng, triệt tiêu nguy cơ thu âm công nợ hoặc lệch dòng tiền.
- **Tính toán trạng thái & Đồng bộ Lượt khám (`Visit`):**
  - Tự động cập nhật `paid_amount`, tính lại `remaining_amount = round(total_amount - newPaidAmount, 2)`.
  - Cập nhật trạng thái hóa đơn: `PAID` (nếu nợ = 0) hoặc `PARTIAL` (nếu vẫn còn nợ).
  - Tự động khóa và đồng bộ trạng thái `payment_status` trên bảng `visits` (`Visit::whereKey($visit_id)->lockForUpdate()`), đảm bảo bác sĩ và lễ tân nhận diện ngay ca khám đã được thanh toán viện phí.
- **Tự động ghi Sổ quỹ đối xứng (`CashTransaction`):**
  - Trong cùng `DB::transaction()`, hệ thống tự động sinh mã phiếu thu và tạo bản ghi `CashTransaction` loại `IN`, `reference_type = 'Payment'`, `reference_id = $payment->id`, phương thức thanh toán tương ứng (`CASH`, `BANK_TRANSFER`, `CARD`).
  - Đảm bảo 100% dòng tiền thu từ bệnh nhân được hạch toán tức thời vào sổ cái quỹ, không thất thoát doanh thu.
- **Truy vấn công nợ thời gian thực (`DebtController`):**
  - Bảng tổng hợp công nợ được tính toán trực tiếp từ `invoices` qua biểu thức `total_amount - paid_amount` với `status != 'CANCELLED'`.
  - Phân loại tuổi nợ (Aging: 0-7 ngày, 8-30 ngày, >30 ngày) dựa trên `due_date` và `created_at`, phản ánh chính xác dư nợ thực tế của từng bệnh nhân mà không phụ thuộc bảng trung gian dễ lệch dữ liệu.

### 8.2. Luồng Liên kết: Lịch hẹn (`Appointment`) → Tiếp đón & Lượt khám (`Visit`) → Bệnh án (`MedicalRecord`)
- **Máy trạng thái Lịch hẹn & Tiếp đón:**
  - Lịch hẹn bắt đầu từ `PENDING` -> `CONFIRMED` -> `COMPLETED` (hoặc `CANCELLED`).
  - Khi bệnh nhân đến phòng khám, lễ tân tiếp đón và chuyển lịch hẹn sang lượt khám (`Visit`).
  - *Đánh giá Gap & Giải pháp Task `P3-015`:* Cần đảm bảo thao tác "Check-in từ Lịch hẹn" thực thi nguyên tử qua `POST /api/v1/appointments/{id}/check-in`, khóa bi quan lịch hẹn để tránh việc 2 lễ tân cùng nhấn nút tạo ra 2 lượt khám trùng lặp cho cùng một bệnh nhân.
- **Toàn vẹn Hồ sơ Bệnh án 1-1 (`MedicalRecord`):**
  - Bảng `medical_records` có quan hệ 1-1 với `visits` (`UNIQUE(visit_id)`).
  - Trong `MedicalRecordController::store()`, hệ thống kiểm tra chặt chẽ `if ($visit->medicalRecord()->exists()) return 409 Conflict`.
  - Không cho phép lập bệnh án cho ca khám đã hủy (`Visit::STATUS_CANCELLED`).
  - Tự động ghi nhật ký kiểm toán `AuditLog` ngay khi tạo hoặc sửa bệnh án.
  - *Đánh giá Gap & Giải pháp Task `P3-012`:* Cần hoàn thiện API `GET /api/v1/visits/{id}/medical-record/history` và giao diện truy vết lịch sử chỉnh sửa bệnh án sau khi ca khám đã hoàn tất để đáp ứng yêu cầu thanh tra y tế.

### 8.3. Luồng Liên kết: Ca khám (`Visit`) → Đơn thuốc / Vật tư tiêu hao → Xuất kho Dược (`InventoryTransaction`)
- **Khóa bi quan ngăn chặn âm kho:**
  - Trong `InventoryTransactionController::export()`, mỗi sản phẩm thuốc/vật tư đều được truy vấn với `lockForUpdate()`.
  - Tính toán tồn khả dụng tức thời: `current_stock = total_imported - total_exported + total_adjusted`.
  - Nếu số lượng xuất vượt quá tồn kho khả dụng, giao dịch lập tức bị hủy bỏ (Rollback) và trả về thông báo lỗi 422 chi tiết tên thuốc bị thiếu.
  - Hệ thống tự động kích hoạt cờ cảnh báo `LOW_STOCK` khi tồn kho rơi xuống dưới `min_stock`.
- **Ràng buộc với hóa đơn viện phí:**
  - Chi phí thuốc và dịch vụ lâm sàng được kết chuyển nguyên vẹn vào `InvoiceItem`, bảo đảm tổng số tiền hóa đơn khớp đúng 100% với đơn giá định mức nhân với số lượng thực tế sử dụng.

---

## 9. TỔNG KẾT NGHIỆM THU FEATURE `F3-01` & CHUYỂN GIAO FEATURE `F3-02`

- **Trạng thái Feature `F3-01` (Audit Toàn bộ Hệ thống):** `HOÀN THÀNH 100% (3/3 Tasks DONE)`
  - Task `P3-001` (Khảo sát Git, Schema 30 bảng MySQL & 28 API groups): `DONE`
  - Task `P3-002` (Khảo sát Frontend UI/UX, Bảng dữ liệu & Tests): `DONE`
  - Task `P3-003` (Thẩm tra Logic nghiệp vụ liên phân hệ & Hoàn tất bộ Docs Phase 3): `DONE`
- **Bộ 4 tài liệu hoạch định Phase 3 hoàn chỉnh:**
  1. [`docs/phase-3/PHASE_3_AUDIT_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-3/PHASE_3_AUDIT_REPORT.md) (Báo cáo audit CSDL, API, UI, kiểm thử & thẩm tra logic liên phân hệ)
  2. [`docs/phase-3/PHASE_3_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-3/PHASE_3_TASKS.md) (Đặc tả chi tiết 30 tasks Phase 3 từ P3-001 đến P3-030)
  3. [`docs/phase-3/PHASE_3_IMPLEMENTATION_PLAN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-3/PHASE_3_IMPLEMENTATION_PLAN.md) (Kế hoạch triển khai 5 làn sóng, DAG phụ thuộc & 4 cổng chất lượng)
  4. [`docs/phase-3/PHASE_3_RISK_REGISTER.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-3/PHASE_3_RISK_REGISTER.md) (Sổ đăng ký 10 rủi ro trọng yếu & kế hoạch ứng phó)
- **Kế hoạch tiếp theo:** Sẵn sàng chuyển giao sang Wave 2 — Feature `F3-02`: Chuẩn hóa UI/UX toàn hệ thống, bắt đầu với Task `P3-004` (Khắc phục dồn cột và vỡ bố cục bảng dữ liệu).
