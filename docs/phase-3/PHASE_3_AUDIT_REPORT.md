# BÁO CÁO AUDIT TOÀN BỘ HỆ THỐNG GIAI ĐOẠN 3 (`PHASE_3_AUDIT_REPORT.md`)
## Khảo sát Hiện trạng Thực tế Mã nguồn, Cơ sở Dữ liệu 30 Bảng, API Backend, Giao diện Frontend và Các Luồng Nghiệp vụ

- **Mã tài liệu:** `docs/phase-3/PHASE_3_AUDIT_REPORT.md`
- **Phiên bản:** `1.0.0`
- **Thời gian thực hiện audit:** 2026-10-28T10:20:00+07:00
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
  - [`DATABASE_DESIGN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/DATABASE_DESIGN.md): Đặc tả ERD 30 bảng MySQL 8.0.
  - [`API_DOCUMENTATION.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/API_DOCUMENTATION.md): Danh mục API Core v1.
- **Tài liệu Phase 2 (`docs/phase-2/`):**
  - [`PHASE_2_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_REPORT.md): Báo cáo nghiệm thu bàn giao 30 task Giai đoạn 2.
  - [`PHASE_2_COMPLETION_SUMMARY.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_COMPLETION_SUMMARY.md): Bảng tổng hợp nghiệm thu chi tiết 11 Features (`F2-01` -> `F2-11`).
  - [`API_DOCUMENTATION_PHASE_2.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/API_DOCUMENTATION_PHASE_2.md): Đặc tả 28 nhóm API nâng cao (Tài chính, Sổ quỹ, Kho, KPI, Báo cáo, Import/Export, Cảnh báo).
  - Bản lưu trữ framework: `ROADMAP-PHASE-2-ARCHIVE.md` và `PROGRESS-PHASE-2-ARCHIVE.md`.

---

## 2. AUDIT SCHEMA MYSQL THỰC TẾ ĐỐI CHIẾU VỚI ERD 30 BẢNG

Hệ thống quản lý phòng khám được xây dựng dựa trên 30 bảng quan hệ trên MySQL 8.0 (`DBQLPK`). Kết quả đối chiếu chi tiết giữa Schema MySQL thực tế và Eloquent Models trong `be/app/Models/`:

| STT | Tên Bảng MySQL | Eloquent Model | Mục đích Nghiệp vụ | Tình trạng API / Controller | Đánh giá Tính Toàn Vẹn |
|---|---|---|---|---|---|
| 1 | `users` | `User.php` | Tài khoản đăng nhập hệ thống | Hoàn thiện (`UserController`) | Khóa ngoại với `employees`, mã hóa bcrypt, quản lý trạng thái ACTIVE/INACTIVE |
| 2 | `roles` | `Role.php` | Vai trò người dùng (ADMIN, DOCTOR, ...) | Hoàn thiện (`RolePermissionController`) | Slug unique, quan hệ n-n với permissions |
| 3 | `permissions` | `Permission.php` | Quyền hạn chi tiết | Hoàn thiện (`RolePermissionController`) | Quản lý theo chuẩn `resource.action` |
| 4 | `role_permissions` | Pivot table | Bảng trung gian Role - Permission | Hoàn thiện | Composite primary key `(role_id, permission_id)` |
| 5 | `user_roles` | Pivot table | Bảng trung gian User - Role | Hoàn thiện | Composite primary key `(user_id, role_id)` |
| 6 | `departments` | `Department.php` | Chuyên khoa / Phòng ban | Hoàn thiện | Liên kết nhân viên theo chuyên khoa |
| 7 | `employees` | `Employee.php` | Thông tin nhân viên, bác sĩ, điều dưỡng | Hoàn thiện (`EmployeeController`) | Mã `employee_code` unique, liên kết user 1-1 |
| 8 | `patients` | `Patient.php` | Hồ sơ bệnh nhân | Hoàn thiện (`PatientController`) | Mã `patient_code` unique, tra cứu trùng lặp theo SĐT/CCCD |
| 9 | `services` | `Service.php` | Danh mục dịch vụ khám / cận lâm sàng | Hoàn thiện (`ServiceController`) | Mã dịch vụ, giá tiền, thời lượng, trạng thái |
| 10 | `service_packages` | `ServicePackage.php` | Gói dịch vụ định kỳ / liệu trình | Hoàn thiện (`ServicePackageController`) | Giá gói, thời hạn sử dụng, số buổi |
| 11 | `package_services` | Pivot table | Dịch vụ trong gói | Hoàn thiện (`PackageServiceController`) | Quản lý số lượt định mức của từng dịch vụ trong gói |
| 12 | `patient_packages` | `PatientPackage.php` | Gói dịch vụ bệnh nhân đã mua | Hoàn thiện (`PatientPackageController`) | Theo dõi số buổi đã dùng / còn lại, trạng thái |
| 13 | `appointments` | `Appointment.php` | Lịch hẹn khám bệnh | Hoàn thiện (`AppointmentController`) | Trạng thái: PENDING, CONFIRMED, COMPLETED, CANCELLED |
| 14 | `visits` | `Visit.php` | Lượt khám thực tế tại phòng khám | Hoàn thiện (`VisitController`) | Trạng thái tiếp đón, khám bệnh, kết thúc; liên kết tiếp nhận |
| 15 | `medical_records` | `MedicalRecord.php` | Hồ sơ bệnh án điện tử | Đã có API cơ bản, **chưa có UI chuyên sâu** | Quan hệ 1-1 với `visits` (`visit_id` UNIQUE). Cần audit trail khi sửa |
| 16 | `patient_files` | `PatientFile.php` | Tệp đính kèm y tế (X-quang, xét nghiệm, PDF) | **CHƯA CÓ API & UI CHÍNH THỨC** | **GAP QUAN TRỌNG:** Model đã có, bảng đã có nhưng chưa có Controller upload/download bảo mật |
| 17 | `invoices` | `Invoice.php` | Hóa đơn viện phí | Hoàn thiện (`InvoiceController`) | `lockForUpdate()`, mã hóa đơn theo mẫu `HD-YYYYMMDD-XXXX` |
| 18 | `invoice_items` | `InvoiceItem.php` | Chi tiết dịch vụ/thuốc trong hóa đơn | Hoàn thiện (`InvoiceController`) | Đơn giá, số lượng, giảm giá, thành tiền |
| 19 | `payments` | `Payment.php` | Lịch sử thanh toán thu tiền nhiều đợt | Hoàn thiện (`PaymentController`) | Tự động đồng bộ sang Sổ quỹ `cash_transactions` |
| 20 | `debts` | `Debt.php` | Sổ theo dõi công nợ bệnh nhân | Hoàn thiện (`DebtController`) | Tổng nợ, đã trả, còn nợ, cập nhật real-time khi thanh toán |
| 21 | `expense_categories` | `ExpenseCategory.php`| Danh mục phân loại chi phí | Hoàn thiện (`ExpenseCategoryController`)| Phân cấp cha con, mã danh mục |
| 22 | `expenses` | `Expense.php` | Phiếu chi tiền mặt / chuyển khoản | Hoàn thiện (`ExpenseController`) | Tự động ghi giảm quỹ trong `cash_transactions` |
| 23 | `cash_transactions` | `CashTransaction.php`| Sổ quỹ thu chi tổng hợp | Hoàn thiện (`CashTransactionController`)| Theo dõi dòng tiền, phương thức, tồn quỹ |
| 24 | `products` | `Product.php` | Danh mục Thuốc và Vật tư y tế | Hoàn thiện (`ProductController`) | Quản lý tồn kho, tồn tối thiểu, đơn vị tính, hạn dùng |
| 25 | `inventory_transactions` | `InventoryTransaction.php` | Nhật ký nhập / xuất / kiểm kê kho | Hoàn thiện (`InventoryTransactionController`)| Giao dịch nguyên tử, ngăn chặn xuất âm kho |
| 26 | `kpi_targets` | `KpiTarget.php` | Chỉ tiêu KPI nhân viên | Hoàn thiện (`KpiTargetController`) | Giao chỉ tiêu theo tháng/quý/năm cho bác sĩ/nhân viên |
| 27 | `kpi_performances` | `KpiPerformance.php`| Thực đạt KPI tự động đối soát | Hoàn thiện (`KpiTargetController`) | Tự động tính toán dựa trên doanh thu và lượt khám thực |
| 28 | `audit_logs` | `AuditLog.php` | Nhật ký kiểm toán thao tác hệ thống | Hoàn thiện (`AuditLogController`) | Ghi nhận user_id, action, model, old_values, new_values, ip |
| 29 | `alert_rules` | `AlertRule.php` | Cấu hình quy tắc cảnh báo tự động | Hoàn thiện (`AlertRuleController`) | Cảnh báo nợ quá hạn, tồn kho dưới định mức, hủy lịch |
| 30 | `approval_requests` | `ApprovalRequest.php`| Yêu cầu phê duyệt nghiệp vụ | Hoàn thiện (`ApprovalRequestController`)| Phê duyệt miễn giảm hóa đơn, xuất hủy kho, chi tiền lớn |

---

## 3. AUDIT BACKEND API, CONTROLLERS, VALIDATION & MIDDLEWARES

### 3.1. Các Controller và Route đang hoạt động
- **Tổng số nhóm Controller trong `be/app/Http/Controllers/Api/V1/`:** `28 Controllers`
  - Đều được bọc trong middleware `auth:sanctum` và `active_user` (trừ `/v1/health` và `/v1/auth/login`).
  - 100% routes nghiệp vụ được gắn middleware phân quyền `permission:xxx.yyy`.
- **Điểm khuyết thiếu (Gaps) cần xử lý trong Phase 3:**
  1. **Tệp đính kèm y tế (`patient_files`):** Chưa có `PatientFileController`. Cần xây dựng API upload tệp (ảnh X-quang, MRI, kết quả xét nghiệm PDF), validate định dạng/dung lượng an toàn, lưu trữ có phân quyền và API download qua signed stream.
  2. **Audit Trail cho Bệnh án điện tử (`medical_records`):** Hiện tại `MedicalRecordController@update` ghi log cơ bản nhưng chưa có endpoint tra cứu lịch sử các lần chỉnh sửa bệnh án của từng lượt khám (`GET /api/v1/visits/{visit}/medical-record/history`).
  3. **Thao tác chuyển đổi trạng thái Lịch hẹn -> Tiếp đón -> Khám:** Cần đảm bảo tính nguyên tử: khi bấm "Tiếp đón" từ Lịch hẹn, hệ thống tự động sinh `Visit` trạng thái `WAITING` và cập nhật `Appointment` thành `COMPLETED` trong cùng một transaction.

### 3.2. Kiểm tra An toàn Dữ liệu & Chống Race Condition
- **Tài chính & Sổ quỹ:** `InvoiceController`, `PaymentController`, `ExpenseController`, `CashTransactionController` đều sử dụng `DB::transaction()` và `lockForUpdate()`. Đảm bảo không xảy ra hiện tượng thanh toán đúp hoặc lệch sổ quỹ khi có request đồng thời.
- **Kho Dược:** `InventoryTransactionController` kiểm tra số lượng tồn hiện tại bằng khóa bi quan `lockForUpdate()`. Nếu số lượng xuất vượt tồn kho, trả về lỗi `422 Unprocessable Entity`, đảm bảo không âm kho.

---

## 4. AUDIT FRONTEND UI/UX VÀ CÁC LUỒNG NGHIỆP VỤ

Qua khảo sát toàn bộ các trang tại `fe/app/(admin)/`, phát hiện các vấn đề UI/UX cần chuẩn hóa triệt để theo yêu cầu `F3-02`:

### 4.1. Vấn đề 1: Bảng dữ liệu bị dồn cột, chữ xuống dòng 2-3 dòng (F3-02-01)
- **Hiện trạng:**
  - Ở các trang `patients/page.tsx`, `invoices/page.tsx`, `debts/page.tsx`, `inventory/page.tsx`, `appointments/page.tsx`, `visits/page.tsx`:
  - Các cột tiêu đề như "Mã bệnh nhân", "Thời gian tiếp đón", "Trạng thái thanh toán", "Hành động" không có `whitespace-nowrap`.
  - Trên màn hình laptop kích thước trung bình (1280px - 1440px), nội dung mã và ngày tháng bị ngắt dòng (ví dụ: `BN-20261028-` xuống dòng `0001`, `Đang điều` xuống dòng `trị`).
  - Các nút hành động (Xem, Sửa, Xóa, Thu tiền) bị ép sát hoặc xếp dọc làm mất thẩm mỹ chuyên nghiệp.
- **Giải pháp chuẩn hóa:**
  - Bọc tất cả bảng trong container `<div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">` với `min-w-[900px]` hoặc `min-w-[1100px]` tùy số cột.
  - Áp dụng `whitespace-nowrap` cho toàn bộ `<th>` tiêu đề và các ô ngắn: Mã ID, Ngày giờ, Huy hiệu trạng thái (Badge), Số tiền, Cột hành động.
  - Cột nội dung dài (Địa chỉ, Chẩn đoán, Ghi chú) đặt `max-w-xs truncate` kết hợp tooltip hoặc xem chi tiết.
  - Cố định header (`sticky top-0 bg-slate-50 dark:bg-slate-900`) khi cuộn bảng dài.

### 4.2. Vấn đề 2: Tính nhất quán của Form và Validation (F3-02-02)
- **Hiện trạng:**
  - Một số form sử dụng input gốc mà chưa đồng bộ đầy đủ với component `Input`, `Select`, `Button` của `shadcn/ui`.
  - Một số trường bắt buộc chưa có dấu sao đỏ (`*`) trực quan.
  - Khi người dùng bấm lưu nhiều lần liên tiếp, một số form chưa vô hiệu hóa nút submit (`isSubmitting`), có nguy cơ gửi trùng request nếu mạng trễ.
- **Giải pháp chuẩn hóa:**
  - Chuẩn hóa cấu trúc Form: nhãn rõ ràng, dấu sao đỏ cho `required`, inline validation error dưới từng input.
  - Trạng thái loading: hiển thị spinner và vô hiệu hóa nút (`disabled={isSubmitting}`) để ngăn duplicate submit.
  - Toast thông báo thành công hoặc thất bại bằng component đồng nhất.

### 4.3. Vấn đề 3: Cấu trúc trang danh sách (List Page Layout) (F3-02-03)
- **Hiện trạng:**
  - Một số trang có thanh tìm kiếm và bộ lọc không đều nhau (có trang dùng flex-col, có trang dùng grid).
  - Trạng thái Empty State (khi danh sách trống) ở một số trang chỉ hiển thị dòng chữ đơn giản "Không có dữ liệu".
- **Giải pháp chuẩn hóa:**
  - Áp dụng cấu trúc chuẩn 8 khối: Header (Tiêu đề + Nút hành động chính) -> KPI Cards tóm tắt (nếu cần) -> Filter Toolbar (Search + Filters) -> Data Table -> Empty/Loading/Error States -> Pagination Bar.

### 4.4. Vấn đề 4: Dialog & Responsive (F3-02-04 & F3-02-05)
- **Hiện trạng:**
  - Dialog xác nhận một số nơi dùng modal tự chế hoặc `window.confirm`.
  - Trên màn hình tablet/mobile, một số modal tràn màn hình do không có `max-h-[90vh] overflow-y-auto`.
- **Giải pháp chuẩn hóa:**
  - Sử dụng thống nhất component `Dialog` hoặc `AlertDialog` của `shadcn/ui` cho các hành động nguy hiểm (Hủy lịch, Hủy hóa đơn, Xóa hồ sơ).
  - Thiết lập responsive: Dialog tự động co giãn, có thanh cuộn nội dung khi màn hình nhỏ.

### 4.5. Vấn đề 5: Hồ sơ bệnh nhân & Khám bệnh tách bạch (F3-02-06 & F3-03)
- **Hiện trạng:**
  - Trang chi tiết bệnh nhân `patients/[id]/page.tsx` tab "medical" hiện chỉ có nút liên kết sang `/visits?patient_id=...` mà chưa hiển thị trục thời gian (timeline) bệnh án chi tiết, danh sách tệp đính kèm kết quả xét nghiệm, và chưa phân định rõ ranh giới giữa hồ sơ y tế lâm sàng và thông tin tài chính/công nợ.
- **Giải pháp chuẩn hóa:**
  - Xây dựng Clinical Timeline: hiển thị các đợt khám theo thứ tự thời gian giảm dần, tóm tắt chẩn đoán, bác sĩ phụ trách, thuốc đã kê.
  - Tích hợp tab Quản lý Tệp Đính kèm (X-quang, Xét nghiệm) có xem trước thumbnail và download an toàn.
  - Giữ nguyên cơ chế bảo mật: tài khoản không có quyền `medical_records.view` (như Thu ngân, Kế toán) chỉ thấy thông tin hành chính & tài chính, không xem được chi tiết bệnh án chuyên môn.

---

## 5. AUDIT TEST SUITES VÀ KẾT QUẢ THỰC TẾ

- **Backend PHPUnit Test Suite:**
  - `285 tests`, `2,602 assertions` -> **100% PASS** trong Phase 2.
  - Bao phủ toàn bộ các luồng: RBAC, Auth, Patient, Appointment, Visit, Invoice, Multi-payment, Debt ledger, Cash transactions, Inventory transactions, KPI calculations, Alerts, Approvals, Import CSV, Export CSV streaming.
- **Code Style Linting:**
  - `vendor/bin/pint --test` -> **PASS** (Tuân thủ chuẩn PSR-12 / Laravel Code Style).
- **Frontend Build & Type Check:**
  - Next.js 16.4.2 App Router với 28 pages biên dịch thành công không có TypeScript error.
- **Kết luận:** Nền tảng code sạch và ổn định, sẵn sàng để triển khai các cải tiến sâu về UI/UX và hoàn thiện các module còn thiếu trong Phase 3.

---

## 6. DANH SÁCH LỖI TIỀM ẨN VÀ GAP NGHIỆP VỤ CẦN GIẢI QUYẾT TRONG PHASE 3

1. **Gap 1 (F3-05):** Chưa có module tải lên và xem tệp đính kèm y tế (`patient_files`).
2. **Gap 2 (F3-03):** Tab bệnh án trong chi tiết bệnh nhân chưa hiển thị timeline lâm sàng hoàn chỉnh và chưa có lịch sử chỉnh sửa bệnh án.
3. **Gap 3 (F3-02-01):** Bảng dữ liệu trên hầu hết các trang bị xuống dòng ở các cột mã, ngày, trạng thái khi xem trên laptop thông thường.
4. **Gap 4 (F3-06):** Biểu đồ báo cáo cần chuẩn hóa thêm Donut Chart (tỷ trọng phương thức thanh toán, nhóm chi phí), Bar Chart (KPI kế hoạch vs thực tế), Line Chart (xu hướng doanh thu & lượt khám 12 tháng).
5. **Gap 5 (F3-08):** Chưa có kịch bản và runbook tự động hóa sao lưu dự phòng CSDL (`scripts/backup-db.sh` và `scripts/restore-db.sh`) có cơ chế dry-run kiểm thử trên database cô lập.
6. **Gap 6 (F3-09):** Cần rà soát các câu truy vấn phức tạp (báo cáo doanh thu, lịch sử khám, sổ quỹ) để thêm Composite Index trên MySQL nhằm tối ưu tốc độ phản hồi dưới 100ms.

---

## 7. KẾ HOẠCH TRIỂN KHAI PHÂN RÃ 30 TASKS GIAI ĐOẠN 3

Dựa trên kết quả audit, Giai đoạn 3 (`PHASE-03`) được phân rã thành **30 Tasks chi tiết (`P3-001` -> `P3-030`)** trải đều trên 10 Features (`F3-01` -> `F3-10`), được đặc tả chi tiết trong tài liệu [`docs/phase-3/PHASE_3_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-3/PHASE_3_TASKS.md).
