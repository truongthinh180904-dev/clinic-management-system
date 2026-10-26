# MORNING.md — Hướng dẫn Chạy Tự Động Xuyên Đêm & Kiểm Tra Buổi Sáng (`PHASE-01`)

## 1. Lệnh chạy tự động Giai đoạn 1 (`P1-001` → `P1-030`)

### A. Chạy toàn bộ các Task còn lại của Giai đoạn 1 (Chạy cả ngày / xuyên đêm)
Mở Terminal tại thư mục gốc `clinic-management-system` và chạy:

```bash
nohup env CPU_LOAD_PER_CORE_LIMIT=1.8 MAX_TASKS_PER_SESSION=30 SESSION_TIMEOUT_SECONDS=43200 \
  ./qlpk-autonomous-framework/run-agy.sh run \
  > qlpk-autonomous-framework/logs/overnight.out 2>&1 &
```

*(Nếu chạy trên macOS muốn chống máy tự sleep khi đóng màn hình/không thao tác, thêm `caffeinate -i` phía trước)*:

```bash
nohup caffeinate -i env CPU_LOAD_PER_CORE_LIMIT=1.8 MAX_TASKS_PER_SESSION=30 SESSION_TIMEOUT_SECONDS=43200 \
  ./qlpk-autonomous-framework/run-agy.sh run \
  > qlpk-autonomous-framework/logs/overnight.out 2>&1 &
```

### B. Chạy thử từng Task cụ thể (ví dụ `P1-001`)
```bash
CPU_LOAD_PER_CORE_LIMIT=1.8 ./qlpk-autonomous-framework/run-agy.sh run P1-001
```

### C. Theo dõi trực tiếp tiến độ (Live Log) & Dừng an toàn
- Xem log điều phối thời gian thực:
  ```bash
  tail -f qlpk-autonomous-framework/logs/orchestrator.log
  ```
- Đặt giờ tự động dừng vào buổi sáng (ví dụ `07` giờ sáng):
  ```bash
  echo "07" > qlpk-autonomous-framework/.agy-state/STOP_AT_HOUR
  ```
- Dừng chủ động ngay sau bước hiện tại:
  ```bash
  ./qlpk-autonomous-framework/run-agy.sh stop
  ```
- Xóa cờ dừng để chạy tiếp:
  ```bash
  ./qlpk-autonomous-framework/run-agy.sh clear-stop
  ```

---

## 2. Checklist Kiểm Tra Buổi Sáng (5 bước)

1. **Xem bảng tiến độ tổng thể:**
   - Mở `qlpk-autonomous-framework/PROGRESS.md` để xem những Task nào đã chuyển sang `DONE` (`PASS` / `PASS`) và những Task nào đang `READY` hoặc `BLOCKED`.
2. **Kiểm tra nhật ký điều phối (`orchestrator.log`):**
   - Kiểm tra các dòng `TASK_DONE`, `REVIEW_PASS`, `DONE_GATE_VERIFIED`, hoặc `QUOTA_EXCEEDED` / `BLOCKED`.
3. **Xem báo cáo bằng chứng của từng Task:**
   - Báo cáo Coder: `qlpk-autonomous-framework/reports/tasks/P1-XXX.md`
   - Báo cáo Test thật: `qlpk-autonomous-framework/reports/tasks/P1-XXX-test.md`
   - Báo cáo Reviewer: `qlpk-autonomous-framework/reports/tasks/P1-XXX-review-round-1.md`
4. **Kiểm tra tài liệu đầu ra Giai đoạn 1 (`docs/phase-1/`):**
   - `docs/phase-1/INITIAL_AUDIT.md`
   - `docs/phase-1/ARCHITECTURE.md`
   - `docs/phase-1/DEVELOPMENT.md`
   - `docs/phase-1/DATABASE_DESIGN.md`
   - `docs/phase-1/DATABASE_RELATIONSHIPS.md`
   - `docs/phase-1/API_DOCUMENTATION.md`
   - `docs/phase-1/PHASE_1_REPORT.md`
5. **Chạy nghiệm thu nhanh toàn bộ Backend & Frontend:**
   ```bash
   cd be && php artisan test && ./vendor/bin/pint --test
   cd ../fe && npx tsc --noEmit && npm run build
   ```
