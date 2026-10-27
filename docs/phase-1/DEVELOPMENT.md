# DEVELOPMENT GUIDE — HƯỚNG DẪN MÔI TRƯỜNG & KIỂM THỬ (`P1-003`)

Tài liệu chuẩn hóa môi trường phát triển, biến môi trường mẫu và các lệnh kiểm tra cho Backend (`be/`) và Frontend (`fe/`).

---

## 1. Yêu cầu Công cụ
- **PHP**: `^8.3` (kèm extension `pdo_mysql`, `pdo_sqlite`, `mbstring`, `openssl`, `json`)
- **Composer**: `^2.x`
- **Node.js**: `>=20.x` & **npm**: `>=10.x`
- **MySQL**: `8.0+` (Database `DBQLPK`, charset `utf8mb4`, collation `utf8mb4_unicode_ci`)

---

## 2. Cấu hình Môi trường

### 2.1. Backend (`be/`)
- File mẫu: `be/.env.example` (tuyệt đối không lưu mật khẩu thật vào Git).
- Database phát triển: `DBQLPK` trên MySQL (`127.0.0.1:3306`).
- Database kiểm thử tự động (`be/phpunit.xml`): Cô lập hoàn toàn trên SQLite `:memory:` để không bao giờ làm hỏng dữ liệu thật trên `DBQLPK`.
- Endpoint kiểm tra sức khỏe API: `GET /api/v1/health`.

### 2.2. Frontend (`fe/`)
- File mẫu: `fe/.env.example`:
  ```env
  NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
  NEXT_PUBLIC_APP_NAME="Hệ thống Quản lý Phòng khám"
  ```
- Không đặt bất kỳ khóa bí mật nào vào biến có tiền tố `NEXT_PUBLIC_`.

---

## 3. Các lệnh Khởi động, Kiểm thử & Build chuẩn

### 3.1. Backend (`be/`)
```bash
cd be

# Khởi động dev server
php artisan serve --port=8000

# Kiểm tra trạng thái kết nối & migration trên DBQLPK
php artisan db:show
php artisan migrate:status

# Chạy toàn bộ kiểm thử tự động (SQLite :memory:)
php artisan test

# Kiểm tra và chuẩn hóa code style với Laravel Pint
./vendor/bin/pint --test
./vendor/bin/pint
```

### 3.2. Frontend (`fe/`)
```bash
cd fe

# Khởi động Next.js dev server (Turbopack)
npm run dev

# Kiểm tra kiểu dữ liệu TypeScript
npx tsc --noEmit

# Kiểm tra ESLint
npm run lint

# Build production
npm run build
```
