# TÀI LIỆU KỸ THUẬT API — GIAI ĐOẠN 1 (PHASE-01)
## HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK)

- **Mã tài liệu:** `API-DOC-PHASE-01`
- **Phiên bản:** `1.0.0`
- **Ngày phát hành:** `2026-10-27`
- **Môi trường API:** `http://localhost:8000/api/v1`
- **Chuẩn giao tiếp:** RESTful API, JSON Envelope, UTF-8, ISO 8601 Timestamps
- **Xác thực & Bảo mật:** Laravel Sanctum Token (`Authorization: Bearer <token>`), RBAC Middleware (`active_user`, `permission:<key>`)

---

## 1. QUY ƯỚC CHUNG & CHUẨN DỮ LIỆU

### 1.1. Base URL & HTTP Headers
- **Base URL:** `http://localhost:8000/api/v1` (Frontend biến `NEXT_PUBLIC_API_BASE_URL`)
- **Headers bắt buộc:**
  ```http
  Accept: application/json
  Content-Type: application/json
  Authorization: Bearer <sanctum_token>
  ```

### 1.2. Chuẩn Cấu trúc JSON Envelope

#### Phản hồi thành công (Success Response — 200, 201)
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": { ... },
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 68
  }
}
```

#### Phản hồi lỗi nghiệp vụ / xác thực (Error Response — 400, 401, 403, 404, 409, 422, 500)
```json
{
  "success": false,
  "message": "Thông điệp mô tả lỗi chi tiết",
  "errors": {
    "field_name": [
      "Chi tiết lỗi cụ thể cho trường dữ liệu."
    ]
  }
}
```

### 1.3. Bảng mã trạng thái HTTP chuẩn

| HTTP Code | Định danh | Trường hợp sử dụng |
|---|---|---|
| `200 OK` | Hoàn tất | Yêu cầu GET, PUT, PATCH, DELETE thành công |
| `201 Created` | Đã khởi tạo | Yêu cầu POST tạo mới tài nguyên thành công |
| `400 Bad Request` | Tham số không hợp lệ | Vi phạm logic tiền đề không phân loại được |
| `401 Unauthorized` | Chưa xác thực | Không truyền Token, Token hết hạn hoặc không hợp lệ |
| `403 Forbidden` | Không có quyền | Tài khoản bị khóa (`LOCKED`), ngừng hoạt động (`INACTIVE`) hoặc thiếu quyền RBAC |
| `404 Not Found` | Không tìm thấy | Bản ghi không tồn tại hoặc đã bị xóa |
| `409 Conflict` | Xung đột tài nguyên | Trùng mã duy nhất (UNIQUE), trùng khung giờ bác sĩ, vi phạm concurrency |
| `422 Unprocessable Entity` | Lỗi Validation | Dữ liệu đầu vào sai định dạng, thiếu trường bắt buộc |
| `500 Server Error` | Lỗi hệ thống | Exception chưa được bắt (không để lộ stack trace trên production) |

---

## 2. PHÂN HỆ KIỂM TRA SỨC KHỎE HỆ THỐNG (HEALTH CHECK)

### `GET /health`
- **Mục đích:** Kiểm tra trạng thái hoạt động của Backend API.
- **Quyền hạn:** Không yêu cầu xác thực (`Public`).
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "message": "QLPK API is healthy.",
  "data": {
    "service": "qlpk-backend-api",
    "version": "v1",
    "status": "ok",
    "timestamp": "2026-10-27T04:50:00+00:00"
  }
}
```

---

## 3. PHÂN HỆ XÁC THỰC & PHIÊN LÀM VIỆC (AUTHENTICATION)

### 3.1. `POST /auth/login`
- **Mục đích:** Xác thực người dùng, cấp Token Sanctum.
- **Quyền hạn:** Public.
- **Request Body:**
```json
{
  "username": "admin",
  "password": "SecurePassword123@",
  "device_name": "Web Browser Chrome"
}
```
- **Validation Rules:**
  - `username`: `required|string`
  - `password`: `required|string`
  - `device_name`: `nullable|string|max:255`
- **Phản hồi thành công (`200 OK`):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "token": "1|q6WwKzZ...",
    "token_type": "Bearer",
    "user": {
      "id": 1,
      "employee_id": 1,
      "username": "admin",
      "status": "ACTIVE",
      "roles": ["ADMIN"],
      "permissions": ["*"]
    }
  }
}
```
- **Lỗi phổ biến:**
  - `401 Unauthorized`: Tài khoản hoặc mật khẩu không chính xác.
  - `403 Forbidden`: Tài khoản ở trạng thái `INACTIVE` hoặc `LOCKED`.

### 3.2. `GET /auth/me`
- **Mục đích:** Lấy thông tin tài khoản hiện tại, danh sách quyền và vai trò.
- **Quyền hạn:** Yêu cầu Bearer Token (`auth:sanctum`, `active_user`).
- **Phản hồi thành công (`200 OK`):**
```json
{
  "success": true,
  "message": "Lấy thông tin người dùng thành công",
  "data": {
    "id": 1,
    "employee_id": 1,
    "username": "admin",
    "status": "ACTIVE",
    "employee": {
      "id": 1,
      "employee_code": "NV000001",
      "full_name": "Nguyễn Văn Admin",
      "department": "BAN_GIAM_DOC",
      "position": "Giám đốc chuyên môn",
      "phone": "0901234567",
      "email": "admin@qlpk.vn"
    },
    "roles": [
      { "id": 1, "code": "ADMIN", "name": "Quản trị viên" }
    ],
    "permissions": ["users.view", "users.create", "users.update", "appointments.view", "visits.view"]
  }
}
```

### 3.3. `POST /auth/logout`
- **Mục đích:** Thu hồi token hiện tại, kết thúc phiên làm việc an toàn.
- **Quyền hạn:** Yêu cầu Bearer Token (`auth:sanctum`).
- **Phản hồi thành công (`200 OK`):**
```json
{
  "success": true,
  "message": "Đăng xuất thành công",
  "data": null
}
```

---

## 4. PHÂN HỆ PHÂN QUYỀN VAI TRÒ (RBAC)

### 4.1. `GET /roles`
- **Mục đích:** Danh sách các vai trò hệ thống kèm số lượng quyền và người dùng.
- **Quyền hạn:** `permission:roles.view`
- **Query Params:** `include_permissions=true` (tùy chọn)

### 4.2. `GET /permissions`
- **Mục đích:** Danh sách toàn bộ quyền chuẩn hóa nhóm theo module (`users`, `employees`, `patients`, `services`, `service_packages`, `patient_packages`, `appointments`, `visits`, `medical_records`, `roles`, `reports`).
- **Quyền hạn:** `permission:permissions.view|roles.view`

### 4.3. `PUT /roles/{role}/permissions`
- **Mục đích:** Đồng bộ (sync) danh sách mã quyền cho vai trò.
- **Quyền hạn:** `permission:roles.manage`
- **Request Body:**
```json
{
  "permissions": [
    "patients.view",
    "patients.create",
    "appointments.view",
    "appointments.create"
  ]
}
```

### 4.4. `PUT /users/{user}/roles`
- **Mục đích:** Gán danh sách vai trò cho một tài khoản người dùng.
- **Quyền hạn:** `permission:roles.manage`
- **Request Body:**
```json
{
  "roles": ["RECEPTIONIST", "EMPLOYEE"]
}
```

---

## 5. PHÂN HỆ QUẢN LÝ TÀI KHOẢN (USERS)

### 5.1. `GET /users`
- **Quyền hạn:** `permission:users.view`
- **Query Params:** `search`, `status` (`ACTIVE`, `INACTIVE`, `LOCKED`), `role_id`, `page`, `per_page`
- **Phản hồi:** Danh sách tài khoản người dùng kèm thông tin nhân sự và vai trò (ẩn tuyệt đối `password_hash`).

### 5.2. `POST /users`
- **Quyền hạn:** `permission:users.create`
- **Request Body:**
```json
{
  "employee_id": 2,
  "username": "bacsi_tuan",
  "password": "DoctorPass123!@",
  "roles": ["DOCTOR"],
  "status": "ACTIVE"
}
```

### 5.3. `GET /users/{user}`
- **Quyền hạn:** `permission:users.view`

### 5.4. `PUT/PATCH /users/{user}`
- **Quyền hạn:** `permission:users.update`
- **Request Body:** Cho phép cập nhật `employee_id`, `status`.

### 5.5. `PATCH /users/{user}/status`
- **Quyền hạn:** `permission:users.update`
- **Request Body:** `{"status": "INACTIVE"}` (hỗ trợ `ACTIVE`, `INACTIVE`, `LOCKED`).

### 5.6. `PUT/POST /users/{user}/password` hoặc `POST /users/{user}/change-password`
- **Quyền hạn:** `permission:users.update`
- **Request Body:** `{"password": "NewSecretPassword2026!@", "password_confirmation": "NewSecretPassword2026!@"}`

### 5.7. `DELETE /users/{user}`
- **Quyền hạn:** `permission:users.delete|users.update`
- **Lưu ý:** Ngăn chặn tự xóa tài khoản của chính mình hoặc tài khoản `ADMIN` duy nhất còn lại.

---

## 6. PHÂN HỆ QUẢN LÝ NHÂN SỰ (EMPLOYEES)

### 6.1. `GET /employees`
- **Quyền hạn:** `permission:employees.view`
- **Query Params:** `search`, `department`, `position`, `status` (`ACTIVE`, `INACTIVE`), `page`, `per_page`

### 6.2. `POST /employees`
- **Quyền hạn:** `permission:employees.create`
- **Request Body:**
```json
{
  "employee_code": "NV000002",
  "full_name": "Bác sĩ Trần Văn Tuấn",
  "department": "KHAM_BENH",
  "position": "Bác sĩ chuyên khoa I",
  "phone": "0987654321",
  "email": "tuan.tv@qlpk.vn",
  "status": "ACTIVE"
}
```
- **Quy tắc:** `employee_code` là duy nhất (`UNIQUE`); nếu không truyền, hệ thống tự sinh theo format `NVxxxxxx`.

### 6.3. `GET /employees/{employee}`
- **Quyền hạn:** `permission:employees.view`

### 6.4. `PUT/PATCH /employees/{employee}`
- **Quyền hạn:** `permission:employees.update`

### 6.5. `PATCH /employees/{employee}/status`
- **Quyền hạn:** `permission:employees.update`
- **Request Body:** `{"status": "INACTIVE"}`

### 6.6. `DELETE /employees/{employee}`
- **Quyền hạn:** `permission:employees.delete|employees.update`
- **Ràng buộc:** Nếu nhân viên đã gắn với tài khoản `users` hoặc lịch khám, hệ thống chuyển trạng thái sang `INACTIVE` để bảo tồn lịch sử audit.

---

## 7. PHÂN HỆ QUẢN LÝ BỆNH NHÂN (PATIENTS)

### 7.1. `POST /patients/check-duplicates`
- **Mục đích:** Tiền kiểm tra trùng lặp trước khi tiếp nhận bệnh nhân mới để tránh nhân đôi hồ sơ y tế.
- **Quyền hạn:** `permission:patients.view|patients.create`
- **Request Body:**
```json
{
  "phone": "0912345678",
  "full_name": "Nguyễn Thị Mai",
  "dob": "1992-05-14"
}
```
- **Phản hồi thành công (`200 OK`):**
```json
{
  "success": true,
  "message": "Kiểm tra trùng lặp hoàn tất",
  "data": {
    "has_duplicate": true,
    "matched_patients": [
      {
        "id": 12,
        "patient_code": "BN000012",
        "full_name": "Nguyễn Thị Mai",
        "phone": "0912345678",
        "dob": "1992-05-14",
        "match_reasons": ["Trùng số điện thoại", "Trùng họ tên và ngày sinh"]
      }
    ]
  }
}
```

### 7.2. `GET /patients`
- **Quyền hạn:** `permission:patients.view`
- **Query Params:** `search` (tìm theo mã `patient_code`, họ tên, số điện thoại), `gender` (`MALE`, `FEMALE`, `OTHER`), `status`, `page`, `per_page`

### 7.3. `POST /patients`
- **Quyền hạn:** `permission:patients.create`
- **Request Body:**
```json
{
  "patient_code": "BN000088",
  "full_name": "Lê Văn An",
  "gender": "MALE",
  "dob": "1988-10-20",
  "phone": "0909888999",
  "address": "123 Nguyễn Huệ, Quận 1, TP.HCM",
  "emergency_contact": "Mẹ: Lê Thị Bình - 0909111222",
  "status": "ACTIVE"
}
```
- **Quy tắc:** `patient_code` duy nhất (`UNIQUE`), tự sinh `BNxxxxxx` nếu để trống. `phone` không ép `UNIQUE` cứng để hỗ trợ người thân cùng số, nhưng kích hoạt cờ cảnh báo nếu trùng.

### 7.4. `GET /patients/{patient}`
- **Quyền hạn:** `permission:patients.view`

### 7.5. `PUT/PATCH /patients/{patient}`
- **Quyền hạn:** `permission:patients.update`

### 7.6. `PATCH /patients/{patient}/status`
- **Quyền hạn:** `permission:patients.update`

### 7.7. `GET /patients/{patient}/packages`
- **Mục đích:** Tra cứu lịch sử và danh sách gói dịch vụ đã mua của bệnh nhân.
- **Quyền hạn:** `permission:patient_packages.view|patients.view`

### 7.8. `POST /patients/{patient}/packages`
- **Mục đích:** Cấp (gán) gói dịch vụ mới cho bệnh nhân.
- **Quyền hạn:** `permission:patient_packages.assign|patients.update`
- **Request Body:**
```json
{
  "service_package_id": 3,
  "start_date": "2026-10-27",
  "notes": "Bệnh nhân thanh toán chuyển khoản gói Chăm sóc Da chuyên sâu 10 buổi"
}
```
- **Quy tắc nghiệp vụ:**
  - Tự động lấy `total_sessions` và `validity_days` từ gói `service_packages`.
  - Khởi tạo `used_sessions = 0`, `remaining_sessions = total_sessions`.
  - Hạn dùng `expiry_date = start_date + validity_days` (nếu có `validity_days`).
  - Trạng thái mặc định: `ACTIVE`.

---

## 8. PHÂN HỆ DANH MỤC DỊCH VỤ (SERVICES)

### 8.1. `GET /services`
- **Quyền hạn:** `permission:services.view`
- **Query Params:** `search`, `category`, `status`, `page`, `per_page`

### 8.2. `POST /services`
- **Quyền hạn:** `permission:services.create`
- **Request Body:**
```json
{
  "service_code": "DV001",
  "service_name": "Khám Chuyên khoa Nội tổng quát",
  "category": "KHAM_BENH",
  "price": 250000.00,
  "duration_minutes": 30,
  "description": "Khám, tư vấn và kê đơn chuyên khoa Nội tổng quát",
  "status": "ACTIVE"
}
```
- **Quy tắc:** `service_code` duy nhất, `price` không âm (`DECIMAL(15,2)`), `duration_minutes` từ 1 đến 1440.

### 8.3. `GET /services/{service}`
- **Quyền hạn:** `permission:services.view`

### 8.4. `PUT/PATCH /services/{service}`
- **Quyền hạn:** `permission:services.update`

### 8.5. `PATCH /services/{service}/status`
- **Quyền hạn:** `permission:services.update`

### 8.6. `DELETE /services/{service}`
- **Quyền hạn:** `permission:services.delete|services.update`

---

## 9. PHÂN HỆ GÓI DỊCH VỤ & ĐỊNH LƯỢNG GÓI (SERVICE PACKAGES)

### 9.1. `GET /service-packages`
- **Quyền hạn:** `permission:service_packages.view`
- **Query Params:** `search`, `status`, `include_services=true`

### 9.2. `POST /service-packages`
- **Quyền hạn:** `permission:service_packages.create`
- **Request Body:**
```json
{
  "package_code": "GOI_CSD_10",
  "package_name": "Gói Chăm sóc Da Chuyên sâu 10 Buổi",
  "total_sessions": 10,
  "package_price": 4500000.00,
  "validity_days": 180,
  "description": "Liệu trình chăm sóc da 10 buổi trong vòng 6 tháng",
  "services": [
    { "service_id": 1, "quantity": 10 }
  ],
  "status": "ACTIVE"
}
```

### 9.3. `GET /service-packages/{service_package}`
- **Quyền hạn:** `permission:service_packages.view`

### 9.4. `PUT/PATCH /service-packages/{service_package}`
- **Quyền hạn:** `permission:service_packages.update`

### 9.5. `POST /service-packages/{package}/services`
- **Mục đích:** Thêm hoặc gán cấu phần dịch vụ vào gói (`package_services`).
- **Quyền hạn:** `permission:service_packages.update|service_packages.create`
- **Request Body:** `{"service_id": 2, "quantity": 5}`

### 9.6. `PUT/PATCH /service-packages/{package}/services` (Sync)
- **Mục đích:** Đồng bộ hàng loạt dịch vụ kèm số lượng trong gói.
- **Quyền hạn:** `permission:service_packages.update`
- **Request Body:**
```json
{
  "services": [
    { "service_id": 1, "quantity": 10 },
    { "service_id": 3, "quantity": 2 }
  ]
}
```

### 9.7. `DELETE /service-packages/{package}/services/{service}`
- **Mục đích:** Gỡ một dịch vụ ra khỏi gói.
- **Quyền hạn:** `permission:service_packages.update|service_packages.delete`

---

## 10. PHÂN HỆ QUẢN LÝ GÓI BỆNH NHÂN (PATIENT PACKAGES)

### 10.1. `GET /patient-packages`
- **Quyền hạn:** `permission:patient_packages.view|patients.view`
- **Query Params:** `patient_id`, `status` (`ACTIVE`, `COMPLETED`, `EXPIRED`, `CANCELLED`), `page`

### 10.2. `GET /patient-packages/{patient_package}`
- **Quyền hạn:** `permission:patient_packages.view|patients.view`

### 10.3. `PATCH /patient-packages/{patient_package}/status`
- **Mục đích:** Chuyển trạng thái gói (ví dụ gia hạn, tạm hoãn hoặc hủy gói).
- **Quyền hạn:** `permission:patient_packages.assign|patients.update`
- **Request Body:** `{"status": "CANCELLED", "notes": "Bệnh nhân yêu cầu hủy và hoàn tiền"}`

---

## 11. PHÂN HỆ QUẢN LÝ LỊCH HẸN (APPOINTMENTS)

### 11.1. `GET /appointments`
- **Quyền hạn:** `permission:appointments.view`
- **Query Params:** `date`, `start_date`, `end_date`, `employee_id` (bác sĩ phụ trách), `patient_id`, `status` (`SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`), `page`

### 11.2. `POST /appointments`
- **Mục đích:** Đặt lịch hẹn khám bệnh mới.
- **Quyền hạn:** `permission:appointments.create`
- **Request Body:**
```json
{
  "patient_id": 5,
  "employee_id": 2,
  "appointment_date": "2026-10-30",
  "start_time": "09:00",
  "end_time": "09:30",
  "appointment_type": "KHAM_MOI",
  "notes": "Khám định kỳ tổng quát"
}
```
- **Quy tắc kiểm tra trùng lịch (Concurrency Overlap Guard):**
  - Ràng buộc: `end_time > start_time`.
  - Hệ thống kiểm tra trong cùng ngày `appointment_date` của bác sĩ (`employee_id`): không được có bất kỳ lịch hẹn nào đang hoạt động (`status != 'CANCELLED'`) thỏa mãn điều kiện giao thoa khung giờ:
    `existing_start < new_end AND existing_end > new_start`.
  - Nếu phát hiện xung đột, trả về mã lỗi `409 Conflict` kèm thông điệp chi tiết.

### 11.3. `GET /appointments/{appointment}`
- **Quyền hạn:** `permission:appointments.view`

### 11.4. `PUT/PATCH /appointments/{appointment}`
- **Mục đích:** Dời lịch hoặc đổi bác sĩ (áp dụng lại quy tắc chống trùng lịch).
- **Quyền hạn:** `permission:appointments.update`

### 11.5. `PATCH /appointments/{appointment}/status`
- **Quyền hạn:** `permission:appointments.update|appointments.cancel`
- **Request Body:** `{"status": "CONFIRMED"}`

### 11.6. `POST /appointments/{appointment}/cancel`
- **Mục đích:** Hủy lịch hẹn khám kèm lý do hủy.
- **Quyền hạn:** `permission:appointments.cancel|appointments.update`
- **Request Body:** `{"cancel_reason": "Bệnh nhân bận công tác đột xuất"}`

---

## 12. PHÂN HỆ LƯỢT KHÁM & KHẤU TRỪ GÓI (VISITS)

### 12.1. `GET /visits`
- **Quyền hạn:** `permission:visits.view`
- **Query Params:** `date`, `patient_id`, `employee_id`, `status` (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), `payment_status` (`UNPAID`, `PARTIAL`, `PAID`, `PACKAGED`), `page`

### 12.2. `POST /visits`
- **Mục đích:** Tiếp đón bệnh nhân, tạo lượt khám (và tự động khấu trừ buổi gói nếu áp dụng gói).
- **Quyền hạn:** `permission:visits.create`
- **Request Body (Khám lẻ có thu tiền):**
```json
{
  "patient_id": 5,
  "employee_id": 2,
  "service_id": 1,
  "appointment_id": 8,
  "visit_date": "2026-10-27 10:00:00",
  "unit_price": 250000.00,
  "quantity": 1,
  "discount_amount": 0.00,
  "notes": "Tiếp đón từ lịch hẹn"
}
```
- **Request Body (Sử dụng gói dịch vụ):**
```json
{
  "patient_id": 5,
  "employee_id": 2,
  "service_id": 1,
  "patient_package_id": 3,
  "visit_date": "2026-10-27 10:15:00",
  "quantity": 1
}
```
- **Quy tắc nghiệp vụ cốt lõi:**
  1. **Tính toán tài chính:** `total_amount = (quantity * unit_price) - discount_amount`. Nếu áp dụng gói (`patient_package_id`), `total_amount = 0` và `payment_status = 'PACKAGED'`.
  2. **Khấu trừ số buổi gói an toàn (`DB::transaction` & `lockForUpdate`):**
     - Kiểm tra gói còn hiệu lực (`status == 'ACTIVE'`, `remaining_sessions >= quantity`).
     - Tăng `used_sessions += quantity`.
     - Giảm `remaining_sessions -= quantity`.
     - Nếu `remaining_sessions == 0`, tự động chuyển trạng thái gói sang `COMPLETED`.
  3. **Cập nhật ngày khám bệnh nhân:** Cập nhật `last_visit_date` của bệnh nhân thành thời điểm khám hiện tại.
  4. Tự động chuyển trạng thái lịch hẹn tương ứng sang `COMPLETED` nếu có `appointment_id`.

### 12.3. `GET /visits/{visit}`
- **Quyền hạn:** `permission:visits.view`
- **Bảo mật dữ liệu y tế (Medical Data Protection):**
  - Người dùng có quyền `medical_records.view` (Bác sĩ, Quản trị viên) sẽ thấy trường `medical_record` đính kèm trong response.
  - Người dùng không có quyền (Tiếp tân, Thu ngân, Kế toán) sẽ nhận `medical_record: null` hoặc không hiển thị để đảm bảo nguyên tắc bảo mật hồ sơ bệnh án.

### 12.4. `PUT/PATCH /visits/{visit}`
- **Quyền hạn:** `permission:visits.update`

### 12.5. `PATCH /visits/{visit}/status`
- **Quyền hạn:** `permission:visits.update|visits.cancel`
- **Request Body:** `{"status": "COMPLETED"}`

### 12.6. `POST /visits/{visit}/cancel`
- **Mục đích:** Hủy lượt khám và tự động hoàn trả số buổi gói đã khấu trừ (nếu lượt khám sử dụng gói).
- **Quyền hạn:** `permission:visits.cancel|visits.update`

---

## 13. PHÂN HỆ HỒ SƠ BỆNH ÁN (MEDICAL RECORDS)

### 13.1. `GET /visits/{visit}/medical-record`
- **Mục đích:** Xem bệnh án của lượt khám.
- **Quyền hạn:** `permission:medical_records.view` (Chỉ dành cho Bác sĩ, Quản trị viên lâm sàng).
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "message": "Lấy thông tin bệnh án thành công",
  "data": {
    "id": 15,
    "visit_id": 42,
    "patient_id": 5,
    "employee_id": 2,
    "symptoms": "Đau rát họng 3 ngày, sốt nhẹ 38 độ, ho khan",
    "diagnosis": "Viêm họng cấp tính (J02)",
    "treatment_plan": "Kháng sinh, kháng viêm, súc họng nước muối, tái khám sau 5 ngày",
    "doctor_notes": "Bệnh nhân có tiền sử dị ứng Penicillin",
    "created_at": "2026-10-27T10:30:00+07:00",
    "updated_at": "2026-10-27T10:45:00+07:00"
  }
}
```

### 13.2. `POST /visits/{visit}/medical-record`
- **Mục đích:** Bác sĩ lập hồ sơ bệnh án cho lượt khám.
- **Quyền hạn:** `permission:medical_records.create`
- **Request Body:**
```json
{
  "symptoms": "Ho khan, sốt nhẹ, đau đầu vùng trán",
  "diagnosis": "Cảm cúm thông thường / Viêm đường hô hấp trên",
  "treatment_plan": "Uống nhiều nước, Paracetamol 500mg khi sốt > 38.5, nghỉ ngơi tại nhà",
  "doctor_notes": "Dặn dò theo dõi nhiệt độ, nếu khó thở phải tái khám ngay"
}
```
- **Quy tắc:**
  - Quan hệ 1–1 với `visits` (`visit_id` là `UNIQUE`). Nếu đã có bệnh án, trả về lỗi `409 Conflict` (yêu cầu gọi API cập nhật).
  - Tự động lấy `patient_id` và `employee_id` từ `visits` nếu không truyền.

### 13.3. `PUT/PATCH /visits/{visit}/medical-record`
- **Mục đích:** Cập nhật thông tin bệnh án đã lập.
- **Quyền hạn:** `permission:medical_records.update`

### 13.4. `GET /medical-records/{medical_record}` & `PUT/PATCH /medical-records/{medical_record}`
- **Mục đích:** Xem hoặc chỉnh sửa trực tiếp bệnh án theo mã ID bệnh án.
- **Quyền hạn:** `permission:medical_records.view` / `permission:medical_records.update`

---

## 14. BẢNG TỔNG HỢP PERMISSION KEYS GIAI ĐOẠN 1

| Module | Permission Key | Mô tả tác vụ |
|---|---|---|
| **Users** | `users.view` | Xem danh sách và chi tiết người dùng |
| | `users.create` | Tạo mới tài khoản đăng nhập |
| | `users.update` | Sửa thông tin tài khoản, mật khẩu, trạng thái |
| | `users.delete` | Xóa hoặc vô hiệu hóa tài khoản |
| **Roles** | `roles.view` | Xem danh mục vai trò và quyền |
| | `roles.manage` | Cấu hình quyền cho vai trò, gán vai trò người dùng |
| **Employees** | `employees.view` | Xem danh sách và hồ sơ nhân sự |
| | `employees.create` | Thêm mới nhân sự |
| | `employees.update` | Sửa thông tin, chức vụ, phòng ban, trạng thái |
| | `employees.delete` | Xóa nhân sự |
| **Patients** | `patients.view` | Tìm kiếm, xem hồ sơ bệnh nhân, kiểm tra trùng lặp |
| | `patients.create` | Tiếp nhận bệnh nhân mới |
| | `patients.update` | Sửa thông tin bệnh nhân |
| | `patients.delete` | Xóa hồ sơ bệnh nhân |
| **Services** | `services.view` | Xem bảng giá danh mục dịch vụ |
| | `services.create` | Thêm mới dịch vụ |
| | `services.update` | Sửa giá tiền, thời lượng, trạng thái |
| | `services.delete` | Xóa dịch vụ |
| **Service Packages** | `service_packages.view` | Xem danh mục gói dịch vụ |
| | `service_packages.create` | Tạo mới gói dịch vụ |
| | `service_packages.update` | Sửa giá gói, định lượng dịch vụ trong gói |
| | `service_packages.delete` | Xóa gói dịch vụ |
| **Patient Packages** | `patient_packages.view` | Xem gói dịch vụ của bệnh nhân |
| | `patient_packages.assign` | Cấp gói dịch vụ cho bệnh nhân, điều chỉnh trạng thái gói |
| **Appointments** | `appointments.view` | Xem lịch hẹn khám |
| | `appointments.create` | Đặt lịch khám mới |
| | `appointments.update` | Đổi lịch, dời giờ, đổi bác sĩ |
| | `appointments.cancel` | Hủy lịch hẹn |
| **Visits** | `visits.view` | Xem danh sách lượt khám |
| | `visits.create` | Tiếp đón, tạo lượt khám, trừ buổi gói |
| | `visits.update` | Cập nhật lượt khám |
| | `visits.cancel` | Hủy lượt khám, hoàn buổi gói |
| **Medical Records** | `medical_records.view` | Xem bệnh án, tiền sử bệnh, triệu chứng, chẩn đoán |
| | `medical_records.create` | Bác sĩ lập bệnh án mới |
| | `medical_records.update` | Cập nhật chẩn đoán, phác đồ điều trị |
