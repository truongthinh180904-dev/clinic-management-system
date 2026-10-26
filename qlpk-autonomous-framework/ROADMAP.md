# ROADMAP — QLPK

> Trạng thái hiện tại: **CONTROLLED VERIFICATION / DEMO TASKS**. Các task demo dưới đây dùng để xác minh luồng thực thi an toàn của bộ khung, không tự động sửa code nghiệp vụ `be/` hay `fe/` và không chạy migration lên `DBQLPK`.

## Thông tin môi trường và Định tuyến Model
- `PROJECT_ROOT`: `/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system`
- `FRAMEWORK_DIR`: `/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/qlpk-autonomous-framework`
- **Backend (`be/`)**: PHP ^8.3, Laravel ^13.17, PHPUnit ^12.5, MySQL `DBQLPK`
- **Frontend (`fe/`)**: Next.js 16.4.2 App Router, React 19.3.0, Tailwind CSS v4, TypeScript v5
- **Model Routing chuẩn (`agy 1.4.7`)**:
  - `PLANNER`: `claude-sonnet-5-5-high`
  - `CODER`: `gemini-3.8-flash-high`
  - `REVIEWER`: `gemini-4-argon-high`
  - `DEBUG_FALLBACK`: `claude-sonnet-5-5-high`
  - `ARCH_SECURITY_ESCALATION`: `claude-opus-5-5-high`

## Trạng thái chuẩn
`DRAFT`, `READY`, `PLANNED`, `IN_PROGRESS`, `TESTING`, `REVIEW_PENDING`, `FIXING`, `APPROVED`, `DONE`, `BLOCKED`, `CANCELLED`.

## Feature F-DEMO-001 — Xác minh bộ khung và công cụ (DEMO ONLY)

**Mục đích:** Minh họa cấu trúc task, cổng kiểm thử tự động, cổng Reviewer độc lập và giới hạn tài nguyên. Không sửa code ứng dụng `be/` hoặc `fe/` và không chạm dữ liệu `DBQLPK`.

### Task T-DEMO-001 — Kiểm kê repository
- `feature_id`: `F-DEMO-001`
- `task_id`: `T-DEMO-001`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `[]`
- `acceptance_criteria`:
  1. Ghi nhận branch, git status, cây thư mục cấp đầu và file manifest FE/BE hiện có tại `PROJECT_ROOT`.
  2. Xác minh `be/composer.json` và `fe/package.json` thực tế, không suy luận từ mô tả.
  3. Tuyệt đối không đọc hoặc xuất giá trị secret từ `be/.env`.
  4. Không sửa file source trong `be/` hoặc `fe/` và không chạy migration.
- `test_commands`:
  - `git -C "$PROJECT_ROOT" status --short --branch`
  - `php -v`
  - `composer validate --no-check-publish --working-dir="$PROJECT_ROOT/be"`
  - `node --version && npm --version`
- `allowed_files`: `qlpk-autonomous-framework/reports/tasks/T-DEMO-001.md`
- `status`: `READY`
- `complexity`: `LOW`

### Task T-DEMO-002 — Xác minh lệnh AGY CLI
- `feature_id`: `F-DEMO-001`
- `task_id`: `T-DEMO-002`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["T-DEMO-001"]`
- `acceptance_criteria`:
  1. Ghi lại phiên bản `1.4.7` và help output của `agy` CLI.
  2. Xác minh đầy đủ cách chọn model (`--model`), truyền prompt (`--print`), timeout (`--print-timeout`), JSON output (`--output-format json`) và sandbox (`--sandbox`).
  3. Cập nhật bảng xác minh trong `qlpk-autonomous-framework/reports/agy-cli-capability-matrix.md`.
- `test_commands`:
  - `agy --version`
  - `agy --help`
  - `test -f "$FRAMEWORK_DIR/reports/agy-cli-capability-matrix.md"`
- `allowed_files`: `qlpk-autonomous-framework/reports/tasks/T-DEMO-002.md`, `qlpk-autonomous-framework/reports/agy-cli-capability-matrix.md`
- `status`: `READY`
- `complexity`: `MEDIUM`

### Task T-DEMO-003 — Dry-run và kiểm thử cô lập các cổng an toàn của Workflow
- `feature_id`: `F-DEMO-001`
- `task_id`: `T-DEMO-003`
- `role`: `CODER`
- `model`: `gemini-3.8-flash-high`
- `reviewer_model`: `gemini-4-argon-high`
- `dependencies`: `["T-DEMO-001", "T-DEMO-002"]`
- `acceptance_criteria`:
  1. Kiểm tra cú pháp `bash -n "$FRAMEWORK_DIR/run-agy.sh"` đạt exit code `0`.
  2. Chứng minh bằng bộ kiểm thử mock (`AT-01..AT-11`) rằng: Test FAIL không gọi Reviewer; Test PASS mới gọi Reviewer; Reviewer FAIL kích hoạt Fix Loop tối đa 3 vòng rồi chuyển `BLOCKED`.
  3. Chứng minh kiểm tra ngưỡng CPU/RAM, `TASK_COOLDOWN_SECONDS`, timeout giải phóng lock, bảo vệ working tree khi hết quota hoặc khi Git bẩn, và chống `DONE` giả.
- `test_commands`:
  - `bash -n "$FRAMEWORK_DIR/run-agy.sh"`
  - `"$FRAMEWORK_DIR/run-agy.sh" self-test`
- `allowed_files`: `qlpk-autonomous-framework/reports/tasks/T-DEMO-003.md`, `qlpk-autonomous-framework/reports/workflow-dry-run.md`
- `status`: `READY`
- `complexity`: `MEDIUM`
