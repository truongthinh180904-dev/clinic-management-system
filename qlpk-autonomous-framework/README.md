# QLPK Autonomous Development Framework

Bộ khung điều phối phát triển tự động có kiểm soát cho dự án `clinic-management-system` (`be/` Laravel 13 + `fe/` Next.js 16.4).

## Cấu trúc thư mục
- `PROJECT_ROOT`: thư mục gốc của repository (`clinic-management-system/`), chứa `be/` và `fe/`.
- `FRAMEWORK_DIR`: thư mục `clinic-management-system/qlpk-autonomous-framework/`, chứa toàn bộ tài liệu điều phối, script `run-agy.sh`, `skills/`, `templates/`, `reports/`, `.agy-state/` và `logs/`.
- Không cần copy đè các file trong thư mục này ra `PROJECT_ROOT`; `run-agy.sh` tự động xác định `FRAMEWORK_DIR` và `PROJECT_ROOT` bất kể được gọi từ thư mục terminal nào.

## Thành phần bao gồm
- Governance & Vai trò: `AGENTS.md`, `PLANNER.md`, `REVIEWER.md`
- Kế hoạch & Trạng thái: `ROADMAP.md`, `PROGRESS.md`, `MORNING.md`
- Bộ điều phối thực thi an toàn: `run-agy.sh`
- Templates báo cáo: `templates/TASK_TEMPLATE.md`, `templates/REVIEW_REPORT_TEMPLATE.md`, `templates/FINAL_REPORT_TEMPLATE.md`
- Skills kỹ thuật: `skills/laravel-backend/`, `skills/nextjs-frontend/`, `skills/api-contract/`, `skills/testing-quality/`, `skills/database-migrations/`, `skills/security-privacy/`
- Báo cáo xác minh & kiểm toán: `reports/agy-cli-capability-matrix.md`, `reports/framework-audit.md`, `reports/workflow-dry-run.md`

## Lệnh sử dụng `run-agy.sh`
```bash
./qlpk-autonomous-framework/run-agy.sh status
./qlpk-autonomous-framework/run-agy.sh check-resources
./qlpk-autonomous-framework/run-agy.sh dry-run
./qlpk-autonomous-framework/run-agy.sh self-test
./qlpk-autonomous-framework/run-agy.sh run [TASK_ID]
./qlpk-autonomous-framework/run-agy.sh stop
./qlpk-autonomous-framework/run-agy.sh clear-stop
```
