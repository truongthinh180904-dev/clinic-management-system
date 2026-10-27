# MORNING RUNBOOK — HƯỚNG DẪN CHẠY & KIỂM TRA GIAI ĐOẠN 2 (`PHASE-02`)

## 1. Trạng thái hiện tại
- **Giai đoạn 1 (`PHASE-01`):** Đã hoàn tất **`30 / 30 Tasks DONE`** (`285 PHPUnit tests / 2,602 assertions PASS`, `28 Next.js routes`). Toàn bộ tài liệu Giai đoạn 1 được lưu trữ tại:
  - [`docs/phase-1/PHASE_1_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_TASKS.md)
  - [`docs/phase-1/PHASE_1_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_REPORT.md)
  - [`ROADMAP-PHASE-1-ARCHIVE.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/qlpk-autonomous-framework/ROADMAP-PHASE-1-ARCHIVE.md)
- **Giai đoạn 2 (`PHASE-02`):** Đã hoàn tất **`17 / 30 Tasks DONE`** (`P2-001` → `P2-011`, `P2-013` → `P2-019`).
  - Đã xong: Khảo sát, UI Core `shadcn/ui`, AdminShell, RBAC Phase 2, Dashboard API + UI, Invoices API + UI, Payments API + Quỹ, Debts API + UI, Cashbook API + UI, Products API, Inventory Transactions API, Inventory UI, KPI Targets API, KPI Management UI.
  - Còn lại 13 tasks (`P2-012`, `P2-020` → `P2-030`).
  - Model Reviewer hiện tại: `gemini-4-argon-high`. Coder: `gemini-3.8-flash-high`.

---

## 2. Lệnh khởi chạy tự động xuyên đêm tới sáng trên nhánh `dev`

```bash
nohup caffeinate -dimsu env FORCE_RUN=1 CPU_LOAD_PER_CORE_LIMIT=1.8 MAX_TASKS_PER_SESSION=30 SESSION_TIMEOUT_SECONDS=43200 ./qlpk-autonomous-framework/run-agy.sh run > qlpk-autonomous-framework/logs/overnight.out 2>&1 &
```

> **Lưu ý để máy chạy thông suốt tới sáng:**
> 1. **Cắm sạc cho máy Mac** (tránh tình trạng macOS ngắt process khi pin yếu).
> 2. **Không gập hoàn toàn nắp MacBook** (để hở nắp hoặc không gập màn hình để macOS không ngắt kết nối mạng và tắt CPU).
> 3. Cờ `-dimsu` của `caffeinate` sẽ ngăn chặn hoàn toàn việc tắt màn hình, ngủ ổ cứng và sleep hệ thống.
> 4. `FORCE_RUN=1` sẽ tự động hủy tiến trình cũ còn sót lại trong bộ nhớ và khởi động phiên mới chạy bằng model `gemini-4-argon-high`.

### Các lệnh theo dõi tiến độ
```bash
# 1. Xem log thực thi trực tiếp
tail -f qlpk-autonomous-framework/logs/orchestrator.log

# 2. Xem các commit tự động feat(phase-2): complete P2-... trên nhánh dev
git log --oneline -n 15

# 3. Xem bảng tiến độ 30 Task Giai đoạn 2
cat qlpk-autonomous-framework/PROGRESS.md

# 4. Yêu cầu dừng an toàn sau khi task hiện tại xong (nếu cần)
./qlpk-autonomous-framework/run-agy.sh stop
```
