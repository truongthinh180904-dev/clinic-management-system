# ROADMAP — HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK)

> **Giai đoạn hiện tại:** `PHASE-01` — **Xây dựng nền tảng và nghiệp vụ khám chữa bệnh cốt lõi** (30 Tasks: `P1-001` → `P1-030` chia làm 8 Nhóm).
> **Nguyên tắc thực thi:** Thực hiện tuần tự theo DAG phụ thuộc, có kiểm thử tự động (`exit_code == 0`), có cổng Reviewer độc lập (tối đa 3 vòng Fix Loop) và chống trạng thái `DONE` giả (`verify_done_gate`).

---

## Tổng quan 3 Giai đoạn của Dự án

| Giai đoạn | Mã | Tên giai đoạn | Phạm vi chính | Kết quả đầu ra |
|---|---|---|---|---|
| **Giai đoạn 1** | `PHASE-01` | Xây dựng nền tảng và nghiệp vụ cốt lõi | Kiến trúc, CSDL 30 bảng, đăng nhập Sanctum, RBAC, nhân sự, bệnh nhân, dịch vụ, gói dịch vụ, lịch hẹn, lượt khám & bệnh án cơ bản | Hệ thống chạy ổn định, đăng nhập, phân quyền và thực hiện trọn vẹn luồng khám cơ bản |
| **Giai đoạn 2** | `PHASE-02` | Hoàn thiện tài chính và quản trị vận hành | Hóa đơn, thanh toán nhiều lần, công nợ, thu chi, sổ quỹ, kho vật tư, KPI, báo cáo, Dashboard, Import/Export | Quản lý vận hành và tài chính tập trung |
| **Giai đoạn 3** | `PHASE-03` | Hoàn thiện chức năng nâng cao & triển khai | Bệnh án điện tử nâng cao, tệp y tế (`patient_files`), cảnh báo (`alert_rules`), phê duyệt (`approval_requests`), thông báo (`notifications`), tối ưu & deploy | Hệ thống hoàn chỉnh, kiểm thử tổng thể và sẵn sàng vận hành thực tế |

---

## Thông tin Môi trường & Định tuyến Model (`agy v1.4.7`)

- `PROJECT_ROOT`: `/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system`
- `FRAMEWORK_DIR`: `/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/qlpk-autonomous-framework`
- **Backend (`be/`)**: PHP `^8.3`, Laravel `^13.17`, PHPUnit `^12.5`, Laravel Pint, MySQL 8.0 (`DBQLPK`, `utf8mb4_unicode_ci`)
- **Frontend (`fe/`)**: Next.js `16.4.2` (App Router), React `19.3.0`, TypeScript `5`, Tailwind CSS `v4`
- **Phân quyền AI Models**:
  - `PLANNER`: `claude-sonnet-5-5-high` (`--mode plan --sandbox`)
  - `CODER`: `gemini-3.8-flash-high` (`--mode accept-edits`)
  - `AUTOMATED_TESTER`: Shell Runner (chạy lệnh test thật, thu `exit_code`)
  - `REVIEWER`: `gemini-4-argon-high` (`--mode plan --sandbox`, chỉ gọi khi Test `PASS`)
  - `DEBUG_FALLBACK`: `claude-sonnet-5-5-high`
  - `ARCH_SECURITY_ESCALATION`: `claude-opus-5-5-high`

---

# CHI TIẾT 30 TASK GIAI ĐOẠN 1 (`PHASE-01`)

---

## NHÓM 1 — KHẢO SÁT VÀ CHUẨN HÓA DỰ ÁN (`F-P1-G01`)

### Task P1-001 — Kiểm tra toàn bộ repository
- `feature_id`: `F-P1-G01`
- `task_id`: `P1-001`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `[]`
- `status`: `READY`
- `complexity`: `LOW`
- `objective`: Hiểu chính xác trạng thái hiện tại của dự án (`be/`, `fe/`, `DBQLPK`, migrations, models, routes) và lập báo cáo khảo sát trước khi viết thêm code nghiệp vụ.
- `deliverables`:
  - `docs/phase-1/INITIAL_AUDIT.md` (gồm trạng thái repo, phiên bản công cụ, trạng thái 30 bảng & 30 models đã khởi tạo, danh sách cấu hình còn thiếu và thứ tự triển khai).
- `acceptance_criteria`:
  1. Có báo cáo `docs/phase-1/INITIAL_AUDIT.md` phản ánh đúng trạng thái thực tế của `be/`, `fe/` và `DBQLPK`.
  2. Không in mật khẩu hoặc secret từ `be/.env` ra tài liệu hay log.
  3. Không tự ý sửa code nghiệp vụ hoặc xóa dữ liệu database.
- `test_commands`:
  - `test -s "$PROJECT_ROOT/docs/phase-1/INITIAL_AUDIT.md"`
  - `cd "$PROJECT_ROOT/be" && php artisan --version`
- `allowed_files`: `docs/phase-1/INITIAL_AUDIT.md`, `qlpk-autonomous-framework/reports/tasks/P1-001.md`

---

### Task P1-002 — Xác lập kiến trúc kỹ thuật
- `feature_id`: `F-P1-G01`
- `task_id`: `P1-002`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-001"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Thiết lập chuẩn kiến trúc Laravel REST API (`be/`) và Next.js App Router (`fe/`), quy ước đặt tên, cấu trúc JSON envelope, xử lý lỗi, phân trang, xác thực Sanctum và phân quyền RBAC.
- `deliverables`:
  - `docs/phase-1/ARCHITECTURE.md`
- `acceptance_criteria`:
  1. Quy định rõ cấu trúc thư mục `be/app/{Http/Controllers/Api/V1,Http/Requests,Http/Resources,Services,Models,Policies}` và `fe/app`, `fe/lib/api`, `fe/types`.
  2. Quy định chuẩn JSON envelope (`success`, `message`, `data`, `meta`, `errors`) và mã HTTP (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`).
  3. Không thêm microservice hay độ phức tạp không cần thiết.
- `test_commands`:
  - `test -s "$PROJECT_ROOT/docs/phase-1/ARCHITECTURE.md"`
- `allowed_files`: `docs/phase-1/ARCHITECTURE.md`, `qlpk-autonomous-framework/reports/tasks/P1-002.md`

---

### Task P1-003 — Chuẩn hóa môi trường phát triển và lệnh kiểm tra
- `feature_id`: `F-P1-G01`
- `task_id`: `P1-003`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-001", "P1-002"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Chuẩn hóa cấu hình môi trường mẫu (`be/.env.example`, `fe/.env.example`), kích hoạt định tuyến API (`/api/v1/health`) ở Laravel và ghi tài liệu hướng dẫn phát triển.
- `deliverables`:
  - `docs/phase-1/DEVELOPMENT.md`
  - `be/routes/api.php` (kèm endpoint `GET /api/v1/health` trả JSON chuẩn)
  - `fe/.env.example` (chứa `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`)
  - Feature test kiểm tra `/api/v1/health`
- `acceptance_criteria`:
  1. `GET /api/v1/health` trả HTTP 200 kèm JSON trạng thái ứng dụng.
  2. `php artisan test`, `pint --test` bên `be/` và `npx tsc --noEmit` bên `fe/` đều chạy thành công.
  3. Không ghi thông tin nhạy cảm vào `.env.example` hoặc source code.
- `test_commands`:
  - `test -s "$PROJECT_ROOT/docs/phase-1/DEVELOPMENT.md"`
  - `cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint --test`
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit`
- `allowed_files`: `docs/phase-1/DEVELOPMENT.md`, `be/bootstrap/app.php`, `be/routes/api.php`, `be/.env.example`, `fe/.env.example`, `be/tests/Feature/*`, `qlpk-autonomous-framework/reports/tasks/P1-003.md`

---

## NHÓM 2 — DATABASE VÀ NỀN TẢNG DỮ LIỆU (`F-P1-G02`)

### Task P1-004 — Đối chiếu và chốt mô hình dữ liệu 30 bảng
- `feature_id`: `F-P1-G02`
- `task_id`: `P1-004`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-001", "P1-002"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Tài liệu hóa chi tiết thiết kế 30 bảng, khóa chính/ngoại, khóa chính ghép, ràng buộc `UNIQUE`, quy tắc giá trị `status`/`gender`/`payment_method` và sơ đồ quan hệ.
- `deliverables`:
  - `docs/phase-1/DATABASE_DESIGN.md`
  - `docs/phase-1/DATABASE_RELATIONSHIPS.md`
- `acceptance_criteria`:
  1. Liệt kê đầy đủ 30 bảng, kiểu dữ liệu, PK/FK/Unique/Index và giải trình 10 điểm lưu ý nghiệp vụ trong Phần C.
  2. Tài liệu khớp 100% với bộ migrations và Eloquent Models đã triển khai.
- `test_commands`:
  - `test -s "$PROJECT_ROOT/docs/phase-1/DATABASE_DESIGN.md"`
  - `test -s "$PROJECT_ROOT/docs/phase-1/DATABASE_RELATIONSHIPS.md"`
- `allowed_files`: `docs/phase-1/DATABASE_DESIGN.md`, `docs/phase-1/DATABASE_RELATIONSHIPS.md`, `qlpk-autonomous-framework/reports/tasks/P1-004.md`

---

### Task P1-005 — Triển khai migration cho 30 bảng
- `feature_id`: `F-P1-G02`
- `task_id`: `P1-005`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-004"]`
- `status`: `DONE`
- `complexity`: `HIGH`
- `objective`: Tạo đầy đủ 30 bảng theo đúng thứ tự phụ thuộc khóa ngoại trên Laravel và chạy migration an toàn lên `DBQLPK` + kiểm thử tự động trên SQLite `:memory:`.
- `deliverables`:
  - 30 bảng migrations trong `be/database/migrations/`
  - `be/tests/Feature/DatabaseSchemaTest.php`
- `acceptance_criteria`:
  1. Đủ 30 bảng mục tiêu, đúng tên cột, kiểu dữ liệu `DECIMAL(15,2)` / `DECIMAL(15,3)`, khóa chính ghép và khóa ngoại.
  2. Đã chạy `php artisan migrate` thành công trên `DBQLPK` và pass `DatabaseSchemaTest` (66 assertions).
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=DatabaseSchemaTest`
  - `cd "$PROJECT_ROOT/be" && php artisan migrate:status`
- `allowed_files`: `be/database/migrations/*`, `be/tests/Feature/DatabaseSchemaTest.php`

---

### Task P1-006 — Xây dựng Model và quan hệ Eloquent
- `feature_id`: `F-P1-G02`
- `task_id`: `P1-006`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-005"]`
- `status`: `DONE`
- `complexity`: `HIGH`
- `objective`: Xây dựng đầy đủ 30 Eloquent Models (27 Entity Models + 3 Pivot Models) kèm `#[Fillable]`, `casts()`, `UPDATED_AT` và đầy đủ Relationships.
- `deliverables`:
  - 30 Models trong `be/app/Models/`
  - `be/tests/Feature/EloquentModelsRelationshipTest.php`
- `acceptance_criteria`:
  1. Đủ 30 Models khớp với 30 bảng trong database.
  2. Toàn bộ quan hệ `BelongsTo`, `HasMany`, `HasOne`, `BelongsToMany` (`using` Pivot) và `MorphTo`/`MorphMany` hoạt động chính xác qua test `EloquentModelsRelationshipTest`.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=EloquentModelsRelationshipTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Models/*`, `be/tests/Feature/EloquentModelsRelationshipTest.php`

---

### Task P1-007 — Seed dữ liệu nền và quy tắc dữ liệu mẫu
- `feature_id`: `F-P1-G02`
- `task_id`: `P1-007`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-005", "P1-006"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Tạo Seeder idempotent (`updateOrCreate` / `firstOrCreate`) cho 8 vai trò (`ADMIN`, `MANAGER`, `DOCTOR`, `RECEPTIONIST`, `CASHIER`, `ACCOUNTANT`, `EMPLOYEE`, `VIEWER`), danh mục quyền chuẩn theo module, và dữ liệu mẫu dịch vụ/gói trong môi trường dev/test.
- `deliverables`:
  - `be/database/seeders/RolePermissionSeeder.php`
  - `be/database/seeders/DemoCatalogSeeder.php`
  - Cập nhật `be/database/seeders/DatabaseSeeder.php`
  - `be/tests/Feature/DatabaseSeederTest.php`
- `acceptance_criteria`:
  1. Chạy Seeder nhiều lần liên tiếp không gây lỗi trùng lặp (`idempotent`).
  2. Tạo đủ 8 vai trò chuẩn và ma trận quyền tương ứng.
  3. Không chứa dữ liệu bệnh nhân thật và không tạo mật khẩu cố định nguy hiểm khi `APP_ENV=production`.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=DatabaseSeederTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/database/seeders/*`, `be/tests/Feature/DatabaseSeederTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-007.md`

---

## NHÓM 3 — ĐĂNG NHẬP VÀ PHÂN QUYỀN (`F-P1-G03`)

### Task P1-008 — Xây dựng hệ thống đăng nhập
- `feature_id`: `F-P1-G03`
- `task_id`: `P1-008`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-005", "P1-006", "P1-007"]`
- `status`: `READY`
- `complexity`: `HIGH`
- `objective`: Xây dựng hệ thống xác thực API (`POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`) với kiểm tra `status === ACTIVE`, cập nhật `last_login_at`, ghi `audit_logs`, rate limiting chống brute-force và ẩn tuyệt đối `password_hash`.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/AuthController.php`
  - `be/app/Http/Requests/Auth/LoginRequest.php`
  - `be/app/Http/Resources/UserResource.php`
  - Middleware kiểm tra tài khoản `ACTIVE`
  - `be/tests/Feature/AuthApiTest.php`
- `acceptance_criteria`:
  1. Đăng nhập đúng `username`/`password` với tài khoản `ACTIVE` trả token/session hợp lệ và cập nhật `last_login_at`.
  2. Sai mật khẩu trả `401`; tài khoản `INACTIVE`/`LOCKED` bị từ chối (`403`); vượt giới hạn tần suất trả `429`.
  3. `GET /api/v1/auth/me` trả thông tin user kèm `roles`, `permissions`, `employee` và tuyệt đối không lộ `password_hash`.
  4. `POST /api/v1/auth/logout` thu hồi token/session hiện tại.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=AuthApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/AuthController.php`, `be/app/Http/Requests/Auth/*`, `be/app/Http/Resources/*`, `be/app/Http/Middleware/*`, `be/app/Models/User.php`, `be/routes/api.php`, `be/bootstrap/app.php`, `be/config/*`, `be/database/migrations/*`, `be/tests/Feature/AuthApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-008.md`

---

### Task P1-009 — Xây dựng hệ thống Role và Permission (RBAC)
- `feature_id`: `F-P1-G03`
- `task_id`: `P1-009`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-006", "P1-008"]`
- `status`: `READY`
- `complexity`: `HIGH`
- `objective`: Xây dựng helper/methods kiểm tra quyền trên `User` (`hasRole`, `hasPermission`), middleware `permission:<key>`, và các API quản trị Role & Permission (`GET /api/v1/roles`, `GET /api/v1/permissions`, `PUT /api/v1/roles/{role}/permissions`, `PUT /api/v1/users/{user}/roles`).
- `deliverables`:
  - `be/app/Http/Middleware/CheckPermission.php`
  - `be/app/Http/Controllers/Api/V1/RolePermissionController.php`
  - `be/tests/Feature/RbacAuthorizationTest.php`
- `acceptance_criteria`:
  1. Middleware chặn `403` với tài khoản không có `permission_key` yêu cầu.
  2. Tài khoản `VIEWER` không thể gọi các API tạo/sửa/xóa; `RECEPTIONIST` không có quyền tài chính.
  3. Chỉ tài khoản có quyền quản trị phân quyền mới sửa được `role_permissions` hoặc gán `user_roles`.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=RbacAuthorizationTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Models/User.php`, `be/app/Http/Middleware/*`, `be/app/Http/Controllers/Api/V1/RolePermissionController.php`, `be/app/Http/Requests/*`, `be/app/Http/Resources/*`, `be/routes/api.php`, `be/bootstrap/app.php`, `be/tests/Feature/RbacAuthorizationTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-009.md`

---

### Task P1-010 — Xây dựng giao diện đăng nhập và bảo vệ trang quản trị
- `feature_id`: `F-P1-G03`
- `task_id`: `P1-010`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-008", "P1-009"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng API client xác thực trên Next.js (`fe/`), AuthProvider/guard bảo vệ khu vực quản trị, trang `/login`, hiển thị thông tin tài khoản đang đăng nhập và chức năng đăng xuất.
- `deliverables`:
  - `fe/lib/api/client.ts`, `fe/lib/api/auth.ts`
  - `fe/types/auth.ts`
  - `fe/app/login/page.tsx`
  - `fe/components/layout/AdminShell.tsx`
- `acceptance_criteria`:
  1. Trang `/login` validate input, hiển thị trạng thái loading và thông báo lỗi rõ ràng từ Backend.
  2. Người chưa đăng nhập vào trang quản trị sẽ được chuyển hướng về `/login`.
  3. `npx tsc --noEmit` và `npm run build` bên `fe/` đạt exit code `0`.
- `test_commands`:
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`
- `allowed_files`: `fe/app/**`, `fe/components/**`, `fe/lib/**`, `fe/types/**`, `qlpk-autonomous-framework/reports/tasks/P1-010.md`

---

## NHÓM 4 — NHÂN SỰ VÀ TÀI KHOẢN (`F-P1-G04`)

### Task P1-011 — Xây dựng API quản lý nhân viên
- `feature_id`: `F-P1-G04`
- `task_id`: `P1-011`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-006", "P1-009"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng REST API CRUD nhân viên (`/api/v1/employees`) kèm sinh mã `employee_code` duy nhất an toàn, tìm kiếm theo mã/tên, lọc theo `status`/`department`, phân trang và bảo vệ bằng RBAC.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/EmployeeController.php`
  - `be/app/Http/Requests/Employee/*`
  - `be/app/Http/Resources/EmployeeResource.php`
  - `be/tests/Feature/EmployeeApiTest.php`
- `acceptance_criteria`:
  1. Danh sách, chi tiết, tạo mới, cập nhật và đổi trạng thái nhân viên hoạt động đúng và validate chặt chẽ.
  2. Mã nhân viên không trùng; không xóa nhân viên đã có lịch sử khám/lịch hẹn.
  3. Kiểm tra quyền `employees.view`, `employees.create`, `employees.update` trên từng endpoint.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=EmployeeApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/EmployeeController.php`, `be/app/Http/Requests/Employee/*`, `be/app/Http/Resources/EmployeeResource.php`, `be/app/Services/*`, `be/routes/api.php`, `be/tests/Feature/EmployeeApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-011.md`

---

### Task P1-012 — Xây dựng API quản lý tài khoản và vai trò
- `feature_id`: `F-P1-G04`
- `task_id`: `P1-012`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-009", "P1-011"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng API quản lý tài khoản (`/api/v1/users`), liên kết `employee_id`, đổi trạng thái, đổi mật khẩu an toàn, gán vai trò, chống tự nâng quyền và chống khóa tài khoản `ADMIN` hoạt động cuối cùng.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/UserController.php`
  - `be/app/Http/Requests/User/*`
  - `be/tests/Feature/UserManagementApiTest.php`
- `acceptance_criteria`:
  1. Tạo/xem/cập nhật tài khoản, đổi mật khẩu và gán vai trò hoạt động đúng.
  2. Chặn vô hiệu hóa tài khoản `ADMIN` cuối cùng đang hoạt động (`422`/`409`).
  3. Không trả `password_hash` trong bất kỳ response nào; thu hồi phiên khi tài khoản bị vô hiệu hóa.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=UserManagementApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/UserController.php`, `be/app/Http/Requests/User/*`, `be/app/Http/Resources/*`, `be/routes/api.php`, `be/tests/Feature/UserManagementApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-012.md`

---

### Task P1-013 — Xây dựng giao diện nhân sự và tài khoản
- `feature_id`: `F-P1-G04`
- `task_id`: `P1-013`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-010", "P1-011", "P1-012"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng các trang quản lý Nhân viên (`/employees`, `/employees/[id]`) và Tài khoản & Phân quyền (`/users`) kết nối API thật, có tìm kiếm, lọc, phân trang, trạng thái loading/empty/error và ẩn thao tác theo quyền.
- `deliverables`:
  - `fe/lib/api/employees.ts`, `fe/lib/api/users.ts`
  - `fe/app/(admin)/employees/**`, `fe/app/(admin)/users/**`
- `acceptance_criteria`:
  1. Tạo/sửa nhân viên, tạo tài khoản và gán vai trò trực tiếp trên giao diện kết nối Backend thật.
  2. Hiển thị lỗi validation từ Backend rõ ràng; `npx tsc --noEmit` và `npm run build` PASS.
- `test_commands`:
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`
- `allowed_files`: `fe/app/**`, `fe/components/**`, `fe/lib/**`, `fe/types/**`, `qlpk-autonomous-framework/reports/tasks/P1-013.md`

---

## NHÓM 5 — BỆNH NHÂN VÀ DỮ LIỆU DỊCH VỤ (`F-P1-G05`)

### Task P1-014 — Xây dựng API quản lý bệnh nhân
- `feature_id`: `F-P1-G05`
- `task_id`: `P1-014`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-006", "P1-009"]`
- `status`: `READY`
- `complexity`: `HIGH`
- `objective`: Xây dựng API CRUD bệnh nhân (`/api/v1/patients`) với cơ chế cấp mã `patient_code` duy nhất an toàn khi đồng thời (concurrency-safe), cảnh báo khả năng trùng hồ sơ (`duplicate_warnings` theo SĐT/họ tên + ngày sinh) mà không tự gộp hồ sơ, tìm kiếm và phân trang.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/PatientController.php`
  - `be/app/Http/Requests/Patient/*`
  - `be/app/Http/Resources/PatientResource.php`
  - `be/tests/Feature/PatientApiTest.php`
- `acceptance_criteria`:
  1. `patient_code` duy nhất, không dùng `count() + 1` ngây thơ dễ trùng khi tạo đồng thời.
  2. Cảnh báo `duplicate_warnings` khi trùng SĐT nhưng vẫn cho phép lưu (không ép `phone` unique cứng).
  3. Tìm kiếm theo `patient_code`, `full_name`, `phone` và kiểm tra quyền `patients.view`/`create`/`update`.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/PatientController.php`, `be/app/Http/Requests/Patient/*`, `be/app/Http/Resources/PatientResource.php`, `be/app/Services/*`, `be/routes/api.php`, `be/tests/Feature/PatientApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-014.md`

---

### Task P1-015 — Xây dựng trang danh sách và hồ sơ bệnh nhân
- `feature_id`: `F-P1-G05`
- `task_id`: `P1-015`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-010", "P1-014"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng giao diện danh sách bệnh nhân (`/patients`), form thêm/sửa có hiển thị cảnh báo trùng hồ sơ, và trang chi tiết bệnh nhân (`/patients/[id]`) kèm khu vực lịch sử khám & gói dịch vụ.
- `deliverables`:
  - `fe/lib/api/patients.ts`
  - `fe/app/(admin)/patients/**`
- `acceptance_criteria`:
  1. Danh sách, tìm kiếm theo mã/tên/SĐT, thêm/sửa và xem chi tiết hồ sơ bệnh nhân hoạt động với API thật.
  2. Không hiển thị dữ liệu bệnh án nhạy cảm nếu tài khoản không có quyền y tế.
- `test_commands`:
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`
- `allowed_files`: `fe/app/**`, `fe/components/**`, `fe/lib/**`, `fe/types/**`, `qlpk-autonomous-framework/reports/tasks/P1-015.md`

---

### Task P1-016 — Xây dựng API quản lý dịch vụ
- `feature_id`: `F-P1-G05`
- `task_id`: `P1-016`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-006", "P1-009"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng API CRUD danh mục dịch vụ (`/api/v1/services`), kiểm tra `price >= 0`, `duration_minutes > 0`, mã `service_code` duy nhất, lọc theo `status` và giữ nguyên lịch sử cho các lượt khám cũ.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/ServiceController.php`
  - `be/app/Http/Requests/Service/*`
  - `be/app/Http/Resources/ServiceResource.php`
  - `be/tests/Feature/ServiceApiTest.php`
- `acceptance_criteria`:
  1. CRUD dịch vụ hoạt động đúng; validate giá không âm và thời lượng hợp lệ.
  2. Tìm kiếm theo `service_code`/`name`, lọc theo `status`, phân trang và bảo vệ bằng RBAC.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=ServiceApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/ServiceController.php`, `be/app/Http/Requests/Service/*`, `be/app/Http/Resources/ServiceResource.php`, `be/app/Services/*`, `be/routes/api.php`, `be/tests/Feature/ServiceApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-016.md`

---

### Task P1-017 — Xây dựng API quản lý gói dịch vụ
- `feature_id`: `F-P1-G05`
- `task_id`: `P1-017`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-016"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng API CRUD danh mục gói dịch vụ (`/api/v1/service-packages`), validate `price >= 0`, `total_sessions >= 1`, `validity_days >= 1`, mã `package_code` duy nhất và bảo toàn lịch sử giá của các gói bệnh nhân đã mua.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/ServicePackageController.php`
  - `be/app/Http/Requests/ServicePackage/*`
  - `be/app/Http/Resources/ServicePackageResource.php`
  - `be/tests/Feature/ServicePackageApiTest.php`
- `acceptance_criteria`:
  1. CRUD gói dịch vụ hoạt động đúng, kiểm tra chặt `total_sessions` và `validity_days`.
  2. Cập nhật giá gói danh mục không làm thay đổi trường `price` của các bản ghi `patient_packages` đã cấp trước đó.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=ServicePackageApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/ServicePackageController.php`, `be/app/Http/Requests/ServicePackage/*`, `be/app/Http/Resources/ServicePackageResource.php`, `be/routes/api.php`, `be/tests/Feature/ServicePackageApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-017.md`

---

### Task P1-018 — Xây dựng chức năng cấu hình dịch vụ trong gói
- `feature_id`: `F-P1-G05`
- `task_id`: `P1-018`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-016", "P1-017"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng các API quản lý thành phần dịch vụ trong gói (`GET/POST/PUT/DELETE /api/v1/service-packages/{package}/services`) trên bảng trung gian `package_services` trong transaction.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/PackageServiceController.php`
  - `be/tests/Feature/PackageServiceConfigApiTest.php`
- `acceptance_criteria`:
  1. Thêm, cập nhật `quantity` (`>= 1`), xóa và xem danh sách dịch vụ thành phần của gói hoạt động chính xác.
  2. Ngăn thêm trùng `(package_id, service_id)` (`409`/`422`).
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=PackageServiceConfigApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/PackageServiceController.php`, `be/app/Http/Controllers/Api/V1/ServicePackageController.php`, `be/app/Http/Requests/ServicePackage/*`, `be/app/Http/Resources/*`, `be/routes/api.php`, `be/tests/Feature/PackageServiceConfigApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-018.md`

---

### Task P1-019 — Xây dựng nghiệp vụ cấp gói cho bệnh nhân
- `feature_id`: `F-P1-G05`
- `task_id`: `P1-019`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-014", "P1-017", "P1-018"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng API cấp gói dịch vụ cho bệnh nhân (`POST /api/v1/patients/{patient}/packages`, `GET /api/v1/patients/{patient}/packages`, `GET /api/v1/patient-packages/{id}`) khởi tạo `total_sessions`, `used_sessions = 0`, `remaining_sessions = total_sessions`, `expiry_date` từ `validity_days` và chốt `price` tại thời điểm cấp.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/PatientPackageController.php`
  - `be/app/Http/Requests/PatientPackage/*`
  - `be/app/Http/Resources/PatientPackageResource.php`
  - `be/tests/Feature/PatientPackageApiTest.php`
  - Giao diện quản lý Dịch vụ & Gói dịch vụ (`fe/app/(admin)/services/**`, `fe/app/(admin)/packages/**`)
- `acceptance_criteria`:
  1. Cấp gói thành công cho bệnh nhân đang hoạt động với gói `ACTIVE`; tự động tính `expiry_date = purchase_date + validity_days`.
  2. Đảm bảo bất biến `used_sessions = 0`, `remaining_sessions = total_sessions`, `price` lưu theo giá tại thời điểm cấp.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientPackageApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/PatientPackageController.php`, `be/app/Http/Requests/PatientPackage/*`, `be/app/Http/Resources/PatientPackageResource.php`, `be/app/Services/*`, `be/routes/api.php`, `be/tests/Feature/PatientPackageApiTest.php`, `fe/app/**`, `fe/components/**`, `fe/lib/**`, `fe/types/**`, `qlpk-autonomous-framework/reports/tasks/P1-019.md`

---

## NHÓM 6 — LỊCH HẸN VÀ LƯỢT KHÁM (`F-P1-G06`)

### Task P1-020 — Xây dựng API quản lý lịch hẹn
- `feature_id`: `F-P1-G06`
- `task_id`: `P1-020`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-014", "P1-016", "P1-011"]`
- `status`: `READY`
- `complexity`: `HIGH`
- `objective`: Xây dựng API quản lý lịch hẹn (`/api/v1/appointments`) kèm kiểm tra `end_time > start_time`, dịch vụ đang `ACTIVE`, và khóa chống trùng lịch (`existing.start_time < new.end_time AND existing.end_time > new.start_time`) cho cùng nhân viên trong cùng ngày đối với các lịch chưa hủy (`status != CANCELLED`).
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/AppointmentController.php`
  - `be/app/Services/AppointmentService.php`
  - `be/app/Http/Requests/Appointment/*`
  - `be/app/Http/Resources/AppointmentResource.php`
  - `be/tests/Feature/AppointmentApiTest.php`
- `acceptance_criteria`:
  1. Chặn đặt lịch hoặc đổi giờ bị chồng lấn khung giờ của cùng `employee_id` trong cùng `appointment_date` (trả `409`/`422` kèm thông báo rõ ràng).
  2. Lịch đã hủy (`CANCELLED`) không giữ chỗ, cho phép đặt lịch mới vào khung giờ đó.
  3. Sử dụng transaction + row lock (`lockForUpdate`) trên nhân viên để giảm thiểu race condition.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=AppointmentApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/AppointmentController.php`, `be/app/Services/AppointmentService.php`, `be/app/Http/Requests/Appointment/*`, `be/app/Http/Resources/AppointmentResource.php`, `be/routes/api.php`, `be/tests/Feature/AppointmentApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-020.md`

---

### Task P1-021 — Xây dựng giao diện quản lý lịch hẹn
- `feature_id`: `F-P1-G06`
- `task_id`: `P1-021`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-010", "P1-020"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng trang quản lý lịch hẹn (`/appointments`), form đặt lịch/cập nhật/hủy lịch, bộ lọc theo ngày/nhân viên/bệnh nhân/trạng thái và hiển thị cảnh báo khi trùng khung giờ nhân viên.
- `deliverables`:
  - `fe/lib/api/appointments.ts`
  - `fe/app/(admin)/appointments/**`
- `acceptance_criteria`:
  1. Đặt lịch, cập nhật, hủy lịch và lọc danh sách lịch hẹn qua API thật.
  2. Hiển thị thông báo lỗi rõ ràng khi nhân viên bị trùng lịch; `npx tsc --noEmit` và `npm run build` PASS.
- `test_commands`:
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`
- `allowed_files`: `fe/app/**`, `fe/components/**`, `fe/lib/**`, `fe/types/**`, `qlpk-autonomous-framework/reports/tasks/P1-021.md`

---

### Task P1-022 — Xây dựng API tạo và quản lý lượt khám
- `feature_id`: `F-P1-G06`
- `task_id`: `P1-022`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-014", "P1-016", "P1-019", "P1-020"]`
- `status`: `READY`
- `complexity`: `HIGH`
- `objective`: Xây dựng API quản lý lượt khám (`/api/v1/visits`), tự sinh `visit_code` duy nhất, tính `total_amount = max(0, quantity * unit_price - discount_amount)` (kiểm tra `discount_amount <= quantity * unit_price`), quản lý vòng đời trạng thái (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) và cập nhật `first_visit_date`/`last_visit_date` của bệnh nhân.
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/VisitController.php`
  - `be/app/Services/VisitService.php`
  - `be/app/Http/Requests/Visit/*`
  - `be/app/Http/Resources/VisitResource.php`
  - `be/tests/Feature/VisitApiTest.php`
- `acceptance_criteria`:
  1. Tạo, xem, cập nhật và đổi trạng thái lượt khám hoạt động đúng trong DB transaction.
  2. Công thức `total_amount = quantity * unit_price - discount_amount` chính xác, từ chối giảm giá vượt thành tiền hoặc số âm.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=VisitApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/VisitController.php`, `be/app/Services/VisitService.php`, `be/app/Http/Requests/Visit/*`, `be/app/Http/Resources/VisitResource.php`, `be/routes/api.php`, `be/tests/Feature/VisitApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-022.md`

---

### Task P1-023 — Xây dựng quy tắc sử dụng gói trong lượt khám
- `feature_id`: `F-P1-G06`
- `task_id`: `P1-023`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-019", "P1-022"]`
- `status`: `READY`
- `complexity`: `HIGH`
- `objective`: Triển khai logic trừ buổi an toàn (`lockForUpdate` trong transaction) khi lượt khám sử dụng `patient_package_id`: kiểm tra gói thuộc đúng bệnh nhân, đang `ACTIVE`, chưa hết hạn (`expiry_date`), dịch vụ nằm trong `package_services`, `remaining_sessions >= quantity`, chống trừ 2 lần và hoàn buổi đúng quy tắc nếu hủy lượt khám.
- `deliverables`:
  - Cập nhật `be/app/Services/VisitService.php`
  - `be/tests/Feature/VisitPackageUsageTest.php`
- `acceptance_criteria`:
  1. Gói còn buổi, đúng bệnh nhân, đúng dịch vụ trong gói và chưa hết hạn mới được trừ buổi; luôn bảo toàn `used_sessions + remaining_sessions == total_sessions`.
  2. Gói hết buổi hoặc hết hạn bị từ chối (`422`); gọi cập nhật lặp lại cùng trạng thái không bao giờ trừ buổi 2 lần.
  3. Khi `remaining_sessions == 0`, tự động chuyển trạng thái gói sang `COMPLETED`/`EXHAUSTED`.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=VisitPackageUsageTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Services/VisitService.php`, `be/app/Http/Controllers/Api/V1/VisitController.php`, `be/app/Models/PatientPackage.php`, `be/app/Models/Visit.php`, `be/tests/Feature/VisitPackageUsageTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-023.md`

---

### Task P1-024 — Xây dựng hồ sơ bệnh án cơ bản
- `feature_id`: `F-P1-G06`
- `task_id`: `P1-024`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-022", "P1-009"]`
- `status`: `READY`
- `complexity`: `HIGH`
- `objective`: Xây dựng API xem/tạo/cập nhật hồ sơ bệnh án theo lượt khám (`GET/POST/PUT /api/v1/visits/{visit}/medical-record`), bảo đảm mỗi lượt khám có tối đa 1 bệnh án (`visit_id` unique), ghi `audit_logs` khi tạo/sửa và bảo vệ nghiêm ngặt bằng quyền y tế (`medical_records.view`, `medical_records.create`, `medical_records.update`).
- `deliverables`:
  - `be/app/Http/Controllers/Api/V1/MedicalRecordController.php`
  - `be/app/Http/Requests/MedicalRecord/*`
  - `be/app/Http/Resources/MedicalRecordResource.php`
  - `be/tests/Feature/MedicalRecordApiTest.php`
- `acceptance_criteria`:
  1. Tạo và cập nhật bệnh án gắn với `visit_id`; chặn tạo bệnh án thứ 2 cho cùng `visit_id`.
  2. Tài khoản `RECEPTIONIST` hoặc `CASHIER` không có quyền `medical_records.view` bị chặn `403` và không nhận được dữ liệu chẩn đoán/điều trị qua API lượt khám.
  3. Ghi vết thay đổi vào bảng `audit_logs`.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=MedicalRecordApiTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/app/Http/Controllers/Api/V1/MedicalRecordController.php`, `be/app/Http/Controllers/Api/V1/VisitController.php`, `be/app/Http/Requests/MedicalRecord/*`, `be/app/Http/Resources/MedicalRecordResource.php`, `be/app/Http/Resources/VisitResource.php`, `be/routes/api.php`, `be/tests/Feature/MedicalRecordApiTest.php`, `qlpk-autonomous-framework/reports/tasks/P1-024.md`

---

### Task P1-025 — Xây dựng giao diện lượt khám và bệnh án
- `feature_id`: `F-P1-G06`
- `task_id`: `P1-025`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-015", "P1-021", "P1-022", "P1-024"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Xây dựng trang danh sách lượt khám (`/visits`), form tạo lượt khám (chọn bệnh nhân, nhân viên, dịch vụ, gói bệnh nhân nếu có), và trang chi tiết lượt khám (`/visits/[id]`) tích hợp khu vực nhập/xem bệnh án theo quyền.
- `deliverables`:
  - `fe/lib/api/visits.ts`, `fe/lib/api/medical-records.ts`
  - `fe/app/(admin)/visits/**`
- `acceptance_criteria`:
  1. Thực hiện trọn vẹn luồng tạo lượt khám (dùng lẻ hoặc dùng gói) và nhập bệnh án trên giao diện thật.
  2. Hiển thị rõ lỗi nghiệp vụ khi gói hết buổi/hết hạn; ẩn/chặn khu vực bệnh án đối với vai trò không có quyền y tế.
- `test_commands`:
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`
- `allowed_files`: `fe/app/**`, `fe/components/**`, `fe/lib/**`, `fe/types/**`, `qlpk-autonomous-framework/reports/tasks/P1-025.md`

---

## NHÓM 7 — TÍCH HỢP, KIỂM THỬ VÀ HOÀN THIỆN (`F-P1-G07`)

### Task P1-026 — Hoàn thiện kiểm thử Backend
- `feature_id`: `F-P1-G07`
- `task_id`: `P1-026`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-008", "P1-009", "P1-011", "P1-012", "P1-014", "P1-016", "P1-017", "P1-018", "P1-019", "P1-020", "P1-022", "P1-023", "P1-024"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Rà soát và bổ sung đầy đủ bộ kiểm thử Backend cho toàn bộ 20 kịch bản trọng yếu của Giai đoạn 1 (Auth, RBAC, Employees, Users, Patients, Services, Packages, PatientPackages, Appointments overlap, Visits & Package session deduction, MedicalRecords privacy, Transaction rollback).
- `deliverables`:
  - Bộ test đầy đủ trong `be/tests/Feature/`
- `acceptance_criteria`:
  1. Tất cả test trong `be/tests/` đều PASS (`php artisan test` exit code `0`).
  2. `Laravel Pint` kiểm tra toàn bộ code `be/` đạt PASS.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint --test`
- `allowed_files`: `be/tests/**`, `be/app/**`, `qlpk-autonomous-framework/reports/tasks/P1-026.md`

---

### Task P1-027 — Hoàn thiện kiểm thử Frontend và tích hợp API
- `feature_id`: `F-P1-G07`
- `task_id`: `P1-027`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-013", "P1-015", "P1-021", "P1-025"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Kiểm tra tổng thể toàn bộ các trang Frontend Giai đoạn 1 (`login`, `employees`, `users`, `patients`, `services`, `packages`, `appointments`, `visits`), đồng bộ TypeScript types với API Resources của Backend, vượt qua `tsc --noEmit`, `eslint` và `next build` production.
- `deliverables`:
  - Hoàn thiện các trang & components trong `fe/`
- `acceptance_criteria`:
  1. Không dùng dữ liệu giả thay cho API thật trên bất kỳ trang nghiệm thu nào.
  2. `npx tsc --noEmit`, `npm run lint` và `npm run build` đều PASS (`exit_code == 0`).
- `test_commands`:
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run lint && npm run build`
- `allowed_files`: `fe/**`, `qlpk-autonomous-framework/reports/tasks/P1-027.md`

---

### Task P1-028 — Kiểm thử tích hợp luồng nghiệp vụ đầu cuối (E2E Flows)
- `feature_id`: `F-P1-G07`
- `task_id`: `P1-028`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-026", "P1-027"]`
- `status`: `READY`
- `complexity`: `HIGH`
- `objective`: Viết và chạy bài kiểm thử tích hợp đầu-cuối (`Phase1EndToEndWorkflowTest`) mô phỏng xuyên suốt 4 luồng nghiệp vụ: (1) Nhân sự & Phân quyền, (2) Bệnh nhân & Cảnh báo trùng, (3) Dịch vụ & Cấp gói, (4) Đặt lịch hẹn (kèm chặn trùng lịch) → Tạo lượt khám trừ buổi gói → Tạo bệnh án & Kiểm tra bảo mật y tế.
- `deliverables`:
  - `be/tests/Feature/Phase1EndToEndWorkflowTest.php`
- `acceptance_criteria`:
  1. Cả 4 luồng nghiệp vụ đầu-cuối chạy liên hoàn từ đầu đến cuối trong `Phase1EndToEndWorkflowTest` đạt `PASS`.
- `test_commands`:
  - `cd "$PROJECT_ROOT/be" && php artisan test --filter=Phase1EndToEndWorkflowTest`
  - `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test`
- `allowed_files`: `be/tests/Feature/Phase1EndToEndWorkflowTest.php`, `be/app/**`, `qlpk-autonomous-framework/reports/tasks/P1-028.md`

---

## NHÓM 8 — TÀI LIỆU, REVIEW VÀ BÀN GIAO (`F-P1-G08`)

### Task P1-029 — Hoàn thiện tài liệu kỹ thuật và hướng dẫn sử dụng
- `feature_id`: `F-P1-G08`
- `task_id`: `P1-029`
- `priority`: `P1`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-028"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Tổng hợp và hoàn thiện bộ tài liệu kỹ thuật Giai đoạn 1: tài liệu API (`API_DOCUMENTATION.md`), thiết kế CSDL (`DATABASE_DESIGN.md`), hướng dẫn phát triển (`DEVELOPMENT.md`) và các giới hạn/vấn đề tồn đọng (`KNOWN_ISSUES.md`).
- `deliverables`:
  - `docs/phase-1/API_DOCUMENTATION.md`
  - `docs/phase-1/DATABASE_DESIGN.md`
  - `docs/phase-1/DEVELOPMENT.md`
  - `docs/phase-1/KNOWN_ISSUES.md`
- `acceptance_criteria`:
  1. Cả 4 tài liệu tồn tại, đầy đủ nội dung thực tế và không chứa bất kỳ secret/mật khẩu nào.
- `test_commands`:
  - `test -s "$PROJECT_ROOT/docs/phase-1/API_DOCUMENTATION.md"`
  - `test -s "$PROJECT_ROOT/docs/phase-1/DATABASE_DESIGN.md"`
  - `test -s "$PROJECT_ROOT/docs/phase-1/DEVELOPMENT.md"`
  - `test -s "$PROJECT_ROOT/docs/phase-1/KNOWN_ISSUES.md"`
- `allowed_files`: `docs/phase-1/*`, `qlpk-autonomous-framework/reports/tasks/P1-029.md`

---

### Task P1-030 — Kiểm tra cuối giai đoạn và bàn giao review
- `feature_id`: `F-P1-G08`
- `task_id`: `P1-030`
- `priority`: `P0`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["P1-028", "P1-029"]`
- `status`: `READY`
- `complexity`: `MEDIUM`
- `objective`: Chạy toàn bộ cổng kiểm tra cuối Giai đoạn 1 (Backend tests, Pint, Frontend TypeScript/Build, Git status, kiểm tra không lộ `.env`/secret) và xuất báo cáo tổng kết bàn giao `docs/phase-1/PHASE_1_REPORT.md` ở trạng thái `REVIEW_REQUIRED` để người dùng nghiệm thu.
- `deliverables`:
  - `docs/phase-1/PHASE_1_REPORT.md`
- `acceptance_criteria`:
  1. Toàn bộ test Backend (`php artisan test`), Pint (`pint --test`) và Frontend (`tsc --noEmit`, `npm run build`) đều PASS.
  2. Báo cáo `docs/phase-1/PHASE_1_REPORT.md` tổng hợp đầy đủ 30 tasks, kết quả kiểm thử, danh sách file thay đổi và điểm bắt đầu cho Giai đoạn 2.
- `test_commands`:
  - `test -s "$PROJECT_ROOT/docs/phase-1/PHASE_1_REPORT.md"`
  - `cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint --test`
  - `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build`
- `allowed_files`: `docs/phase-1/PHASE_1_REPORT.md`, `qlpk-autonomous-framework/PROGRESS.md`, `qlpk-autonomous-framework/reports/tasks/P1-030.md`
