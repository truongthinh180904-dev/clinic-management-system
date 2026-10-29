# TÀI LIỆU HƯỚNG DẪN SAO LƯU CƠ SỞ DỮ LIỆU TỰ ĐỘNG (`scripts/backup-db.sh`)
## Feature `F3-08` — Sao lưu, Khôi phục & Quy trình Vận hành | Task `P3-025`

- **Tên tài liệu:** `DATABASE_BACKUP_GUIDE.md`
- **Phiên bản:** `1.0.0`
- **Hệ thống áp dụng:** Hệ thống Quản lý Phòng khám (`clinic-management-system`)
- **Kịch bản thực thi:** [`scripts/backup-db.sh`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/scripts/backup-db.sh)
- **Cơ sở dữ liệu mục tiêu:** MySQL 8.0 InnoDB (`DBQLPK` — 30 bảng quan hệ)
- **Mức độ an toàn:** Chuẩn Enterprise Medical SaaS (Zero Password Exposure in Process Table)

---

## 1. TỔNG QUAN VÀ MỤC TIÊU

Kịch bản [`scripts/backup-db.sh`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/scripts/backup-db.sh) được xây dựng nhằm tự động hóa hoàn toàn quy trình trích xuất, nén, lưu trữ và luân chuyển các bản sao lưu cơ sở dữ liệu cho toàn bộ 30 bảng của hệ thống phòng khám.

### 1.1. Các đặc tính cốt lõi
1. **Toàn vẹn dữ liệu lâm sàng (InnoDB Single-Transaction):**
   Sử dụng cờ `--single-transaction` kết hợp `--quick` của `mysqldump` để tạo bản trích xuất nhất quán mà không khóa bảng (non-locking read), đảm bảo phòng khám vẫn tiếp đón bệnh nhân và lập hóa đơn bình thường trong lúc sao lưu.
2. **Nén Gzip tỷ lệ cao (Gzip Level 9 Streaming):**
   Dữ liệu từ `mysqldump` được truyền qua pipe trực tiếp đến `gzip -9` mà không cần ghi file SQL tạm trung gian, tiết kiệm I/O ổ đĩa và giảm 85–90% dung lượng lưu trữ.
3. **Bảo mật thông tin đăng nhập tuyệt đối (Process Table Masking):**
   Tuyệt đối không truyền tham số `-p` hoặc `--password` trên dòng lệnh. Script khởi tạo tệp cấu hình tạm MySQL (`--defaults-extra-file`) với quyền truy cập khắt khe `0600`, tự động hủy tệp thông qua signal trap ngay khi hoàn tất hoặc gặp lỗi.
4. **Quy tắc luân chuyển và dọn dẹp tự động (Retention Policy):**
   Mặc định lưu giữ các bản sao lưu trong 30 ngày (có thể tùy chỉnh qua biến hoặc tham số `--retention`). Tự động quét và xóa an toàn các bản sao lưu quá hạn.
5. **Chế độ kiểm thử an toàn (Dry-Run Mode):**
   Hỗ trợ cờ `--dry-run` cho phép kiểm tra thông số kết nối, tính khả dụng của công cụ (`mysqldump`, `gzip`), dung lượng ổ cứng khả dụng và chính sách dọn dẹp mà không can thiệp vào cơ sở dữ liệu.

---

## 2. THÔNG SỐ VÀ CẤU TRÚC ĐẶT TÊN

### 2.1. Quy ước đặt tên file sao lưu
Các bản sao lưu được lưu trữ tại thư mục `storage/backups/` theo định dạng chuẩn:
```text
backup_<TÊN_CSDL>_<YYYYMMDD>_<HHMMSS>.sql.gz
```
- **Ví dụ thực tế:** `backup_DBQLPK_20261028_020000.sql.gz`

### 2.2. Nguồn nạp cấu hình CSDL
Kịch bản tự động dò tìm cấu hình kết nối từ các file sau (theo thứ tự ưu tiên):
1. Tham số `--env <path>` hoặc biến môi trường `ENV_FILE`.
2. `be/.env` (Laravel backend environment file).
3. `.env` (Project root environment file).

Các biến môi trường được trích xuất:
- `DB_CONNECTION` (Mặc định: `mysql`)
- `DB_HOST` (Mặc định: `127.0.0.1` / `localhost`)
- `DB_PORT` (Mặc định: `3306`)
- `DB_DATABASE` (Mặc định: `DBQLPK`)
- `DB_USERNAME` (Mặc định: `root`)
- `DB_PASSWORD` (Mật khẩu được che giấu trong mọi log và tiến trình `ps`)

---

## 3. HƯỚNG DẪN CẤU HÌNH CRON JOB TỰ ĐỘNG

Nhằm đảm bảo dữ liệu phòng khám được sao lưu định kỳ hàng ngày vào thời điểm lưu lượng truy cập thấp nhất (02:00 AM), thực hiện cấu hình crontab trên máy chủ:

### 3.1. Mở trình biên tập Cron
```bash
crontab -e
```

### 3.2. Thêm chỉ thị Cron
```cron
# ==============================================================================
# QLPK Automated Database Backup Cron Job
# Lên lịch sao lưu CSDL hàng ngày lúc 02:00 sáng, ghi log vào storage/backups/
# ==============================================================================
0 2 * * * /Users/truongthinh/Documents/UIT/Manage\ Infomation/clinic-management-system/scripts/backup-db.sh >> /Users/truongthinh/Documents/UIT/Manage\ Infomation/clinic-management-system/storage/backups/backup.log 2>&1
```

### 3.3. Xem danh sách Cron Job hiện tại
```bash
crontab -l
```

---

## 4. HƯỚNG DẪN SỬ DỤNG DÒNG LỆNH (CLI)

### 4.1. Cú pháp cơ bản
```bash
bash scripts/backup-db.sh [options]
```

### 4.2. Danh mục tham số hỗ trợ

| Tham số | Viết tắt | Ý nghĩa | Mặc định |
|---|---|---|---|
| `--dry-run` | *(không)* | Chạy thử nghiệm giả lập, kiểm tra pre-flight | Tắt (`0`) |
| `--retention <days>` | `-r` | Số ngày lưu giữ bản sao lưu trước khi dọn dẹp | `30` ngày |
| `--output-dir <path>`| `-o` | Thư mục đích lưu trữ tệp `.sql.gz` | `storage/backups/` |
| `--env <path>` | `-e` | Đường dẫn tùy biến tới tệp cấu hình `.env` | `be/.env` |
| `--verbose` | `-v` | Bật chế độ ghi log chi tiết chẩn đoán | Tắt (`0`) |
| `--help` | `-h` | Hiển thị trợ giúp và cú pháp dòng lệnh | *(không)* |

### 4.3. Các kịch bản sử dụng điển hình

#### Kịch bản 1: Chạy giả lập kiểm tra môi trường (Dry-Run)
```bash
bash scripts/backup-db.sh --dry-run
```
*Kết quả:* Kiểm tra và hiển thị các biến kết nối, đường dẫn tệp, dung lượng ổ đĩa, kiểm tra `mysqldump` & `gzip`, số tệp quá hạn sẽ xóa mà không thực hiện sao lưu thật.

#### Kịch bản 2: Thực hiện sao lưu tức thời (Thủ công trước đợt bảo trì)
```bash
bash scripts/backup-db.sh
```

#### Kịch bản 3: Tăng thời hạn lưu trữ lên 60 ngày
```bash
bash scripts/backup-db.sh --retention 60
```

#### Kịch bản 4: Sao lưu ra ổ cứng gắn ngoài hoặc phân vùng dự phòng
```bash
bash scripts/backup-db.sh --output-dir /mnt/external_backup/qlpk
```

---

## 5. CƠ CHẾ KIỂM TRA TÍNH TOÀN VẸN VÀ BẢO MẬT

1. **Kiểm tra tính hợp lệ của tệp nén (`gzip -t`):**
   Sau khi hoàn tất dump, script lập tức chạy `gzip -t "$BACKUP_FILE"` để kiểm tra header và checksum CRC32 của tệp nén. Nếu phát hiện tệp hỏng hoặc bị đứt đoạn, script lập tức hủy tệp và trả về mã lỗi (`exit 1`).
2. **Quyền truy cập tệp sao lưu (`chmod 600`):**
   Mọi tệp backup được phân quyền `rw-------` (chỉ chủ sở hữu tiến trình sao lưu mới có quyền đọc/ghi), ngăn chặn truy cập trái phép từ các tài khoản người dùng khác trên cùng máy chủ.
3. **Phát hiện dung lượng ổ cứng thấp:**
   Trước khi tiến hành dump, script kiểm tra phân vùng đích với ngưỡng tối thiểu an toàn (50MB). Nếu không đủ dung lượng, script sẽ dừng ngay lập tức kèm thông báo lỗi rõ ràng thay vì làm đầy phân vùng hệ thống.
