# PROGRESS — QLPK (`PHASE-01` ARCHIVED & `PHASE-02` ACTIVE)

## 1. Đối chiếu Giai đoạn 1 (`PHASE-01` — ĐÃ HOÀN TẤT `30 / 30 DONE`)
- **Trạng thái Giai đoạn 1:** `COMPLETED (30 / 30 Tasks DONE)`
- **Tài liệu đối chiếu Giai đoạn 1:**
  - Danh sách 30 Task Giai đoạn 1: [`docs/phase-1/PHASE_1_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_TASKS.md)
  - Báo cáo bàn giao Giai đoạn 1: [`docs/phase-1/PHASE_1_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_REPORT.md)
  - Tài liệu API & CSDL Giai đoạn 1: [`docs/phase-1/API_DOCUMENTATION.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/API_DOCUMENTATION.md), [`docs/phase-1/DATABASE_DESIGN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/DATABASE_DESIGN.md)
  - Bản lưu trữ bảng tiến độ Giai đoạn 1: [`PROGRESS-PHASE-1-ARCHIVE.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/qlpk-autonomous-framework/PROGRESS-PHASE-1-ARCHIVE.md)
- **Kết quả kiểm thử nền Giai đoạn 1:** `285 PHPUnit tests / 2,602 assertions PASS`, `Pint PASS`, `Next.js 28 routes build PASS`.

---

## 2. Tổng quan Giai đoạn 2 (`PHASE-02` — Tài chính, Kho Dược, Báo cáo & UI `shadcn/ui` Chuyên nghiệp)
- **Framework status:** `READY_FOR_PHASE_2_EXECUTION`
- **Current phase:** `PHASE-02` — Hoàn thiện tài chính, kho dược, báo cáo, UI `shadcn/ui` + `lucide-react` + `recharts` và quản trị vận hành
- **Tài liệu khảo sát & kế hoạch (`F2-01-01`):** [`docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md)
- **Đặc tả 30 Task Giai đoạn 2:** [`docs/phase-2/PHASE_2_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_TASKS.md)
- **Total tasks in Phase 2:** `30` (`P2-001` → `P2-030` thuộc 11 Features `F2-01` → `F2-11`)
- **Completed (`DONE`):** `17 / 30` Tasks (`P2-001` → `P2-011`, `P2-013` → `P2-019`)
- **Remaining:** `13 / 30` Tasks (`P2-012`, `P2-020` → `P2-030`)
- **Configured Models (`agy 1.4.7`):**
  - Planner: `claude-sonnet-5-5-high`
  - Coder: `gemini-3.8-flash-high`
  - Reviewer: `gemini-4-argon-high`
  - Debug fallback: `gemini-3.8-flash-high`
  - Arch/Security escalation: `gemini-4-argon-high`

---

## 3. Bảng trạng thái 30 Task Giai đoạn 2 (`PHASE-02`)

| Task ID | Feature | Ưu tiên | Status | Test status | Review status | Round | Coder / Reviewer Model | Evidence Report | Mô tả ngắn |
|---|---|---|---|---|---|---:|---|---|---|
| `P2-001` | `F2-01` | P0 | `DONE` | `PASS` | `PASS` | 1/3 | `claude-sonnet-5-5-high` / `gemini-4-argon-high` | `docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md` | Khảo sát Giai đoạn 1 & lập kế hoạch Giai đoạn 2 (`F2-01-01`) |
| `P2-002` | `F2-01` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-002.md` | Cài đặt `lucide-react`, `recharts` & bộ UI `shadcn/ui` Core Design System |
| `P2-003` | `F2-01` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-003.md` | Nâng cấp `AdminShell.tsx` & Login UI chuyên nghiệp (`shadcn/ui` + `lucide-react`) |
| `P2-004` | `F2-02` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-004.md` | Mở rộng `RolePermissionSeeder` & dữ liệu mẫu cho Giai đoạn 2 |
| `P2-005` | `F2-02` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-005.md` | Xây dựng API Dashboard Tổng quan (`/api/v1/dashboard/*`) |
| `P2-006` | `F2-02` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-006.md` | Giao diện Dashboard Tổng quan với `shadcn/ui` & biểu đồ `recharts` |
| `P2-007` | `F2-03` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-007.md` | Xây dựng API Quản lý Hóa đơn (`/api/v1/invoices`) |
| `P2-008` | `F2-03` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-008.md` | Xây dựng API Thanh toán Hóa đơn nhiều đợt (`/api/v1/payments`) + ghi quỹ |
| `P2-009` | `F2-03` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-009.md` | Giao diện Hóa đơn & Thu ngân nhiều đợt (`/invoices`, `/invoices/[id]`) |
| `P2-010` | `F2-04` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-010.md` | Xây dựng API Theo dõi & Đối soát Công nợ (`/api/v1/debts`) |
| `P2-011` | `F2-04` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-011.md` | Giao diện Quản lý Công nợ & Thu nợ nhanh (`/debts`) |
| `P2-012` | `F2-05` | P1 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-012.md` | Xây dựng API Danh mục Chi phí & Phiếu chi (`/api/v1/expenses`) |
| `P2-013` | `F2-05` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-013.md` | Xây dựng API Sổ quỹ & Dòng tiền (`/api/v1/cash-transactions`) |
| `P2-014` | `F2-05` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-014.md` | Giao diện Thu chi & Sổ quỹ chuyên nghiệp (`/finance/cashbook`) |
| `P2-015` | `F2-06` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-015.md` | Xây dựng API Danh mục Sản phẩm & Tồn kho (`/api/v1/products`) |
| `P2-016` | `F2-06` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-016.md` | Xây dựng API Giao dịch Nhập/Xuất/Kiểm kê Kho chống âm kho |
| `P2-017` | `F2-06` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-017.md` | Giao diện Quản lý Kho Thuốc, Vật tư & Cảnh báo tồn kho (`/inventory`) |
| `P2-018` | `F2-07` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-018.md` | Xây dựng API Chỉ tiêu & Thực đạt KPI Nhân viên (`/api/v1/kpi-targets`) |
| `P2-019` | `F2-07` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `claude-sonnet-5-5-high` | `reports/tasks/P2-019.md` | Giao diện Quản lý KPI Nhân viên & Biểu đồ hiệu suất (`/kpi`) |
| `P2-020` | `F2-08` | P1 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-020.md` | Xây dựng API Báo cáo Quản trị Tài chính, Khám bệnh & Kho (`/api/v1/reports`) |
| `P2-021` | `F2-08` | P1 | `BLOCKED` | `FAIL` | `FAIL` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-021.md` | Giao diện Trung tâm Báo cáo Quản trị đa chiều (`/reports`) |
| `P2-022` | `F2-09` | P1 | `BLOCKED` | `FAIL` | `FAIL` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-022.md` | Xây dựng API Import CSV kèm lưu vết lỗi `import_errors` (`/api/v1/imports`) |
| `P2-023` | `F2-09` | P1 | `BLOCKED` | `FAIL` | `FAIL` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-023.md` | Xây dựng API Export CSV UTF-8 BOM cho Bệnh nhân/Hóa đơn/Quỹ/Kho (`/api/v1/exports`) |
| `P2-024` | `F2-09` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-024.md` | Giao diện Trung tâm Import / Export Dữ liệu (`/data-transfer`) |
| `P2-025` | `F2-10` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-025.md` | Xây dựng API Quy tắc Cảnh báo & Thông báo (`/api/v1/notifications`, `/api/v1/alert-rules`) |
| `P2-026` | `F2-10` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-026.md` | Xây dựng API Phê duyệt Tập trung (`/api/v1/approval-requests`) |
| `P2-027` | `F2-10` | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-027.md` | Giao diện Trung tâm Phê duyệt (`/approvals`), Thông báo (`/notifications`) & Chuông Topbar |
| `P2-028` | `F2-11` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-028.md` | Kiểm thử tích hợp End-to-End Giai đoạn 2 (`Phase2EndToEndWorkflowTest`) |
| `P2-029` | `F2-11` | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P2-029.md` | Kiểm thử đồng bộ toàn diện Backend + Frontend (Lint, Typecheck, Build) |
| `P2-030` | `F2-11` | P0 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `docs/phase-2/PHASE_2_REPORT.md` | Hoàn thiện tài liệu & Báo cáo bàn giao Giai đoạn 2 (`PHASE_2_REPORT.md`) |

---

## 4. Quy tắc cập nhật và Chống trạng thái DONE giả
1. Sau mỗi task, `run-agy.sh` tự động cập nhật trạng thái kèm `RUN_ID`, thời gian chạy, model đã dùng, đường dẫn report và tự động commit lên nhánh `dev`.
2. Không bao giờ thay `NOT_RUN` thành `PASS` hoặc `DONE` nếu chưa thực thi thật.
