# TÀI LIỆU KỸ THUẬT API — GIAI ĐOẠN 2 (PHASE-02)
## HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (QLPK)
### Phân hệ Tài chính, Kho Dược, Báo cáo Quản trị, KPI, Import/Export, Thông báo & Phê duyệt

- **Mã tài liệu:** `API-DOC-PHASE-02`
- **Phiên bản:** `2.0.0`
- **Ngày phát hành:** `2026-10-28`
- **Môi trường API:** `http://localhost:8000/api/v1`
- **Chuẩn giao tiếp:** RESTful API, JSON Envelope, UTF-8 BOM CSV, ISO 8601 Timestamps
- **Xác thực & Bảo mật:** Laravel Sanctum Token (`Authorization: Bearer <token>`), RBAC Middleware (`active_user`, `permission:<key>`), Pessimistic Concurrency Control (`lockForUpdate` + `DB::transaction()`)

---

## 1. QUY ƯỚC CHUNG & CHUẨN DỮ LIỆU GIAI ĐOẠN 2

### 1.1. Base URL & HTTP Headers
- **Base URL:** `http://localhost:8000/api/v1` (Frontend: `NEXT_PUBLIC_API_BASE_URL`)
- **Headers bắt buộc cho JSON API:**
  ```http
  Accept: application/json
  Content-Type: application/json
  Authorization: Bearer <sanctum_token>
  ```
- **Headers cho Import file CSV:**
  ```http
  Accept: application/json
  Content-Type: multipart/form-data
  Authorization: Bearer <sanctum_token>
  ```
- **Headers cho Export file CSV:**
  ```http
  Accept: text/csv; charset=UTF-8
  Authorization: Bearer <sanctum_token>
  ```
  *(Tất cả file CSV xuất ra đều có tiền tố UTF-8 BOM `\xEF\xBB\xBF` giúp Microsoft Excel hiển thị tiếng Việt có dấu chuẩn xác 100%).*

### 1.2. Cấu trúc Chuẩn JSON Envelope

#### Phản hồi thành công (Success Response — 200, 201)
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": { ... },
  "meta": {
    "current_page": 1,
    "last_page": 4,
    "per_page": 15,
    "total": 52
  }
}
```

#### Phản hồi lỗi nghiệp vụ / Validation / Xung đột (Error Response — 400, 403, 404, 409, 422)
```json
{
  "success": false,
  "message": "Thông điệp mô tả lỗi chi tiết",
  "errors": {
    "field_name": [
      "Chi tiết lỗi cụ thể cho trường dữ liệu."
    ]
  }
}
```

### 1.3. Ma trận Quyền RBAC Bổ sung trong Giai đoạn 2

| Quyền hạn (`Permission Key`) | Mô tả chức năng | Vai trò được cấp mặc định |
|---|---|---|
| `debts.view` | Xem danh sách, tổng hợp và chi tiết sổ nợ bệnh nhân | `ADMIN`, `MANAGER`, `ACCOUNTANT`, `CASHIER`, `VIEWER` |
| `cash_transactions.view` | Xem sổ quỹ và báo cáo dòng tiền thu chi | `ADMIN`, `MANAGER`, `ACCOUNTANT`, `CASHIER`, `VIEWER` |
| `cash_transactions.create` | Lập giao dịch thu/chi quỹ thủ công | `ADMIN`, `ACCOUNTANT` |
| `products.view` | Xem danh mục sản phẩm, thuốc và tồn kho | `ADMIN`, `MANAGER`, `DOCTOR`, `ACCOUNTANT`, `VIEWER` |
| `products.create` | Tạo mới thuốc / vật tư y tế | `ADMIN`, `MANAGER` |
| `products.update` | Cập nhật thông tin, giá, định mức tồn kho | `ADMIN`, `MANAGER` |
| `products.delete` | Xóa mặt hàng khỏi danh mục | `ADMIN` |
| `inventory.view` | Xem lịch sử giao dịch kho và báo cáo tồn kho | `ADMIN`, `MANAGER`, `ACCOUNTANT`, `VIEWER` |
| `inventory.in` | Lập phiếu nhập kho vật tư / thuốc | `ADMIN`, `MANAGER` |
| `inventory.out` | Lập phiếu xuất kho sử dụng / bán | `ADMIN`, `MANAGER` |
| `inventory.adjust` | Lập phiếu điều chỉnh kiểm kê kho | `ADMIN`, `MANAGER` |
| `kpi_targets.view` | Xem chỉ tiêu và tiến độ thực đạt KPI | `ADMIN`, `MANAGER`, `DOCTOR`, `EMPLOYEE`, `VIEWER` |
| `kpi_targets.manage` | Thiết lập, cập nhật chỉ tiêu KPI nhân sự | `ADMIN`, `MANAGER` |
| `reports.view` | Xem Trung tâm Báo cáo Quản trị (Tài chính, Khám, Kho) | `ADMIN`, `MANAGER`, `ACCOUNTANT`, `VIEWER` |
| `imports.manage` | Tải template, import CSV và xem nhật ký lỗi import | `ADMIN`, `MANAGER` |
| `exports.view` | Xuất dữ liệu bệnh nhân, hóa đơn, sổ quỹ, kho ra CSV | `ADMIN`, `MANAGER`, `ACCOUNTANT` |
| `notifications.view` | Xem danh sách thông báo và cảnh báo cá nhân | Mọi vai trò đã đăng nhập |
| `notifications.read` | Đánh dấu thông báo đã đọc | Mọi vai trò đã đăng nhập |
| `alert_rules.manage` | Cấu hình ngưỡng cảnh báo & kích hoạt quét cảnh báo | `ADMIN`, `MANAGER` |
| `approvals.view` | Xem danh sách yêu cầu phê duyệt | `ADMIN`, `MANAGER`, `ACCOUNTANT`, `VIEWER` |
| `approvals.manage` | Phê duyệt hoặc từ chối phiếu chi / đề xuất | `ADMIN`, `MANAGER` |

---

## 2. PHÂN HỆ DASHBOARD TỔNG QUAN (`/api/v1/dashboard`)

### 2.1. Thống kê Chỉ số Tổng quan (Summary KPIs)
- **Endpoint:** `GET /api/v1/dashboard/summary`
- **Quyền hạn:** `auth:sanctum`, `active_user`
- **Query Parameters:**
  - `start_date` *(tùy chọn)*: `YYYY-MM-DD`
  - `end_date` *(tùy chọn)*: `YYYY-MM-DD`
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "invoiced_amount": 145000000,
    "collected_amount": 128500000,
    "remaining_debt": 16500000,
    "total_expense": 34200000,
    "net_cashflow": 94300000,
    "today_visits": 24,
    "period_visits": 312,
    "today_appointments": 18,
    "new_patients": 45,
    "low_stock_products_count": 3,
    "pending_approvals_count": 2
  }
}
```

### 2.2. Biểu đồ Doanh thu & Dòng tiền (`recharts`)
- **Endpoint:** `GET /api/v1/dashboard/revenue-chart`
- **Quyền hạn:** `auth:sanctum`, `active_user`
- **Query Parameters:** `days` (mặc định: `14`), `start_date`, `end_date`
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-10-21",
      "invoiced_amount": 12500000,
      "collected_amount": 11000000,
      "expense_amount": 2500000,
      "net_cashflow": 8500000
    },
    {
      "date": "2026-10-22",
      "invoiced_amount": 15000000,
      "collected_amount": 14200000,
      "expense_amount": 1800000,
      "net_cashflow": 12400000
    }
  ]
}
```

### 2.3. Xu hướng Lượt khám & Trạng thái
- **Endpoint:** `GET /api/v1/dashboard/visit-trends`
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-10-22",
      "total_visits": 35,
      "completed": 28,
      "in_progress": 4,
      "waiting": 2,
      "cancelled": 1
    }
  ]
}
```

### 2.4. Top Bác sĩ & Dịch vụ Nổi bật
- **Endpoint:** `GET /api/v1/dashboard/top-performers`
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "top_doctors": [
      {
        "employee_id": 3,
        "doctor_name": "BS. Nguyễn Văn A",
        "visits_count": 86,
        "revenue": 54200000
      }
    ],
    "top_services": [
      {
        "service_id": 1,
        "service_name": "Khám Nội Tổng Quát",
        "usage_count": 142,
        "total_revenue": 21300000
      }
    ]
  }
}
```

---

## 3. PHÂN HỆ HÓA ĐƠN & THANH TOÁN NHIỀU ĐỢT (`/api/v1/invoices`, `/api/v1/payments`)

### 3.1. Danh sách Hóa đơn
- **Endpoint:** `GET /api/v1/invoices`
- **Quyền hạn:** `invoices.view`
- **Query Parameters:**
  - `status`: `UNPAID` | `PARTIAL` | `PAID` | `CANCELLED`
  - `patient_id`: Lọc theo bệnh nhân
  - `visit_id`: Lọc theo lượt khám
  - `search`: Tìm theo mã hóa đơn (`INV-...`) hoặc tên/mã/SĐT bệnh nhân
  - `start_date`, `end_date`: Khoảng ngày phát hành `issued_at`
  - `page`, `per_page`: Phân trang
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "invoice_code": "INV-20261028-0010",
      "patient_id": 5,
      "patient": {
        "id": 5,
        "patient_code": "BN000005",
        "full_name": "Trần Thị Lan",
        "phone": "0987123456"
      },
      "visit_id": 12,
      "subtotal_amount": 1000000.00,
      "discount_amount": 100000.00,
      "total_amount": 900000.00,
      "paid_amount": 400000.00,
      "remaining_amount": 500000.00,
      "status": "PARTIAL",
      "issued_at": "2026-10-28 09:30:00",
      "note": "Khám và làm xét nghiệm tổng quát",
      "payments_count": 1
    }
  ]
}
```

### 3.2. Lập Hóa đơn Mới
- **Endpoint:** `POST /api/v1/invoices`
- **Quyền hạn:** `invoices.create`
- **Request Body:**
```json
{
  "patient_id": 5,
  "visit_id": 12,
  "patient_package_id": null,
  "subtotal_amount": 1000000,
  "discount_amount": 100000,
  "issued_at": "2026-10-28 09:30:00",
  "note": "Hóa đơn viện phí khám bệnh"
}
```
- **Xử lý nghiệp vụ:**
  - Khởi tạo `total_amount = subtotal_amount - discount_amount`.
  - Khởi tạo `paid_amount = 0`, `remaining_amount = total_amount`.
  - Gán trạng thái `status = 'UNPAID'` (hoặc `PAID` nếu `total_amount == 0`).
  - Tự động sinh `invoice_code = INV-YYYYMMDD-XXXX`.
  - Nếu có `visit_id`, đồng bộ `visit.payment_status`.

### 3.3. Xem Chi tiết Hóa đơn & Lịch sử Thu tiền
- **Endpoint:** `GET /api/v1/invoices/{id}`
- **Quyền hạn:** `invoices.view`
- **Phản hồi:** Trả về đầy đủ thông tin hóa đơn, bệnh nhân, lượt khám, bác sĩ phụ trách và mảng `payments` các đợt thanh toán trước đó.

### 3.4. Thu tiền Hóa đơn Nhiều đợt (Multi-stage Payment)
- **Endpoint:** `POST /api/v1/invoices/{invoice}/payments` (hoặc `POST /api/v1/payments`)
- **Quyền hạn:** `payments.create`
- **Request Body:**
```json
{
  "amount": 500000,
  "payment_method": "CASH",
  "payment_date": "2026-10-28",
  "reference_code": "REF-CASH-01",
  "note": "Thu đợt 2 - tất toán hóa đơn"
}
```
- **Xử lý An toàn Giao dịch & Chống Race Condition:**
  - Thực thi trong `DB::transaction()`.
  - Khóa bi quan bản ghi hóa đơn: `Invoice::whereKey($id)->lockForUpdate()->firstOrFail()`.
  - Chặn `422` nếu `amount <= 0` hoặc `amount > invoice->remaining_amount`.
  - Chặn `422` nếu hóa đơn đã `PAID` hoặc `CANCELLED`.
  - Sinh mã `payment_code = PAY-YYYYMMDD-XXXX`.
  - Cập nhật số tiền: `paid_amount += amount`, `remaining_amount = total_amount - paid_amount`.
  - Cập nhật `status = (remaining_amount == 0 ? 'PAID' : 'PARTIAL')`.
  - Đồng bộ `visit.payment_status` tương ứng.
  - **Tự động ghi bút toán thu vào Sổ quỹ:** Sinh bản ghi `CashTransaction` loại `IN`, `reference_type = 'Payment'`, `reference_id = $payment->id`, `amount = $payment->amount`.
- **Phản hồi mẫu (`201 Created`):**
```json
{
  "success": true,
  "message": "Thu tiền hóa đơn thành công",
  "data": {
    "id": 15,
    "payment_code": "PAY-20261028-0015",
    "invoice_id": 10,
    "amount": 500000.00,
    "payment_method": "CASH",
    "payment_date": "2026-10-28",
    "invoice": {
      "id": 10,
      "status": "PAID",
      "paid_amount": 900000.00,
      "remaining_amount": 0.00
    }
  }
}
```

### 3.5. Hủy Hóa đơn (Chống thất thoát)
- **Endpoint:** `PATCH /api/v1/invoices/{invoice}/cancel`
- **Quyền hạn:** `invoices.update`
- **Quy tắc an toàn:** Chỉ cho phép hủy khi `paid_amount == 0`. Nếu hóa đơn đã phát sinh thu tiền (dù chỉ 1 đợt), hệ thống trả về lỗi `422 Unprocessable Entity` để bảo vệ sổ quỹ và chứng từ kế toán.

---

## 4. PHÂN HỆ QUẢN LÝ CÔNG NỢ (`/api/v1/debts`)

### 4.1. Báo cáo Tổng hợp & Tuổi nợ (Aging Receivable)
- **Endpoint:** `GET /api/v1/debts/summary`
- **Quyền hạn:** `debts.view`
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "total_invoiced": 250000000.00,
    "total_collected": 215000000.00,
    "total_remaining_debt": 35000000.00,
    "debtor_patients_count": 14,
    "unpaid_invoices_count": 8,
    "partial_invoices_count": 11,
    "aging": {
      "current_0_to_7_days": 18000000.00,
      "due_8_to_30_days": 12000000.00,
      "overdue_over_30_days": 5000000.00
    }
  }
}
```

### 4.2. Danh sách Bệnh nhân Có Công nợ
- **Endpoint:** `GET /api/v1/debts/patients`
- **Quyền hạn:** `debts.view`
- **Query Parameters:** `search` (tên/mã/SĐT), `sort_by=remaining_amount`, `page`, `per_page`
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "patient_id": 5,
      "patient_code": "BN000005",
      "full_name": "Trần Thị Lan",
      "phone": "0987123456",
      "total_invoiced": 5500000.00,
      "total_paid": 3000000.00,
      "total_remaining_debt": 2500000.00,
      "unpaid_invoices_count": 2,
      "latest_debt_date": "2026-10-20"
    }
  ]
}
```

### 4.3. Sổ chi tiết Công nợ Bệnh nhân
- **Endpoint:** `GET /api/v1/debts/patients/{patient}` hoặc `GET /api/v1/patients/{patient}/debts`
- **Quyền hạn:** `debts.view`
- **Phản hồi:** Danh sách các hóa đơn của bệnh nhân đó, chi tiết tiền nợ từng hóa đơn và lịch sử các đợt trả tiền.

---

## 5. PHÂN HỆ THU CHI & SỔ QUÝ TẬP TRUNG (`/api/v1/cash-transactions`, `/api/v1/cashbook`)

### 5.1. Báo cáo Tổng hợp Sổ Quỹ
- **Endpoint:** `GET /api/v1/cash-transactions/summary` (Alias: `GET /api/v1/cashbook/summary`)
- **Quyền hạn:** `cash_transactions.view`
- **Query Parameters:** `start_date`, `end_date`
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "opening_balance": 50000000.00,
    "total_in": 128500000.00,
    "total_out": 34200000.00,
    "net_change": 94300000.00,
    "closing_balance": 144300000.00,
    "by_method": {
      "CASH": {
        "in": 45000000.00,
        "out": 12000000.00,
        "net": 33000000.00
      },
      "BANK_TRANSFER": {
        "in": 78500000.00,
        "out": 22200000.00,
        "net": 56300000.00
      },
      "CARD": {
        "in": 5000000.00,
        "out": 0.00,
        "net": 5000000.00
      }
    }
  }
}
```

### 5.2. Danh sách Nhật ký Giao dịch Quỹ
- **Endpoint:** `GET /api/v1/cash-transactions` (Alias: `GET /api/v1/cashbook`)
- **Query Parameters:** `transaction_type` (`IN` | `OUT`), `payment_method`, `start_date`, `end_date`, `search`
- **Phản hồi:** Trả về danh sách phân trang các phiếu thu/chi, mã tham chiếu nghiệp vụ gốc (`Payment`, `Expense`, `InitialFund`).

### 5.3. Tạo Giao dịch Quỹ Thủ công
- **Endpoint:** `POST /api/v1/cash-transactions`
- **Quyền hạn:** `cash_transactions.create`
- **Request Body:**
```json
{
  "transaction_type": "IN",
  "amount": 20000000,
  "payment_method": "CASH",
  "transaction_date": "2026-10-28",
  "description": "Bổ sung tiền mặt vào quỹ đầu ngày"
}
```

---

## 6. PHÂN HỆ KHO THUỐC & VẬT TƯ Y TẾ (`/api/v1/products`, `/api/v1/inventory-transactions`)

### 6.1. Danh mục Sản phẩm & Tồn kho Hiện tại
- **Endpoint:** `GET /api/v1/products`
- **Quyền hạn:** `products.view`
- **Query Parameters:**
  - `low_stock_only=1`: Chỉ lọc các sản phẩm có `current_stock <= minimum_stock`
  - `status`: `ACTIVE` | `INACTIVE`
  - `search`: Mã (`PRD-...`) hoặc tên sản phẩm
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product_code": "PRD-001",
      "name": "Băng gạc tiệt trùng 10x10cm",
      "unit": "Hộp",
      "selling_price": 45000.00,
      "minimum_stock": 5.000,
      "current_stock": 4.000,
      "is_low_stock": true,
      "stock_status": "LOW_STOCK",
      "status": "ACTIVE"
    }
  ]
}
```

### 6.2. Tạo Sản phẩm Mới
- **Endpoint:** `POST /api/v1/products`
- **Quyền hạn:** `products.create`
- **Request Body:**
```json
{
  "name": "Dung dịch sát khuẩn Povidone 500ml",
  "unit": "Chai",
  "selling_price": 65000,
  "minimum_stock": 10,
  "initial_stock": 25,
  "description": "Dung dịch sát khuẩn vết thương ngoài da"
}
```
*(Nếu `initial_stock > 0`, hệ thống tự động sinh 1 giao dịch kho loại `IN` để ghi nhận tồn đầu kỳ).*

### 6.3. Giao dịch Kho: Nhập / Xuất / Kiểm kê (Anti-Negative Stock)
- **Endpoint:** `POST /api/v1/inventory-transactions`
- **Quyền hạn:** `inventory.in` (khi loại `IN`), `inventory.out` (khi loại `OUT`), `inventory.adjust` (khi loại `ADJUST`)
- **Request Body:**
```json
{
  "product_id": 1,
  "transaction_type": "OUT",
  "quantity": 2,
  "reference_type": "CLINIC_USAGE",
  "description": "Xuất cấp phòng tiểu phẫu ca khám #12"
}
```
- **Xử lý An toàn Kho & Cảnh báo:**
  - `DB::transaction()` + `Product::lockForUpdate()`.
  - Tính toán `current_stock` chính xác từ sổ kho.
  - Khi `OUT`: Kiểm tra `quantity <= current_stock`. Nếu vượt quá tồn, lập tức từ chối `422 Unprocessable Entity` với thông báo lỗi rõ ràng: *"Số lượng xuất vượt quá tồn kho hiện tại"*.
  - Khi `ADJUST`: Cho phép số lượng dương hoặc âm nhưng đảm bảo `current_stock + quantity >= 0`.
  - **Tự động Cảnh báo:** Nếu tồn kho sau giao dịch `<= minimum_stock`, hệ thống tự động gửi `Notification` loại `LOW_STOCK` tới các Quản lý và Admin.

### 6.4. Tổng quan Thống kê Tồn kho
- **Endpoint:** `GET /api/v1/inventory-transactions/summary` (Alias: `GET /api/v1/inventory/summary`)
- **Phản hồi:** Số lượng mặt hàng theo trạng thái: `total_items`, `normal_count`, `low_stock_count`, `out_of_stock_count`.

---

## 7. PHÂN HỆ KPI NHÂN VIÊN (`/api/v1/kpi-targets`)

### 7.1. Danh sách Chỉ tiêu & Kết quả Thực đạt Tự động
- **Endpoint:** `GET /api/v1/kpi-targets`
- **Quyền hạn:** `kpi_targets.view`
- **Query Parameters:** `employee_id`, `start_date`, `end_date`, `status`
- **Thuật toán Tự động Đối soát:**
  - `actual_revenue`: Tự động tính tổng doanh thu từ các hóa đơn `PAID` do nhân viên lập/phụ trách trong kỳ.
  - `actual_visits`: Tự động đếm số lượt khám `COMPLETED` của bác sĩ trong khoảng thời gian `period_start` → `period_end`.
  - `revenue_completion_rate`: `(actual_revenue / target_revenue) * 100%`.
  - `visits_completion_rate`: `(actual_visits / target_visits) * 100%`.
  - `evaluation_status`: `EXCEEDED` (>= 100%), `ON_TRACK` (>= 75%), `BEHIND` (< 75%).
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employee_id": 3,
      "employee": {
        "id": 3,
        "employee_code": "BS001",
        "full_name": "BS. Nguyễn Văn A",
        "department": "Khám tổng quát"
      },
      "target_revenue": 50000000.00,
      "actual_revenue": 54200000.00,
      "revenue_completion_rate": 108.4,
      "target_visits": 100,
      "actual_visits": 112,
      "visits_completion_rate": 112.0,
      "evaluation_status": "EXCEEDED",
      "period_start": "2026-10-01",
      "period_end": "2026-10-31"
    }
  ]
}
```

### 7.2. Giao Chỉ tiêu KPI Mới
- **Endpoint:** `POST /api/v1/kpi-targets`
- **Quyền hạn:** `kpi_targets.manage`
- **Ràng buộc:** Kiểm tra ngăn chặn thiết lập trùng lặp hoặc giao thoa kỳ hạn cho cùng một nhân viên.

---

## 8. PHÂN HỆ BÁO CÁO QUẢN TRỊ (`/api/v1/reports`)

### 8.1. Báo cáo Tài chính & Dòng tiền
- **Endpoint:** `GET /api/v1/reports/financial`
- **Quyền hạn:** `reports.view`
- **Query Parameters:** `start_date`, `end_date`
- **Dữ liệu trả về:** Doanh thu hóa đơn phát sinh, Thực thu tiền mặt/chuyển khoản, Chi phí theo danh mục (`expenses_by_category`), Lợi nhuận gộp và biểu đồ thời gian chuỗi ngày.

### 8.2. Báo cáo Hoạt động Lâm sàng
- **Endpoint:** `GET /api/v1/reports/clinical`
- **Quyền hạn:** `reports.view`
- **Dữ liệu trả về:** Lịch hẹn (đúng giờ, đến trễ, hủy), Tỷ lệ đến khám, Lượt khám phân bổ theo chuyên khoa/bác sĩ, Tần suất sử dụng các gói dịch vụ.

### 8.3. Báo cáo Nhập Xuất Tồn Kho
- **Endpoint:** `GET /api/v1/reports/inventory`
- **Quyền hạn:** `reports.view`
- **Dữ liệu trả về:** Bảng tổng hợp Tồn đầu kỳ, Nhập trong kỳ, Xuất trong kỳ, Điều chỉnh kiểm kê, Tồn cuối kỳ và Trị giá vốn hàng tồn kho của từng sản phẩm.

---

## 9. PHÂN HỆ IMPORT & EXPORT DỮ LIỆU (`/api/v1/imports`, `/api/v1/exports`)

### 9.1. Tải Template CSV Chuẩn Mẫu
- **Endpoint:** `GET /api/v1/imports/templates/{module}`
- **Modules hỗ trợ:** `patients`, `services`, `products`
- **Quyền hạn:** `imports.manage`
- **Phản hồi:** Trả về file CSV đính kèm header chuẩn mực (kèm dòng dữ liệu mẫu) có UTF-8 BOM.

### 9.2. Import Dữ liệu CSV Kèm Lưu vết Lỗi Từng Dòng
- **Endpoint:** `POST /api/v1/imports/{module}`
- **Content-Type:** `multipart/form-data`
- **Payload:** `file` (File `.csv` hoặc `.txt`)
- **Cơ chế Xử lý:**
  - Khởi tạo bản ghi `ImportBatch` (`status = 'PROCESSING'`).
  - Duyệt tuần tự từng dòng trong file CSV.
  - Các dòng hợp lệ: Chèn/cập nhật dữ liệu vào DB, tăng `success_rows`.
  - Các dòng vi phạm (thiếu trường, sai định dạng, giá trị âm, trùng mã): Ghi chi tiết vào bảng `import_errors` (`row_number`, `column_name`, `error_message`, `raw_data`), tăng `error_rows`.
  - Cập nhật trạng thái đợt import sang `COMPLETED` (nếu không có lỗi) hoặc `COMPLETED_WITH_ERRORS`.
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "message": "Xử lý import hoàn tất",
  "data": {
    "batch_id": 4,
    "module": "products",
    "total_rows": 50,
    "success_rows": 48,
    "error_rows": 2,
    "status": "COMPLETED_WITH_ERRORS",
    "errors": [
      {
        "row_number": 15,
        "column_name": "selling_price",
        "error_message": "Giá bán không được âm",
        "raw_data": { "product_code": "PRD-015", "selling_price": "-5000" }
      }
    ]
  }
}
```

### 9.3. Xuất Dữ liệu Báo cáo CSV Chuẩn UTF-8 BOM
- **Endpoints:**
  - `GET /api/v1/exports/patients`: Xuất danh sách bệnh nhân
  - `GET /api/v1/exports/invoices`: Xuất hóa đơn và tình trạng công nợ
  - `GET /api/v1/exports/cashbook`: Xuất sổ cái thu chi quỹ
  - `GET /api/v1/exports/inventory`: Xuất danh mục và báo cáo tồn kho
- **Headers trả về:**
  ```http
  Content-Type: text/csv; charset=UTF-8
  Content-Disposition: attachment; filename="export_*.csv"
  ```

---

## 10. PHÂN HỆ THÔNG BÁO, CẢNH BÁO & PHÊ DUYỆT (`/api/v1/notifications`, `/api/v1/alert-rules`, `/api/v1/approval-requests`)

### 10.1. Danh sách Thông báo Người dùng
- **Endpoint:** `GET /api/v1/notifications`
- **Query Parameters:** `unread_only=1`
- **Phản hồi mẫu (`200 OK`):**
```json
{
  "success": true,
  "unread_count": 2,
  "data": [
    {
      "id": 18,
      "type": "LOW_STOCK",
      "title": "Cảnh báo tồn kho thấp",
      "content": "Vật tư [Băng gạc tiệt trùng 10x10cm] chỉ còn 4 Hộp (ngưỡng tối thiểu: 5 Hộp)",
      "reference_type": "Product",
      "reference_id": 1,
      "is_read": false,
      "created_at": "2026-10-28 10:15:00"
    }
  ]
}
```

### 10.2. Đánh dấu Đã đọc Thông báo
- `PATCH /api/v1/notifications/{id}/read` (1 thông báo)
- `POST /api/v1/notifications/read-all` (Tất cả thông báo của user)

### 10.3. Quy tắc Cảnh báo & Quét Tự động
- `GET /api/v1/alert-rules`: Danh sách quy tắc cấu hình cảnh báo.
- `POST /api/v1/alerts/scan` (Alias: `POST /api/v1/alert-rules/scan`): Kích hoạt quét tự động hệ thống để phát hiện:
  1. Sản phẩm rơi xuống dưới định mức tồn kho tối thiểu (`LOW_STOCK`).
  2. Gói khám của bệnh nhân sắp hết hạn trong vòng 7 ngày hoặc sắp hết buổi (`PACKAGE_EXPIRING`).
  3. Hóa đơn công nợ quá hạn thanh toán trên 30 ngày (`OVERDUE_INVOICE`).

### 10.4. Quy trình Phê duyệt Tập trung (Approval Workflow)
- **Endpoint:** `GET /api/v1/approval-requests` (Xem danh sách đề xuất)
- **Endpoint Tạo Yêu cầu:** `POST /api/v1/approval-requests`
  ```json
  {
    "request_type": "EXPENSE_APPROVAL",
    "reference_type": "Expense",
    "reference_id": 5,
    "reason": "Đề nghị duyệt chi mua dung dịch sát khuẩn Chloramin B"
  }
  ```
- **Endpoint Duyệt Yêu cầu:** `POST /api/v1/approval-requests/{id}/approve`
  - Thực thi trong `DB::transaction()` + `lockForUpdate()`.
  - Cập nhật `ApprovalRequest` sang `APPROVED`, gán `approved_by = Auth::id()`, `approved_at = now()`.
  - Đồng bộ trạng thái của `Expense` tương ứng sang `APPROVED`.
  - **Tự động sinh bút toán chi (`OUT`) vào Sổ quỹ `cash_transactions`**.
  - **Tự động gửi thông báo (`Notification`) loại `APPROVAL_APPROVED` cho người đề xuất**.
- **Endpoint Từ chối Yêu cầu:** `POST /api/v1/approval-requests/{id}/reject`
  - Yêu cầu truyền `rejection_reason`.
  - Đồng bộ `Expense` sang `REJECTED` và gửi thông báo `APPROVAL_REJECTED` cho người đề xuất.

---

## 11. BẢO MẬT & CONCURRENCY CONTROL (ĐẶC TẢ GIAI ĐOẠN 2)

1. **Khóa bi quan (Pessimistic Locking):**
   Mọi luồng biến động tài chính (`Invoice`, `Payment`, `Expense`, `CashTransaction`) và biến động kho (`Product`, `InventoryTransaction`) bắt buộc dùng câu lệnh `->lockForUpdate()` bên trong `DB::transaction()`. Cơ chế này ngăn chặn tuyệt đối tình trạng:
   - Thu tiền vượt quá số tiền còn nợ của hóa đơn.
   - Duyệt chi trùng 2 lần dẫn đến trừ quỹ 2 lần.
   - Xuất kho vượt quá số lượng tồn thực tế (âm kho).
2. **Bảo toàn Số học (Decimal Precision):**
   Mọi trường số tiền (`total_amount`, `paid_amount`, `remaining_amount`, `amount`) được lưu trữ kiểu `DECIMAL(15,2)` và định lượng kho (`quantity`, `current_stock`, `minimum_stock`) kiểu `DECIMAL(15,3)` trên MySQL 8.0, loại trừ hoàn toàn sai số làm tròn số thực dấu phẩy động (floating point precision error).
3. **Kiểm tra Tích hợp End-to-End:**
   Toàn bộ các API trên đã được kiểm chứng hoạt động đồng bộ qua bộ test tích hợp `be/tests/Feature/Phase2EndToEndWorkflowTest.php` với 4 kịch bản liên hoàn đạt tỷ lệ thành công 100%.
