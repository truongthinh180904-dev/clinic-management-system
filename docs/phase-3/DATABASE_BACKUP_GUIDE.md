# HƯỚNG DẪN SAO LƯU CƠ SỞ DỮ LIỆU TỰ ĐỘNG & CẤU HÌNH CRON JOB
## Feature `F3-08` — Task `P3-025`: Automated Database Backup with Gzip Compression & Retention

- **Hệ thống:** Quản lý Phòng Khám Đa Khoa (QLPK)
- **Tập lệnh sao lưu:** [`scripts/backup-db.sh`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/scripts/backup-db.sh)
- **Cơ sở dữ liệu mục tiêu:** `DBQLPK` (Toàn bộ cấu trúc và dữ liệu 30 bảng MySQL)
- **Định dạng lưu trữ:** SQL nén `gzip` (`.sql.gz`)
- **Thư mục lưu trữ mặc định:** `storage/backups/`
- **Chính sách lưu trữ mặc định:** 30 ngày (Retention: 30 days)

---

## 1. TỔNG QUAN VÀ NGUYÊN TẮC THIẾT KẾ

Tập lệnh [`scripts/backup-db.sh`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/scripts/backup-db.sh) được xây dựng tuân thủ nghiêm ngặt các tiêu chuẩn an toàn dữ liệu y tế và vận hành hệ thống cấp doanh nghiệp:

1. **Đọc cấu hình động từ `.env`:**
   - Tự động dò tìm và nạp thông tin kết nối từ `be/.env` (hoặc `.env` tại thư mục gốc dự án).
   - Tuyệt đối không hardcode mật khẩu hay thông số nhạy cảm trong mã nguồn script.
   - Hỗ trợ các biến cấu hình: `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_SOCKET`.

2. **Bảo mật thông tin xác thực chống lộ vết (Process Masking):**
   - Mật khẩu MySQL **không bao giờ** được truyền trực tiếp qua cờ dòng lệnh (`-p` hoặc `--password=`).
   - Sử dụng tệp tùy chọn tạm thời có cấp quyền nghiêm ngặt `chmod 600` thông qua cờ `--defaults-extra-file`.
   - Ngăn chặn hoàn toàn việc rò rỉ thông tin đăng nhập khi người dùng khác hoặc công cụ giám sát kiểm tra bảng tiến trình hệ thống qua lệnh `ps aux`, `top` hoặc `/proc/*/cmdline`.
   - Cơ chế bẫy tín hiệu (`trap cleanup EXIT INT TERM`) bảo đảm tệp cấu hình tạm thời lập tức được xóa bỏ sau khi hoàn thành hoặc khi script bị ngắt đột ngột.

3. **Nén Stream Trực tiếp Gzip Cấp độ 9 (`gzip -9`):**
   - Luồng dữ liệu xuất từ `mysqldump` được truyền qua pipe (`|`) trực tiếp vào tiến trình `gzip -9` mà không ghi tệp trung gian không nén lên đĩa.
   - Tiết kiệm 80% – 90% dung lượng lưu trữ so với tệp `.sql` thô.
   - Kiểm tra tính toàn vẹn của tệp nén ngay sau khi xuất bằng lệnh `gzip -t`.

4. **Kiểm tra trước khi thực thi (Pre-flight Checks):**
   - Kiểm tra dung lượng trống của phân vùng đĩa trước khi trích xuất (yêu cầu tối thiểu 50MB dung lượng khả dụng).
   - Kiểm tra sự hiện diện của các công cụ bắt buộc (`mysqldump`, `gzip`, `df`).
   - Hỗ trợ chế độ chạy thử nghiệm `--dry-run` để kiểm chứng toàn bộ thông số mà không tác động dữ liệu.

5. **Tự động áp dụng chính sách lưu trữ (Retention Policy):**
   - Tự động dò tìm và xóa các bản sao lưu cũ vượt quá số ngày quy định (mặc định 30 ngày).
   - Cho phép điều chỉnh linh hoạt số ngày lưu trữ thông qua tham số `--retention <days>`.

---

## 2. QUY CÁCH ĐẶT TÊN BẢN SAO LƯU

Mỗi bản sao lưu được lưu trữ theo cấu trúc tên định danh thời gian chuẩn:
```text
backup_${DB_DATABASE}_${TIMESTAMP}.sql.gz
```

**Ví dụ:**
- `backup_DBQLPK_20261029_020000.sql.gz` (Bản sao lưu ngày 29/10/2026 lúc 02:00:00 AM)
- `backup_DBQLPK_20261030_020000.sql.gz` (Bản sao lưu ngày 30/10/2026 lúc 02:00:00 AM)

Phân quyền tệp sao lưu tự động được gán ở mức `chmod 600` (chỉ cho phép user sở hữu đọc và ghi, ngăn chặn truy cập trái phép từ các tiến trình khác trên máy chủ).

---

## 3. HƯỚNG DẪN CẤU HÌNH CRON JOB TRÊN MÁY CHỦ

### 3.1. Mở Trình Quản Lý Crontab
Đăng nhập vào máy chủ bằng tài khoản vận hành (`deploy` hoặc `root`) và mở trình soạn thảo crontab:
```bash
crontab -e
```

### 3.2. Cấu hình Sao lưu Định kỳ Hàng ngày (Khuyến nghị: 02:00 AM)
Thời điểm 02:00 AM là khung giờ thấp điểm của phòng khám, hạn chế ảnh hưởng đến hiệu năng truy vấn của người dùng. Thêm dòng sau vào crontab:

```cron
# ==============================================================================
# QLPK Automated Database Backup (Daily at 02:00 AM)
# ==============================================================================
PATH=/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin
0 2 * * * "/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/scripts/backup-db.sh" >> "/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/storage/backups/backup.log" 2>&1
```

> [!NOTE]
> Đường dẫn có khoảng trắng (ví dụ `Manage Infomation`) **bắt buộc phải bọc trong dấu ngoặc kép** `"` để trình lập lịch Cron không phân tách sai đối số.

### 3.3. Các Lịch Trình Cron Thay Thế Phù Hợp với Quy Mô

1. **Sao lưu 2 lần/ngày (Khung giờ trưa và đêm):**
   ```cron
   0 12,2 * * * "/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/scripts/backup-db.sh" >> "/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/storage/backups/backup.log" 2>&1
   ```

2. **Sao lưu hàng ngày với thời gian lưu trữ 60 ngày:**
   ```cron
   0 2 * * * "/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/scripts/backup-db.sh" --retention 60 >> "/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/storage/backups/backup.log" 2>&1
   ```

3. **Sao lưu sang thư mục gắn kết bên ngoài (NFS / External Volume / NAS):**
   ```cron
   0 2 * * * "/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/scripts/backup-db.sh" --output-dir "/mnt/nas-backup/qlpk" >> "/mnt/nas-backup/qlpk/backup.log" 2>&1
   ```

### 3.4. Kiểm Tra Danh Sách Crontab Đã Lưu
```bash
crontab -l
```

---

## 4. HƯỚNG DẪN SỬ DỤNG LỆNH DÒNG LỆNH (CLI REFERENCE)

### 4.1. Cú pháp cơ bản
```bash
./scripts/backup-db.sh [options]
# hoặc
bash scripts/backup-db.sh [options]
```

### 4.2. Bảng Tùy Chọn Đầy Đủ

| Tham số | Dạng ngắn | Mặc định | Ý nghĩa & Tác vụ |
|---|---|---|---|
| `--dry-run` | | `tắt` | Mô phỏng quá trình sao lưu, kiểm tra công cụ, cấu hình và dung lượng ổ đĩa mà không tác động dữ liệu |
| `--retention <days>` | `-r <days>` | `30` | Số ngày lưu trữ các bản sao lưu. Tệp cũ hơn sẽ tự động bị xóa |
| `--output-dir <path>` | `-o <path>` | `storage/backups` | Thư mục đích lưu trữ các tệp `.sql.gz` |
| `--env <path>` | `-e <path>` | `be/.env` | Đường dẫn chỉ định tới tệp `.env` |
| `--database <name>` | `--db <name>` | Lấy từ `.env` (`DBQLPK`) | Chỉ định tên CSDL cần trích xuất |
| `--host <host>` | | Lấy từ `.env` (`127.0.0.1`) | Chỉ định máy chủ MySQL |
| `--port <port>` | | Lấy từ `.env` (`3306`) | Chỉ định cổng kết nối MySQL |
| `--user <user>` | `-u <user>` | Lấy từ `.env` (`root`) | Tên người dùng MySQL |
| `--verbose` | `-v` | `tắt` | Hiển thị nhật ký chẩn đoán chi tiết |
| `--help` | `-h` | | Hiển thị màn hình hướng dẫn trợ giúp |

### 4.3. Các Ví Dụ Lệnh Thực Tế

#### 1. Chạy thử nghiệm kiểm chứng môi trường (`--dry-run`)
```bash
./scripts/backup-db.sh --dry-run
```
**Kết quả đầu ra mẫu:**
```text
================================================================================
  QLPK AUTOMATED DATABASE BACKUP — PRE-FLIGHT / DRY-RUN SIMULATION
================================================================================
[2026-10-29 02:00:00] [INFO] Mode: DRY-RUN (No files will be modified or database queries executed)
[2026-10-29 02:00:00] [INFO] Project Root: /Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system
[2026-10-29 02:00:00] [INFO] Environment File: .../be/.env
[2026-10-29 02:00:00] [INFO] Database Driver: mysql
[2026-10-29 02:00:00] [INFO] Database Host: localhost (Target: 127.0.0.1)
[2026-10-29 02:00:00] [INFO] Database Port: 3306
[2026-10-29 02:00:00] [INFO] Database Name: DBQLPK
[2026-10-29 02:00:00] [INFO] Database User: root
[2026-10-29 02:00:00] [INFO] Database Password: ****** [REDACTED / MASKED FROM PROCESS LIST]
[2026-10-29 02:00:00] [INFO] Backup Directory: .../storage/backups
[2026-10-29 02:00:00] [INFO] Retention Policy: 30 days
[2026-10-29 02:00:00] [INFO] Simulated Backup Filename: backup_DBQLPK_20261029_020000.sql.gz
[2026-10-29 02:00:00] [INFO] Tool check [gzip]: PASS (/usr/bin/gzip)
[2026-10-29 02:00:00] [INFO] Tool check [mysqldump]: PASS (/usr/local/bin/mysqldump)
[2026-10-29 02:00:00] [INFO] Disk space check: PASS
[2026-10-29 02:00:00] [INFO] Retention check: Found 0 backup files older than 30 days to be purged.
[2026-10-29 02:00:00] [SUCCESS] Dry-run verification completed successfully. All pre-flight checks passed.
```

#### 2. Kích hoạt sao lưu thủ công tức thời
```bash
./scripts/backup-db.sh
```

#### 3. Sao lưu với thời gian lưu trữ dài hạn (90 ngày)
```bash
./scripts/backup-db.sh --retention 90
```

#### 4. Sao lưu CSDL sang thư mục lưu trữ ngoài
```bash
./scripts/backup-db.sh --output-dir /Volumes/SecureStorage/ClinicBackups
```

---

## 5. KIỂM TRA NHẬT KÝ & GIÁM SÁT BẢN SAO LƯU

### 5.1. Xem Nhật Ký Sao Lưu (Log File)
```bash
tail -n 50 storage/backups/backup.log
```

### 5.2. Kiểm Tra Tính Toàn Vẹn Của Một Bản Sao Lưu Cụ Thể
Sử dụng cờ `-t` của `gzip` để giải nén thử trong bộ nhớ mà không ghi tệp ra đĩa:
```bash
gzip -t storage/backups/backup_DBQLPK_20261029_020000.sql.gz
echo $?
# Kết quả trả về 0: Tệp hoàn toàn nguyên vẹn, không bị hỏng cấu trúc nén.
```

### 5.3. Xem Xem Trước Một Phần Dữ Liệu Mà Không Giải Nén Toàn Bộ Tệp
```bash
zcat storage/backups/backup_DBQLPK_20261029_020000.sql.gz | head -n 40
```

---

## 6. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

| Hiện tượng | Nguyên nhân có thể | Cách khắc phục |
|---|---|---|
| `mysqldump utility is required but not found in PATH` | Đường dẫn `mysqldump` chưa nằm trong biến `PATH` của shell hoặc Cron | Bổ sung `PATH=/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$PATH` vào đầu Crontab hoặc file `.bashrc` / `.zshrc` |
| `Low disk space on storage/backups: only X MB available` | Phân vùng ổ đĩa chứa thư mục sao lưu còn dưới 50MB dung lượng khả dụng | Dọn dẹp bớt dung lượng đĩa hoặc chỉ định `--output-dir` sang phân vùng khác có dung lượng lớn hơn |
| `mysqldump execution failed for database DBQLPK` | Mật khẩu MySQL không chính xác hoặc dịch vụ MySQL bị tắt | Kiểm tra lại thông tin `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` trong `be/.env`; đảm bảo service MySQL đang chạy |
| Cron job không tự động chạy | Đường dẫn crontab bị lỗi phân tách do dấu cách trong tên thư mục | Bọc toàn bộ đường dẫn tập lệnh và đường dẫn log trong dấu ngoặc kép `"` như hướng dẫn mục 3.2 |

---

## 7. LIÊN KẾT TÁC VỤ KẾ TIẾP

Bản sao lưu tạo bởi `scripts/backup-db.sh` được đồng bộ chuẩn định dạng để phục vụ việc khôi phục nhanh thông qua:
- **Task `P3-026`:** Script khôi phục an toàn [`scripts/restore-db.sh`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/scripts/restore-db.sh) kèm chế độ kiểm thử dry-run trên database độc lập.
- **Tài liệu Khôi phục Thảm họa:** `docs/phase-3/DISASTER_RECOVERY_RUNBOOK.md`.
