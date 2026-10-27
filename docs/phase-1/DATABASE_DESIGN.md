# DATABASE DESIGN — 30 BẢNG HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (`P1-004`)

Tài liệu thiết kế chi tiết 30 bảng CSDL trên MySQL (`DBQLPK`, `utf8mb4_unicode_ci`) và quy tắc toàn vẹn dữ liệu.

---

## 1. Danh mục 30 bảng theo 11 Phân hệ

| STT | Tên bảng | Phân hệ | Khóa chính (PK) | Khóa duy nhất (UNIQUE) | Ghi chú |
|---:|---|---|---|---|---|
| 1 | `roles` | 1. Người dùng & Bảo mật | `id` | — | 8 vai trò chuẩn |
| 2 | `permissions` | 1. Người dùng & Bảo mật | `id` | `permission_key` | Mã quyền `<module>.<action>` |
| 3 | `role_permissions` | 1. Người dùng & Bảo mật | `(role_id, permission_id)` | — | Khóa chính ghép, chỉ có `created_at` |
| 4 | `user_roles` | 1. Người dùng & Bảo mật | `(user_id, role_id)` | — | Khóa chính ghép, chỉ có `created_at` |
| 5 | `users` | 1. Người dùng & Bảo mật | `id` | `username` | Dùng `password_hash`, FK `employee_id` NULL |
| 6 | `audit_logs` | 1. Người dùng & Bảo mật | `id` | — | Lưu JSON `old_values`, `new_values`; không lưu mật khẩu/token |
| 7 | `employees` | 2. Nhân sự | `id` | `employee_code` | Tạo trước `users` |
| 8 | `patients` | 3. Bệnh nhân | `id` | `patient_code` | `phone` cho phép trùng (cảnh báo ở tầng nghiệp vụ) |
| 9 | `patient_files` | 3. Bệnh nhân | `id` | — | Tệp đính kèm bệnh nhân / lượt khám |
| 10 | `medical_records` | 3. Bệnh nhân | `id` | `visit_id` | Quan hệ 1–1 với `visits` (`visit_id` UNIQUE) |
| 11 | `appointments` | 4. Lịch hẹn & Khám | `id` | `appointment_code` | Kiểm tra chống chồng giờ cùng `employee_id` |
| 12 | `visits` | 4. Lịch hẹn & Khám | `id` | `visit_code` | `total_amount = quantity * unit_price - discount_amount` |
| 13 | `services` | 5. Dịch vụ & Gói | `id` | `service_code` | `price DECIMAL(15,2)`, `duration_minutes SMALLINT UNSIGNED` |
| 14 | `service_packages` | 5. Dịch vụ & Gói | `id` | `package_code` | `total_sessions`, `validity_days` |
| 15 | `package_services` | 5. Dịch vụ & Gói | `(package_id, service_id)` | — | Khóa chính ghép, `quantity INT UNSIGNED` |
| 16 | `patient_packages` | 5. Dịch vụ & Gói | `id` | — | `used_sessions + remaining_sessions = total_sessions` |
| 17 | `invoices` | 6. Tài chính | `id` | `invoice_code` | `subtotal_amount`, `discount_amount`, `total_amount`, `paid_amount`, `remaining_amount` |
| 18 | `payments` | 6. Tài chính | `id` | `payment_code` | Hỗ trợ thanh toán nhiều lần cho 1 `invoice_id` |
| 19 | `expense_categories` | 7. Thu chi & Quỹ | `id` | `name` | Danh mục chi phí |
| 20 | `expenses` | 7. Thu chi & Quỹ | `id` | `expense_code` | Phiếu chi có `approval_status` |
| 21 | `cash_transactions` | 7. Thu chi & Quỹ | `id` | `transaction_code` | Tham chiếu đa hình `(reference_type, reference_id)` |
| 22 | `kpi_targets` | 8. Quản lý | `id` | — | Chỉ tiêu doanh thu & lượt khám theo kỳ |
| 23 | `notifications` | 8. Quản lý | `id` | — | Tham chiếu đa hình `(reference_type, reference_id)` |
| 24 | `approval_requests` | 8. Quản lý | `id` | — | Yêu cầu phê duyệt đa hình `(reference_type, reference_id)` |
| 25 | `alert_rules` | 8. Quản lý | `id` | — | Quy tắc cảnh báo tự động |
| 26 | `products` | 9. Kho | `id` | `product_code` | `minimum_stock DECIMAL(15,3)` |
| 27 | `inventory_transactions` | 9. Kho | `id` | — | `quantity DECIMAL(15,3)`, tham chiếu đa hình |
| 28 | `import_batches` | 10. Import/Export | `id` | — | Lô import dữ liệu |
| 29 | `import_errors` | 10. Import/Export | `id` | — | Chi tiết lỗi từng dòng JSON `raw_data` |
| 30 | `system_settings` | 11. Hệ thống | `id` | `setting_key` | Cấu hình hệ thống key-value |

---

## 2. Xác minh 10 Điểm Nghiệp vụ Trọng yếu (Phần C)

1. **`users` & `employees`**: `users.employee_id` là `NULLABLE` FK trỏ tới `employees.id` (`nullOnDelete`), cho phép tài khoản hệ thống độc lập hoặc gắn với nhân sự.
2. **`patients`**: `patient_code` là `UNIQUE`; `phone` là `VARCHAR(30) NULL` (không ép `UNIQUE` cứng để hỗ trợ người thân dùng chung SĐT, cảnh báo trùng ở tầng API).
3. **`medical_records`**: `visit_id` có ràng buộc `UNIQUE`, bảo đảm mỗi lượt khám chỉ có tối đa 1 bệnh án chính.
4. **`appointments`**: Kiểm tra `end_time > start_time` và chống trùng lịch của cùng `employee_id` trong cùng `appointment_date` với các lịch chưa hủy (`status != 'CANCELLED'`).
5. **`visits`**: `total_amount = quantity * unit_price - discount_amount` (`DECIMAL(15,2)`), không âm, liên kết tùy chọn với `appointment_id` và `patient_package_id`.
6. **`patient_packages`**: Bất biến `used_sessions + remaining_sessions = total_sessions`, `remaining_sessions >= 0`, khóa dòng (`lockForUpdate`) khi trừ buổi.
7. **`invoices` & `payments`**: 1 hóa đơn có nhiều `payments`, `paid_amount + remaining_amount = total_amount`.
8. **Tham chiếu đa hình (`cash_transactions`, `notifications`, `approval_requests`, `inventory_transactions`)**: Dùng cặp `(reference_type, reference_id)` có đánh composite index.
9. **`audit_logs`**: Tuyệt đối lọc bỏ `password`, `password_hash`, `token` trước khi ghi `old_values`/`new_values`.
10. **Chuẩn hóa giá trị `status`**:
    - Chung (`users`, `employees`, `patients`, `services`, `service_packages`, `products`, `expense_categories`, `alert_rules`): `ACTIVE`, `INACTIVE`, `LOCKED`.
    - `patient_packages`: `ACTIVE`, `COMPLETED`, `EXPIRED`, `CANCELLED`.
    - `appointments`: `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
    - `visits`: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`; `payment_status`: `UNPAID`, `PARTIAL`, `PAID`, `PACKAGED`.
