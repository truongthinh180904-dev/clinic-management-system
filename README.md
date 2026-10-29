# HỆ THỐNG QUẢN LÝ PHÒNG KHÁM CHUYÊN NGHIỆP (CLINIC MANAGEMENT SYSTEM - QLPK)

Hệ thống quản lý phòng khám đa khoa toàn diện, bao gồm tiếp đón bệnh nhân, bệnh án điện tử (EMR), quản lý tệp y tế (X-quang, PDF), kho dược & vật tư tiêu hao, viện phí & hóa đơn nhiều đợt, sổ quỹ tự động, báo cáo doanh thu & KPI bác sĩ.

---

## 1. YÊU CẦU MÔI TRƯỜNG (PREREQUISITES)

Trước khi bắt đầu, hãy đảm bảo máy tính đã cài đặt các công cụ sau:
* **Git**
* **PHP `^8.3`** kèm các extension: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `curl`.
* **Composer `^2.x`**
* **Node.js `^20.x`** hoặc `^22.x` và **npm `^10.x`**
* **MySQL `8.0`** (Khởi động dịch vụ MySQL trên cổng `3306`)

---

## 2. HƯỚNG DẪN CÀI ĐẶT NHANH (QUICK START)

### Bước 1: Clone mã nguồn từ Git
```bash
git clone <URL_GIT_REPOSITORY>
cd clinic-management-system

# Chuyển sang nhánh dev (nhánh phát triển chính thức):
git checkout dev
```

---

### Bước 2: Cài đặt và Khởi động Backend (`be/`)

```bash
cd be

# 1. Cài đặt các gói phụ thuộc PHP:
composer install

# 2. Tạo file cấu hình môi trường từ file mẫu:
cp .env.example .env

# 3. Tạo Application Key:
php artisan key:generate

# 4. Cấu hình kết nối MySQL trong file .env:
# Mở file .env và chỉnh sửa các thông số sau cho khớp với MySQL máy bạn:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=DBQLPK
# DB_USERNAME=root
# DB_PASSWORD=your_password

# 5. Tạo cơ sở dữ liệu trên MySQL (nếu chưa có):
# mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS DBQLPK CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 6. Chạy migration và seed dữ liệu mẫu ban đầu:
php artisan migrate --seed

# 7. Tạo symbolic link cho thư mục lưu trữ tệp đính kèm:
php artisan storage:link

# 8. Khởi động Backend API Server (chạy tại http://localhost:8000):
php artisan serve
```

---

### Bước 3: Cài đặt và Khởi động Frontend (`fe/`)

Mở một cửa sổ Terminal mới:

```bash
cd fe

# 1. Cài đặt các gói phụ thuộc Node.js:
npm install

# 2. Tạo file cấu hình môi trường Frontend:
cp .env.example .env.local

# 3. Nội dung .env.local mặc định:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
# NEXT_PUBLIC_APP_NAME="Hệ thống Quản lý Phòng khám"

# 4. Khởi động máy chủ Next.js (chạy tại http://localhost:3000):
npm run dev
```

---

## 3. THÔNG TIN ĐĂNG NHẬP MẶC ĐỊNH (DEMO ACCOUNT)

Sau khi khởi động cả Frontend và Backend, truy cập vào trình duyệt: **`http://localhost:3000`**

* **Tài khoản quản trị (Admin):**
  * **Tên đăng nhập:** `admin` (hoặc email `admin@example.com`)
  * **Mật khẩu:** `Admin@123456`
  * **Vai trò:** Quản trị viên tối cao (`ADMIN`), có toàn quyền truy cập tất cả các phân hệ.

---

## 4. LỆNH CHẠY KIỂM THỬ HỆ THỐNG (TESTING COMMANDS)

Để xác nhận môi trường của bạn đã cài đặt hoàn hảo và mã nguồn chạy thông suốt 100%:

### Kiểm thử Backend:
```bash
cd be

# Chạy toàn bộ 285+ bài test tự động (PHPUnit):
php artisan test

# Chạy bài test tích hợp E2E toàn bộ luồng phòng khám:
php artisan test --filter=EndToEndPhase3WorkflowTest

# Kiểm tra chuẩn cú pháp code (Laravel Pint):
./vendor/bin/pint --test
```

### Kiểm thử Frontend:
```bash
cd fe

# Kiểm tra lỗi kiểu dữ liệu TypeScript:
npx tsc --noEmit

# Kiểm tra build đóng gói ứng dụng:
npm run build
```

---

## 5. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
clinic-management-system/
├── be/                             # Backend Laravel 13 (PHP 8.3)
│   ├── app/Http/Controllers/Api/   # 28+ nhóm Controller RESTful API v1
│   ├── app/Models/                 # 30 Eloquent Models quan hệ 3NF
│   ├── database/migrations/        # Migration tạo 30 bảng & Composite Indexes
│   ├── database/seeders/           # Dữ liệu phân quyền RBAC & dữ liệu mẫu
│   └── tests/                      # Bộ kiểm thử PHPUnit tự động
├── fe/                             # Frontend Next.js 16.4 (React 19, Tailwind v4)
│   ├── app/(admin)/                # 28+ trang giao diện quản trị (App Router)
│   ├── components/ui/              # Thư viện shadcn/ui nguyên tử
│   └── lib/                        # Axios client, Auth Context, Data Masking
├── docs/                           # Trọn bộ tài liệu kỹ thuật, API & Vận hành
└── scripts/                        # Kịch bản backup-db.sh & restore-db.sh
```
