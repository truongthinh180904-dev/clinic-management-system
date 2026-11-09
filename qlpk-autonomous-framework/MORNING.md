# MORNING RUNBOOK — HƯỚNG DẪN CHẠY & KIỂM TRA GIAI ĐOẠN 2 (`PHASE-02`)

## 1. Trạng thái hiện tại
- **Giai đoạn 1 (`PHASE-01`):** Đã hoàn tất **`30 / 30 Tasks DONE`** (`285 PHPUnit tests / 2,602 assertions PASS`, `28 Next.js routes`). Toàn bộ tài liệu Giai đoạn 1 được lưu trữ tại:
  - [`docs/phase-1/PHASE_1_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_TASKS.md)
  - [`docs/phase-1/PHASE_1_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_REPORT.md)
  - [`ROADMAP-PHASE-1-ARCHIVE.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/qlpk-autonomous-framework/ROADMAP-PHASE-1-ARCHIVE.md)
- **Giai đoạn 2 (`PHASE-02`):** Đã hoàn tất **`30 / 30 Tasks DONE (100%)`**!
  - Toàn bộ 11 Features (`F2-01` → `F2-11`) đã hoàn thành và tự động commit lên nhánh `dev`.
  - Toàn bộ Backend Tests, Pint, Frontend Typecheck và Next.js Production Build đều `100% PASS`.
  - Báo cáo tổng kết bàn giao: [`docs/phase-2/PHASE_2_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_REPORT.md).
  - Tài liệu kỹ thuật API Phase 2: [`docs/phase-2/API_DOCUMENTATION_PHASE_2.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/API_DOCUMENTATION_PHASE_2.md).

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
