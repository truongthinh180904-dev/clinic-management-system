# MORNING RUNBOOK — HƯỚNG DẪN CHẠY & KIỂM TRA GIAI ĐOẠN 2 (`PHASE-02`)

## 1. Trạng thái hiện tại
- **Giai đoạn 1 (`PHASE-01`):** Đã hoàn tất **`30 / 30 Tasks DONE`** (`285 PHPUnit tests / 2,602 assertions PASS`, `28 Next.js routes`). Toàn bộ tài liệu Giai đoạn 1 được lưu trữ tại:
  - [`docs/phase-1/PHASE_1_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_TASKS.md)
  - [`docs/phase-1/PHASE_1_REPORT.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-1/PHASE_1_REPORT.md)
  - [`ROADMAP-PHASE-1-ARCHIVE.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/qlpk-autonomous-framework/ROADMAP-PHASE-1-ARCHIVE.md)
- **Giai đoạn 2 (`PHASE-02`):** Đã hoàn tất khảo sát và lập kế hoạch **`P2-001` (`F2-01-01`)** tại [`docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/F2-01-01_SURVEY_AND_PLAN.md) và nạp đủ **30 Tasks (`P2-001` → `P2-030`)** thuộc **11 Features (`F2-01` → `F2-11`)** vào [`docs/phase-2/PHASE_2_TASKS.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/docs/phase-2/PHASE_2_TASKS.md) và [`ROADMAP.md`](file:///Users/truongthinh/Documents/UIT/Manage%20Infomation/clinic-management-system/qlpk-autonomous-framework/ROADMAP.md).

---

## 2. Lệnh khởi chạy tự động Giai đoạn 2 (`P2-002` → `P2-030`) trên nhánh `dev`

```bash
nohup caffeinate -i env CPU_LOAD_PER_CORE_LIMIT=1.8 MAX_TASKS_PER_SESSION=30 SESSION_TIMEOUT_SECONDS=43200 ./qlpk-autonomous-framework/run-agy.sh run > qlpk-autonomous-framework/logs/overnight.out 2>&1 &
```

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
