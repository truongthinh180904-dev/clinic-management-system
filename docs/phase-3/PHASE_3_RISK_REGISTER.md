# SỔ ĐĂNG KÝ QUẢN TRỊ RỦI RO GIAI ĐOẠN 3 (`PHASE_3_RISK_REGISTER.md`)
## Nhận diện, Đánh giá Ma trận Rủi ro và Kế hoạch Ứng phó Kỹ thuật - Nghiệp vụ - Vận hành

- **Mã tài liệu:** `docs/phase-3/PHASE_3_RISK_REGISTER.md`
- **Phiên bản:** `1.0.0`
- **Giai đoạn áp dụng:** `PHASE-03`
- **Mục tiêu:** Nhận diện toàn diện các nguy cơ tiềm ẩn về kỹ thuật, toàn vẹn dữ liệu, hiệu năng hệ thống, an ninh thông tin và vận hành hạ tầng; xác lập các biện pháp phòng ngừa và kế hoạch dự phòng cụ thể cho từng rủi ro.

---

## 1. MA TRẬN PHÂN LOẠI MỨC ĐỘ RỦI RO (RISK MATRIX)

| Xác suất \ Tác động | Thấp (Low) | Trung bình (Medium) | Cao (High) | Nghiêm trọng (Critical) |
|---|---|---|---|---|
| **Cao (High)** | Vừa (Medium) | Cao (High) | Nghiêm trọng (Critical) | **Cực kỳ nghiêm trọng (Severe)** |
| **Trung bình (Medium)** | Thấp (Low) | Vừa (Medium) | Cao (High) | **Nghiêm trọng (Critical)** |
| **Thấp (Low)** | Rất thấp (Very Low) | Thấp (Low) | Vừa (Medium) | **Cao (High)** |

---

## 2. BẢNG CHI TIẾT SỔ ĐĂNG KÝ RỦI RO GIAI ĐOẠN 3

| Mã Rủi ro | Lĩnh vực | Mô tả Nguy cơ Tiềm ẩn | Xác suất | Tác động | Cấp độ | Dấu hiệu Nhận biết (Trigger) | Biện pháp Phòng ngừa (Mitigation) | Kế hoạch Ứng phó (Contingency) |
|---|---|---|---|---|---|---|---|---|
| **`RSK-01`** | **Bảo mật** | Tải lên tệp độc hại giả dạng tệp y tế (webshell, mã độc thực thi) qua API `patient_files`. | Trung bình | Nghiêm trọng | **Nghiêm trọng** | Tệp có đuôi kép (`.php.jpg`) hoặc MIME type không khớp phần mở rộng. | Kiểm tra MIME type thực tế bằng `mime_content_type()`, chỉ cho phép whitelist (`jpg, jpeg, png, pdf, dicom`), đổi tên file ngẫu nhiên (UUID), lưu ngoài thư mục web public. | Khóa ngay tài khoản tải lên, xóa tệp nghi vấn khỏi disk, ghi log cảnh báo an ninh P0. |
| **`RSK-02`** | **Toàn vẹn Dữ liệu** | Xung đột đồng thời (Race Condition) khi chuyển Lịch hẹn sang Lượt khám dẫn đến sinh 2 lượt khám cho cùng 1 lịch. | Thấp | Cao | **Vừa** | Bệnh nhân xuất hiện 2 lần trong danh sách chờ khám cùng một khung giờ. | Bọc logic tiếp nhận trong `DB::transaction()` kết hợp `lockForUpdate()` trên bảng `appointments`. Kiểm tra `whereNull('visit_id')` trước khi tạo. | Rollback transaction, trả về thông báo lỗi 409 Conflict cho request gửi sau. |
| **`RSK-03`** | **Giao diện / UX** | Bảng dữ liệu tiếp tục bị vỡ hoặc dồn cột trên các màn hình đặc thù sau khi áp dụng CSS. | Trung bình | Vừa | **Vừa** | Cột tiêu đề bị ngắt dòng 2 hàng, thanh cuộn ngang không xuất hiện khi co nhỏ trình duyệt. | Sử dụng chuẩn chung: bọc bảng trong `<div className="overflow-x-auto">` với `min-w-[900px]`, đặt `whitespace-nowrap` cho toàn bộ header và cột ngắn. | Kiểm tra lại responsive trên Chrome DevTools ở các kích thước 1280px, 1366px, 1440px. |
| **`RSK-04`** | **Cơ sở Dữ liệu** | Lỗi tạo Composite Index làm khóa bảng (Table Lock) gây gián đoạn truy vấn trên môi trường thật. | Thấp | Nghiêm trọng | **Cao** | Lệnh migrate bị treo lâu hoặc API bị timeout khi chạy migration. | Viết migration có kiểm tra tồn tại index (`hasTable`, `hasIndex`), chạy kiểm thử trước bằng `php artisan migrate --pretend`. | Huỷ tiến trình migrate, rollback migration, áp dụng index vào khung giờ thấp điểm. |
| **`RSK-05`** | **Vận hành / Backup** | Script khôi phục CSDL (`scripts/restore-db.sh`) vô tình ghi đè phá hủy dữ liệu sản xuất đang chạy. | Rất thấp | Thảm họa | **Nghiêm trọng** | Thực thi lệnh restore mà không có tham số xác nhận rõ ràng. | Script bắt buộc yêu cầu cờ `--confirm-destructive`, kiểm tra tên database đích; mặc định chế độ dry-run chạy trên `DBQLPK_TEST_RESTORE`. | Phục hồi từ bản sao lưu gần nhất lưu tại thư mục sao lưu độc lập. |
| **`RSK-06`** | **Hạ tầng / Quota** | Mô hình AI hết hạn ngạch (Quota Exhausted) làm gián đoạn kịch bản tự động chạy đêm. | Cao | Vừa | **Cao** | Log xuất hiện mã lỗi `429 Too Many Requests` hoặc `RESOURCE_EXHAUSTED`. | Chuyển cấu hình Reviewer sang Claude (`claude-sonnet-5-5-high`) và Fallback sang GPT (`gpt-oss-120b-medium`), cấu hình `QUOTA_BACKOFF_SECONDS=900`. | Framework tự động chuyển model fallback mà không hủy bỏ phiên làm việc, lưu giữ nguyên trạng working tree. |
| **`RSK-07`** | **Hiệu năng** | Tải chậm trang Lịch sử khám và Bệnh án do truy vấn đệ quy hoặc N+1 Query giữa Patient -> Visits -> MedicalRecords. | Trung bình | Vừa | **Vừa** | Thời gian phản hồi API chi tiết bệnh nhân vượt quá 500ms. | Luôn áp dụng Eager Loading có chọn lọc: `with(['visits' => fn($q) => $q->latest()->limit(20), 'visits.medicalRecord', 'visits.doctor'])`. | Sử dụng Laravel Debugbar / Clockwork kiểm tra số lượng câu truy vấn SQL thực tế. |
| **`RSK-08`** | **Quyền riêng tư (HIPAA/GDPR)** | Nhân viên không phận sự (Lễ tân, Thu ngân) đọc được chẩn đoán chi tiết hoặc tải tệp X-quang/bệnh án nhạy cảm. | Thấp | Nghiêm trọng | **Nghiêm trọng** | Màn hình tiếp đón vô tình hiển thị trường chẩn đoán và phác đồ điều trị. | Phân tách rành mạch: Middleware `permission:medical_records.view` và `patient_files.view` chặn ở cấp API; Frontend ẩn toàn bộ tab lâm sàng đối với tài khoản phi y tế. | Thu hồi quyền truy cập trái phép, ghi nhận nhật ký kiểm toán trong `audit_logs`. |
| **`RSK-09`** | **Toàn vẹn Nghiệp vụ** | Lệch đối soát dòng tiền giữa Sổ quỹ (`cash_transactions`) và Hóa đơn (`invoices`) khi thu ngân nhập trùng hoặc thao tác đồng thời. | Thấp | Cao | **Vừa** | Số dư tiền mặt hoặc báo cáo tài chính không khớp tổng doanh thu thu được. | Sử dụng `lockForUpdate()` trên `invoices`, kiểm tra chặt chẽ `remaining_amount`, tạo `CashTransaction` loại `IN` trong cùng một `DB::transaction()`. | Rollback transaction, đối soát tự động qua `PaymentController` và `CashTransactionController`. |
| **`RSK-10`** | **Toàn vẹn Kho Dược** | Xuất thuốc vượt quá tồn kho thực tế khi kê đơn đồng thời trong giờ cao điểm. | Thấp | Cao | **Vừa** | Sản phẩm rơi vào trạng thái số lượng âm hoặc báo cáo tồn kho bị sai lệch. | Áp dụng khóa bi quan trên bảng `products` khi thực hiện xuất kho (`InventoryTransactionController`), tính toán số lượng khả dụng tức thời trước khi commit. | Hủy giao dịch xuất, trả lỗi 422 cảnh báo hết hàng kèm danh mục thuốc thiếu. |

---

## 3. CƠ CHẾ GIÁM SÁT VÀ XỬ LÝ SỰ CỐ TRONG QUÁ TRÌNH CHẠY TỰ ĐỘNG

1. **Giám sát tải hệ thống (System Resource Watchdog):**
   - Giới hạn tải CPU trên mỗi core: `CPU_LOAD_PER_CORE_LIMIT=1.8` (đã hiệu chỉnh theo máy Mac của người dùng).
   - Dung lượng RAM tối thiểu: 15% RAM trống. Khi bộ nhớ dưới ngưỡng, framework tự động tạm dừng 300s để bảo vệ hệ điều hành.
2. **Cơ chế dừng khẩn cấp (Emergency Stop Gate):**
   - Người dùng có thể dừng kịch bản bất kỳ lúc nào bằng cách tạo file:
     ```bash
     touch qlpk-autonomous-framework/.agy-state/STOP
     ```
   - Framework sẽ kết thúc task hiện tại an toàn, commit code sạch sẽ và dừng lại ngay lập tức mà không để lại rác tiến trình.
3. **Cơ chế phục hồi sau sự cố mạng (Network Resilience):**
   - Tự động thử lại tối đa 3 lần với thuật toán Exponential Backoff + Jitter khi gặp sự cố ngắt kết nối mạng hoặc timeout.
