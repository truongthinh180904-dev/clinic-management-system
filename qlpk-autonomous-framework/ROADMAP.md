# ROADMAP & DANH SÁCH TASK GIAI ĐOẠN 3 (`PHASE-03`) — HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK)
## Chuẩn hóa UI/UX Toàn diện, Bệnh án Điện tử, Quản lý Tệp Y tế, Báo cáo Nâng cao, Tối ưu & Vận hành

- **Mã giai đoạn:** `PHASE-03`
- **Tài liệu đối chiếu Giai đoạn 1 & 2:**
  - Giai đoạn 1 Archive: [`docs/phase-1/PHASE_1_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_REPORT.md), [`docs/phase-1/DATABASE_DESIGN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/DATABASE_DESIGN.md)
  - Giai đoạn 2 Archive: [`docs/phase-2/PHASE_2_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_REPORT.md), [`qlpk-autonomous-framework/ROADMAP-PHASE-2-ARCHIVE.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/qlpk-autonomous-framework/ROADMAP-PHASE-2-ARCHIVE.md)
- **Báo cáo Audit Giai đoạn 3:** [`docs/phase-3/PHASE_3_AUDIT_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-3/PHASE_3_AUDIT_REPORT.md)
- **Kế hoạch triển khai & Quản trị rủi ro:** [`docs/phase-3/PHASE_3_IMPLEMENTATION_PLAN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-3/PHASE_3_IMPLEMENTATION_PLAN.md), [`docs/phase-3/PHASE_3_RISK_REGISTER.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-3/PHASE_3_RISK_REGISTER.md)
- **Tổng số Feature Giai đoạn 3:** `10 Features` (`F3-01` → `F3-10`)
- **Tổng số Task Giai đoạn 3:** `30 Tasks` (`P3-001` → `P3-030`)
- **Cấu hình Model Định tuyến:**
  - Planner: `claude-sonnet-5-5-high`
  - Coder: `gemini-3.8-flash-high`
  - Reviewer: `claude-sonnet-5-5-high`
  - Tester & Fallback: `gpt-oss-120b-medium`
- **Quy tắc bất biến:**
  1. Không chạy lệnh phá hủy dữ liệu (`migrate:fresh`, `migrate:reset`, `db:wipe`).
  2. Mọi bảng dữ liệu trên Frontend phải có `overflow-x-auto` và `whitespace-nowrap` cho các cột ngắn/mã/ngày/trạng thái, tuyệt đối không để dồn cột vỡ giao diện.
  3. Mọi thao tác y tế lâm sàng (`MedicalRecord`) phải bảo đảm tính toàn vẹn, có audit trail, tuyệt đối không để AI tự ý chẩn đoán hoặc kê đơn.
  4. Mọi commit được ghi nhận tự động trên branch `dev`.

---

## BẢNG ÁNH XẠ 10 FEATURES (`F3-01` → `F3-10`) SANG 30 TASKS (`P3-001` → `P3-030`)

| Feature | Nội dung cốt lõi | Danh sách Tasks | Kết quả đầu ra |
|---|---|---|---|
| **`F3-01`** | Audit toàn bộ hệ thống | `P3-001`, `P3-002`, `P3-003` | Báo cáo audit CSDL, API, UI và trọn bộ tài liệu hoạch định Phase 3 |
| **`F3-02`** | Chuẩn hóa UI/UX toàn hệ thống | `P3-004`, `P3-005`, `P3-006`, `P3-007`, `P3-008`, `P3-009` | Bảng không dồn cột, form nhất quán, modal chuẩn `shadcn/ui`, responsive & báo cáo UI |
| **`F3-03`** | Hồ sơ bệnh nhân & Bệnh án điện tử | `P3-010`, `P3-011`, `P3-012` | Clinical Timeline, màn hình khám chuyên môn cho bác sĩ, audit trail lịch sử sửa |
| **`F3-04`** | Quy trình Lịch hẹn & Tiếp đón | `P3-013`, `P3-014`, `P3-015` | Chuẩn hóa máy trạng thái lịch hẹn, tiếp đón nhanh lễ tân, check-in nguyên tử |
| **`F3-05`** | Quản lý tệp đính kèm y tế | `P3-016`, `P3-017`, `P3-018` | Backend API upload an toàn (`patient_files`), API stream tải/xem tệp, UI xem trước X-quang |
| **`F3-06`** | Báo cáo & Biểu đồ chuyên nghiệp | `P3-019`, `P3-020`, `P3-021` | Donut Chart cơ cấu, Bar Chart so sánh KPI bác sĩ, Area Chart xu hướng 12 tháng |
| **`F3-07`** | Bảo mật, Phân quyền & Kiểm toán | `P3-022`, `P3-023`, `P3-024` | RBAC hồ sơ y tế, Audit Log truy vết xem dữ liệu nhạy cảm, Data Masking & Rate Limit |
| **`F3-08`** | Sao lưu, Khôi phục & Vận hành | `P3-025`, `P3-026` | Script `backup-db.sh`, script `restore-db.sh` kèm dry-run và sổ tay vận hành |
| **`F3-09`** | Tối ưu hiệu năng & Truy vấn | `P3-027`, `P3-028` | Composite Indexes MySQL bảng lớn, triệt tiêu N+1 Query Eloquent, tối ưu phân trang |
| **`F3-10`** | Kiểm thử tích hợp & Bàn giao | `P3-029`, `P3-030` | E2E Integration Test toàn bộ luồng nghiệp vụ, nghiệm thu toàn diện và báo cáo bàn giao |

---

## CHI TIẾT 30 TASKS GIAI ĐOẠN 3 (`P3-001` → `P3-030`)

---

# FEATURE `F3-01` — AUDIT TOÀN BỘ HỆ THỐNG

### TASK `P3-001` (`F3-01-01` / `F3-01-02` / `F3-01-03`): Khảo sát Git, Schema 30 Bảng MySQL và Danh mục API Backend
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P2-030`
- **goal:** Khảo sát chi tiết hiện trạng mã nguồn, đối chiếu schema thực tế của 30 bảng MySQL trên `DBQLPK` với Eloquent models và 28 API controller groups; lập báo cáo audit kỹ thuật tại `docs/phase-3/PHASE_3_AUDIT_REPORT.md`.
- **scope:** `be/app/Models/*`, `be/app/Http/Controllers/Api/V1/*`, `be/routes/api.php`, `docs/phase-3/PHASE_3_AUDIT_REPORT.md`.
- **deliverables:**
  - `docs/phase-3/PHASE_3_AUDIT_REPORT.md`
- **test_commands:**
  - `test -f "docs/phase-3/PHASE_3_AUDIT_REPORT.md"`
  - `grep -Fq "BÁO CÁO AUDIT TOÀN BỘ HỆ THỐNG GIAI ĐOẠN 3" docs/phase-3/PHASE_3_AUDIT_REPORT.md`

### TASK `P3-002` (`F3-01-04` / `F3-01-05`): Khảo sát Frontend UI/UX, Bảng dữ liệu và Kiểm chứng Test Suites Hiện có
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-001`
- **goal:** Rà soát toàn bộ các trang frontend trong `fe/app/(admin)/`, ghi nhận chi tiết hiện tượng dồn cột bảng, các form chưa đồng bộ validation, kiểm chứng kết quả chạy test suites thực tế (PHPUnit, Pint, Next.js build).
- **scope:** `fe/app/(admin)/*`, `docs/phase-3/PHASE_3_AUDIT_REPORT.md`.
- **deliverables:**
  - Cập nhật mục 4 và mục 5 trong `docs/phase-3/PHASE_3_AUDIT_REPORT.md`.
- **test_commands:**
  - `cd be && php artisan test`
  - `test -f "docs/phase-3/PHASE_3_AUDIT_REPORT.md"`

### TASK `P3-003` (`F3-01-06` / `F3-01-07`): Thẩm tra Logic Nghiệp vụ Tiềm ẩn & Hoàn tất Bộ Tài liệu Hoạch định Phase 3
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-002`
- **goal:** Kiểm tra logic liên kết giữa Thanh toán, Sổ quỹ, Công nợ, Lượt khám, Kho dược và Bệnh án; hoàn thiện trọn bộ 4 tài liệu hoạch định Phase 3 (`PHASE_3_AUDIT_REPORT.md`, `PHASE_3_TASKS.md`, `PHASE_3_IMPLEMENTATION_PLAN.md`, `PHASE_3_RISK_REGISTER.md`).
- **scope:** `docs/phase-3/*`, `qlpk-autonomous-framework/ROADMAP.md`, `qlpk-autonomous-framework/PROGRESS.md`.
- **deliverables:**
  - `docs/phase-3/PHASE_3_TASKS.md`
  - `docs/phase-3/PHASE_3_IMPLEMENTATION_PLAN.md`
  - `docs/phase-3/PHASE_3_RISK_REGISTER.md`
- **test_commands:**
  - `test -f "docs/phase-3/PHASE_3_TASKS.md"`
  - `test -f "docs/phase-3/PHASE_3_IMPLEMENTATION_PLAN.md"`
  - `test -f "docs/phase-3/PHASE_3_RISK_REGISTER.md"`

---

# FEATURE `F3-02` — CHUẨN HÓA UI/UX TOÀN HỆ THỐNG

### TASK `P3-004` (`F3-02-01`): Chuẩn hóa Bảng Dữ liệu Toàn Hệ thống Chống Dồn Cột và Vỡ Bố Cục
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-003`
- **goal:** Khắc phục triệt để tình trạng tiêu đề cột và nội dung bị xuống dòng 2-3 hàng; bọc bảng trong container có `overflow-x-auto`, thiết lập độ rộng cột hợp lý, áp dụng `whitespace-nowrap` cho các cột ngắn (Mã, Ngày giờ, Trạng thái, Thao tác), nội dung dài có tooltip/ellipsis, và bố trí nút thao tác không bị chồng lấn.
- **scope:**
  - `fe/app/(admin)/patients/page.tsx`
  - `fe/app/(admin)/invoices/page.tsx`
  - `fe/app/(admin)/debts/page.tsx`
  - `fe/app/(admin)/inventory/page.tsx`
  - `fe/app/(admin)/appointments/page.tsx`
  - `fe/app/(admin)/visits/page.tsx`
  - `fe/app/(admin)/cash-book/page.tsx`
- **deliverables:**
  - Bảng dữ liệu được bọc `overflow-x-auto` và áp dụng `whitespace-nowrap` chuẩn mực.
- **test_commands:**
  - `cd fe && npm run build`

### TASK `P3-005` (`F3-02-02`): Chuẩn hóa Toàn bộ Biểu mẫu (Form), Validation và Chống Submit Lặp
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-004`
- **goal:** Chuẩn hóa toàn bộ các form nhập liệu: bổ sung dấu sao bắt buộc (`*`), nhóm thông tin logic, hiển thị lỗi validation dưới từng trường, hiển thị loading spinner khi gửi form, vô hiệu hóa nút submit ngăn gửi lặp (`isSubmitting`), và thông báo toast kết quả.
- **scope:** Toàn bộ modal/sheet nhập liệu trong `fe/app/(admin)/*`.
- **deliverables:**
  - Các form nhập liệu đồng nhất trạng thái validation, loading spinner và toasts.
- **test_commands:**
  - `cd fe && npm run build`

### TASK `P3-006` (`F3-02-03`): Chuẩn hóa Cấu trúc Trang Danh sách Thống nhất (List Page Pattern)
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-005`
- **goal:** Áp dụng mô hình chuẩn 8 khối cho các trang danh sách: Header -> Action button -> Khối tóm tắt thống kê -> Thanh tìm kiếm -> Bộ lọc đa cấp -> Data Table -> Phân trang -> Empty/Loading States.
- **scope:** `fe/app/(admin)/*` các trang danh sách.
- **deliverables:**
  - Cấu trúc trang danh sách thống nhất, empty state trực quan với icon và nút điều hướng phù hợp.
- **test_commands:**
  - `cd fe && npm run build`

### TASK `P3-007` (`F3-02-04`): Chuẩn hóa Dialog Xác nhận Thao tác và Modal Nghiệp vụ
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-006`
- **goal:** Thay thế toàn bộ hộp thoại `window.confirm` mặc định của trình duyệt bằng component `Dialog` / `AlertDialog` của `shadcn/ui`; thiết kế modal xác nhận rõ ràng cho các thao tác rủi ro cao (Hủy lịch, Hủy hóa đơn, Xóa bệnh nhân); đảm bảo dialog có thanh cuộn nội dung, không tràn màn hình nhỏ.
- **scope:** `fe/components/ui/dialog.tsx`, `fe/app/(admin)/*`.
- **deliverables:**
  - Thống nhất các modal xác nhận và thao tác nhanh bằng `AlertDialog`.
- **test_commands:**
  - `cd fe && npm run build`

### TASK `P3-008` (`F3-02-05`): Tối ưu Responsive Đa Màn hình (Desktop, Tablet, Mobile) và Khả năng Truy cập
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-007`
- **goal:** Kiểm tra và tinh chỉnh giao diện trên 3 độ phân giải chuẩn (Desktop, Tablet, Mobile); đảm bảo sidebar thu gọn mượt mà không che nội dung, các khối thống kê tự động xuống hàng theo grid linh hoạt, bàn phím và nhãn truy cập (ARIA labels) đầy đủ.
- **scope:** `fe/components/layout/AdminShell.tsx`, `fe/app/(admin)/*`.
- **deliverables:**
  - Bố cục responsive hoàn chỉnh trên mọi kích thước màn hình.
- **test_commands:**
  - `cd fe && npm run build`

### TASK `P3-009` (`F3-02-06` / `F3-02-07`): Kiểm chứng Toàn diện Giao diện Toàn Hệ thống & Lập Biên bản Nghiệm thu UI/UX
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-008`
- **goal:** Rà soát toàn bộ 28 routes thực tế của hệ thống; đối chiếu các tiêu chí nghiệm thu của Feature `F3-02`: không còn bảng dồn cột, form nhất quán, modal không vỡ; lập tài liệu kiểm tra giao diện trước và sau chuẩn hóa tại `docs/phase-3/UI_STANDARDIZATION_REPORT.md`.
- **scope:** `docs/phase-3/UI_STANDARDIZATION_REPORT.md`.
- **deliverables:**
  - `docs/phase-3/UI_STANDARDIZATION_REPORT.md`
- **test_commands:**
  - `test -f "docs/phase-3/UI_STANDARDIZATION_REPORT.md"`
  - `cd fe && npm run build`

---

# FEATURE `F3-03` — HOÀN THIỆN HỒ SƠ BỆNH NHÂN VÀ BỆNH ÁN ĐIỆN TỬ

### TASK `P3-010` (`F3-03-01` / `F3-03-02` / `F3-03-03`): Hoàn thiện Hồ sơ Bệnh nhân và Trục Thời gian Lịch sử Khám (Timeline)
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-009`
- **goal:** Nâng cấp trang chi tiết bệnh nhân `fe/app/(admin)/patients/[id]/page.tsx`: hiển thị thông tin định danh y tế rõ ràng (Mã BN, Họ tên, Giới tính, Nhóm máu, Tiền sử dị ứng), xây dựng khối Trục thời gian lịch sử khám (Clinical Timeline) theo thứ tự ngày giờ giảm dần, hiển thị trạng thái lượt khám, bác sĩ phụ trách và liên kết nhanh đến bệnh án chi tiết.
- **scope:** `fe/app/(admin)/patients/[id]/page.tsx`, `be/app/Http/Controllers/Api/V1/PatientController.php`.
- **deliverables:**
  - Giao diện Timeline lâm sàng chi tiết và API trả về lịch sử khám đính kèm thông tin chẩn đoán.
- **test_commands:**
  - `cd be && php artisan test --filter=PatientTest`
  - `cd fe && npm run build`

### TASK `P3-011` (`F3-03-04` / `F3-03-06`): Hoàn thiện Giao diện & Nghiệp vụ Bệnh án Điện tử (Khám bệnh Chuyên môn)
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-010`
- **goal:** Xây dựng màn hình nhập liệu và hiển thị Bệnh án điện tử hoàn chỉnh cho bác sĩ: hỗ trợ nhập Tiền sử bệnh, Triệu chứng lâm sàng, Chẩn đoán sơ bộ/xác định, Chỉ định cận lâm sàng, Kết quả cận lâm sàng, Phác đồ điều trị và Ngày hẹn tái khám (`follow_up_date`); liên kết chặt chẽ với lượt khám tương ứng (`visit_id`).
- **scope:** `fe/app/(admin)/visits/[id]/medical-record/page.tsx` hoặc Modal Bệnh án chuyên sâu tại `visits/page.tsx`, `be/app/Http/Controllers/Api/V1/MedicalRecordController.php`.
- **deliverables:**
  - Màn hình khám bệnh cho bác sĩ, form bệnh án chuẩn y khoa, API đồng bộ trạng thái lượt khám sang `COMPLETED` khi lưu bệnh án.
- **test_commands:**
  - `cd be && php artisan test --filter=MedicalRecordTest`
  - `cd fe && npm run build`

### TASK `P3-012` (`F3-03-05` / `F3-03-07` / `F3-03-08`): Phân quyền Nghiêm ngặt & Lưu vết Lịch sử Chỉnh sửa Bệnh án (Audit Trail)
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-011`
- **goal:** Triển khai cơ chế bảo vệ tính toàn vẹn y bạ: Chỉ tài khoản có quyền `medical_records.update` mới được chỉnh sửa bệnh án; mọi thao tác chỉnh sửa bệnh án sau khi đã kết thúc lượt khám phải được ghi nhận vào bảng `audit_logs` kèm lý do chỉnh sửa; cung cấp API và giao diện xem lịch sử các lần sửa bệnh án.
- **scope:** `be/app/Http/Controllers/Api/V1/MedicalRecordController.php`, `fe/app/(admin)/visits/*`.
- **deliverables:**
  - API `GET /api/v1/visits/{visit}/medical-record/history` và giao diện xem lịch sử chỉnh sửa bệnh án có lưu vết thời gian và người sửa.
- **test_commands:**
  - `cd be && php artisan test --filter=MedicalRecordTest`
  - `cd fe && npm run build`

---

# FEATURE `F3-04` — HOÀN THIỆN QUY TRÌNH LỊCH HẸN, TIẾP ĐÓN VÀ KHÁM BỆNH

### TASK `P3-013` (`F3-04-01` / `F3-04-02` / `F3-04-03`): Chuẩn hóa Máy trạng thái Lịch hẹn và Bộ lọc Lịch khám Đa tiêu chí
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-012`
- **goal:** Chuẩn hóa quy tắc chuyển trạng thái của Lịch hẹn (`appointments`): `PENDING` -> `CONFIRMED` -> `COMPLETED` (hoặc `CANCELLED` kèm lý do hủy); hoàn thiện bộ lọc lịch hẹn đa năng theo Khoảng ngày khám, Bác sĩ phụ trách, Chuyên khoa/Dịch vụ và Trạng thái xác nhận.
- **scope:** `be/app/Http/Controllers/Api/V1/AppointmentController.php`, `fe/app/(admin)/appointments/page.tsx`.
- **deliverables:**
  - Logic xác thực chuyển trạng thái lịch hẹn chống nhảy cóc trạng thái bất hợp lệ; bộ lọc danh sách lịch hẹn mượt mà.
- **test_commands:**
  - `cd be && php artisan test --filter=AppointmentTest`
  - `cd fe && npm run build`

### TASK `P3-014` (`F3-04-04` / `F3-04-05`): Hoàn thiện Luồng Tiếp đón Bệnh nhân tại Quầy Lễ tân
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-013`
- **goal:** Xây dựng màn hình/chức năng Tiếp đón nhanh tại quầy lễ tân: tìm kiếm bệnh nhân nhanh qua SĐT hoặc CCCD, tự động điền thông tin nếu bệnh nhân cũ, thêm bệnh nhân mới tức thời, phân luồng vào phòng khám chuyên khoa, và cấp số thứ tự chờ khám.
- **scope:** `fe/app/(admin)/visits/page.tsx`, `fe/app/(admin)/appointments/page.tsx`.
- **deliverables:**
  - Thao tác tiếp đón 1-click tại quầy, sinh lượt khám với trạng thái `WAITING` rõ ràng.
- **test_commands:**
  - `cd be && php artisan test --filter=VisitTest`
  - `cd fe && npm run build`

### TASK `P3-015` (`F3-04-06` / `F3-04-07`): Chuyển đổi Nguyên tử từ Lịch hẹn sang Lượt khám Chống Tạo Trùng
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-014`
- **goal:** Xây dựng endpoint và UI chuyển đổi nguyên tử: khi bấm "Tiếp nhận từ Lịch hẹn", hệ thống kích hoạt `DB::transaction()` khóa bi quan lịch hẹn, tạo lượt khám `Visit` liên kết `appointment_id`, chuyển trạng thái `Appointment` thành `COMPLETED`, chống tạo đúp 2 lượt khám cho cùng một lịch hẹn khi có nhiều click đồng thời.
- **scope:** `be/app/Http/Controllers/Api/V1/AppointmentController.php`, `fe/app/(admin)/appointments/page.tsx`.
- **deliverables:**
  - API `POST /api/v1/appointments/{appointment}/check-in` hoạt động nguyên tử và UI nút tiếp nhận trực quan.
- **test_commands:**
  - `cd be && php artisan test --filter=AppointmentCheckInTest`
  - `cd fe && npm run build`

---

# FEATURE `F3-05` — QUẢN LÝ TÀI LIỆU VÀ TỆP ĐÍNH KÈM Y TẾ

### TASK `P3-016` (`F3-05-01` / `F3-05-02`): Xây dựng Backend API Tải lên & Quản lý Tệp Đính kèm Y tế (`patient_files`)
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-015`
- **goal:** Xây dựng `PatientFileController` và các Form Request: hỗ trợ tải lên tài liệu y tế (kết quả xét nghiệm, ảnh X-quang, MRI, đơn thuốc ngoài, file PDF kết luận); kiểm tra nghiêm ngặt MIME type, giới hạn dung lượng tối đa 10MB/file, lưu trữ trong thư mục bảo vệ `storage/app/patient_files/{patient_id}/`.
- **scope:**
  - `be/app/Http/Controllers/Api/V1/PatientFileController.php`
  - `be/app/Http/Requests/PatientFile/UploadPatientFileRequest.php`
  - `be/app/Http/Resources/PatientFileResource.php`
  - `be/routes/api.php`
- **deliverables:**
  - API `POST /api/v1/patients/{patient}/files` và `POST /api/v1/visits/{visit}/files` kèm validation bảo mật.
- **test_commands:**
  - `cd be && php artisan test --filter=PatientFileTest`

### TASK `P3-017` (`F3-05-03` / `F3-05-04`): Xây dựng Backend API Tải xuống & Xem Trực tiếp Tệp Y tế có Phân quyền
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-016`
- **goal:** Xây dựng API phát trực tuyến tệp an toàn (`stream file`): yêu cầu token xác thực Sanctum và quyền `patient_files.view`; hỗ trợ xem trước hình ảnh/PDF trong trình duyệt (`Content-Disposition: inline`) và tải về máy (`Content-Disposition: attachment`); hỗ trợ xóa tệp đính kèm (`patient_files.delete`) có ghi nhận audit log.
- **scope:** `be/app/Http/Controllers/Api/V1/PatientFileController.php`, `be/routes/api.php`.
- **deliverables:**
  - API `GET /api/v1/patient-files/{id}/download`, `GET /api/v1/patient-files/{id}/preview`, `DELETE /api/v1/patient-files/{id}`.
- **test_commands:**
  - `cd be && php artisan test --filter=PatientFileDownloadTest`

### TASK `P3-018` (`F3-05-05` / `F3-05-06`): Xây dựng Giao diện Quản lý và Xem trước Tệp Y tế trên Frontend
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-017`
- **goal:** Xây dựng giao diện danh sách và tải lên tệp y tế trong trang chi tiết bệnh nhân (`fe/app/(admin)/patients/[id]/page.tsx`) và màn hình khám bệnh (`visits/page.tsx`): hỗ trợ kéo thả tệp, thanh tiến trình tải lên, hiển thị thumbnail ảnh thu nhỏ, modal xem trước hình ảnh phóng to hoặc mở xem PDF trực tiếp trong ứng dụng.
- **scope:** `fe/components/patient-files/*`, `fe/app/(admin)/patients/[id]/page.tsx`, `fe/lib/api/patient-files.ts`.
- **deliverables:**
  - Module quản lý tệp y tế trực quan, chuyên nghiệp, hỗ trợ xem trước ảnh X-quang/kết quả xét nghiệm.
- **test_commands:**
  - `cd fe && npm run build`

---

# FEATURE `F3-06` — HOÀN THIỆN BÁO CÁO VÀ BIỂU ĐỒ CHUYÊN NGHIỆP

### TASK `P3-019` (`F3-06-01`): Chuẩn hóa Biểu đồ Tròn/Donut (Pie/Donut Chart) Biểu diễn Cơ cấu Doanh thu & Tỷ trọng
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-018`
- **goal:** Nâng cấp Trung tâm Báo cáo và Dashboard: sử dụng biểu đồ Donut Chart từ thư viện `recharts` để trực quan hóa: (1) Cơ cấu phương thức thanh toán (Tiền mặt, Chuyển khoản, Thẻ, Bảo hiểm), (2) Tỷ trọng cơ cấu chi phí vận hành theo danh mục chi, (3) Phân bố trạng thái lịch hẹn (Hoàn thành, Đã hủy, Bỏ khám).
- **scope:** `fe/app/(admin)/reports/page.tsx`, `fe/app/(admin)/dashboard/page.tsx`, `fe/components/charts/*`.
- **deliverables:**
  - Biểu đồ Donut Chart có tooltip tùy biến đẹp mắt, chú thích (legend) rõ ràng, tỷ lệ phần trăm trực quan.
- **test_commands:**
  - `cd fe && npm run build`

### TASK `P3-020` (`F3-06-02`): Chuẩn hóa Biểu đồ Cột (Bar Chart) So sánh Hiệu suất Bác sĩ và Chỉ tiêu KPI
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-019`
- **goal:** Hoàn thiện biểu đồ Bar Chart so sánh đa chiều: (1) Doanh thu thực tế vs Mục tiêu KPI theo từng bác sĩ/nhân viên trong tháng, (2) Số lượt khám hoàn thành giữa các chuyên khoa phòng khám, (3) Top 10 thuốc/vật tư tiêu hao nhiều nhất.
- **scope:** `fe/app/(admin)/kpi/page.tsx`, `fe/app/(admin)/reports/page.tsx`.
- **deliverables:**
  - Biểu đồ Bar Chart so sánh trực quan, có vạch ngưỡng chỉ tiêu (ReferenceLine) và bảng màu chuẩn Medical SaaS.
- **test_commands:**
  - `cd fe && npm run build`

### TASK `P3-021` (`F3-06-03`): Chuẩn hóa Biểu đồ Đường/Vùng (Line/Area Chart) Xu hướng Tăng trưởng Doanh thu & Lưu lượng
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-020`
- **goal:** Nâng cấp biểu đồ Line/Area Chart thể hiện chuỗi thời gian (Time-series analytics): theo dõi xu hướng biến động doanh thu thuần, dòng tiền thực thu và số lượt khám hàng ngày trong tháng, so sánh với cùng kỳ tháng trước; hỗ trợ bộ lọc nhanh (7 ngày qua, 30 ngày qua, Quý này, Năm nay).
- **scope:** `fe/app/(admin)/dashboard/page.tsx`, `fe/app/(admin)/reports/page.tsx`.
- **deliverables:**
  - Biểu đồ xu hướng Area Chart mượt mà với đường cong spline, gradient tinh tế và bộ lọc thời gian tương tác cao.
- **test_commands:**
  - `cd fe && npm run build`

---

# FEATURE `F3-07` — NÂNG CAO BẢO MẬT, PHÂN QUYỀN VÀ KIỂM TOÁN

### TASK `P3-022` (`F3-07-01` / `F3-07-02`): Hoàn thiện Ma trận Phân quyền RBAC Chuyên sâu cho Hồ sơ Y tế và Tệp đính kèm
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-021`
- **goal:** Bổ sung và đồng bộ các quyền chi tiết mới vào `RolePermissionSeeder`: `patient_files.view`, `patient_files.upload`, `patient_files.delete`, `medical_records.history.view`; phân định rõ ranh giới quyền giữa bác sĩ, điều dưỡng, và thu ngân/hành chính.
- **scope:** `be/database/seeders/RolePermissionSeeder.php`, `be/app/Http/Controllers/Api/V1/RolePermissionController.php`.
- **deliverables:**
  - Seeder quyền RBAC đầy đủ, kiểm soát chặt chẽ ở cấp Middleware API và ẩn/hiện nút bấm trên Frontend.
- **test_commands:**
  - `cd be && php artisan test --filter=RolePermissionTest`

### TASK `P3-023` (`F3-07-03` / `F3-07-04`): Nâng cấp Nhật ký Kiểm toán (Audit Log) Truy vết Truy cập và Thao tác Nhạy cảm
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-022`
- **goal:** Tự động ghi nhật ký kiểm toán vào bảng `audit_logs` khi có người dùng: (1) Xem hoặc tải tệp hồ sơ y tế bệnh nhân, (2) Xuất file CSV báo cáo tài chính/kho, (3) Thay đổi thông tin bệnh án, (4) Thay đổi trạng thái tài khoản người dùng hoặc vai trò.
- **scope:** `be/app/Models/AuditLog.php`, `be/app/Http/Controllers/Api/V1/AuditLogController.php`.
- **deliverables:**
  - Cơ chế tự động ghi log kiểm toán không thể xóa sửa (Append-only Audit Log) và UI xem nhật ký quản trị.
- **test_commands:**
  - `cd be && php artisan test --filter=AuditLogTest`

### TASK `P3-024` (`F3-07-05` / `F3-07-06`): Che dấu Dữ liệu Nhạy cảm (Data Masking) và Giới hạn Tần suất Truy cập (Rate Limiting)
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-023`
- **goal:** Triển khai cơ chế che giấu thông tin cá nhân (Data Masking): che bớt số điện thoại (`0912***456`) và CCCD với vai trò không có quyền quản trị trực tiếp; thiết lập Middleware Rate Limiting trên các API nhạy cảm (Login, Export, Upload) để chống brute-force và DDoS.
- **scope:** `be/routes/api.php`, `be/app/Http/Resources/*`.
- **deliverables:**
  - Cấu hình Rate Limiting theo chuẩn Laravel Throttle và các Resource che dấu thông tin cá nhân.
- **test_commands:**
  - `cd be && php artisan test --filter=RateLimitTest`

---

# FEATURE `F3-08` — SAO LƯU, KHÔI PHỤC VÀ QUY TRÌNH VẬN HÀNH

### TASK `P3-025` (`F3-08-01` / `F3-08-02`): Xây dựng Kịch bản Sao lưu Cơ sở Dữ liệu Tự động (`scripts/backup-db.sh`)
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-024`
- **goal:** Xây dựng script shell an toàn `scripts/backup-db.sh`: tự động đọc thông tin kết nối từ file `.env`, trích xuất toàn bộ cấu trúc và dữ liệu 30 bảng MySQL sang file SQL nén `gzip`, đặt tên có nhãn thời gian, lưu trong thư mục `storage/backups/`, tự động dọn dẹp các bản sao lưu cũ quá 30 ngày; che giấu mật khẩu khỏi tiến trình hệ thống.
- **scope:** `scripts/backup-db.sh`.
- **deliverables:**
  - File kịch bản `scripts/backup-db.sh` có quyền thực thi `chmod +x` và tài liệu hướng dẫn cron job.
- **test_commands:**
  - `test -x "scripts/backup-db.sh"`
  - `bash scripts/backup-db.sh --dry-run`

### TASK `P3-026` (`F3-08-03` / `F3-08-04`): Xây dựng Kịch bản Khôi phục CSDL (`scripts/restore-db.sh`) và Sổ tay Vận hành Khẩn cấp
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-025`
- **goal:** Xây dựng script khôi phục cơ sở dữ liệu `scripts/restore-db.sh` với cơ chế kiểm tra an toàn cao nhất: (1) Luôn yêu cầu xác nhận rõ ràng từ người vận hành, (2) Có chế độ dry-run kiểm tra tính toàn vẹn của tệp sao lưu trên một database thử nghiệm tạm thời (`DBQLPK_TEST_RESTORE`), (3) Tuyệt đối không bao giờ tự động ghi đè lên database chính `DBQLPK` khi chưa có xác nhận; biên soạn Sổ tay Vận hành Khôi phục thảm họa tại `docs/phase-3/DISASTER_RECOVERY_RUNBOOK.md`.
- **scope:** `scripts/restore-db.sh`, `docs/phase-3/DISASTER_RECOVERY_RUNBOOK.md`.
- **deliverables:**
  - `scripts/restore-db.sh` và `docs/phase-3/DISASTER_RECOVERY_RUNBOOK.md`.
- **test_commands:**
  - `test -x "scripts/restore-db.sh"`
  - `test -f "docs/phase-3/DISASTER_RECOVERY_RUNBOOK.md"`
  - `bash scripts/restore-db.sh --help`

---

# FEATURE `F3-09` — TỐI ƯU HIỆU NĂNG VÀ TRUY VẤN CƠ SỞ DỮ LIỆU

### TASK `P3-027` (`F3-09-01` / `F3-09-02`): Bổ sung Chỉ mục Phức hợp (Composite Indexes) trên các Bảng Giao dịch Lớn
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-026`
- **goal:** Rà soát các câu truy vấn lọc, tìm kiếm và thống kê thời gian; tạo migration bổ sung các Composite Indexes chiến lược trên MySQL cho `visits`, `appointments`, `invoices`, `cash_transactions`, `inventory_transactions`, `audit_logs`.
- **scope:** `be/database/migrations/2026_10_29_110000_add_phase_3_composite_indexes.php`.
- **deliverables:**
  - File migration bổ sung index an toàn (có kiểm tra `hasIndex` trước khi tạo để tránh lỗi trùng lặp).
- **test_commands:**
  - `cd be && php artisan migrate --pretend`
  - `cd be && php artisan test`

### TASK `P3-028` (`F3-09-03` / `F3-09-04`): Tối ưu Truy vấn Eloquent Chống N+1 và Tối ưu Phân trang Danh mục Lớn
- **priority:** `P1`
- **status:** `DONE`
- **dependencies:** `P3-027`
- **goal:** Rà soát toàn bộ các Controller báo cáo, hóa đơn, tồn kho và lượt khám; áp dụng triệt để Eager Loading (`with()`) loại bỏ hoàn toàn các điểm nghẽn N+1 Query; tối ưu các truy vấn đếm tổng (`count()`) và phân trang danh mục lớn; đảm bảo thời gian phản hồi của 95% API đạt dưới 100ms.
- **scope:** `be/app/Http/Controllers/Api/V1/*`.
- **deliverables:**
  - Mã nguồn backend được tối ưu hóa truy vấn, kiểm thử hiệu năng thông suốt.
- **test_commands:**
  - `cd be && php artisan test`
  - `cd be && ./vendor/bin/pint --test`

---

# FEATURE `F3-10` — KIỂM THỬ TÍCH HỢP TOÀN DIỆN VÀ BÀN GIAO GIAI ĐOẠN 3

### TASK `P3-029` (`F3-10-01` / `F3-10-02`): Xây dựng Bộ Kiểm thử Tích hợp Toàn diện Toàn bộ Luồng Nghiệp vụ (E2E)
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-028`
- **goal:** Xây dựng bộ test suite tích hợp tự động kịch bản trọn vẹn từ đầu đến cuối (End-to-End Workflow Test): Đặt lịch -> Tiếp đón -> Khám -> Đính kèm tệp -> Kê đơn -> Trừ kho -> Lập hóa đơn -> Thu tiền nhiều đợt -> Giảm công nợ -> Sổ quỹ -> Kết thúc lượt khám -> Ghi log kiểm toán.
- **scope:** `be/tests/Feature/EndToEndPhase3WorkflowTest.php`.
- **deliverables:**
  - File test suite E2E bao phủ toàn bộ vòng đời bệnh nhân và dòng tiền phòng khám, 100% assertions PASS.
- **test_commands:**
  - `cd be && php artisan test tests/Feature/EndToEndPhase3WorkflowTest.php`

### TASK `P3-030` (`F3-10-03` / `F3-10-04`): Nghiệm thu Toàn diện Hệ thống và Lập Hồ sơ Bàn giao Giai đoạn 3
- **priority:** `P0`
- **status:** `DONE`
- **dependencies:** `P3-029`
- **goal:** Tiến hành tổng nghiệm thu toàn bộ 30 Tasks Giai đoạn 3; rà soát chuẩn hóa mã nguồn với Pint (PHP) và ESLint/TypeScript (Next.js); biên soạn tài liệu Báo cáo Hoàn thành Giai đoạn 3 tại `docs/phase-3/PHASE_3_REPORT.md` và Cập nhật Hướng dẫn Vận hành Hệ thống tại `docs/phase-3/OPERATIONAL_GUIDE.md`.
- **scope:**
  - `docs/phase-3/PHASE_3_REPORT.md`
  - `docs/phase-3/OPERATIONAL_GUIDE.md`
  - `qlpk-autonomous-framework/PROGRESS.md`
  - `qlpk-autonomous-framework/ROADMAP.md`
- **deliverables:**
  - `docs/phase-3/PHASE_3_REPORT.md`
  - `docs/phase-3/OPERATIONAL_GUIDE.md`
  - Cập nhật toàn bộ bảng tiến độ Phase 3 thành `100% DONE`.
- **test_commands:**
  - `test -f "docs/phase-3/PHASE_3_REPORT.md"`
  - `test -f "docs/phase-3/OPERATIONAL_GUIDE.md"`
  - `cd be && php artisan test`
  - `cd be && ./vendor/bin/pint --test`
  - `cd fe && npm run build`
