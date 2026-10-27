# DEVELOPMENT GUIDE — HƯỚNG DẪN PHÁT TRIỂN & KIỂM THỬ
## HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK) — GIAI ĐOẠN 1

- **Mã tài liệu:** `DEV-GUIDE-PHASE-01`
- **Phiên bản:** `1.1.0`
- **Ngày phát hành:** `2026-10-27`
- **Áp dụng cho:** Đội ngũ phát triển Backend (`be/`) và Frontend (`fe/`)

---

## 1. YÊU CẦU MÔI TRƯỜNG & CÔNG CỤ

| Thành phần | Phiên bản khuyến nghị | Ghi chú |
|---|---|---|
| **Hệ điều hành** | macOS Sonoma / Linux Ubuntu 22.04+ / Windows 11 (WSL2) | UTF-8 Locale |
| **PHP** | `^8.3` | Bắt buộc bật extensions: `pdo_mysql`, `pdo_sqlite`, `mbstring`, `openssl`, `json`, `curl`, `bcmath`, `tokenizer` |
| **Composer** | `^2.7+` | Trình quản lý gói PHP |
| **Node.js** | `>=20.x` (LTS) | Runtime chạy Frontend Next.js |
| **npm** | `>=10.x` | Trình quản lý gói JavaScript |
| **MySQL Server** | `8.0+` | Database chính: `DBQLPK`, charset: `utf8mb4`, collation: `utf8mb4_unicode_ci` |
| **SQLite** | `^3.35+` | Phục vụ kiểm thử tự động cô lập trong bộ nhớ (`:memory:`) |

---

## 2. CẤU TRÚC DỰ ÁN TỔNG THỂ

```
clinic-management-system/
├── be/                                    # BACKEND SERVICE (Laravel 13.x REST API)
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/       # Thin API Controllers
│   │   │   ├── Middleware/               # Sanctum, ActiveUser, RBAC Permissions
│   │   │   ├── Requests/                 # FormRequest Validations
│   │   │   └── Resources/                # API Data Envelope Transformers
│   │   ├── Models/                       # 30 Eloquent Models & Pivot Models
│   │   ├── Services/                     # Rich Domain Business Services
│   │   └── Policies/                     # Authorization Policies
│   ├── database/
│   │   ├── migrations/                   # 30 Bảng cơ sở dữ liệu
│   │   └── seeders/                      # Role, Permission, Admin & Sample Seeders
│   ├── routes/
│   │   └── api.php                       # Định tuyến REST API v1
│   ├── tests/
│   │   └── Feature/                      # Feature Tests & E2E Workflows
│   ├── phpunit.xml                       # Cấu hình kiểm thử (SQLite :memory:)
│   └── composer.json
│
├── fe/                                    # FRONTEND CLIENT (Next.js 16.4 App Router)
│   ├── app/                              # Next.js App Router (Layouts & Pages)
│   │   ├── (admin)/                      # Admin Shell Layout & Pages
│   │   │   ├── dashboard/                # Trang Tổng quan
│   │   │   ├── employees/                # Quản lý Nhân sự
│   │   │   ├── users/                    # Quản lý Tài khoản & Phân quyền
│   │   │   ├── patients/                 # Quản lý Bệnh nhân & Tiền kiểm trùng
│   │   │   ├── services/                 # Quản lý Danh mục Dịch vụ
│   │   │   ├── packages/                 # Quản lý Gói Dịch vụ
│   │   │   ├── appointments/             # Quản lý Lịch hẹn
│   │   │   └── visits/                   # Quản lý Lượt khám & Bệnh án
│   │   └── login/                        # Màn hình Đăng nhập
│   ├── components/                       # Shared UI Components & Shell
│   ├── lib/
│   │   ├── api/                          # Client API SDK & Fetch wrappers
│   │   └── auth/                         # Context quản lý Auth token & session
│   ├── types/                            # TypeScript Data Transfer Interfaces
│   └── package.json
│
├── docs/                                  # TÀI LIỆU KỸ THUẬT & KIẾN TRÚC
│   └── phase-1/
│       ├── INITIAL_AUDIT.md              # Khảo sát ban đầu
│       ├── ARCHITECTURE.md               # Kiến trúc hệ thống chuẩn
│       ├── DATABASE_DESIGN.md            # Thiết kế chi tiết 30 bảng CSDL
│       ├── DATABASE_RELATIONSHIPS.md     # Sơ đồ quan hệ thực thể
│       ├── API_DOCUMENTATION.md          # Đặc tả chi tiết các endpoint API
│       ├── DEVELOPMENT.md                # Hướng dẫn môi trường & kiểm thử này
│       └── KNOWN_ISSUES.md               # Giới hạn kỹ thuật & backlog
└── qlpk-autonomous-framework/             # HỆ THỐNG ĐIỀU PHỐI TỰ ĐỘNG AGY
```

---

## 3. THIẾT LẬP & KHỞI ĐỘNG BACKEND (`be/`)

### 3.1. Cài đặt Dependencies & Cấu hình môi trường
```bash
cd be

# 1. Cài đặt thư viện PHP qua Composer
composer install

# 2. Khởi tạo tệp cấu hình .env từ file mẫu
cp .env.example .env

# 3. Tạo Application Key bí mật
php artisan key:generate
```

### 3.2. Cấu hình Cơ sở dữ liệu trong `be/.env`
Đảm bảo các biến sau khớp với MySQL trên máy phát triển:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=DBQLPK
DB_USERNAME=root
DB_PASSWORD=your_local_password
```
> [!IMPORTANT]
> Tuyệt đối không đẩy file `.env` chứa mật khẩu thật lên Git repository. Chỉ cập nhật và chia sẻ `be/.env.example`.

### 3.3. Khởi tạo CSDL & Nạp dữ liệu mẫu (Seeding)
```bash
# Chạy migration tạo 30 bảng lên DBQLPK
php artisan migrate

# Nạp danh mục 8 vai trò chuẩn, permissions và tài khoản Admin ban đầu
php artisan db:seed
```

### 3.4. Khởi động Web Server phát triển
```bash
php artisan serve --port=8000
```
Backend API sẽ lắng nghe tại: `http://localhost:8000` (Kiểm tra sức khỏe tại: `http://localhost:8000/api/v1/health`).

---

## 4. THIẾT LẬP & KHỞI ĐỘNG FRONTEND (`fe/`)

### 4.1. Cài đặt Dependencies & Môi trường
```bash
cd fe

# 1. Cài đặt các gói npm
npm install

# 2. Tạo file cấu hình môi trường cục bộ
cp .env.example .env.local
```

Nội dung chuẩn trong `fe/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME="Hệ thống Quản lý Phòng khám QLPK"
```

### 4.2. Khởi động Next.js Development Server
```bash
npm run dev
```
Giao diện ứng dụng sẽ khởi động tại: `http://localhost:3000`.

---

## 5. BỘ LỆNH KIỂM THỬ CHUẨN (AUTOMATED TESTING & QUALITY GATES)

Trước khi commit code hoặc tạo pull request, toàn bộ các cổng kiểm tra chất lượng sau đây bắt buộc phải vượt qua (`exit_code == 0`):

### 5.1. Kiểm thử Backend (`be/`)
```bash
cd be

# Chạy toàn bộ Test Suite (chạy cô lập hoàn toàn trên SQLite :memory:)
php artisan test

# Chạy riêng các Feature Test trọng yếu:
php artisan test --filter=DatabaseSchemaTest              # Kiểm tra 30 bảng CSDL
php artisan test --filter=EloquentModelsRelationshipTest  # Kiểm tra 30 Models & Quan hệ
php artisan test --filter=Phase1EndToEndWorkflowTest      # Kiểm tra 4 Luồng E2E liên hoàn

# Kiểm tra định dạng code với Laravel Pint (không tự động sửa)
./vendor/bin/pint --test

# Tự động chuẩn hóa định dạng code theo PSR-12
./vendor/bin/pint
```

### 5.2. Kiểm thử Frontend (`fe/`)
```bash
cd fe

# Kiểm tra chặt chẽ kiểu dữ liệu TypeScript (Strict Mode)
npx tsc --noEmit

# Kiểm tra quy chuẩn mã nguồn ESLint
npm run lint

# Thử nghiệm Build Production Next.js App Router
npm run build
```

---

## 6. QUY TẮC MÃ NGUỒN VÀ BẢO MẬT BẮT BUỘC

1. **Chuẩn JSON Envelope đồng nhất:** Mọi phản hồi API từ Controller/Resource phải tuân theo cấu trúc `{ success, message, data, meta, errors }`.
2. **Khóa dòng và Transaction:** Mọi thao tác khấu trừ số buổi gói dịch vụ (`patient_packages`) hoặc thay đổi trạng thái lượt khám phải được bọc trong `DB::transaction` và sử dụng `lockForUpdate()`.
3. **Bảo mật Hồ sơ Bệnh án:** Tuyệt đối không để lộ thông tin bệnh án (`medical_records`) cho các vai trò phi lâm sàng (Tiếp tân, Thu ngân, Kế toán). API lượt khám chỉ kèm `medical_record` khi người gọi có quyền `medical_records.view`.
4. **Không lưu mật khẩu trong Audit Log:** Khi ghi nhật ký hành động vào bảng `audit_logs`, các trường `password`, `password_hash`, `token`, `remember_token` bắt buộc phải được lọc bỏ (`filterSensitiveKeys`).
5. **Chống trùng lịch khám:** Logic tạo/sửa lịch hẹn khám (`appointments`) phải luôn xác thực không trùng lặp khung giờ của cùng bác sĩ trong ngày đối với các lịch chưa bị hủy.
