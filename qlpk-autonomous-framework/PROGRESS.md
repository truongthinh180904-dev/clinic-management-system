# PROGRESS — QLPK

## Tổng quan
- Framework status: `READY_FOR_CONTROLLED_TEST`
- Roadmap approval: `APPROVED_FOR_SAFE_VERIFICATION`
- Current feature: `F-DEMO-001`
- Feature status: `READY`
- Automated test status: `PASS (Self-Test AT-00..AT-11)`
- Review status: `NOT_RUN`
- Max review rounds per task: `3`
- Configured Models (`agy 1.4.7`):
  - Planner: `claude-sonnet-5-5-high`
  - Coder: `gemini-3.8-flash-high`
  - Reviewer: `gemini-4-argon-high`
  - Debug fallback: `claude-sonnet-5-5-high`
  - Arch/Security escalation: `claude-opus-5-5-high`
- AGY CLI verification: `VERIFIED (v1.4.7)`
- Last evidence: `reports/framework-audit.md`, `reports/workflow-dry-run.md`

## Task status

| Task ID | Status | Test status | Review status | Review round | Coder / Reviewer Model | Duration | Fallback | Evidence Report | Ghi chú |
|---|---|---|---|---:|---|---|---|---|---|
| T-DEMO-001 | READY | NOT_RUN | NOT_RUN | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | — | NONE | `reports/tasks/T-DEMO-001.md` | Kiểm kê repo, không sửa source |
| T-DEMO-002 | READY | NOT_RUN | NOT_RUN | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | — | NONE | `reports/tasks/T-DEMO-002.md` | Xác minh AGY CLI v1.4.7 |
| T-DEMO-003 | READY | NOT_RUN | NOT_RUN | 0/3 | `gemini-3.8-flash-high` / `gemini-4-argon-high` | — | NONE | `reports/tasks/T-DEMO-003.md` | Kiểm thử workflow & cổng an toàn |

## Quy tắc cập nhật và Chống trạng thái DONE giả
1. Sau mỗi task, `run-agy.sh` cập nhật trạng thái kèm `RUN_ID`, thời gian chạy, model đã dùng, lý do fallback (nếu có) và đường dẫn report.
2. Không bao giờ thay `NOT_RUN` thành `PASS` hoặc `DONE` nếu chưa thực thi thật.
3. Một task chỉ được chuyển sang `DONE` khi hàm `verify_done_gate()` xác nhận cả báo cáo kiểm thử (`exit_code == 0`) và báo cáo Reviewer (`Overall result: PASS`) đều mang cùng `RUN_ID` của phiên chạy hiện tại.

## Trạng thái được phép
- Task: `DRAFT`, `READY`, `IN_PROGRESS`, `TESTING`, `REVIEW_PENDING`, `FIXING`, `PASS`, `DONE`, `FAIL`, `BLOCKED`, `SKIPPED`
- Automated tests: `NOT_RUN`, `PASS`, `FAIL`, `PARTIAL`, `BLOCKED`
- Review: `NOT_RUN`, `PASS`, `FAIL`, `BLOCKED`
