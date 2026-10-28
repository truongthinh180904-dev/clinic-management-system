# ROADMAP ARCHIVE — GIAI ĐOẠN 2 (`PHASE-02` — HOÀN TẤT 30 / 30 TASKS DONE)
## Hoàn thiện Tài chính, Kho Dược, Báo cáo, UI Chuyên nghiệp (`shadcn/ui` + `lucide-react` + `recharts`) và Quản trị Vận hành

- **Mã giai đoạn:** `PHASE-02`
- **Trạng thái:** `COMPLETED (30 / 30 Tasks DONE)`
- **Tài liệu đối chiếu Giai đoạn 1:** [`docs/phase-1/PHASE_1_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_TASKS.md), [`docs/phase-1/PHASE_1_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_REPORT.md)
- **Báo cáo bàn giao Giai đoạn 2:** [`docs/phase-2/PHASE_2_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_REPORT.md)
- **Tài liệu kỹ thuật API Phase 2:** [`docs/phase-2/API_DOCUMENTATION_PHASE_2.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/API_DOCUMENTATION_PHASE_2.md)
- **Tổng số Feature Giai đoạn 2:** `11 Features` (`F2-01` → `F2-11`)
- **Tổng số Task Giai đoạn 2:** `30 Tasks` (`P2-001` → `P2-030` — 100% DONE)

---

## BẢNG ÁNH XẠ 11 FEATURES (`F2-01` → `F2-11`) SANG 30 TASKS (`P2-001` → `P2-030`)

| Feature | Nội dung | Danh sách Tasks | Kết quả đầu ra |
|---|---|---|---|
| **`F2-01`** | Chuẩn hóa UI (`shadcn/ui` + `lucide-react`) và Layout quản trị | `P2-001`, `P2-002`, `P2-003` | Báo cáo khảo sát, bộ UI components `shadcn/ui`, `AdminShell` chuyên nghiệp |
| **`F2-02`** | Mở rộng RBAC Phase 2 & Dashboard tổng quan (`recharts`) | `P2-004`, `P2-005`, `P2-006` | Quyền RBAC Phase 2, API Dashboard & UI Dashboard biểu đồ `recharts` |
| **`F2-03`** | Hóa đơn và Thanh toán nhiều đợt | `P2-007`, `P2-008`, `P2-009` | API Hóa đơn, API Thu tiền nhiều đợt + ghi quỹ, UI Hóa đơn & Thu ngân |
| **`F2-04`** | Quản lý Công nợ | `P2-010`, `P2-011` | API Đối soát phải thu/đã thu/còn nợ & UI Quản lý Công nợ |
| **`F2-05`** | Thu chi và Quản lý Sổ quỹ | `P2-012`, `P2-013`, `P2-014` | API Danh mục chi & Phiếu chi, API Sổ quỹ `cash_transactions`, UI Sổ quỹ |
| **`F2-06`** | Quản lý Kho Thuốc & Vật tư | `P2-015`, `P2-016`, `P2-017` | API Sản phẩm, API Nhập/Xuất/Kiểm kê kho chống âm kho, UI Kho & Cảnh báo |
| **`F2-07`** | KPI Nhân viên | `P2-018`, `P2-019` | API Chỉ tiêu & Thực đạt KPI tự động, UI KPI & Biểu đồ hiệu suất |
| **`F2-08`** | Báo cáo Quản trị | `P2-020`, `P2-021` | API Báo cáo Tài chính/Khám bệnh/Kho & UI Trung tâm Báo cáo |
| **`F2-09`** | Import / Export Dữ liệu | `P2-022`, `P2-023`, `P2-024` | API Import CSV kèm lưu vết lỗi `import_errors`, API Export CSV & UI |
| **`F2-10`** | Thông báo, Cảnh báo & Phê duyệt | `P2-025`, `P2-026`, `P2-027` | API Cảnh báo & Thông báo, API Phê duyệt `approval_requests`, UI & Chuông Topbar |
| **`F2-11`** | Kiểm thử Tích hợp & Nghiệm thu Giai đoạn 2 | `P2-028`, `P2-029`, `P2-030` | E2E Tests Phase 2, Kiểm tra toàn diện BE/FE & Báo cáo `PHASE_2_REPORT.md` |

---

## DANH SÁCH 30 TASKS GIAI ĐOẠN 2 ĐÃ HOÀN TẤT (`100% DONE`)

1. **`P2-001`**: Khảo sát hiện trạng Giai đoạn 1 và lập kế hoạch Giai đoạn 2 (`F2-01-01`)
2. **`P2-002`**: Cài đặt `lucide-react`, `recharts` & bộ UI `shadcn/ui` Core Design System (`F2-01-02`)
3. **`P2-003`**: Nâng cấp `AdminShell.tsx` & Login UI chuyên nghiệp (`F2-01-03`)
4. **`P2-004`**: Mở rộng `RolePermissionSeeder` cho Phase 2 (`F2-02-01`)
5. **`P2-005`**: Xây dựng API Dashboard Tổng quan (`/api/v1/dashboard/*`) (`F2-02-02`)
6. **`P2-006`**: Giao diện Dashboard Tổng quan với `shadcn/ui` & `recharts` (`F2-02-03`)
7. **`P2-007`**: Xây dựng API Quản lý Hóa đơn (`/api/v1/invoices`) (`F2-03-01`)
8. **`P2-008`**: Xây dựng API Thanh toán Hóa đơn nhiều đợt (`/api/v1/payments`) + ghi quỹ (`F2-03-02`)
9. **`P2-009`**: Giao diện Hóa đơn & Thu ngân nhiều đợt (`/invoices`) (`F2-03-03`)
10. **`P2-010`**: Xây dựng API Theo dõi & Đối soát Công nợ (`/api/v1/debts`) (`F2-04-01`)
11. **`P2-011`**: Giao diện Quản lý Công nợ (`/debts`) (`F2-04-02`)
12. **`P2-012`**: Xây dựng API Danh mục Chi phí & Phiếu chi (`/api/v1/expenses`) (`F2-05-01`)
13. **`P2-013`**: Xây dựng API Sổ quỹ & Dòng tiền (`/api/v1/cash-transactions`) (`F2-05-02`)
14. **`P2-014`**: Giao diện Thu chi & Sổ quỹ chuyên nghiệp (`/finance/cashbook`) (`F2-05-03`)
15. **`P2-015`**: Xây dựng API Danh mục Sản phẩm & Tồn kho (`/api/v1/products`) (`F2-06-01`)
16. **`P2-016`**: Xây dựng API Giao dịch Nhập/Xuất/Kiểm kê Kho chống âm kho (`F2-06-02`)
17. **`P2-017`**: Giao diện Quản lý Kho Thuốc, Vật tư & Cảnh báo tồn kho (`/inventory`) (`F2-06-03`)
18. **`P2-018`**: Xây dựng API Chỉ tiêu & Thực đạt KPI Nhân viên (`/api/v1/kpi-targets`) (`F2-07-01`)
19. **`P2-019`**: Giao diện Quản lý KPI Nhân viên & Biểu đồ hiệu suất (`/kpi`) (`F2-07-02`)
20. **`P2-020`**: Xây dựng API Báo cáo Quản trị Tài chính, Khám bệnh & Kho (`/api/v1/reports`) (`F2-08-01`)
21. **`P2-021`**: Giao diện Trung tâm Báo cáo Quản trị đa chiều (`/reports`) (`F2-08-02`)
22. **`P2-022`**: Xây dựng API Import CSV kèm lưu vết lỗi `import_errors` (`/api/v1/imports`) (`F2-09-01`)
23. **`P2-023`**: Xây dựng API Export CSV UTF-8 BOM (`/api/v1/exports`) (`F2-09-02`)
24. **`P2-024`**: Giao diện Trung tâm Import / Export Dữ liệu (`/data-transfer`) (`F2-09-03`)
25. **`P2-025`**: Xây dựng API Quy tắc Cảnh báo & Thông báo (`/api/v1/notifications`) (`F2-10-01`)
26. **`P2-026`**: Xây dựng API Phê duyệt Tập trung (`/api/v1/approval-requests`) (`F2-10-02`)
27. **`P2-027`**: Giao diện Phê duyệt, Thông báo & Chuông Topbar (`F2-10-03`)
28. **`P2-028`**: Kiểm thử tích hợp End-to-End 4 kịch bản liên hoàn (`Phase2EndToEndWorkflowTest`) (`F2-11-01`)
29. **`P2-029`**: Kiểm thử đồng bộ toàn diện Backend + Frontend (Lint, Typecheck, Build) (`F2-11-02`)
30. **`P2-030`**: Hoàn thiện tài liệu & Báo cáo bàn giao Giai đoạn 2 (`docs/phase-2/PHASE_2_REPORT.md`) (`F2-11-03`)
