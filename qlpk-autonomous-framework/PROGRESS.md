# PROGRESS — QLPK (`PHASE-01`)

## Tổng quan Giai đoạn 1
- **Framework status:** `READY_FOR_PHASE_1_EXECUTION`
- **Roadmap approval:** `APPROVED_PHASE_01`
- **Current phase:** `PHASE-01` — Xây dựng nền tảng và nghiệp vụ khám chữa bệnh cốt lõi
- **Total tasks in Phase 1:** `30` (`P1-001` → `P1-030`)
- **Completed (`DONE`):** `8 / 30` (`P1-001` → `P1-008`: Khảo sát, Kiến trúc, Môi trường & `/api/v1/health`, Thiết kế CSDL, 30 Migrations, 30 Eloquent Models, Seeders RBAC/Catalog, Auth API)
- **Remaining (`READY`):** `22 / 30` (`P1-009` → `P1-030`: RBAC Middleware, Giao diện Login, CRUD APIs & Giao diện Next.js)
- **Automated test status:** `PASS` (Self-Test `AT-00..AT-11` + PHPUnit 24 tests / 220 assertions + Laravel Pint)
- **Max review rounds per task:** `3`
- **Configured Models (`agy 1.4.7`):**
  - Planner: `claude-sonnet-5-5-high`
  - Coder: `gemini-3.8-flash-high`
  - Reviewer: `gemini-4-argon-high`
  - Debug fallback: `claude-sonnet-5-5-high`
  - Arch/Security escalation: `claude-opus-5-5-high`

---

## Bảng trạng thái 30 Task Giai đoạn 1 (`PHASE-01`)

| Task ID | Nhóm | Ưu tiên | Status | Test status | Review status | Round | Coder / Reviewer Model | Evidence Report | Mô tả ngắn |
|---|---|---|---|---|---|---:|---|---|---|
| `P1-001` | Nhóm 1 | P0 | `DONE` | `PASS` | `PASS` | 1/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `docs/phase-1/INITIAL_AUDIT.md` | Đã kiểm tra & lập báo cáo khảo sát repository |
| `P1-002` | Nhóm 1 | P0 | `DONE` | `PASS` | `PASS` | 1/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `docs/phase-1/ARCHITECTURE.md` | Đã xác lập kiến trúc kỹ thuật BE/FE (38KB) |
| `P1-003` | Nhóm 1 | P0 | `DONE` | `PASS` | `PASS` | 1/3 | `gemini-4-argon-medium` / `gemini-4-argon-high` | `docs/phase-1/DEVELOPMENT.md` | Đã chuẩn hóa môi trường & `/api/v1/health` (`HealthCheckApiTest` PASS) |
| `P1-004` | Nhóm 2 | P0 | `DONE` | `PASS` | `PASS` | 1/3 | `gemini-4-argon-medium` / `gemini-4-argon-high` | `docs/phase-1/DATABASE_DESIGN.md` | Đã chốt thiết kế & quan hệ 30 bảng CSDL |
| `P1-005` | Nhóm 2 | P0 | `DONE` | `PASS` | `PASS` | 1/3 | `gemini-4-argon-medium` / `gemini-4-argon-high` | `be/tests/Feature/DatabaseSchemaTest.php` | Đã tạo & migrate đủ 30 bảng lên `DBQLPK` (66 assertions PASS) |
| `P1-006` | Nhóm 2 | P0 | `DONE` | `PASS` | `PASS` | 1/3 | `gemini-4-argon-medium` / `gemini-4-argon-high` | `be/tests/Feature/EloquentModelsRelationshipTest.php` | Đã tạo đủ 30 Models & Relationships (89 assertions PASS) |
| `P1-007` | Nhóm 2 | P1 | `DONE` | `PASS` | `PASS` | 1/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-007.md` | Seed dữ liệu nền (8 vai trò, quyền, dịch vụ mẫu) |
| `P1-008` | Nhóm 3 | P0 | `DONE` | `PASS` | `PASS` | 1/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-008.md` | Xây dựng hệ thống đăng nhập API (`AuthApiTest` 14/14 PASS) |
| `P1-009` | Nhóm 3 | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-009.md` | Xây dựng hệ thống Role & Permission (RBAC) |
| `P1-010` | Nhóm 3 | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-010.md` | Giao diện đăng nhập & bảo vệ trang quản trị |
| `P1-011` | Nhóm 4 | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-011.md` | Xây dựng API quản lý nhân viên |
| `P1-012` | Nhóm 4 | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-012.md` | Xây dựng API quản lý tài khoản & vai trò |
| `P1-013` | Nhóm 4 | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-013.md` | Xây dựng giao diện nhân sự & tài khoản |
| `P1-014` | Nhóm 5 | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-014.md` | Xây dựng API quản lý bệnh nhân (kèm cảnh báo trùng) |
| `P1-015` | Nhóm 5 | P0 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-015.md` | Xây dựng trang danh sách & hồ sơ bệnh nhân |
| `P1-016` | Nhóm 5 | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-016.md` | Xây dựng API quản lý dịch vụ |
| `P1-017` | Nhóm 5 | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-017.md` | Xây dựng API quản lý gói dịch vụ |
| `P1-018` | Nhóm 5 | P1 | `DONE` | `PASS` | `PASS` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-018.md` | Cấu hình dịch vụ thành phần trong gói |
| `P1-019` | Nhóm 5 | P1 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-019.md` | Nghiệp vụ cấp gói dịch vụ cho bệnh nhân |
| `P1-020` | Nhóm 6 | P0 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-020.md` | API quản lý lịch hẹn (chống trùng khung giờ) |
| `P1-021` | Nhóm 6 | P1 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-021.md` | Giao diện quản lý lịch hẹn |
| `P1-022` | Nhóm 6 | P0 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-022.md` | API tạo và quản lý lượt khám |
| `P1-023` | Nhóm 6 | P0 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-023.md` | Quy tắc trừ buổi gói trong lượt khám (lock an toàn) |
| `P1-024` | Nhóm 6 | P1 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-024.md` | Xây dựng hồ sơ bệnh án cơ bản |
| `P1-025` | Nhóm 6 | P1 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-025.md` | Giao diện lượt khám và bệnh án |
| `P1-026` | Nhóm 7 | P0 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-026.md` | Hoàn thiện kiểm thử Backend toàn diện |
| `P1-027` | Nhóm 7 | P1 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-027.md` | Hoàn thiện kiểm thử Frontend & tích hợp API |
| `P1-028` | Nhóm 7 | P0 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-028.md` | Kiểm thử tích hợp 4 luồng nghiệp vụ đầu-cuối (E2E) |
| `P1-029` | Nhóm 8 | P1 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `reports/tasks/P1-029.md` | Hoàn thiện bộ tài liệu kỹ thuật Giai đoạn 1 |
| `P1-030` | Nhóm 8 | P0 | `READY` | `NOT_RUN` | `NOT_RUN` | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | `docs/phase-1/PHASE_1_REPORT.md` | Kiểm tra cuối giai đoạn & bàn giao (`REVIEW_REQUIRED`) |

---

## Quy tắc cập nhật và Chống trạng thái DONE giả
1. Sau mỗi task, `run-agy.sh` tự động cập nhật trạng thái kèm `RUN_ID`, thời gian chạy, model đã dùng và đường dẫn report.
2. Không bao giờ thay `NOT_RUN` thành `PASS` hoặc `DONE` nếu chưa thực thi thật.
3. Một task chỉ được chuyển sang `DONE` khi hàm `verify_done_gate()` xác nhận cả báo cáo kiểm thử (`exit_code == 0`) và báo cáo Reviewer (`OVERALL_REVIEW_RESULT: PASS`) đều mang cùng `RUN_ID` của phiên chạy hiện tại.
