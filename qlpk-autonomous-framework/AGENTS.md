# AGENTS.md — Autonomous Development System

## 1. Mục tiêu và phạm vi

Đây là bộ quy tắc điều phối phát triển cho dự án quản lý phòng khám (QLPK), với cấu trúc monorepo tại `PROJECT_ROOT` gồm `be/` (Laravel API), `fe/` (Next.js) và thư mục điều phối `qlpk-autonomous-framework/` (`FRAMEWORK_DIR`).

Mọi lời gọi model, kiểm thử tự động, kiểm soát tài nguyên CPU/RAM và cổng nghiệm thu đều phải được thực thi và lưu bằng chứng thật qua `qlpk-autonomous-framework/run-agy.sh`.

## 2. Công nghệ của dự án

### Backend — `be/`
- PHP `^8.3`
- Laravel Framework `^13.17`
- PHPUnit `^12.5`, Laravel Pint, Pail, Tinker
- MySQL database: `DBQLPK`, charset/collation: `utf8mb4_unicode_ci`
- Kết nối DB đã xác nhận bằng `php artisan db:show`
- Kiểm thử PHPUnit (`be/phpunit.xml`) được cấu hình cô lập trên SQLite `:memory:`
- Ứng dụng cấu hình trả JSON cho request `api/*` hoặc `expectsJson()`

### Frontend — `fe/`
- Next.js `16.4.2`, App Router, Turbopack
- React / React DOM `19.3.0`
- Tailwind CSS v4
- TypeScript v5
- Alias `@/*` trỏ về gốc `fe/`

## 3. Vai trò và phân bổ Model (Đã xác minh qua `agy models` v1.4.7)

Mỗi vai trò bắt buộc gọi đúng Model ID đã được xác minh trên `agy 1.4.7`:

- **PLANNER (`claude-sonnet-5-5-high`)**: Phân tích yêu cầu, chia task, dependency, `allowed_files`, acceptance criteria và kế hoạch kiểm thử (`--mode plan --sandbox`).
- **CODER (`gemini-3.8-flash-high`)**: Thực hiện từng task một theo thứ tự dependency, viết code, cập nhật test và tài liệu liên quan trong phạm vi `allowed_files` (`--mode accept-edits`).
- **AUTOMATED TESTER (Shell Runner — Không dùng LLM)**: Chạy kiểm thử bằng lệnh thật, thu exit code và log đã redact; không coi phát biểu của AI là kết quả kiểm thử.
- **REVIEWER (`gemini-4-argon-high`)**: Đánh giá code độc lập (`--mode plan --sandbox`), **chỉ được gọi sau khi tất cả các kiểm thử bắt buộc của task đã PASS (`exit_code == 0`)**.
- **DEBUG FALLBACK (`claude-sonnet-5-5-high`)**: Dùng khi cần phân tích lỗi phức tạp kéo dài theo chính sách fallback.
- **ARCH / SECURITY ESCALATION (`claude-opus-5-5-high`)**: Dùng cho vấn đề kiến trúc hoặc bảo mật nghiêm trọng.

### Quy tắc kiểm soát Model & Lỗi CLI
- Không tự động đổi model âm thầm khi hết quota (`429` / `RESOURCE_EXHAUSTED`).
- Phân biệt rõ 5 loại lỗi: `QUOTA_ERROR`, `NETWORK_ERROR`, `CLI_ERROR`, `TIMEOUT_ERROR`, `CONTENT_ERROR`.
- Khi xảy ra fallback (nếu được bật qua cấu hình), bắt buộc ghi log đầy đủ: model gốc, model đích, lý do trigger và kết quả.

## 4. Vòng đời Task và Cổng nghiệm thu bắt buộc

`PLANNED → IN_PROGRESS → TESTING → REVIEW_PENDING → FIXING (1..3) → APPROVED → DONE`

Trạng thái ngoại lệ: `BLOCKED`, `CANCELLED`.

1. **PLANNER** tạo/cập nhật `ROADMAP.md` và acceptance criteria; người dùng duyệt kế hoạch trước khi chạy tự động.
2. **CODER** thực hiện từng task một (tuần tự, không chạy song song).
3. **AUTOMATED TESTER** chạy toàn bộ `test_commands` bắt buộc của task:
   - Nếu **Test FAIL (`exit_code != 0`)**: **Tuyệt đối không gọi Reviewer**. Chuyển sang sửa lỗi hoặc đánh dấu FAIL/BLOCKED.
   - Nếu **Test PASS (`exit_code == 0`)**: Mới được phép gọi **REVIEWER**.
4. **REVIEWER** trả về đúng một trạng thái: `PASS`, `FAIL` hoặc `BLOCKED` kèm danh sách finding có cấu trúc.
5. **FIX LOOP**:
   - Nếu Reviewer trả `FAIL`, kích hoạt vòng sửa lỗi: `CODER` sửa theo finding → `AUTOMATED TESTER` **bắt buộc chạy lại toàn bộ kiểm thử bắt buộc** → nếu Test PASS mới gọi lại `REVIEWER`.
   - Tối đa **3 vòng review** (`MAX_REVIEW_ROUNDS=3`) cho một task. Nếu sau vòng thứ 3 vẫn `FAIL`, lập tức chuyển task sang `BLOCKED` (`MAX_REVIEW_ROUNDS_EXCEEDED`) và dừng xử lý task đó.
6. **FINAL APPROVAL (`verify_done_gate`)**:
   - Chỉ đánh dấu `DONE` khi có bằng chứng thuộc đúng `RUN_ID` của phiên chạy hiện tại chứng minh: `test_exit_code == 0` VÀ `reviewer_verdict == PASS` VÀ không có file thay đổi ngoài `allowed_files`.
   - Chống trạng thái `DONE` giả và không chấp nhận log/report cũ từ phiên chạy trước.

## 5. Quản lý Tài nguyên (CPU, RAM), Cooldown và Timeout

1. **Thực thi tuần tự**: Mỗi thời điểm chỉ chạy tối đa 1 task và 1 tiến trình model, kiểm soát bằng lock `.agy-state/run.lock` có kiểm tra PID sống (`kill -0`).
2. **Kiểm tra CPU & RAM trước mỗi task**:
   - `CPU_LOAD_PER_CORE_LIMIT` (mặc định `0.85`): So sánh `load_1m / logical_cores` (`sysctl -n vm.loadavg` và `sysctl -n hw.ncpu` trên macOS).
   - `MIN_FREE_MEMORY_PERCENT` (mặc định `15%`): Tính tỷ lệ bộ nhớ khả dụng (`free + inactive + speculative` từ `vm_stat` chia cho `sysctl -n hw.memsize` trên macOS).
   - Nếu vượt ngưỡng, chờ theo chu kỳ `RESOURCE_POLL_INTERVAL_SECONDS=15` tối đa `RESOURCE_WAIT_SECONDS=300`. Nếu hết thời gian chờ mà tài nguyên chưa hồi phục, chuyển `BLOCKED (RESOURCE_OVERLOAD)` và dừng an toàn.
3. **Cooldown & Backoff**:
   - Nghỉ giữa 2 task thành công: `TASK_COOLDOWN_SECONDS=30`.
   - Nghỉ sau lỗi: `ERROR_COOLDOWN_SECONDS=120`.
   - Nghỉ khi hết quota: `QUOTA_BACKOFF_SECONDS=900` (dài hơn cooldown thường, có ghi log và giữ nguyên working tree).
   - Giới hạn lỗi liên tiếp: `MAX_CONSECUTIVE_FAILURES=2`.
4. **Timeout & Giới hạn phiên**:
   - Timeout mỗi lời gọi model: `MODEL_TIMEOUT_SECONDS=300` (`--print-timeout`).
   - Timeout mỗi task: `TASK_TIMEOUT_SECONDS=900`.
   - Timeout toàn phiên: `SESSION_TIMEOUT_SECONDS=14400` và `MAX_TASKS_PER_SESSION=5`.
   - Hỗ trợ dừng chủ động qua `.agy-state/STOP` và giới hạn giờ dừng qua `.agy-state/STOP_AT_HOUR`.

## 6. Quy tắc Coding Senior & Bảo vệ Dữ liệu

- Ưu tiên thay đổi nhỏ, bám đúng `allowed_files` của task.
- Không để secret, token, mật khẩu (`be/.env`), dữ liệu bệnh nhân trong source, log, test fixture, prompt hay report.
- Không chạy các lệnh phá hủy dữ liệu hoặc lịch sử Git: `migrate:fresh`, `migrate:reset`, `migrate:refresh`, `db:wipe`, `git reset --hard`, `git clean`, `git stash`, `push --force`.
- Không bật `--dangerously-skip-permissions` mặc định.

## 7. Git và Cấu trúc Thư mục

- Kiểm tra nhánh hiện tại nằm trong `ALLOWED_BRANCHES` (mặc định `main,dev`) và kiểm tra working tree sạch (`git status --porcelain`) trước khi chạy.
- Nếu working tree có thay đổi không rõ nguồn gốc, dừng ngay (`BLOCKED: DIRTY_WORKING_TREE`) và yêu cầu người dùng xử lý, tuyệt đối không tự ý xóa/stash/reset file của người dùng.
- Phân biệt rõ `FRAMEWORK_DIR` (`clinic-management-system/qlpk-autonomous-framework`) và `PROJECT_ROOT` (`clinic-management-system`).

## 8. Tài liệu Skill theo Stack

- `skills/laravel-backend/SKILL.md`
- `skills/nextjs-frontend/SKILL.md`
- `skills/api-contract/SKILL.md`
- `skills/testing-quality/SKILL.md`
- `skills/database-migrations/SKILL.md`
- `skills/security-privacy/SKILL.md`
