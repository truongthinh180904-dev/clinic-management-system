# DATABASE DESIGN — TÀI LIỆU THIẾT KẾ CƠ SỞ DỮ LIỆU
## HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK) — 30 BẢNG CHUẨN

- **Mã tài liệu:** `DB-DESIGN-PHASE-01`
- **Phiên bản:** `1.1.0`
- **Hệ quản trị CSDL:** MySQL `8.0+` (InnoDB Engine)
- **Database:** `DBQLPK`
- **Bộ mã ký tự / Sắp xếp:** `utf8mb4` / `utf8mb4_unicode_ci`
- **Khóa chính mặc định:** `BIGINT UNSIGNED AUTO_INCREMENT` (ngoại trừ 3 bảng pivot dùng Composite Primary Key)
- **Quy tắc độ chính xác tiền tệ / kho:** `DECIMAL(15,2)` cho tài chính, `DECIMAL(15,3)` cho tồn kho vật tư

---

## 1. TỔNG QUAN PHÂN BỔ 30 BẢNG THEO 11 PHÂN HỆ

| STT | Tên bảng | Phân hệ nghiệp vụ | Khóa chính (PK) | Ràng buộc duy nhất (UNIQUE) | Ràng buộc khóa ngoại chính (FK) |
|---:|---|---|---|---|---|
| 1 | `roles` | 1. Người dùng & Phân quyền | `id` | `code` | — |
| 2 | `permissions` | 1. Người dùng & Phân quyền | `id` | `permission_key` | — |
| 3 | `role_permissions` | 1. Người dùng & Phân quyền | `(role_id, permission_id)` | — | `role_id` -> `roles`, `permission_id` -> `permissions` |
| 4 | `user_roles` | 1. Người dùng & Phân quyền | `(user_id, role_id)` | — | `user_id` -> `users`, `role_id` -> `roles` |
| 5 | `users` | 1. Người dùng & Phân quyền | `id` | `username` | `employee_id` (NULLable) -> `employees` |
| 6 | `audit_logs` | 1. Người dùng & Phân quyền | `id` | — | `user_id` (NULLable) -> `users` |
| 7 | `employees` | 2. Quản lý Nhân sự | `id` | `employee_code` | — |
| 8 | `patients` | 3. Quản lý Bệnh nhân | `id` | `patient_code` | — (SĐT đánh Index tìm kiếm, cho phép trùng có cảnh báo) |
| 9 | `patient_files` | 3. Quản lý Bệnh nhân | `id` | — | `patient_id` -> `patients`, `visit_id` -> `visits` |
| 10 | `medical_records` | 3. Bệnh án Y tế | `id` | `visit_id` | `visit_id` (1-1) -> `visits`, `patient_id` -> `patients` |
| 11 | `appointments` | 4. Lịch hẹn & Tiếp đón | `id` | `appointment_code` | `patient_id` -> `patients`, `employee_id` -> `employees` |
| 12 | `visits` | 4. Lịch hẹn & Tiếp đón | `id` | `visit_code` | `patient_id` -> `patients`, `employee_id` -> `employees`, `service_id` -> `services` |
| 13 | `services` | 5. Danh mục Dịch vụ | `id` | `service_code` | — |
| 14 | `service_packages` | 5. Gói Dịch vụ | `id` | `package_code` | — |
| 15 | `package_services` | 5. Cấu phần Gói | `(package_id, service_id)`| — | `package_id` -> `service_packages`, `service_id` -> `services` |
| 16 | `patient_packages` | 5. Gói của Bệnh nhân | `id` | — | `patient_id` -> `patients`, `package_id` -> `service_packages` |
| 17 | `invoices` | 6. Tài chính & Hóa đơn | `id` | `invoice_code` | `patient_id` -> `patients`, `visit_id` -> `visits` |
| 18 | `payments` | 6. Thanh toán đa lần | `id` | `payment_code` | `invoice_id` -> `invoices`, `cashier_id` -> `users` |
| 19 | `expense_categories` | 7. Sổ quỹ & Chi phí | `id` | `name` | — |
| 20 | `expenses` | 7. Sổ quỹ & Chi phí | `id` | `expense_code` | `category_id` -> `expense_categories`, `created_by` -> `users` |
| 21 | `cash_transactions` | 7. Sổ quỹ & Giao dịch | `id` | `transaction_code` | Đa hình `(reference_type, reference_id)` |
| 22 | `kpi_targets` | 8. Quản trị & Báo cáo | `id` | — | `employee_id` -> `employees` |
| 23 | `notifications` | 8. Thông báo hệ thống | `id` | — | `user_id` -> `users`, Đa hình `(reference_type, reference_id)` |
| 24 | `approval_requests` | 8. Luồng Phê duyệt | `id` | — | `requester_id` -> `users`, Đa hình `(reference_type, reference_id)` |
| 25 | `alert_rules` | 8. Quy tắc Cảnh báo | `id` | — | — |
| 26 | `products` | 9. Kho & Dược phẩm | `id` | `product_code` | — |
| 27 | `inventory_transactions` | 9. Biến động kho | `id` | — | `product_id` -> `products`, Đa hình `(reference_type, reference_id)` |
| 28 | `import_batches` | 10. Nhập liệu dữ liệu | `id` | — | `imported_by` -> `users` |
| 29 | `import_errors` | 10. Nhật ký lỗi import | `id` | — | `batch_id` -> `import_batches` |
| 30 | `system_settings` | 11. Cấu hình Hệ thống | `id` | `setting_key` | — |

---

## 2. CHI TIẾT THIẾT KẾ CÁC PHÂN HỆ NỀN TẢNG (GIAI ĐOẠN 1)

### 2.1. Phân hệ 1: Người dùng, Phân quyền & Giám sát (Security & RBAC)

#### Bảng `roles`
- Lưu trữ danh mục 8 vai trò mặc định: `ADMIN`, `MANAGER`, `DOCTOR`, `RECEPTIONIST`, `CASHIER`, `ACCOUNTANT`, `EMPLOYEE`, `VIEWER`.
- Cột: `id` (PK), `code` (VARCHAR(50), UNIQUE), `name` (VARCHAR(100)), `description` (TEXT), `status` (ENUM('ACTIVE','INACTIVE')), `timestamps`.

#### Bảng `permissions`
- Lưu trữ các đơn vị quyền nguyên tử theo cấu trúc `<module>.<action>`.
- Cột: `id` (PK), `permission_key` (VARCHAR(100), UNIQUE), `name` (VARCHAR(150)), `module` (VARCHAR(50)), `description` (TEXT), `timestamps`.

#### Bảng `role_permissions`
- Pivot table N-N giữa vai trò và quyền.
- Cột: `role_id` (FK), `permission_id` (FK), `created_at` (TIMESTAMP).
- PK ghép: `PRIMARY KEY (role_id, permission_id)`. Không có cột `updated_at`.

#### Bảng `user_roles`
- Pivot table N-N giữa người dùng và vai trò.
- Cột: `user_id` (FK), `role_id` (FK), `created_at` (TIMESTAMP).
- PK ghép: `PRIMARY KEY (user_id, role_id)`.

#### Bảng `users`
- Tài khoản đăng nhập hệ thống.
- Cột: `id` (PK), `employee_id` (FK NULLable, ON DELETE SET NULL), `username` (VARCHAR(50), UNIQUE), `password_hash` (VARCHAR(255)), `status` (ENUM('ACTIVE','INACTIVE','LOCKED')), `last_login_at` (TIMESTAMP NULL), `timestamps`.
- **Lưu ý bảo mật:** Luôn ẩn `password_hash` khỏi API response Resource.

#### Bảng `audit_logs`
- Nhật ký truy vết toàn bộ thao tác thêm/sửa/xóa nhạy cảm.
- Cột: `id` (PK), `user_id` (FK NULLable), `action` (VARCHAR(100)), `module` (VARCHAR(50)), `record_id` (BIGINT UNSIGNED NULL), `old_values` (JSON NULL), `new_values` (JSON NULL), `ip_address` (VARCHAR(45)), `user_agent` (TEXT), `created_at` (TIMESTAMP).
- **Lưu ý bảo mật:** Tuyệt đối lọc bỏ mật khẩu, mã PIN hoặc API token trước khi ghi vào `old_values`/`new_values`.

---

### 2.2. Phân hệ 2: Quản lý Nhân sự (Human Resources)

#### Bảng `employees`
- Quản lý hồ sơ nhân viên y tế và nhân viên hành chính.
- Cột: `id` (PK), `employee_code` (VARCHAR(50), UNIQUE), `full_name` (VARCHAR(150)), `department` (VARCHAR(100)), `position` (VARCHAR(100)), `phone` (VARCHAR(30)), `email` (VARCHAR(150)), `status` (ENUM('ACTIVE','INACTIVE')), `timestamps`.
- Quan hệ: HasOne `users`, HasMany `appointments` (lịch của bác sĩ), HasMany `visits` (bác sĩ khám), HasMany `medical_records` (bác sĩ ghi nhận).

---

### 2.3. Phân hệ 3: Quản lý Bệnh nhân & Bệnh án (Patients & Clinical Records)

#### Bảng `patients`
- Hồ sơ hành chính bệnh nhân.
- Cột: `id` (PK), `patient_code` (VARCHAR(50), UNIQUE, tiền tố `BN`), `full_name` (VARCHAR(150)), `gender` (ENUM('MALE','FEMALE','OTHER')), `dob` (DATE NULL), `phone` (VARCHAR(30) NULL, INDEX), `address` (TEXT NULL), `emergency_contact` (VARCHAR(255) NULL), `last_visit_date` (DATETIME NULL), `status` (ENUM('ACTIVE','INACTIVE')), `timestamps`.
- **Ràng buộc:** `phone` không ép `UNIQUE` để hỗ trợ dùng chung số gia đình/người già/trẻ em; sử dụng API `POST /patients/check-duplicates` để cảnh báo trùng lặp.

#### Bảng `medical_records`
- Hồ sơ bệnh án y tế chi tiết theo từng lượt khám.
- Cột: `id` (PK), `visit_id` (FK, UNIQUE), `patient_id` (FK), `employee_id` (FK), `symptoms` (TEXT NULL), `diagnosis` (TEXT), `treatment_plan` (TEXT NULL), `doctor_notes` (TEXT NULL), `timestamps`.
- **Quan hệ 1–1 bắt buộc:** Mỗi lượt khám chỉ có tối đa một bệnh án (`visit_id` UNIQUE).
- **Phân quyền truy cập:** Yêu cầu quyền `medical_records.view` / `medical_records.create`.

#### Bảng `patient_files`
- Tệp đính kèm y tế (hình ảnh siêu âm, X-quang, PDF kết quả xét nghiệm).
- Cột: `id` (PK), `patient_id` (FK), `visit_id` (FK NULLable), `file_name` (VARCHAR(255)), `file_path` (VARCHAR(500)), `file_size` (INT UNSIGNED), `mime_type` (VARCHAR(100)), `timestamps`.

---

### 2.4. Phân hệ 4: Lịch hẹn & Tiếp đón Lượt khám (Appointments & Visits)

#### Bảng `appointments`
- Lịch hẹn khám chữa bệnh của bệnh nhân với bác sĩ.
- Cột: `id` (PK), `appointment_code` (VARCHAR(50), UNIQUE), `patient_id` (FK), `employee_id` (FK), `appointment_date` (DATE), `start_time` (TIME), `end_time` (TIME), `status` (ENUM('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')), `appointment_type` (VARCHAR(50)), `cancel_reason` (TEXT NULL), `notes` (TEXT NULL), `timestamps`.
- **Quy tắc chống chồng lấn giờ (Overlap Prevention):**
  - Ràng buộc: `end_time > start_time`.
  - Không cho phép trùng khung giờ với các lịch chưa hủy (`status != 'CANCELLED'`) của cùng bác sĩ trong cùng ngày.

#### Bảng `visits`
- Lượt khám thực tế tiếp đón tại phòng khám.
- Cột: `id` (PK), `visit_code` (VARCHAR(50), UNIQUE), `patient_id` (FK), `employee_id` (FK), `service_id` (FK NULLable), `appointment_id` (FK NULLable), `patient_package_id` (FK NULLable), `visit_date` (DATETIME), `unit_price` (DECIMAL(15,2) DEFAULT 0), `quantity` (INT UNSIGNED DEFAULT 1), `discount_amount` (DECIMAL(15,2) DEFAULT 0), `total_amount` (DECIMAL(15,2) DEFAULT 0), `payment_status` (ENUM('UNPAID','PARTIAL','PAID','PACKAGED')), `status` (ENUM('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')), `notes` (TEXT NULL), `timestamps`.
- **Công thức bất biến:** `total_amount = (quantity * unit_price) - discount_amount`. Nếu dùng gói `patient_package_id`, `total_amount = 0` và `payment_status = 'PACKAGED'`.

---

### 2.5. Phân hệ 5: Danh mục Dịch vụ & Quản lý Gói (Services & Packages)

#### Bảng `services`
- Danh mục kỹ thuật y tế, công khám và dịch vụ cận lâm sàng.
- Cột: `id` (PK), `service_code` (VARCHAR(50), UNIQUE), `service_name` (VARCHAR(200)), `category` (VARCHAR(100)), `price` (DECIMAL(15,2)), `duration_minutes` (SMALLINT UNSIGNED DEFAULT 30), `description` (TEXT NULL), `status` (ENUM('ACTIVE','INACTIVE')), `timestamps`.

#### Bảng `service_packages`
- Danh mục gói dịch vụ định sẵn (ví dụ: Gói khám sức khỏe định kỳ, Gói chăm sóc da 10 buổi).
- Cột: `id` (PK), `package_code` (VARCHAR(50), UNIQUE), `package_name` (VARCHAR(200)), `total_sessions` (INT UNSIGNED), `package_price` (DECIMAL(15,2)), `validity_days` (INT UNSIGNED NULL), `description` (TEXT NULL), `status` (ENUM('ACTIVE','INACTIVE')), `timestamps`.

#### Bảng `package_services`
- Định mức cấu phần dịch vụ trong một gói.
- Cột: `package_id` (FK), `service_id` (FK), `quantity` (INT UNSIGNED DEFAULT 1), `created_at` (TIMESTAMP).
- PK ghép: `PRIMARY KEY (package_id, service_id)`. Không có cột `updated_at`.

#### Bảng `patient_packages`
- Hồ sơ mua gói và theo dõi khấu trừ buổi của từng bệnh nhân.
- Cột: `id` (PK), `patient_id` (FK), `service_package_id` (FK), `total_sessions` (INT UNSIGNED), `used_sessions` (INT UNSIGNED DEFAULT 0), `remaining_sessions` (INT UNSIGNED), `start_date` (DATE), `expiry_date` (DATE NULL), `status` (ENUM('ACTIVE','COMPLETED','EXPIRED','CANCELLED')), `notes` (TEXT NULL), `timestamps`.
- **Bất biến số học (Session Invariant):**
  - Luôn đảm bảo: `used_sessions + remaining_sessions == total_sessions`.
  - Luôn đảm bảo: `remaining_sessions >= 0`.
  - Mọi thao tác khấu trừ hoặc hoàn buổi phải dùng `DB::transaction` và `lockForUpdate`.

---

### 2.6. Phân hệ 6 đến 11: Tài chính, Sổ quỹ, Quản trị, Kho & Cấu hình (Phase 2 & Phase 3)

#### Bảng `invoices` & `payments` (Phân hệ 6 — Tài chính)
- Hỗ trợ thanh toán nhiều đợt (`payments`) cho cùng một hóa đơn (`invoices`).
- Bất biến tài chính: `paid_amount + remaining_amount == total_amount`.
- Tiền tệ: `subtotal_amount`, `discount_amount`, `total_amount`, `paid_amount`, `remaining_amount` đều lưu `DECIMAL(15,2)`.

#### Bảng `expense_categories`, `expenses`, `cash_transactions` (Phân hệ 7 — Sổ quỹ)
- Quản lý thu/chi tiền mặt và ngân hàng.
- `cash_transactions` sử dụng tham chiếu đa hình: `(reference_type, reference_id)` với Composite Index `(reference_type, reference_id)`.

#### Bảng `kpi_targets`, `notifications`, `approval_requests`, `alert_rules` (Phân hệ 8 — Quản trị)
- `notifications` và `approval_requests` sử dụng đa hình `(reference_type, reference_id)`.

#### Bảng `products`, `inventory_transactions` (Phân hệ 9 — Kho Dược & Vật tư)
- Số lượng vật tư, thuốc: dùng chuẩn `DECIMAL(15,3)` để hỗ trợ định lượng lẻ (ví dụ: gram, ml, liều nhỏ).

#### Bảng `import_batches`, `import_errors` (Phân hệ 10 — Nhập liệu)
- Lưu trữ nhật ký import Excel/CSV, bảng ghi lỗi lưu chuỗi JSON `raw_data` và `error_message`.

#### Bảng `system_settings` (Phân hệ 11 — Cấu hình)
- Cấu hình toàn hệ thống dạng Key-Value: `setting_key` (VARCHAR(100), UNIQUE), `setting_value` (TEXT NULL), `data_type` (VARCHAR(20)).

---

## 3. CHIẾN LƯỢC ĐÁNH CHỈ MỤC (INDEXING STRATEGY)

1. **Khóa duy nhất (Unique Indexes):**
   - Đảm bảo tính toàn vẹn định danh: `users.username`, `employees.employee_code`, `patients.patient_code`, `services.service_code`, `service_packages.package_code`, `appointments.appointment_code`, `visits.visit_code`, `medical_records.visit_id`, `invoices.invoice_code`, `payments.payment_code`, `expenses.expense_code`, `cash_transactions.transaction_code`, `products.product_code`, `system_settings.setting_key`.

2. **Chỉ mục tìm kiếm thường xuyên (Lookup Indexes):**
   - `patients.phone`: Tìm kiếm nhanh bệnh nhân khi tiếp đón hoặc tiếp nhận cuộc gọi.
   - `appointments (employee_id, appointment_date, start_time)`: Tối ưu tra cứu lịch khám của bác sĩ và thuật toán phát hiện trùng lịch.
   - `visits (patient_id, visit_date)`: Tìm kiếm lịch sử khám của người bệnh.
   - `patient_packages (patient_id, status)`: Lọc nhanh các gói còn hạn sử dụng của bệnh nhân.

3. **Chỉ mục quan hệ đa hình (Polymorphic Indexes):**
   - Đánh chỉ mục kép `INDEX (reference_type, reference_id)` trên các bảng: `cash_transactions`, `notifications`, `approval_requests`, `inventory_transactions`.
