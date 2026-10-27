# TÀI LIỆU KIẾN TRÚC KỸ THUẬT HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK)
## Giai đoạn 1: Nền tảng & Nghiệp vụ Cốt lõi (Phase 1 Technical Architecture)

- **Mã tài liệu:** `ARCH-QLPK-P1`
- **Phiên bản:** `1.0.0`
- **Ngày ban hành:** `2026-10-26`
- **Phạm vi áp dụng:** Toàn bộ Backend (`be/`) và Frontend (`fe/`) dự án QLPK
- **Căn cứ nghiệp vụ & kỹ thuật:** `ROADMAP.md` (Task `P1-002`), Laravel 13.x, Next.js 16.4.x, TypeScript 5, MySQL 8.0

---

## 1. TỔNG QUAN HỆ THỐNG VÀ NGUYÊN TẮC THIẾT KẾ

### 1.1. Mục tiêu kiến trúc
Hệ thống Quản lý Phòng khám (QLPK) được thiết kế theo mô hình **Tách biệt Frontend - Backend (Decoupled Client-Server Monolith)**:
- **Backend (`be/`)**: Đóng vai trò là RESTful API Service tập trung, xử lý toàn bộ logic nghiệp vụ, quản lý dữ liệu, kiểm soát phân quyền (RBAC), bảo vệ toàn vẹn giao dịch (Database Transactions & Concurrency Locks) và bảo mật dữ liệu y tế.
- **Frontend (`fe/`)**: Đóng vai trò là Single Page / Server Rendered Application trên nền Next.js App Router, cung cấp giao diện tương tác tốc độ cao, thân thiện, tương thích responsive và kiểm soát hiển thị theo quyền người dùng.

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|               Next.js 16.4 App Router (React 19, TypeScript, Tailwind v4)         |
|   +-----------------------+   +------------------------+   +------------------+   |
|   |  Public Pages (/login)|   | Admin Shell ((admin)/) |   | Clinical Modules |   |
|   +-----------------------+   +------------------------+   +------------------+   |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / JSON REST API
                                           | Bearer Token (Sanctum)
+------------------------------------------v----------------------------------------+
|                                  BACKEND LAYER                                    |
|                   Laravel 13.x REST API Engine (PHP 8.3+)                         |
|   +----------------------------------------------------------------------------+  |
|   | Routing: routes/api.php -> Prefix: /api/v1/                                |  |
|   +----------------------------------------------------------------------------+  |
|   | Middlewares: Authenticate (Sanctum), CheckActiveUser, CheckPermission     |  |
|   +----------------------------------------------------------------------------+  |
|   | Controllers: Thin Controllers (app/Http/Controllers/Api/V1/*)              |  |
|   +----------------------------------------------------------------------------+  |
|   | Requests: FormRequest Validation & Authorization (app/Http/Requests/*)     |  |
|   +----------------------------------------------------------------------------+  |
|   | Services: Domain Business Logic & Transactions (app/Services/*)            |  |
|   +----------------------------------------------------------------------------+  |
|   | Models: Eloquent ORM 30 Tables (app/Models/*)                              |  |
|   +----------------------------------------------------------------------------+  |
|   | Resources: API Transformers & Data Protection (app/Http/Resources/*)       |  |
+------------------------------------------+----------------------------------------+
                                           | PDO / MySQL 8.0 Protocol
+------------------------------------------v----------------------------------------+
|                                 DATABASE LAYER                                    |
|                       MySQL 8.0 (DBQLPK) / InnoDB Engine                          |
|         30 Tables: RBAC, HR, Patients, Services, Appointments, Visits, EMR         |
+-----------------------------------------------------------------------------------+
```

### 1.2. Các nguyên tắc kiến trúc cốt lõi (Guiding Principles)
1. **Kiến trúc Monolith tinh gọn (No Microservices Overkill):** Tuyệt đối không phân tách microservices, không sử dụng event broker phức tạp (Kafka/RabbitMQ) ở giai đoạn này. Một monolithic API engine kết hợp monolithic frontend web app đảm bảo tính toàn vẹn dữ liệu, kiểm thử nhanh chóng và vận hành đơn giản.
2. **Thin Controllers - Rich Domain Services:** Controller chỉ làm nhiệm vụ tiếp nhận HTTP request, gọi Form Request xác thực, điều phối qua Service xử lý nghiệp vụ, và trả về qua API Resource. Toàn bộ logic tính toán tiền nong, trừ buổi gói, kiểm tra trùng lịch phải nằm trong `app/Services/`.
3. **Database Integrity & Concurrency Control:**
   - Mọi thao tác ghi nhiều bảng hoặc thay đổi trạng thái tài chính/lượt khám/gói dịch vụ phải được bọc trong `DB::transaction`.
   - Các điểm tài nguyên dùng chung có nguy cơ xung đột (lịch bác sĩ, số buổi còn lại của gói) phải dùng cơ chế khóa dòng (`lockForUpdate`) để triệt tiêu Race Condition.
4. **Bảo mật và Quyền riêng tư Y tế (Medical Data Privacy):**
   - Phân quyền RBAC nghiêm ngặt: Nhân viên lễ tân hoặc thu ngân tuyệt đối không thể truy xuất hồ sơ bệnh án hoặc ghi chú chuyên môn y tế.
   - Không bao giờ trả `password_hash`, secret keys hoặc stack trace nội bộ ra client.
   - Không in PII (thông tin định danh bệnh nhân) ra log hệ thống.
5. **Contract-First & Type-Safe Communication:** Chuẩn hóa JSON Response Envelope đồng nhất. Mọi type trên Frontend (`fe/types/*`) phải khớp 100% với Resource Output của Backend.

---

## 2. KIẾN TRÚC BACKEND (LARAVEL 13.X / PHP 8.3)

### 2.1. Cấu trúc thư mục chuẩn Backend (`be/`)
Cấu trúc mã nguồn của ứng dụng Backend tuân thủ nghiêm ngặt chuẩn kiến trúc Laravel hiện đại:

```text
be/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Api/
│   │   │   │   └── V1/                         # Toàn bộ API Controller phiên bản V1
│   │   │   │       ├── AuthController.php
│   │   │   │       ├── RolePermissionController.php
│   │   │   │       ├── EmployeeController.php
│   │   │   │       ├── UserController.php
│   │   │   │       ├── PatientController.php
│   │   │   │       ├── ServiceController.php
│   │   │   │       ├── ServicePackageController.php
│   │   │   │       ├── PackageServiceController.php
│   │   │   │       ├── PatientPackageController.php
│   │   │   │       ├── AppointmentController.php
│   │   │   │       ├── VisitController.php
│   │   │   │       └── MedicalRecordController.php
│   │   │   └── Controller.php                  # Base Controller
│   │   ├── Middleware/
│   │   │   ├── CheckActiveUser.php             # Chặn tài khoản INACTIVE/LOCKED
│   │   │   └── CheckPermission.php             # Middleware phân quyền permission:<key>
│   │   ├── Requests/                           # Form Requests đóng gói validation
│   │   │   ├── Auth/
│   │   │   │   └── LoginRequest.php
│   │   │   ├── Employee/
│   │   │   ├── User/
│   │   │   ├── Patient/
│   │   │   ├── Service/
│   │   │   ├── ServicePackage/
│   │   │   ├── PatientPackage/
│   │   │   ├── Appointment/
│   │   │   ├── Visit/
│   │   │   └── MedicalRecord/
│   │   └── Resources/                          # API Resources chuyển đổi dữ liệu trả về
│   │       ├── ApiResponse.php                 # Helper chuẩn hóa cấu trúc JSON envelope
│   │       ├── UserResource.php
│   │       ├── RoleResource.php
│   │       ├── PermissionResource.php
│   │       ├── EmployeeResource.php
│   │       ├── PatientResource.php
│   │       ├── ServiceResource.php
│   │       ├── ServicePackageResource.php
│   │       ├── PatientPackageResource.php
│   │       ├── AppointmentResource.php
│   │       ├── VisitResource.php
│   │       └── MedicalRecordResource.php
│   ├── Models/                                 # 30 Eloquent Models (Entities & Pivots)
│   │   ├── User.php
│   │   ├── Role.php
│   │   ├── Permission.php
│   │   ├── UserRole.php
│   │   ├── RolePermission.php
│   │   ├── Employee.php
│   │   ├── Patient.php
│   │   ├── Service.php
│   │   ├── ServicePackage.php
│   │   ├── PackageService.php
│   │   ├── PatientPackage.php
│   │   ├── Appointment.php
│   │   ├── Visit.php
│   │   ├── MedicalRecord.php
│   │   └── ... (đủ 30 bảng theo CSDL)
│   ├── Policies/                               # Authorization Policies
│   │   ├── PatientPolicy.php
│   │   ├── AppointmentPolicy.php
│   │   ├── VisitPolicy.php
│   │   └── MedicalRecordPolicy.php
│   └── Services/                               # Domain Service Layer xử lý logic nặng
│       ├── AppointmentService.php              # Xử lý check overlap, lock slot đặt lịch
│       ├── VisitService.php                    # Xử lý tính toán tiền, trừ/hoàn buổi gói
│       ├── PatientService.php                  # Quản lý mã bệnh nhân, cảnh báo trùng
│       └── AuditService.php                    # Ghi nhận log vết thao tác (audit_logs)
├── bootstrap/
│   └── app.php                                 # Cấu hình Routing API, Middleware, Exception handling
├── config/                                     # Cấu hình hệ thống (auth, cors, database, sanctum)
├── database/
│   ├── migrations/                             # 30 Migration files chuẩn thứ tự phụ thuộc
│   └── seeders/                                # Seeders idempotent (RolePermission, Catalog)
├── routes/
│   ├── api.php                                 # Khai báo toàn bộ endpoints /api/v1/
│   └── console.php
└── tests/
    ├── Feature/                                # Kiểm thử tính năng HTTP & Business Flows
    └── Unit/
```

### 2.2. Luồng xử lý yêu cầu Backend (Request Lifecycle)
Mọi request gửi tới Backend đi qua các chặng sau:
1. **Route Dispatching (`routes/api.php`)**: Định tuyến vào đúng Controller method với tiền tố `/api/v1/`.
2. **Middleware Pipeline**:
   - `auth:sanctum`: Xác thực Bearer Token hợp lệ.
   - `CheckActiveUser`: Kiểm tra trạng thái tài khoản `status === 'ACTIVE'`. Nếu bị vô hiệu hóa, trả `403 Forbidden`.
   - `CheckPermission:<permission_key>`: Kiểm tra quyền cụ thể của người dùng trước khi cho phép vào Controller.
3. **Validation Boundary (`Http/Requests/*`)**:
   - Tự động validate kiểu dữ liệu, ràng buộc giá trị, logic phụ thuộc giữa các trường.
   - Thất bại tự động dừng và ném `ValidationException` tương ứng HTTP `422 Unprocessable Content`.
4. **Thin Controller (`Http/Controllers/Api/V1/*`)**:
   - Tiếp nhận dữ liệu đã được validate qua `$request->validated()`.
   - Chuyển tiếp tới Domain Service nếu có logic đa bước hoặc điều phối trực tiếp tới Model nếu là CRUD đơn giản.
5. **Domain Service (`Services/*`)**:
   - Thực thi nghiệp vụ phức tạp trong `DB::transaction`.
   - Đảm bảo an toàn tương tranh với `lockForUpdate()`.
   - Ghi nhật ký kiểm toán `audit_logs`.
6. **Data Transformation (`Http/Resources/*`)**:
   - Bọc dữ liệu đầu ra, ẩn các trường nhạy cảm (`password_hash`, tokens nội bộ).
   - Định dạng chuẩn ngày giờ ISO 8601, chuyển đổi định dạng số tiền `DECIMAL(15,2)` an toàn.
7. **JSON Response Envelope**: Đóng gói cấu trúc phản hồi chuẩn trước khi gửi về client.

---

## 3. KIẾN TRÚC FRONTEND (NEXT.JS 16.4 / REACT 19 / TYPESCRIPT 5)

### 3.1. Cấu trúc thư mục chuẩn Frontend (`fe/`)
Cấu trúc Next.js sử dụng mô hình App Router, tổ chức module rõ ràng:

```text
fe/
├── app/
│   ├── (admin)/                                # Route Group khu vực quản trị (bảo vệ bằng Auth Guard)
│   │   ├── layout.tsx                          # Layout chung: AdminShell (Sidebar, Header, Breadcrumbs)
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── employees/                          # Quản lý nhân viên
│   │   │   ├── page.tsx                        # Danh sách nhân viên (tìm kiếm, lọc, phân trang)
│   │   │   └── [id]/page.tsx                   # Chi tiết & chỉnh sửa nhân viên
│   │   ├── users/                              # Quản lý tài khoản & phân vai trò
│   │   │   └── page.tsx
│   │   ├── patients/                           # Quản lý bệnh nhân
│   │   │   ├── page.tsx                        # Danh sách bệnh nhân & modal thêm mới
│   │   │   └── [id]/page.tsx                   # Chi tiết hồ sơ, lịch sử khám, gói đã mua
│   │   ├── services/                           # Danh mục dịch vụ khám & điều trị
│   │   │   └── page.tsx
│   │   ├── packages/                           # Danh mục gói dịch vụ & cấu hình dịch vụ con
│   │   │   └── page.tsx
│   │   ├── appointments/                       # Quản lý lịch hẹn khám
│   │   │   └── page.tsx                        # Lịch biểu, bộ lọc ngày/bác sĩ, form đặt lịch
│   │   └── visits/                             # Quản lý lượt khám & bệnh án
│   │       ├── page.tsx                        # Danh sách tiếp đón & lượt khám
│   │       ├── new/page.tsx                    # Tiếp nhận & tạo lượt khám mới
│   │       └── [id]/page.tsx                   # Chi tiết lượt khám & cập nhật hồ sơ bệnh án
│   ├── login/                                  # Trang đăng nhập công khai (Public Route)
│   │   └── page.tsx
│   ├── globals.css                             # Tailwind CSS v4 cấu hình & biến màu
│   ├── layout.tsx                              # Root Layout: Theme, Font, AuthProvider
│   └── page.tsx                                # Trang đích mặc định (chuyển hướng /login hoặc /dashboard)
├── components/
│   ├── layout/                                 # Shell components
│   │   ├── AdminShell.tsx                      # Khung giao diện quản trị tổng thể
│   │   ├── Sidebar.tsx                         # Menu điều hướng linh hoạt theo vai trò (RBAC)
│   │   ├── Header.tsx                          # Thanh tiêu đề, thông tin user, nút Logout
│   │   └── Breadcrumbs.tsx
│   └── ui/                                     # Reusable UI Atoms/Molecules
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Modal.tsx
│       ├── Table.tsx
│       ├── Badge.tsx
│       ├── Alert.tsx
│       ├── Pagination.tsx
│       └── LoadingSpinner.tsx
├── lib/
│   ├── api/                                    # API Client Layer (giao tiếp với Backend)
│   │   ├── client.ts                           # Base fetch wrapper, interceptor, token injection
│   │   ├── auth.ts                             # login, logout, me, changePassword
│   │   ├── employees.ts                        # CRUD employees
│   │   ├── users.ts                            # CRUD users, assign roles
│   │   ├── patients.ts                         # CRUD patients, check duplicates
│   │   ├── services.ts                         # CRUD services
│   │   ├── packages.ts                         # CRUD packages, package services
│   │   ├── appointments.ts                     # CRUD appointments, check availability
│   │   ├── visits.ts                           # CRUD visits, deduct package
│   │   └── medical-records.ts                  # GET/POST/PUT medical record
│   ├── auth/                                   # Context & Session management
│   │   ├── AuthContext.tsx                     # AuthProvider lưu trữ user, roles, permissions
│   │   └── useAuth.ts                          # Hook truy xuất trạng thái phiên & kiểm tra quyền
│   └── utils/
│       ├── formatters.ts                       # Format tiền VND, ngày giờ DD/MM/YYYY HH:mm
│       └── constants.ts
└── types/                                      # TypeScript definitions (khớp Backend contract)
    ├── api.ts                                  # ApiResponse<T>, PaginatedData<T>, ApiError
    ├── auth.ts                                 # LoginCredentials, AuthResponse, UserProfile
    ├── user.ts
    ├── employee.ts
    ├── patient.ts
    ├── service.ts
    ├── package.ts
    ├── appointment.ts
    ├── visit.ts
    └── medical-record.ts
```

### 3.2. Chiến lược Server Component và Client Component
- **Server Components (Mặc định):** Áp dụng cho các trang khung layout không duy trì state tương tác (`layout.tsx`), hiển thị thông tin tĩnh hoặc đọc metadata.
- **Client Components (`'use client'`):**
  - Bắt buộc khai báo `'use client'` ở các components/pages có form nhập liệu, quản lý local state (`useState`), modal popups, data table có tính năng search/filter tức thì hoặc sử dụng React context (`useAuth`).
  - Toàn bộ các module tương tác quản trị (`/login`, form tạo lịch hẹn, form lượt khám, bảng danh sách có tìm kiếm realtime) đều là Client Components để tối ưu trải nghiệm SPA mượt mà.

---

## 4. CHUẨN JSON RESPONSE ENVELOPE VÀ MÃ TRẠNG THÁI HTTP

Để đảm bảo tính nhất quán tuyệt đối giữa Backend và Frontend, mọi phản hồi từ API (dù thành công hay thất bại) **bắt buộc** phải tuân theo cấu trúc JSON Envelope chuẩn hóa sau đây.

### 4.1. Cấu trúc JSON Envelope chuẩn
Mọi API trả về một JSON Object chứa các trường sau:

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả ý nghĩa |
|---|---|:---:|---|
| `success` | `boolean` | **Có** | `true` nếu xử lý thành công (mã 2xx); `false` nếu thất bại (mã 4xx, 5xx). |
| `message` | `string` | **Có** | Thông điệp súc tích, dễ hiểu cho người dùng (bằng tiếng Việt chuẩn). |
| `data` | `object \| array \| null` | Tùy chọn | Dữ liệu chính trả về (chỉ xuất hiện khi `success === true`). |
| `meta` | `object` | Tùy chọn | Chứa thông tin phân trang hoặc metadata bổ trợ (chỉ dùng cho danh sách phân trang). |
| `errors` | `object \| null` | Tùy chọn | Chi tiết danh sách lỗi theo từng trường (chỉ xuất hiện khi `success === false`). |

---

### 4.2. Chi tiết cấu trúc cho từng trường hợp

#### A. Phản hồi thành công cho 1 bản ghi (Single Item Success - 200 OK / 201 Created)
```json
{
  "success": true,
  "message": "Tạo bệnh nhân mới thành công.",
  "data": {
    "id": 15,
    "patient_code": "BN202610260015",
    "full_name": "Nguyễn Văn An",
    "phone": "0912345678",
    "gender": "MALE",
    "date_of_birth": "1990-05-15",
    "address": "123 Đường Nguyễn Huệ, Quận 1, TP.HCM",
    "status": "ACTIVE",
    "created_at": "2026-10-26T23:50:00+07:00",
    "updated_at": "2026-10-26T23:50:00+07:00"
  }
}
```

#### B. Phản hồi thành công cho danh sách có phân trang (Paginated List - 200 OK)
Trường `meta` bao gồm đầy đủ các chỉ số phân trang theo chuẩn Laravel LengthAwarePaginator:
```json
{
  "success": true,
  "message": "Lấy danh sách lịch hẹn thành công.",
  "data": [
    {
      "id": 101,
      "appointment_code": "LH202610270001",
      "patient_id": 15,
      "patient_name": "Nguyễn Văn An",
      "doctor_id": 3,
      "doctor_name": "BS. Trần Văn Hùng",
      "service_id": 2,
      "service_name": "Khám Chuyên Khoa Nội",
      "appointment_date": "2026-10-27",
      "start_time": "09:00",
      "end_time": "09:30",
      "status": "CONFIRMED"
    }
  ],
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 5,
    "per_page": 15,
    "to": 15,
    "total": 68
  }
}
```

#### C. Phản hồi lỗi Validation Form (422 Unprocessable Content)
Trường `errors` trả về object dạng key-value, mỗi key tương ứng tên trường lỗi và value là mảng các câu thông báo:
```json
{
  "success": false,
  "message": "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường.",
  "errors": {
    "phone": [
      "Số điện thoại không đúng định dạng 10 chữ số."
    ],
    "discount_amount": [
      "Số tiền giảm giá không được vượt quá tổng thành tiền của dịch vụ."
    ]
  }
}
```

#### D. Phản hồi lỗi Xung đột nghiệp vụ / Trùng lịch (409 Conflict)
Áp dụng khi vi phạm ràng buộc xung đột nghiệp vụ như trùng lịch hẹn của bác sĩ:
```json
{
  "success": false,
  "message": "Bác sĩ đã có lịch hẹn khác trong khung giờ từ 09:00 đến 09:30 ngày 27/10/2026.",
  "errors": {
    "conflict_appointment_id": 98,
    "doctor_id": 3,
    "time_slot": "09:00 - 09:30"
  }
}
```

#### E. Phản hồi lỗi Xác thực & Phân quyền (401 Unauthorized & 403 Forbidden)
- **401 Unauthorized (Chưa đăng nhập hoặc Token hết hạn/sai):**
```json
{
  "success": false,
  "message": "Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.",
  "errors": null
}
```
- **403 Forbidden (Đã đăng nhập nhưng không đủ quyền hoặc tài khoản bị khóa):**
```json
{
  "success": false,
  "message": "Bạn không có quyền thực hiện thao tác này (yêu cầu quyền: medical_records.create).",
  "errors": null
}
```

#### F. Phản hồi lỗi Không tìm thấy tài nguyên (404 Not Found)
```json
{
  "success": false,
  "message": "Không tìm thấy hồ sơ bệnh nhân với mã hoặc ID đã cung cấp.",
  "errors": null
}
```

#### G. Phản hồi lỗi Vượt giới hạn tần suất (429 Too Many Requests)
```json
{
  "success": false,
  "message": "Bạn đã gửi quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau 60 giây.",
  "errors": null
}
```

#### H. Phản hồi lỗi Máy chủ nội bộ (500 Internal Server Error)
Tuyệt đối không để lộ stack trace, đường dẫn file hoặc thông tin nhạy cảm ra ngoài:
```json
{
  "success": false,
  "message": "Hệ thống đã xảy ra sự cố nội bộ. Vui lòng liên hệ quản trị viên.",
  "errors": null
}
```

---

### 4.3. Bảng tra cứu mã trạng thái HTTP chuẩn (HTTP Status Codes)

| Mã HTTP | Tên chuẩn | Trường hợp sử dụng trong QLPK |
|:---:|---|---|
| **200** | `OK` | Truy vấn danh sách, chi tiết, cập nhật thành công (`PUT`/`PATCH`), hoặc xóa logic. |
| **201** | `Created` | Tạo mới thành công bản ghi (`POST` tạo bệnh nhân, lịch hẹn, lượt khám, tài khoản...). |
| **400** | `Bad Request` | Yêu cầu sai cú pháp, header thiếu trường bắt buộc, hoặc tham số query dị dạng. |
| **401** | `Unauthorized` | Không có token xác thực, token không hợp lệ hoặc đã bị thu hồi (`auth:sanctum`). |
| **403** | `Forbidden` | Người dùng đã đăng nhập nhưng không đủ quyền RBAC, hoặc tài khoản đang ở trạng thái `INACTIVE`/`LOCKED`. |
| **404** | `Not Found` | Không tìm thấy bản ghi tương ứng trong CSDL (`ModelNotFoundException`). |
| **409** | `Conflict` | Xung đột nghiệp vụ: Bác sĩ bị trùng giờ hẹn, trạng thái đối tượng không cho phép sửa đổi. |
| **422** | `Unprocessable Content` | Thất bại xác thực Form Request, hoặc vi phạm điều kiện nghiệp vụ (gói hết buổi, tiền giảm âm). |
| **429** | `Too Many Requests` | Vượt ngưỡng Rate Limiting (chống brute-force login hoặc spam đặt lịch). |
| **500** | `Internal Server Error` | Lỗi ngoại lệ chưa được bắt trên Backend (được mask an toàn thành JSON). |

---

## 5. XÁC THỰC VÀ PHÂN QUYỀN (SANCTUM & RBAC)

### 5.1. Cơ chế xác thực (Authentication with Laravel Sanctum)
- Hệ thống sử dụng **Laravel Sanctum Personal Access Tokens** (Bearer Token) cho toàn bộ API clients.
- Luồng đăng nhập:
  1. `POST /api/v1/auth/login` tiếp nhận `username` và `password`.
  2. Hệ thống kiểm tra thông tin đăng nhập trong bảng `users` (`password_hash`).
  3. Kiểm tra trạng thái tài khoản `status === 'ACTIVE'`. Nếu là `INACTIVE` hoặc `LOCKED`, từ chối ngay với mã `403 Forbidden`.
  4. Cập nhật `last_login_at = now()`.
  5. Sinh token Sanctum với tên thiết bị hoặc `web-client`.
  6. Ghi log đăng nhập vào bảng `audit_logs`.
  7. Trả về token kèm thông tin hồ sơ người dùng (`UserResource`), bao gồm danh sách vai trò (`roles`) và quyền hạn (`permissions`).
- Luồng đăng xuất:
  1. `POST /api/v1/auth/logout` thu hồi token hiện tại `$request->user()->currentAccessToken()->delete()`.
  2. Ghi nhận log đăng xuất.

### 5.2. Ma trận 8 vai trò người dùng chuẩn (Role-Based Access Control)
Hệ thống xác lập 8 vai trò mặc định trong CSDL:

| Mã vai trò | Tên hiển thị | Phạm vi quyền hạn chính |
|---|---|---|
| **`ADMIN`** | Quản trị hệ thống | Toàn quyền cấu hình, tài khoản, vai trò, danh mục, kiểm toán và phân quyền. |
| **`MANAGER`** | Quản lý phòng khám | Quản lý nhân sự, dịch vụ, gói, lịch hẹn, xem báo cáo, không sửa cấu hình hệ thống. |
| **`DOCTOR`** | Bác sĩ điều trị | Xem lịch khám, thực hiện khám, cập nhật hồ sơ bệnh án, kê đơn, chỉ định dịch vụ. |
| **`RECEPTIONIST`** | Nhân viên tiếp đón | Tiếp đón bệnh nhân, tra cứu hồ sơ, đặt lịch hẹn, tạo lượt khám mới (không xem bệnh án). |
| **`CASHIER`** | Thu ngân | Lập hóa đơn, thu tiền lượt khám/gói, in biên lai (không xem bệnh án y tế). |
| **`ACCOUNTANT`** | Kế toán phòng khám | Quản lý chi phí, công nợ, đối soát dòng tiền, xuất báo cáo tài chính. |
| **`EMPLOYEE`** | Nhân viên cơ bản | Xem thông tin cá nhân, xem lịch làm việc được phân công. |
| **`VIEWER`** | Khách xem (Read-only) | Chỉ xem báo cáo tổng hợp được chỉ định; tuyệt đối không tạo/sửa/xóa bất kỳ dữ liệu nào. |

### 5.3. Middleware kiểm tra quyền (`CheckPermission`)
- Middleware `CheckPermission` chặn ở tầng Route:
  ```php
  Route::middleware(['auth:sanctum', 'active_user', 'permission:appointments.create'])
      ->post('/appointments', [AppointmentController::class, 'store']);
  ```
- Quy tắc kế thừa: Nếu người dùng mang vai trò `ADMIN`, hệ thống tự động cho phép (`bypass`) mọi kiểm tra permission, ngoại trừ hành động tự khóa tài khoản Admin cuối cùng đang hoạt động.

### 5.4. Bảo vệ dữ liệu y tế nhạy cảm (Medical Records Isolation)
- **Quy tắc tuyệt đối:** Dữ liệu chẩn đoán bệnh án (`medical_records`), tiền sử bệnh lý và ghi chú điều trị chỉ được phép truy xuất bởi các vai trò có quyền chuyên môn: `ADMIN`, `DOCTOR`, `MANAGER` (nếu được cấp phép y khoa).
- API `GET /api/v1/visits/{id}` khi trả về cho vai trò Lễ tân (`RECEPTIONIST`) hoặc Thu ngân (`CASHIER`) sẽ tự động ẩn trường quan hệ `medical_record` (thông qua điều kiện `$this->when(Auth::user()->can('medical_records.view'), ...)` trong `VisitResource`).

---

## 6. QUY TẮC NGHIỆP VỤ VÀ BẢO ĐẢM TOÀN VẸN DỮ LIỆU (DATA INTEGRITY)

### 6.1. Sinh mã tự động an toàn khi đồng thời (Concurrency-Safe Code Generation)
Các mã chứng từ nghiệp vụ bao gồm:
- Mã nhân viên: `NV` + Năm + 4 số tăng dần (VD: `NV20260001`).
- Mã bệnh nhân: `BN` + Ngày tháng năm + 4 số tăng dần (VD: `BN202610260001`).
- Mã lượt khám: `LK` + Ngày tháng năm + 4 số tăng dần (VD: `LK202610260001`).
- Mã lịch hẹn: `LH` + Ngày tháng năm + 4 số tăng dần (VD: `LH202610260001`).

**Quy tắc:** Tuyệt đối không dùng `Model::count() + 1` để sinh mã vì sẽ bị trùng lặp khi 2 người tạo đồng thời. Phải sử dụng phương pháp tìm mã lớn nhất gần nhất trong ngày với cú pháp `lockForUpdate()` hoặc khóa sequence riêng trong transaction.

### 6.2. Kiểm tra trùng lịch hẹn (Appointment Overlap Prevention)
Khi tạo mới hoặc cập nhật giờ lịch hẹn cho một nhân viên/bác sĩ (`employee_id`) vào ngày `appointment_date`:
1. Mở Database Transaction.
2. Khóa dòng bản ghi nhân viên bằng `Employee::where('id', $employeeId)->lockForUpdate()->first()`.
3. Kiểm tra các lịch hẹn khác chưa bị hủy (`status != 'CANCELLED'`) thỏa mãn điều kiện giao cắt thời gian:
   ```sql
   existing.start_time < new.end_time AND existing.end_time > new.start_time
   ```
4. Nếu tồn tại bản ghi xung đột: Trả về ngay HTTP `409 Conflict` kèm chi tiết khung giờ bị trùng.
5. Nếu không trùng: Tiến hành lưu lịch hẹn mới và Commit Transaction.

### 6.3. Quy tắc trừ buổi và bảo toàn gói dịch vụ (Patient Package Sessions)
Khi bệnh nhân sử dụng gói dịch vụ trong lượt khám (`visits.patient_package_id`):
1. **Kiểm tra hợp lệ trước khi trừ:**
   - Gói thuộc đúng bệnh nhân (`patient_package.patient_id == visit.patient_id`).
   - Gói đang ở trạng thái hoạt động (`patient_package.status == 'ACTIVE'`).
   - Gói chưa hết hạn (`patient_package.expiry_date >= current_date`).
   - Dịch vụ được khám nằm trong danh sách dịch vụ của gói (`package_services`).
   - Số buổi còn lại đủ đáp ứng: `remaining_sessions >= visit.quantity`.
2. **Khóa dòng và trừ buổi an toàn trong Transaction:**
   - Thực hiện `PatientPackage::where('id', $packageId)->lockForUpdate()->first()`.
   - Cập nhật số buổi:
     ```php
     $package->used_sessions += $quantity;
     $package->remaining_sessions -= $quantity;
     if ($package->remaining_sessions === 0) {
         $package->status = 'COMPLETED';
     }
     $package->save();
     ```
3. **Bất biến bảo toàn (Data Invariant):**
   Luôn luôn đảm bảo: `used_sessions + remaining_sessions == total_sessions`.
4. **Quy tắc hoàn buổi khi hủy lượt khám:**
   Nếu một lượt khám đã gắn gói bị chuyển sang trạng thái `CANCELLED`, hệ thống tự động hoàn lại số buổi cho gói dịch vụ của bệnh nhân (`used_sessions -= quantity`, `remaining_sessions += quantity`) và đưa trạng thái gói về `ACTIVE` nếu trước đó đã chuyển sang `COMPLETED`.

---

## 7. QUY ƯỚC ĐẶT TÊN VÀ TIÊU CHUẨN MÃ NGUỒN (NAMING & CODING STANDARDS)

### 7.1. Bảng quy ước đặt tên tổng hợp

| Đối tượng | Quy ước | Ví dụ cụ thể |
|---|---|---|
| **Bảng Database** | `snake_case`, số nhiều | `users`, `employees`, `patients`, `service_packages`, `package_services` |
| **Cột Database** | `snake_case` | `patient_code`, `date_of_birth`, `total_amount`, `created_at` |
| **Khóa ngoại Database** | `snake_case`, dạng `<tên_bảng_số_ít>_id` | `user_id`, `patient_id`, `service_package_id`, `employee_id` |
| **Model PHP** | `PascalCase`, số ít | `User`, `Employee`, `Patient`, `ServicePackage`, `PackageService` |
| **Controller PHP** | `PascalCase` + `Controller` | `PatientController`, `AppointmentController`, `VisitController` |
| **Service PHP** | `PascalCase` + `Service` | `AppointmentService`, `VisitService`, `PatientService` |
| **Resource PHP** | `PascalCase` + `Resource` | `UserResource`, `PatientResource`, `AppointmentResource` |
| **Form Request PHP** | `PascalCase` + `Request` | `StorePatientRequest`, `UpdateAppointmentRequest` |
| **URL Endpoints** | `kebab-case`, số nhiều, tiền tố `/api/v1/` | `/api/v1/service-packages`, `/api/v1/patient-packages` |
| **JSON Payload Keys** | `snake_case` (khớp DB & Resources) | `{"patient_code": "...", "date_of_birth": "...", "total_amount": 0}` |
| **Component React** | `PascalCase` | `AdminShell.tsx`, `AppointmentCalendar.tsx`, `PatientForm.tsx` |
| **Hook React** | `camelCase`, tiền tố `use` | `useAuth()`, `useAppointments()`, `useDebounce()` |
| **Type / Interface TS** | `PascalCase` | `Patient`, `Appointment`, `ApiResponse<T>`, `PaginationMeta` |
| **File tiện ích / API TS**| `camelCase` hoặc `kebab-case` | `client.ts`, `patients.ts`, `medical-records.ts` |
| **Định dạng Ngày Giờ** | Chuẩn ISO 8601 (API), hiển thị `DD/MM/YYYY` | `2026-10-26T23:50:00+07:00` (API) $\rightarrow$ `26/10/2026` (UI) |
| **Định dạng Tiền tệ** | Lưu trữ `DECIMAL(15,2)`, hiển thị VND | Lưu `150000.00` $\rightarrow$ Hiển thị trên UI: `150.000 đ` |

---

## 8. HƯỚNG DẪN TÍCH HỢP FRONTEND - BACKEND (API INTEGRATION)

### 8.1. API Client chuẩn phía Frontend (`fe/lib/api/client.ts`)
Frontend sử dụng một wrapper tập trung quanh Native `fetch` (hoặc Axios) với các trách nhiệm:
1. Tự động đính kèm `Authorization: Bearer <token>` nếu người dùng đã đăng nhập.
2. Tự động đính kèm `Accept: application/json` và `Content-Type: application/json`.
3. Kiểm tra HTTP Status:
   - Nếu `status === 401`: Xóa token khỏi Storage/Cookie và chuyển hướng về `/login`.
   - Nếu `status === 403`: Bắn thông báo từ chối truy cập qua Alert/Toast.
   - Nếu `status === 422`: Chuyển đổi mảng `errors` sang định dạng thân thiện cho form components.
4. Trả về Promise chứa dữ liệu đã unwrap từ envelope.

```typescript
// fe/types/api.ts
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  errors?: Record<string, string[]>;
}

export interface PaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}
```

---

## 9. GIỚI HẠN VÀ NHỮNG ĐIỀU CẤM (ARCHITECTURAL RESTRICTIONS)

1. **Tuyệt đối không thêm Microservices:** Giữ vững kiến trúc Monolith tinh gọn (`be/` + `fe/`). Không tách riêng auth service, billing service hay notification service thành các tiến trình phân tán.
2. **Tuyệt đối không tin tưởng dữ liệu đầu vào từ Client:**
   - Không lấy `user_id`, `role`, `price`, `total_amount` do Client gửi lên để lưu thẳng vào CSDL.
   - Mọi mức giá (`price`), thành tiền (`total_amount`) phải được tra cứu và tính toán lại từ bảng `services` / `service_packages` ở phía Backend.
3. **Không hardcode thông tin nhạy cảm:**
   - Không lưu mật khẩu, secret key, API credentials vào mã nguồn Git hoặc tài liệu.
   - Sử dụng biến môi trường thông qua `.env` (`be/.env`, `fe/.env.local`).
4. **Không bypass kiểm tra quyền ở Frontend:**
   - Việc ẩn nút trên giao diện người dùng chỉ nhằm tối ưu UX. Mọi API endpoint ở Backend đều phải có Middleware và Policy kiểm tra độc lập.
5. **Không dùng `float` cho dữ liệu tài chính:**
   - Toàn bộ giá trị tiền tệ trong CSDL phải dùng kiểu `DECIMAL(15,2)`, không bao giờ dùng `FLOAT` hay `DOUBLE` để tránh sai số dấu phẩy động.

---

## 10. KẾ HOẠCH NÂNG CẤP VÀ TƯƠNG THÍCH CHO GIAI ĐOẠN 2 & 3

- **Giai đoạn 2 (Hoàn thiện tài chính & vận hành):** Kiến trúc đã sẵn sàng tiếp nhận các module `invoices`, `payments`, `expenses`, `inventories` bằng cách bổ sung Controller vào `app/Http/Controllers/Api/V1/` và Service tương ứng trong `app/Services/` mà không cần cấu trúc lại hệ thống.
- **Giai đoạn 3 (Bệnh án nâng cao & cảnh báo):** Hỗ trợ đính kèm tệp tin (`patient_files`), thiết lập quy tắc cảnh báo (`alert_rules`) và phê duyệt (`approval_requests`) trên nền tảng RBAC và Transaction hiện tại.

---
*Tài liệu này là chuẩn mực kiến trúc bắt buộc cho toàn bộ các lập trình viên và tiến trình AI trong toàn bộ các task tiếp theo của Dự án Quản lý Phòng khám.*
