# TÀI LIỆU BÀN GIAO NGỮ CẢNH HỆ THỐNG CHO AI AGENT & KỸ SƯ DỰ ÁN
## CONTEXT & HANDOVER GUIDE FOR AI ASSISTANTS (`AI_AGENT_CONTEXT_HANDOVER.md`)
### Hệ thống Quản lý Phòng khám Chuyên nghiệp (Clinic Management System - QLPK)

- **Mã tài liệu:** `HANDOVER-CONTEXT-AI-2026`
- **Phiên bản hệ thống:** `3.2.0 (Phase 3 Completed)`
- **Nhánh Git chính:** `dev` (98+ commits, theo dõi sạch, 90/90 tasks đã hoàn thành)
- **Ngày cập nhật:** `2026-11-06`
- **Mục đích:** Cung cấp toàn bộ ngữ cảnh kiến trúc, tài khoản, quy tắc nghiệp vụ, mã nguồn backend/frontend để bất kỳ AI Agent hoặc Developer nào tiếp quản cũng nắm bắt và vận hành được ngay 100%.

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ (TECH STACK)

Dự án là **Clinic Management System (QLPK)** hoàn chỉnh, gồm 2 ứng dụng độc lập liên kết qua RESTful API:

```text
clinic-management-system/
├── be/                       # Backend: Laravel 13.x (PHP 8.3), MySQL 8.0, Sanctum Token, RBAC
│   ├── app/Http/Controllers/Api/V1/  # 28 Controller RESTful API
│   ├── app/Models/                   # 30 Eloquent Models quan hệ 3NF chuẩn mực
│   ├── database/migrations/          # 30 bảng CSDL + Composite Indexes chống chậm N+1
│   ├── database/seeders/             # Phân quyền RBAC 8 roles + Dữ liệu mẫu hoàn chỉnh
│   └── tests/                        # 285+ bài test PHPUnit (EndToEndPhase3WorkflowTest)
├── fe/                       # Frontend: Next.js 16.4.2 (React 19, TypeScript 5, Tailwind CSS v4)
│   ├── app/(admin)/                  # 28 trang giao diện quản trị chuẩn shadcn/ui
│   ├── components/layout/AdminShell  # Shell điều hướng đa phân hệ
│   └── lib/                          # Axios API client, Auth Context, Data Masking
├── docs/                     # Trọn bộ tài liệu kỹ thuật Phase 1, Phase 2, Phase 3
└── scripts/                  # Kịch bản sao lưu/khôi phục CSDL an toàn (backup/restore)
```

### Các thông số kết nối & lệnh khởi chạy:
- **Backend Port:** `http://localhost:8000` (API Base: `http://localhost:8000/api/v1`)
  - Chạy backend: `cd be && php artisan serve --port=8000`
  - Chạy migration & seed: `cd be && php artisan migrate --seed`
  - Chạy test kiểm thử: `cd be && php artisan test`
- **Frontend Port:** `http://localhost:3000`
  - Chạy frontend: `cd fe && npm run dev`
  - Kiểm tra kiểu dữ liệu: `cd fe && npx tsc --noEmit`

---

## 2. DANH SÁCH TÀI KHOẢN MẪU & PHÂN QUYỀN (RBAC)

Toàn bộ tài khoản có mật khẩu mặc định: `Admin@123456`

| Username | Role | Mô tả vai trò | Liên kết Nhân sự (`employees`) | Ghi chú |
|---|---|---|---|---|
| `admin` | `ADMIN` | Quản trị viên tối cao | Không bắt buộc | Toàn quyền cấu hình, tài khoản, audit, bypass |
| `manager` | `MANAGER` | Quản lý phòng khám | Ban Quản lý | Quản lý nhân sự, dịch vụ, gói, lịch hẹn, duyệt chi, xem báo cáo |
| `doctor` | `DOCTOR` | Bác sĩ khám lâm sàng | `EMP-001` (BS.CKI Nguyễn Văn An) | Khám bệnh, kê đơn, bệnh án EMR, chỉ tiêu KPI |
| `nurse` | `NURSE` | Điều dưỡng / Kỹ thuật viên | Điều dưỡng | Tiếp đón, hỗ trợ lâm sàng, xem hồ sơ & đính kèm tài liệu y tế |
| `receptionist`| `RECEPTIONIST`| Nhân viên Lễ tân | Nhân sự Lễ tân | Tiếp đón, tra cứu hồ sơ, đặt lịch, mở ca khám |
| `cashier` | `CASHIER` | Thu ngân viện phí | Nhân sự Thu ngân | Lập hóa đơn, thu tiền đợt 1/đợt 2, in biên lai, sổ nợ |
| `accountant` | `ACCOUNTANT` | Kế toán phòng khám | Nhân sự Kế toán | Sổ quỹ thu chi, duyệt chi, đối soát công nợ, xuất báo cáo tài chính |
| `employee` | `EMPLOYEE` | Nhân sự cơ bản | Nhân viên phòng khám | Xem lịch phân công làm việc và thông báo nội bộ |

---

## 3. CÁC QUY TẮC NGHIỆP VỤ CỐT LÕI (CORE BUSINESS RULES)

1. **Quan hệ Bác sĩ — Nhân sự — Tài khoản:**
   - Bảng `employees` là trung tâm của nhân sự (bác sĩ, điều dưỡng, tiếp tân).
   - Bảng `users` liên kết 1–1 với `employees` qua trường `employee_id`.
   - Một tài khoản Bác sĩ đăng nhập sẽ sở hữu `user.employee_id`. Mọi lịch khám (`appointments`), ca khám (`visits`), bệnh án (`medical_records`), và chỉ tiêu doanh thu (`kpi_targets`) đều neo chặt theo `employee_id` này.
2. **Cơ chế Cách ly Bác sĩ (Doctor Isolation Guard):**
   - Bác sĩ chỉ được phép lập/sửa bệnh án cho các ca khám được phân công cho chính mình (`visit.employee_id === user.employee_id`).
   - Nếu cố tình can thiệp ca của bác sĩ khác, API trả về `403 Forbidden`. Chỉ `ADMIN` hoặc `MANAGER` mới có quyền xem xét can thiệp.
3. **Chống trùng lịch hẹn (Concurrency Overlap Lock):**
   - Dùng khóa bi quan `lockForUpdate()` trong transaction tại `AppointmentService.php`. Chặn tuyệt đối đặt trùng giờ cùng 1 bác sĩ.
4. **Quy trình Tài chính & Sổ quỹ Khép kín (Automated Cashbook):**
   - Hóa đơn (`invoices`) hỗ trợ thanh toán nhiều đợt (`payments`). Trạng thái chuyển từ `UNPAID` -> `PARTIAL` -> `PAID`.
   - Mỗi lần thu tiền hoặc chi tiền thành công, hệ thống **tự động sinh giao dịch sổ quỹ (`cash_transactions`)** loại `IN` hoặc `OUT`. Không thể sửa sổ quỹ trực tiếp bằng tay nhằm chống gian lận.
5. **Kho Dược & Vật tư Tiêu hao (Inventory Outbound Lock):**
   - Khi xuất thuốc theo đơn, hệ thống khóa bi quan dòng sản phẩm, trừ tồn kho tự động. Nếu tồn kho dưới `min_stock` sẽ bật cờ cảnh báo `LOW_STOCK`.
6. **Bảo mật Y tế & Che dấu Dữ liệu (Data Masking):**
   - SĐT (`0912***456`) và CCCD (`079******123`) của bệnh nhân tự động ẩn ký tự với các vai trò không phải Admin/Manager để tuân thủ pháp lý y khoa.
7. **Tự động sinh Hóa đơn viện phí khi Bác sĩ hoàn tất khám / lưu bệnh án:**
   - Khi bác sĩ bấm lưu bệnh án EMR (`MedicalRecordController`), hệ thống tự động sinh Hóa đơn `UNPAID` với đầy đủ tiền khám và tiền thuốc kê đơn.
   - Quầy thu ngân ([`/invoices`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/invoices/page.tsx)) có sẵn danh sách hóa đơn chờ thu và banner Hàng đợi thu ngân, bấm 1-Click là thu tiền ngay.
8. **Phiếu khám lâm sàng & Đơn thuốc trên Hóa đơn:**
   - Màn hình chi tiết hóa đơn ([`/invoices/[id]`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/invoices/[id]/page.tsx)) nạp trọn vẹn `clinical_record` (Bác sĩ phụ trách, chẩn đoán bệnh, tiền sử, dịch vụ chỉ định, đơn thuốc chi tiết và ngày hẹn tái khám) phục vụ in hóa đơn y tế chuẩn cho bệnh nhân.
9. **Cách ly Bác sĩ Toàn diện (Full-Scope Doctor Isolation):**
   - **Backend:** Cả `AppointmentController` và `VisitController` đều tự động ép buộc `$query->where('employee_id', $currentUser->employee_id)` nếu người dùng đăng nhập có vai trò `DOCTOR` (và không có quyền `ADMIN`/`MANAGER`). Ngăn chặn mọi can thiệp chéo qua REST API.
   - **Frontend:** Tại trang Lượt khám ([`/visits`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/visits/page.tsx)) và Lịch hẹn ([`/appointments`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/appointments/page.tsx)), bộ lọc Bác sĩ tự động cố định theo bác sĩ đang đăng nhập với huy hiệu bảo mật `🔒 BS. [Họ tên] (Của bạn)`, đồng thời khóa trường chọn Bác sĩ trong Modal Tiếp đón nhanh & Đặt lịch để đảm bảo bác sĩ chỉ phụ trách và xem đúng bệnh nhân của chính mình.
10. **Tối ưu hóa Thao tác Thu nợ & Sổ nợ ([`/debts`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/debts/page.tsx)):**
   - Nút "Thu nợ" trên từng dòng danh sách bệnh nhân gọi trực tiếp form thu tiền công nợ.
   - Sửa lỗi truy vấn quan hệ `visit` trong `DebtController@patientDebts` (dùng đúng trường `visit_date,employee_id` thay vì `check_in_time` không tồn tại trong CSDL).
   - Đóng sạch cửa sổ sổ nợ nền trước khi mở modal thu nợ để triệt tiêu lỗi đơ màn hình do kẹt backdrop / `pointer-events: none` của Radix UI.
   - Sửa thuộc tính ô nhập số tiền thu nợ (`step="any"`, `min="0"`, `noValidate`) triệt tiêu lỗi xung đột bước nhảy HTML5 khiến trình duyệt chặn nộp tiền chẵn (ví dụ 60.000đ).
11. **Đồng bộ hóa Trực tiếp Kho Dược & Kê đơn Bác sĩ ([`/inventory`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/inventory/page.tsx) & [`/visits/[id]/medical-record`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/visits/[id]/medical-record/page.tsx)):**
   - Kho Dược lưu trữ toàn bộ 17+ danh mục thuốc chuyên khoa và vật tư y tế kèm tồn kho khả dụng (`current_stock`).
   - Bác sĩ khi mở màn hình EMR kê đơn sẽ nạp trực tiếp danh mục thuốc và số lượng tồn kho khả dụng từ Kho Dược theo thời gian thực (hiển thị `📦 Kho: X Viên`).
   - Chặn kê đơn và cảnh báo khi thuốc trong kho đã hết hàng (`current_stock <= 0`).
   - Khi bác sĩ bấm "Lưu Bệnh án & Kê đơn", hệ thống tự động sinh phiếu Xuất kho (`OUT`) trừ thẳng tồn kho của thuốc đó theo mã lượt khám (`reference_id: visit_id`).
12. **Khóa Cứng Bệnh Án & Đơn Thuốc Khi Đã Thu Tiền Viện Phí (`PAID` Locking):**
   - **Backend:** `MedicalRecordController@update` xác thực trạng thái tài chính của ca khám: nếu hóa đơn liên kết hoặc lượt khám đã ở trạng thái `PAID`, API từ chối cập nhật với mã lỗi `422 Unprocessable Entity` (chỉ mở quyền đặc cách cho `ADMIN` hoặc `MANAGER`).
   - **Frontend:**
     - Tại trang chi tiết ca khám ([`/visits/[id]`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/visits/[id]/page.tsx)), nút "✏️ Sửa nhanh" tự động chuyển thành huy hiệu `🔒 Đã khóa bệnh án (Đã thu viện phí)`.
     - Tại phòng khám EMR ([`/visits/[id]/medical-record`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/visits/[id]/medical-record/page.tsx)), hiển thị Banner cảnh báo màu vàng: `HỒ SƠ BỆNH ÁN & ĐƠN THUỐC ĐÃ KHÓA (CHẾ ĐỘ CHỈ ĐỌC)`. Mọi trường thông tin, nút kê thuốc, nút tăng giảm số lượng thuốc và nút lưu bệnh án đều bị khóa cứng để bảo toàn tính toàn vẹn số liệu tài chính và kho dược.
13. **Lưu Trữ Vĩnh Viễn Toàn Bộ Lịch Sử Các Lần Khám & 1-Click Sao Chép Đơn Cũ:**
   - **Kiến trúc dữ liệu:** Quan hệ 1 Bệnh nhân (`Patient`) liên kết nhiều Lượt khám (`Visit`), mỗi lượt khám sở hữu riêng một Hồ sơ bệnh án (`MedicalRecord`). Lần khám 2, khám 3 được tạo mới hoàn toàn độc lập, tuyệt đối không ghi đè hay làm mất hồ sơ của lần khám 1.
   - **Phòng khám EMR:** Tích hợp trực tiếp Tab **"🕒 Lịch sử các lần khám cũ"** ngay trong giao diện khám bệnh. Bác sĩ xem được ngày khám, bác sĩ phụ trách, chẩn đoán, diễn tiến bệnh và bảng đơn thuốc chi tiết của tất cả các lần khám trước.
   - **Tính năng 1-Click Re-prescribe:** Nút bấm `[📋 Sao chép đơn thuốc cũ]` tự động nạp toàn bộ danh mục thuốc và liều lượng từ lần khám cũ vào bảng kê đơn của lần khám hiện tại, giúp bác sĩ tiết kiệm thời gian kê đơn khi bệnh nhân tái khám cùng bệnh lý.
14. **Tối Ưu Hóa Biểu Đồ So Sánh KPI & Chuẩn Hóa Bảng KPI 1 Dòng Duy Nhất ([`/kpi`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/kpi/page.tsx)):**
   - **Biểu đồ so sánh KPI ([`DoctorKpiBarChart.tsx`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/components/charts/doctor-kpi-bar-chart.tsx)):**
     - Nâng chiều cao biểu đồ từ `360px` lên `420px` thoáng đãng.
     - Tích hợp bộ chọn số lượng nhân sự so sánh: `Top 5 (Rõ nét)`, `Top 8 (Khuyến nghị tối ưu)`, `Top 10`, `Tất cả`.
     - Thêm cơ chế tự động bật thanh cuộn ngang mượt mà (`overflow-x-auto min-w-[...]`) khi có nhiều nhân viên để đảm bảo các cột Bar không bao giờ bị ép mỏng hoặc che khuất nhãn tên.
   - **Bảng Chi tiết Chỉ tiêu & Tiến độ Hoàn thành KPI:**
     - Thiết kế lại 100% các cột (`Nhân viên`, `Kỳ hạn`, `Doanh thu`, `Lượt khám`, `Tỷ lệ TB`, `Đánh giá`, `Thao tác`) hiển thị trên **chính xác 1 dòng duy nhất (Single-Line Row)**.
     - Tích hợp avatar, mã nhân viên, khoa phòng, ngày tháng kỳ hạn `Start → End`, progress bar ngang thu gọn và huy hiệu đánh giá liền mạch không ngắt dòng.
15. **Hỗ Trợ Xuất Excel (.xls) Native Chuẩn Định Dạng Ngày (dd/mm/yyyy) & Bảo Toàn SĐT Toàn Hệ Thống:**
   - **Phạm vi hoàn thiện:** Áp dụng đồng bộ cho cả **Trung tâm Import/Export** ([`/data-transfer`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/data-transfer/page.tsx)) và **Trung tâm Báo cáo Điều hành** ([`/reports`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/reports/page.tsx)).
   - **Nguyên nhân lỗi định dạng ngày cũ:** Khi tải file `.csv` thô chứa ngày dạng `YYYY-MM-DD` hoặc `YYYY-MM-DD HH:mm:ss`, Microsoft Excel (với cài đặt vùng Việt Nam `dd/mm/yyyy`) sẽ không thể tự nhận diện kiểu Date mà coi là chuỗi văn bản hoặc phép tính trừ toán học, gây lỗi `#VALUE!`, không cho lọc theo tháng/năm, đồng thời tự động cắt mất số `0` ở đầu số điện thoại.
   - **Giải pháp Backend ([`ExportController.php`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/be/app/Http/Controllers/Api/V1/ExportController.php) & [`ImportController.php`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/be/app/Http/Controllers/Api/V1/ImportController.php)):**
     - Bổ sung engine tạo file Microsoft Excel XML Spreadsheet (`application/vnd.ms-excel` đuôi `.xls`) chuẩn quy cách toàn cầu.
     - Định nghĩa Style chuyên biệt: Cột ngày tháng (`Date`) gán định dạng hiển thị `dd/mm/yyyy`, cột thời gian (`DateTime`) gán `dd/mm/yyyy hh:mm:ss`, cột tiền tệ/số lượng (`Number`/`DecimalNumber`) gán `#,##0` hoặc `#,##0.00`, cột số điện thoại (`phone`) giữ nguyên kiểu `String` giữ trọn số `0`.
     - Với file CSV (`format=csv`), toàn bộ ngày tháng cũng được chuẩn hóa thành `d/m/Y` và `d/m/Y H:i:s`, số điện thoại được bao bọc an toàn tránh bị Excel cắt số 0.
     - Tại `ImportController.php`: Bổ sung xử lý tự động nhận diện ngày sinh dạng `dd/mm/yyyy` khi người dùng tải tệp import ngược lại vào hệ thống.
   - **Giải pháp Frontend:**
     - Tại [`/data-transfer`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/data-transfer/page.tsx): Bổ sung 2 nút tải riêng biệt trên cả 4 thẻ Báo cáo (Bệnh nhân, Hóa đơn & Công nợ, Sổ quỹ Thu Chi, Báo cáo Tồn kho): Nút chính nổi bật `[📊 Xuất Excel (.xls)]` và nút phụ `[📄 CSV]`.
     - Tại [`/reports`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/reports/page.tsx): Nâng cấp đồng bộ cả 3 tab (Báo cáo Tài chính, Báo cáo Khám bệnh, Báo cáo Kho dược) với 2 nút `[📊 Xuất Excel ... (.xls)]` và `[📄 CSV]`, sử dụng fetch blob chuẩn Token xác thực thay cho `window.open` URL thô cũ.
16. **Trợ lý Điều hành AI Cấp cao & Chatbot Báo cáo Tổng hợp (Google Gemini 2.5 Flash):**
   - **Vị trí tích hợp:** Tab riêng biệt "Trợ lý AI (Flash)" trong Trung tâm Báo cáo Quản trị ([`/reports`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/reports/page.tsx)).
   - **Cơ chế Data Grounding (Độ chính xác 100%):** Backend ([`GeminiReportService.php`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/be/app/Services/GeminiReportService.php)) tự động trích xuất bản Snapshot số liệu thực tế thời gian thực từ CSDL MySQL (Doanh thu thực thu, ca khám chờ/hoàn tất, cảnh báo tồn kho hết hàng/dưới định mức, công nợ, hiệu suất KPI bác sĩ) làm Chân lý dữ liệu (Ground Truth) nạp vào System Instruction của Gemini. Chặn tuyệt đối hiện tượng bịa đặt số liệu (Hallucination).
   - **Tối ưu Tốc độ & Chi phí:** Mặc định sử dụng model siêu tốc `gemini-2.5-flash` (độ trễ phản hồi < 1s), tự động fallback linh hoạt sang `gemini-2.0-flash` hoặc `gemini-1.5-flash`.
   - **Cấu hình môi trường:** Quản trị qua tệp `be/.env`: `GEMINI_API_KEY` và `GEMINI_MODEL`. Khi chưa cấu hình key, giao diện hiển thị hướng dẫn thân thiện, hoàn toàn không làm gián đoạn hay ảnh hưởng tới các chức năng khác của hệ thống.
   - **Giao diện chuẩn ChatGPT:** Thiết kế chuyên nghiệp gồm thanh KPI tóm tắt, 5 câu hỏi nhanh 1-Click (Quick Prompts), bong bóng chat Markdown (hỗ trợ bảng số liệu, in đậm chỉ số, bullet points), sao chép câu trả lời và làm mới phiên chat.
17. **Phân hệ Demo Quản lý Thông tin Database (5 Stored Procedures, 5 Triggers, 3 Functions, 2 Cursors & Audit Trail):**
   - **Mục đích:** Phục vụ trực tiếp việc báo cáo và chấm điểm đồ án môn học Quản lý thông tin / Cơ sở dữ liệu với giảng viên UIT.
   - **Bố trí giao diện:**
     - Tích hợp khối **`QUẢN LÝ THÔNG TIN – DATABASE DEMO`** có thể thu gọn/mở rộng tại chân trang của 5 phân hệ: Lịch hẹn ([`/appointments`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/appointments/page.tsx)), Bệnh nhân ([`/patients`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/patients/page.tsx)), Hóa đơn ([`/invoices`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/invoices/page.tsx)), Kho Dược ([`/inventory`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/inventory/page.tsx)), Báo cáo ([`/reports`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/fe/app/(admin)/reports/page.tsx)).
     - Tích hợp nút kích hoạt nhanh `Demo CSDL [15 SQL]` trên thanh Topbar toàn hệ thống mở cửa sổ điều khiển tổng hợp `MasterDatabaseDemoCenter`.
   - **Tính năng chuyên sâu:**
     - Hiển thị mã nguồn SQL thực tế (`CREATE PROCEDURE/TRIGGER/FUNCTION`) kèm nút sao chép 1-Click.
     - Chạy thử nghiệm DEMO trực tiếp trên CSDL, đo đạc thời gian mili-giây (`duration_ms`).
     - So sánh trực quan dữ liệu Trước (Before) và Sau (After) khi câu lệnh thực thi.
     - Bảng theo dõi lịch sử thay đổi dữ liệu minh bạch (`db_demo_audit_logs`).
   - **Cam kết bảo toàn:** Chạy trên cơ chế sandbox an toàn, tuyệt đối không làm sai lệch hay xóa mất dữ liệu nghiệp vụ thật của phòng khám.

---

## 4. BẢN ĐỒ GIAO DIỆN FRONTEND (`fe/app/(admin)/`)

| Đường dẫn (URL Route) | Phân hệ | Chức năng chính |
|---|---|---|
| `/admin` | Điều hành chung | Dashboard tổng quan doanh thu, ca khám, biểu đồ xu hướng |
| `/approvals` | Điều hành chung | Phê duyệt đề xuất chi tiêu, giảm giá, hoàn tiền |
| `/notifications` | Điều hành chung | Danh sách thông báo ca mới, duyệt phiếu, cảnh báo tồn kho |
| `/patients` | Khám chữa bệnh | Danh sách bệnh nhân, hồ sơ bệnh sử, tệp X-quang/PDF |
| `/appointments` | Khám chữa bệnh | Đặt lịch khám, tiếp đón nguyên tử 1-Click sang ca khám |
| `/visits` | Khám chữa bệnh | Quản lý lượt khám tại phòng (Chờ -> Đang khám -> Hoàn tất) |
| `/visits/[id]` | Khám chữa bệnh | Khám bệnh, nhập bệnh án EMR, kê đơn thuốc, hẹn tái khám |
| `/services` | Khám chữa bệnh | Bảng giá danh mục dịch vụ cận lâm sàng, xét nghiệm |
| `/packages` | Khám chữa bệnh | Gói dịch vụ định lượng nhiều buổi |
| `/invoices` | Tài chính | Lập hóa đơn, thu tiền đợt 1/đợt 2, in biên lai |
| `/debts` | Tài chính | Quản lý công nợ, phân tích tuổi nợ 0-7, 8-30, >30 ngày |
| `/finance/cashbook` | Tài chính & Sổ quỹ | Quản lý phiếu thu, phiếu chi, dòng tiền mặt và ngân hàng |
| `/inventory` | Kho dược | Danh mục thuốc, tồn kho, nhập kho, cảnh báo hết thuốc |
| `/kpi` | Quản trị & Báo cáo | Theo dõi chỉ tiêu và kết quả thực tế của từng bác sĩ |
| `/reports` | Quản trị & Báo cáo | Báo cáo doanh thu đa chiều, biểu đồ tăng trưởng và Trợ lý Điều hành AI (Gemini 2.5 Flash) |
| `/data-transfer` | Quản trị | Import/Export danh mục và dữ liệu Excel/CSV |
| `/employees` | Quản trị | Quản lý hồ sơ nhân viên, bác sĩ, lịch công tác |
| `/users` | Phân quyền | Cấp tài khoản người dùng, gán vai trò RBAC |
| `/audit-logs` | Bảo mật | Nhật ký kiểm toán mọi hành động tạo, sửa, xóa trong hệ thống |

---

## 5. KỊCH BẢN KIỂM THỬ (TESTING RUNBOOK) CHO NGƯỜI DÙNG

### Ma trận Kiểm thử Phân quyền (Happy Path & Unhappy Path) theo 8 vai trò RBAC:

| Vai trò (Role) | Tài khoản / MK | Happy Path (Hành vi được phép) | Unhappy Path (Hành vi bị chặn / Biên lỗi an toàn) |
|---|---|---|---|
| **ADMIN** | `admin` / `Admin@123456` | Toàn quyền tất cả 28 phân hệ, cấu hình hệ thống, cấp tài khoản, kiểm toán audit logs, xem SĐT BN đầy đủ. | Nhập sai định dạng dữ liệu (ví dụ mã nhân viên trùng, ngày sinh tương lai) sẽ bị validator chặn báo lỗi rõ ràng. |
| **MANAGER** | `manager` / `Admin@123456` | Quản lý phòng khám: Quản lý nhân sự, dịch vụ, gói khám, lịch hẹn, duyệt chi, xem toàn bộ báo cáo doanh thu. | Cố tình truy cập trang Cấu hình hệ thống hoặc Audit logs người dùng -> Bị chặn 403 Forbidden. |
| **DOCTOR** | `doctor` / `Admin@123456` | Vào `/visits/[id]` khám bệnh ca của mình, kê đơn thuốc có trong kho, chỉ định dịch vụ, hoàn tất bệnh án EMR. | • Cố sửa ca khám của BS khác -> Bị chặn 403 (Doctor Isolation Guard).<br>• Kê số lượng vượt tồn kho -> Cảnh báo thiếu thuốc.<br>• Ca đã thu tiền -> Bị khóa bệnh án, không cho sửa đơn thuốc.<br>• Cố vào thu tiền viện phí hoặc sổ quỹ -> Menu bị ẩn, API trả về 403. |
| **NURSE** | `nurse` / `Admin@123456` | Xem danh sách tiếp đón, hồ sơ BN, tải lên tệp đính kèm y tế (X-quang, PDF kết quả xét nghiệm). | Cố tình tạo đơn thuốc, chẩn đoán bệnh án EMR hoặc thu tiền -> Bị ẩn nút hoặc chặn 403. |
| **RECEPTIONIST** | `receptionist` / `Admin@123456` | Tiếp đón BN mới, đặt lịch hẹn (`/appointments`), check-in đưa BN vào phòng chờ khám, xem số điện thoại BN. | • Cố mở hồ sơ bệnh án chuyên môn EMR -> Bị chặn 403.<br>• Đặt lịch trùng giờ bác sĩ -> Khóa cảnh báo chống trùng lịch.<br>• Cố truy cập báo cáo tài chính / thu chi -> Bị từ chối quyền. |
| **CASHIER** | `cashier` / `Admin@123456` | Mở hàng đợi thu ngân (`/invoices`), thu tiền đủ hoặc thu đợt 1 (50%), in biên lai, thu nợ tồn đọng (`/debts`). | • Cố truy cập bệnh án y tế EMR -> Bị chặn 403.<br>• Cố hủy hóa đơn đã có tiền thanh toán (`paid_amount > 0`) -> Bị chặn báo lỗi.<br>• Cố sửa bảng giá dịch vụ -> Không có quyền. |
| **ACCOUNTANT** | `accountant` / `Admin@123456` | Lập phiếu chi, xem sổ quỹ (`/finance/cashbook`), đối soát tuổi nợ (`/debts`), xuất báo cáo Excel/CSV. | • Phiếu chi vượt hạn mức -> Chuyển trạng thái PENDING chờ Manager/Admin duyệt, chưa trừ sổ quỹ.<br>• Cố can thiệp kê đơn thuốc -> Bị chặn 403. |
| **EMPLOYEE** | `employee` / `Admin@123456` | Xem lịch làm việc phân công cá nhân, nhận thông báo nội bộ hệ thống. | Cố truy cập bất kỳ dữ liệu bệnh nhân, tài chính, hóa đơn viện phí, kho dược -> Toàn bộ đều bị khóa 403. |
