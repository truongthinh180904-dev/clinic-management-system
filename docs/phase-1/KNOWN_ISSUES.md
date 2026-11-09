# GIỚI HẠN KỸ THUẬT & DANH MỤC VẤN ĐỀ TỒN ĐỌNG (KNOWN ISSUES)
## HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK) — GIAI ĐOẠN 1 (PHASE-01)

- **Mã tài liệu:** `KNOWN-ISSUES-PHASE-01`
- **Phiên bản:** `1.0.0`
- **Ngày phát hành:** `2026-10-27`
- **Phạm vi:** Tổng kết hiện trạng hoàn thiện Giai đoạn 1, phân định rõ ranh giới chức năng và chuyển giao sang Giai đoạn 2 & 3.

---

## 1. TỔNG QUAN RANH GIỚI PHẠM VI (SCOPE BOUNDARIES)

Giai đoạn 1 (`PHASE-01`) đã hoàn thành 100% mục tiêu kiến trúc nền tảng và nghiệp vụ khám chữa bệnh cốt lõi:
- Toàn bộ CSDL 30 bảng (`DBQLPK`) và 30 Eloquent Models đã khởi tạo, cấu hình quan hệ đầy đủ.
- Hệ thống định danh, xác thực Laravel Sanctum và phân quyền RBAC đa cấp độ (8 vai trò chuẩn, middleware kiểm soát quyền nguyên tử).
- Quản lý Nhân sự (`employees`), Người dùng (`users`), Bệnh nhân (`patients`) có thuật toán tiền kiểm tra trùng lặp hồ sơ.
- Danh mục Dịch vụ (`services`), Gói dịch vụ (`service_packages`, `package_services`) và Cấp gói cho bệnh nhân (`patient_packages`).
- Quản lý Lịch hẹn (`appointments`) tích hợp thuật toán ngăn chặn trùng lặp khung giờ bác sĩ.
- Tiếp đón Lượt khám (`visits`) tích hợp cơ chế khấu trừ số buổi gói an toàn (`lockForUpdate`) và bảo mật bệnh án (`medical_records`).

Dưới đây là các phân hệ đã có cấu trúc dữ liệu nhưng logic nghiệp vụ chi tiết được chủ động phân bổ theo kế hoạch sang Giai đoạn 2 và Giai đoạn 3:

---

## 2. DANH MỤC CÁC PHÂN HỆ THUỘC GIAI ĐOẠN 2 & GIAI ĐOẠN 3

### 2.1. Phân hệ Tài chính, Hóa đơn & Thu ngân (Chuyển tiếp sang Giai đoạn 2)
- **Bảng CSDL liên quan:** `invoices`, `payments`.
- **Hiện trạng Giai đoạn 1:**
  - Bảng CSDL và Model Eloquent đã sẵn sàng kèm các trường số tiền chuẩn `DECIMAL(15,2)`.
  - Nghiệp vụ lượt khám Phase 1 quản lý trường `total_amount` và `payment_status` (`UNPAID`, `PARTIAL`, `PAID`, `PACKAGED`).
- **Phạm vi thực hiện tại Giai đoạn 2 (`PHASE-02`):**
  - Tạo hóa đơn tự động từ lượt khám và dịch vụ cận lâm sàng.
  - Hỗ trợ thanh toán nhiều đợt (Partial Payments) cho cùng 1 hóa đơn, tự động tính `remaining_amount`.
  - Quản lý công nợ bệnh nhân, in biên lai/hóa đơn thu tiền.

### 2.2. Phân hệ Thu chi, Sổ quỹ & Quản lý Chi phí (Chuyển tiếp sang Giai đoạn 2)
- **Bảng CSDL liên quan:** `expense_categories`, `expenses`, `cash_transactions`.
- **Hiện trạng Giai đoạn 1:**
  - Bảng CSDL và Model Eloquent đã thiết lập quan hệ đa hình `(reference_type, reference_id)`.
- **Phạm vi thực hiện tại Giai đoạn 2 (`PHASE-02`):**
  - Quản lý danh mục loại chi phí và lập phiếu chi có luồng phê duyệt (`approval_status`).
  - Tự động sinh giao dịch sổ quỹ (`cash_transactions`) khi thu tiền hóa đơn hoặc chi quỹ tiền mặt/ngân hàng.
  - Báo cáo đối soát doanh thu thực thu, tiền tồn quỹ cuối ngày.

### 2.3. Phân hệ Kho Dược & Vật tư Y tế (Chuyển tiếp sang Giai đoạn 2)
- **Bảng CSDL liên quan:** `products`, `inventory_transactions`.
- **Hiện trạng Giai đoạn 1:**
  - Bảng CSDL đã chuẩn hóa trường số lượng tồn kho `DECIMAL(15,3)` hỗ trợ chia liều.
- **Phạm vi thực hiện tại Giai đoạn 2 (`PHASE-02`):**
  - Quản lý nhập/xuất kho thuốc, vật tư tiêu hao.
  - Trừ kho tự động khi bác sĩ kê đơn hoặc thực hiện dịch vụ thủ thuật.
  - Cảnh báo tồn kho tối thiểu (`minimum_stock`) và quản lý hạn sử dụng theo lô (Lot / Expiry Date).

### 2.4. Phân hệ Bệnh án Điện tử Nâng cao & Tệp đính kèm (Chuyển tiếp sang Giai đoạn 3)
- **Bảng CSDL liên quan:** `patient_files`, `medical_records` (mở rộng).
- **Hiện trạng Giai đoạn 1:**
  - Bệnh án cơ bản (`medical_records`) đáp ứng đầy đủ: triệu chứng, chẩn đoán, phác đồ điều trị, ghi chú bác sĩ và phân quyền xem chặt chẽ.
- **Phạm vi thực hiện tại Giai đoạn 3 (`PHASE-03`):**
  - Đính kèm tệp kết quả chẩn đoán hình ảnh (X-Quang, Siêu âm, PDF xét nghiệm máu) qua bảng `patient_files`.
  - Mẫu bệnh án chuyên khoa sâu (Răng Hàm Mặt, Da Liễu, Sản Phụ Khoa).
  - Tích hợp chữ ký số bác sĩ và lịch sử chỉnh sửa bệnh án.

### 2.5. Phân hệ Cảnh báo, Phê duyệt & Thông báo tự động (Chuyển tiếp sang Giai đoạn 3)
- **Bảng CSDL liên quan:** `approval_requests`, `alert_rules`, `notifications`.
- **Hiện trạng Giai đoạn 1:**
  - Schema và Model quan hệ đa hình đã kiểm thử tính toàn vẹn.
- **Phạm vi thực hiện tại Giai đoạn 3 (`PHASE-03`):**
  - Động cơ cảnh báo tự động: cảnh báo nợ quá hạn, cảnh báo tồn kho sắp hết, cảnh báo gói sắp hết hạn.
  - Luồng phê duyệt đa cấp (Giám đốc duyệt chi, Trưởng khoa duyệt miễn giảm học phí/dịch vụ).
  - Kênh thông báo qua Webhook/Zalo ZNS/SMS nhắc lịch tái khám cho người bệnh.

---

## 3. CÁC QUYẾT ĐỊNH THIẾT KẾ & GIỚI HẠN KỸ THUẬT (DESIGN DECISIONS)

| Vấn đề | Quyết định thiết kế đã chọn | Lý do & Khuyến nghị kỹ thuật |
|---|---|---|
| **Số điện thoại bệnh nhân trùng nhau** | Không đặt ràng buộc `UNIQUE` cứng trên cột `patients.phone`. Cung cấp API `check-duplicates`. | Nhiều trường hợp người nhà, bố mẹ đăng ký khám cho con nhỏ hoặc người cao tuổi dùng chung một số điện thoại. Ép `UNIQUE` cứng sẽ chặn thao tác tiếp nhận thực tế. |
| **Môi trường kiểm thử tự động** | Chạy toàn bộ Test Suite trên SQLite `:memory:` thay vì MySQL trực tiếp. | SQLite `:memory:` cho tốc độ chạy cực nhanh (~2 giây cho 40+ tests), cách ly 100% không sợ làm ô nhiễm hay hỏng dữ liệu trên `DBQLPK`. Trước khi release production, cần chạy kiểm thử nghiệm thu trên MySQL staging. |
| **Cơ chế cập nhật / xóa dữ liệu** | Khuyến nghị chuyển `status` sang `INACTIVE` thay vì chạy lệnh xóa vật lý `DELETE`. | Giúp bảo tồn toàn vẹn dữ liệu y tế và phục vụ công tác thanh tra/audit sau này. Một số API xóa vẫn cung cấp nhưng được kiểm soát chặn xóa khi đã phát sinh dữ liệu liên quan. |
| **Đồng bộ thời gian thực (Realtime)** | Frontend hiện tại dùng cơ chế Polling và Fetch định kỳ. | Chưa kích hoạt WebSocket/Pusher ở Giai đoạn 1 để giữ kiến trúc tinh gọn, giảm phụ thuộc hạ tầng mạng và chi phí vận hành ban đầu. Sẽ tích hợp Laravel Reverb ở Giai đoạn 3 nếu phòng khám yêu cầu hiển thị số thứ tự chờ trực tiếp trên màn hình TV sảnh tiếp đón. |
| **Khóa dòng dữ liệu (Concurrency)** | Sử dụng `DB::transaction` và `lockForUpdate` trên `patient_packages`. | Ngăn chặn tuyệt đối Race Condition khi hai nhân viên cùng tiếp đón một bệnh nhân và đồng thời bấm trừ buổi gói dịch vụ. |

---

## 4. TỔNG KẾT & TRẠNG THÁI SẴN SÀNG

Toàn bộ 4 tài liệu kỹ thuật cốt lõi của Giai đoạn 1 đã được xây dựng đồng bộ, chính xác và bám sát kiến trúc thực thi:
1. `API_DOCUMENTATION.md`: Đặc tả chi tiết từng endpoint, mã trạng thái, header, tham số và phân quyền.
2. `DATABASE_DESIGN.md`: Chi tiết thiết kế toàn bộ 30 bảng, quy tắc độ chính xác tiền tệ, khóa ngoại và chỉ mục.
3. `DEVELOPMENT.md`: Hướng dẫn thiết lập môi trường chuẩn, các lệnh chạy Backend/Frontend và các cổng kiểm thử chất lượng.
4. `KNOWN_ISSUES.md`: Làm rõ ranh giới kỹ thuật, giải thích các quyết định kiến trúc và lộ trình triển khai chi tiết cho Giai đoạn 2 và Giai đoạn 3.

Tài liệu hoàn toàn tuân thủ tiêu chí an toàn thông tin: không chứa bất kỳ secret, mật khẩu hay token bảo mật nào.
Sẵn sàng bước vào task nghiệm thu cuối cùng `P1-030`.
