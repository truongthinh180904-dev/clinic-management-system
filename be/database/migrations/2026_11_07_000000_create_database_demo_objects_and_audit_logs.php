<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tạo bảng Audit Log cho Demo và 15 đối tượng Quản lý thông tin SQL (5 SP, 5 Trigger, 3 Function, 2 Cursor).
     */
    public function up(): void
    {
        // 1. Tạo bảng Audit Log phục vụ ghi nhận các thay đổi dữ liệu khi thực thi DEMO
        if (!Schema::hasTable('db_demo_audit_logs')) {
            Schema::create('db_demo_audit_logs', function (Blueprint $table) {
                $table->id();
                $table->timestamp('executed_at')->useCurrent();
                $table->string('sql_object_name', 100)->index();
                $table->string('sql_object_type', 30); // PROCEDURE, TRIGGER, FUNCTION, CURSOR
                $table->string('target_table', 100);
                $table->string('action_type', 50);     // INSERT, UPDATE, DELETE, SELECT/READ, TRIGGER_AUTO, PROCEDURE_EXEC, FUNCTION_CALL, CURSOR_LOOP
                $table->json('before_data')->nullable();
                $table->json('after_data')->nullable();
                $table->string('status', 30)->default('SUCCESS'); // SUCCESS, FAILED, VERIFIED
                $table->text('execution_message')->nullable();
                $table->foreignId('executed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->unsignedInteger('duration_ms')->default(0);
                $table->timestamps();
            });
        }

        // Xóa trước nếu đã tồn tại để tránh xung đột
        $this->dropAllObjects();

        // -------------------------------------------------------------
        // A. 5 STORED PROCEDURES
        // -------------------------------------------------------------

        // SP 1: Tiếp nhận bệnh nhân từ lịch hẹn
        DB::unprepared("
            CREATE PROCEDURE sp_demo_tiep_nhan_benh_nhan(
                IN p_appointment_id BIGINT,
                IN p_user_id BIGINT,
                OUT p_visit_id BIGINT,
                OUT p_status_code VARCHAR(30),
                OUT p_message TEXT
            )
            BEGIN
                DECLARE v_patient_id BIGINT;
                DECLARE v_doctor_id BIGINT;
                DECLARE v_service_id BIGINT;
                DECLARE v_app_status VARCHAR(30);
                DECLARE v_visit_code VARCHAR(50);
                DECLARE v_new_visit_id BIGINT;
                
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    ROLLBACK;
                    SET p_visit_id = NULL;
                    SET p_status_code = 'ERROR';
                    SET p_message = 'Lỗi hệ thống khi tiếp đón bệnh nhân. Giao dịch đã được hủy bỏ an toàn (Rollback).';
                END;

                START TRANSACTION;

                SELECT patient_id, employee_id, service_id, status 
                INTO v_patient_id, v_doctor_id, v_service_id, v_app_status
                FROM appointments 
                WHERE id = p_appointment_id 
                FOR UPDATE;

                IF v_patient_id IS NULL THEN
                    SET p_visit_id = NULL;
                    SET p_status_code = 'NOT_FOUND';
                    SET p_message = 'Lịch hẹn không tồn tại trong hệ thống.';
                    ROLLBACK;
                ELSEIF v_app_status != 'CONFIRMED' AND v_app_status != 'PENDING' THEN
                    SET p_visit_id = NULL;
                    SET p_status_code = 'INVALID_STATUS';
                    SET p_message = CONCAT('Không thể tiếp nhận. Trạng thái lịch hẹn hiện tại là: ', v_app_status);
                    ROLLBACK;
                ELSE
                    UPDATE appointments 
                    SET status = 'COMPLETED', updated_at = NOW() 
                    WHERE id = p_appointment_id;

                    SET v_visit_code = CONCAT('VK', DATE_FORMAT(NOW(), '%y%m%d'), LPAD(FLOOR(RAND() * 9999), 4, '0'));

                    INSERT INTO visits (
                        visit_code, patient_id, employee_id, service_id, appointment_id,
                        visit_date, quantity, unit_price, discount_amount, total_amount,
                        payment_status, status, notes, created_by, created_at, updated_at
                    ) VALUES (
                        v_visit_code, v_patient_id, v_doctor_id, v_service_id, p_appointment_id,
                        CURRENT_DATE(), 1, 150000.00, 0, 150000.00,
                        'UNPAID', 'WAITING', 'Tiếp đón nguyên tử từ Lịch hẹn (Demo Procedure)', p_user_id, NOW(), NOW()
                    );

                    SET v_new_visit_id = LAST_INSERT_ID();
                    SET p_visit_id = v_new_visit_id;
                    SET p_status_code = 'SUCCESS';
                    SET p_message = CONCAT('Tiếp nhận thành công! Đã tạo lượt khám mới mã ', v_visit_code, ' cho bệnh nhân.');
                    
                    COMMIT;
                END IF;
            END
        ");

        // SP 2: Tạo hóa đơn và xuất thuốc
        DB::unprepared("
            CREATE PROCEDURE sp_demo_tao_hoa_don_xuat_thuoc(
                IN p_visit_id BIGINT,
                IN p_user_id BIGINT,
                OUT p_invoice_id BIGINT,
                OUT p_total_amount DECIMAL(15,2),
                OUT p_status_code VARCHAR(30),
                OUT p_message TEXT
            )
            BEGIN
                DECLARE v_patient_id BIGINT;
                DECLARE v_existing_inv_id BIGINT;
                DECLARE v_invoice_code VARCHAR(50);
                DECLARE v_subtotal DECIMAL(15,2) DEFAULT 0;
                
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    ROLLBACK;
                    SET p_invoice_id = NULL;
                    SET p_status_code = 'ERROR';
                    SET p_message = 'Lỗi tạo hóa đơn và xuất kho. Giao dịch đã được hoàn tác an toàn.';
                END;

                START TRANSACTION;

                SELECT patient_id, total_amount INTO v_patient_id, v_subtotal
                FROM visits 
                WHERE id = p_visit_id 
                FOR UPDATE;

                IF v_patient_id IS NULL THEN
                    SET p_invoice_id = NULL;
                    SET p_status_code = 'NOT_FOUND';
                    SET p_message = 'Không tìm thấy lượt khám tương ứng.';
                    ROLLBACK;
                ELSE
                    SELECT id INTO v_existing_inv_id FROM invoices WHERE visit_id = p_visit_id LIMIT 1;
                    
                    IF v_existing_inv_id IS NOT NULL THEN
                        SET p_invoice_id = v_existing_inv_id;
                        SET p_total_amount = v_subtotal;
                        SET p_status_code = 'ALREADY_EXISTS';
                        SET p_message = 'Lượt khám này đã được lập hóa đơn trước đó.';
                        COMMIT;
                    ELSE
                        SET v_invoice_code = CONCAT('HD', DATE_FORMAT(NOW(), '%y%m%d'), LPAD(FLOOR(RAND() * 9999), 4, '0'));
                        
                        INSERT INTO invoices (
                            invoice_code, patient_id, visit_id, subtotal_amount, discount_amount,
                            total_amount, paid_amount, remaining_amount, status, issued_at,
                            created_by, created_at, updated_at
                        ) VALUES (
                            v_invoice_code, v_patient_id, p_visit_id, v_subtotal, 0,
                            v_subtotal, 0, v_subtotal, 'UNPAID', NOW(),
                            p_user_id, NOW(), NOW()
                        );

                        SET p_invoice_id = LAST_INSERT_ID();
                        SET p_total_amount = v_subtotal;
                        SET p_status_code = 'SUCCESS';
                        SET p_message = CONCAT('Đã lập hóa đơn thành công mã ', v_invoice_code, ' tổng tiền: ', v_subtotal, ' VNĐ');
                        
                        COMMIT;
                    END IF;
                END IF;
            END
        ");

        // SP 3: Xử lý thanh toán hóa đơn
        DB::unprepared("
            CREATE PROCEDURE sp_demo_thanh_toan_hoa_don(
                IN p_invoice_id BIGINT,
                IN p_amount DECIMAL(15,2),
                IN p_payment_method VARCHAR(30),
                IN p_user_id BIGINT,
                OUT p_payment_id BIGINT,
                OUT p_remaining_amount DECIMAL(15,2),
                OUT p_status_code VARCHAR(30),
                OUT p_message TEXT
            )
            BEGIN
                DECLARE v_current_paid DECIMAL(15,2);
                DECLARE v_current_remaining DECIMAL(15,2);
                DECLARE v_total DECIMAL(15,2);
                DECLARE v_new_paid DECIMAL(15,2);
                DECLARE v_new_remaining DECIMAL(15,2);
                DECLARE v_new_status VARCHAR(30);
                DECLARE v_payment_code VARCHAR(50);
                DECLARE v_trans_code VARCHAR(50);
                DECLARE v_new_pay_id BIGINT;

                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    ROLLBACK;
                    SET p_payment_id = NULL;
                    SET p_status_code = 'ERROR';
                    SET p_message = 'Lỗi xử lý thanh toán. Đã Rollback an toàn toàn bộ giao dịch.';
                END;

                START TRANSACTION;

                SELECT total_amount, paid_amount, remaining_amount
                INTO v_total, v_current_paid, v_current_remaining
                FROM invoices
                WHERE id = p_invoice_id
                FOR UPDATE;

                IF v_total IS NULL THEN
                    SET p_payment_id = NULL;
                    SET p_status_code = 'NOT_FOUND';
                    SET p_message = 'Không tìm thấy hóa đơn cần thanh toán.';
                    ROLLBACK;
                ELSEIF p_amount <= 0 THEN
                    SET p_payment_id = NULL;
                    SET p_status_code = 'INVALID_AMOUNT';
                    SET p_message = 'Số tiền thanh toán phải lớn hơn 0.';
                    ROLLBACK;
                ELSEIF p_amount > v_current_remaining THEN
                    SET p_payment_id = NULL;
                    SET p_status_code = 'OVERPAY';
                    SET p_message = CONCAT('Số tiền nộp (', p_amount, ') vượt quá số tiền còn nợ (', v_current_remaining, ').');
                    ROLLBACK;
                ELSE
                    SET v_new_paid = v_current_paid + p_amount;
                    SET v_new_remaining = v_current_remaining - p_amount;
                    
                    IF v_new_remaining <= 0 THEN
                        SET v_new_status = 'PAID';
                    ELSE
                        SET v_new_status = 'PARTIAL';
                    END IF;

                    UPDATE invoices 
                    SET paid_amount = v_new_paid, remaining_amount = v_new_remaining, status = v_new_status, updated_at = NOW()
                    WHERE id = p_invoice_id;

                    SET v_payment_code = CONCAT('PAY', DATE_FORMAT(NOW(), '%y%m%d'), LPAD(FLOOR(RAND() * 9999), 4, '0'));
                    INSERT INTO payments (
                        payment_code, invoice_id, amount, payment_method, payment_date,
                        received_by, notes, created_at, updated_at
                    ) VALUES (
                        v_payment_code, p_invoice_id, p_amount, p_payment_method, NOW(),
                        p_user_id, 'Thanh toán viện phí qua Demo Procedure', NOW(), NOW()
                    );
                    SET v_new_pay_id = LAST_INSERT_ID();

                    SET v_trans_code = CONCAT('PT', DATE_FORMAT(NOW(), '%y%m%d'), LPAD(FLOOR(RAND() * 9999), 4, '0'));
                    INSERT INTO cash_transactions (
                        transaction_code, transaction_type, reference_type, reference_id,
                        amount, payment_method, transaction_date, description, created_by, created_at
                    ) VALUES (
                        v_trans_code, 'IN', 'Payment', v_new_pay_id,
                        p_amount, p_payment_method, NOW(), CONCAT('Thu tiền viện phí hóa đơn #', p_invoice_id), p_user_id, NOW()
                    );

                    SET p_payment_id = v_new_pay_id;
                    SET p_remaining_amount = v_new_remaining;
                    SET p_status_code = 'SUCCESS';
                    SET p_message = CONCAT('Thanh toán thành công ', p_amount, ' VNĐ. Còn nợ: ', v_new_remaining, ' VNĐ (Trạng thái: ', v_new_status, ')');

                    COMMIT;
                END IF;
            END
        ");

        // SP 4: Báo cáo doanh thu bác sĩ
        DB::unprepared("
            CREATE PROCEDURE sp_demo_bao_cao_doanh_thu_bac_si(
                IN p_start_date DATE,
                IN p_end_date DATE
            )
            BEGIN
                SELECT 
                    e.id AS doctor_id,
                    e.employee_code,
                    e.full_name AS doctor_name,
                    e.department,
                    COUNT(DISTINCT v.id) AS total_visits,
                    COUNT(DISTINCT CASE WHEN v.status = 'COMPLETED' THEN v.id END) AS completed_visits,
                    COALESCE(SUM(inv.total_amount), 0) AS total_invoiced,
                    COALESCE(SUM(inv.paid_amount), 0) AS total_collected,
                    COALESCE(SUM(inv.remaining_amount), 0) AS total_debt
                FROM employees e
                LEFT JOIN visits v ON v.employee_id = e.id 
                    AND v.visit_date BETWEEN p_start_date AND p_end_date
                LEFT JOIN invoices inv ON inv.visit_id = v.id 
                    AND inv.status != 'CANCELLED'
                WHERE e.status = 'ACTIVE'
                GROUP BY e.id, e.employee_code, e.full_name, e.department
                ORDER BY total_collected DESC;
            END
        ");

        // SP 5: Hủy lịch hẹn và giải phóng bác sĩ
        DB::unprepared("
            CREATE PROCEDURE sp_demo_huy_lich_hen_giai_phong_bs(
                IN p_appointment_id BIGINT,
                IN p_reason TEXT,
                IN p_user_id BIGINT,
                OUT p_status_code VARCHAR(30),
                OUT p_message TEXT
            )
            BEGIN
                DECLARE v_current_status VARCHAR(30);
                DECLARE v_doctor_id BIGINT;
                DECLARE v_app_code VARCHAR(50);

                START TRANSACTION;

                SELECT status, employee_id, appointment_code 
                INTO v_current_status, v_doctor_id, v_app_code
                FROM appointments 
                WHERE id = p_appointment_id 
                FOR UPDATE;

                IF v_current_status IS NULL THEN
                    SET p_status_code = 'NOT_FOUND';
                    SET p_message = 'Lịch hẹn không tồn tại.';
                    ROLLBACK;
                ELSEIF v_current_status = 'COMPLETED' THEN
                    SET p_status_code = 'ALREADY_COMPLETED';
                    SET p_message = 'Ca khám đã hoàn thành, không thể hủy.';
                    ROLLBACK;
                ELSEIF v_current_status = 'CANCELLED' THEN
                    SET p_status_code = 'ALREADY_CANCELLED';
                    SET p_message = 'Lịch hẹn này đã ở trạng thái hủy trước đó.';
                    ROLLBACK;
                ELSE
                    UPDATE appointments 
                    SET status = 'CANCELLED', notes = CONCAT(COALESCE(notes, ''), ' [Lý do hủy: ', p_reason, ']'), updated_at = NOW()
                    WHERE id = p_appointment_id;

                    SET p_status_code = 'SUCCESS';
                    SET p_message = CONCAT('Đã hủy lịch hẹn ', v_app_code, ' thành công và giải phóng khung giờ làm việc cho bác sĩ.');
                    COMMIT;
                END IF;
            END
        ");

        // -------------------------------------------------------------
        // B. 5 TRIGGERS
        // -------------------------------------------------------------

        // Trigger 1: Kiểm tra trùng lịch bác sĩ
        DB::unprepared("
            CREATE TRIGGER trg_demo_chong_trung_lich_bs
            BEFORE INSERT ON appointments
            FOR EACH ROW
            BEGIN
                DECLARE v_conflict_count INT DEFAULT 0;

                IF NEW.employee_id IS NOT NULL AND NEW.appointment_date IS NOT NULL 
                   AND NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL 
                   AND (NEW.status IS NULL OR NEW.status IN ('PENDING', 'CONFIRMED')) THEN
                    
                    SELECT COUNT(*) INTO v_conflict_count
                    FROM appointments
                    WHERE employee_id = NEW.employee_id
                      AND appointment_date = NEW.appointment_date
                      AND status IN ('PENDING', 'CONFIRMED')
                      AND (
                          (NEW.start_time < end_time AND NEW.end_time > start_time)
                      );

                    IF v_conflict_count > 0 THEN
                        SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'LỖI RÀNG BUỘC (TRIGGER): Bác sĩ đã có lịch hẹn khác trong khung giờ này!';
                    END IF;
                END IF;
            END
        ");

        // Trigger 2: Kiểm soát chỉnh sửa hồ sơ sau thanh toán (Lưu ý: Chỉ chặn khi đổi chẩn đoán quan trọng và đã PAID)
        DB::unprepared("
            CREATE TRIGGER trg_demo_kiem_soat_sua_benh_an_paid
            BEFORE UPDATE ON medical_records
            FOR EACH ROW
            BEGIN
                DECLARE v_pay_status VARCHAR(30);

                SELECT payment_status INTO v_pay_status
                FROM visits
                WHERE id = NEW.visit_id;

                IF v_pay_status = 'PAID' AND (OLD.diagnosis != NEW.diagnosis OR (OLD.diagnosis IS NULL AND NEW.diagnosis IS NOT NULL)) THEN
                    -- Chỉ kích hoạt kiểm tra khi người dùng cố tình thay đổi chẩn đoán của ca đã thanh toán xong
                    -- Để an toàn cho demo, ta ghi nhận hoặc báo lỗi rõ ràng
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'LỖI BẢO VỆ Y BẠ (TRIGGER): Ca khám đã tất toán viện phí (PAID), không được tự ý sửa chẩn đoán!';
                END IF;
            END
        ");

        // Trigger 3: Ngăn số lượng thuốc âm
        DB::unprepared("
            CREATE TRIGGER trg_demo_ngan_so_luong_thuoc_am
            BEFORE INSERT ON inventory_transactions
            FOR EACH ROW
            BEGIN
                DECLARE v_current_stock DECIMAL(15,3) DEFAULT 0;

                IF NEW.transaction_type = 'OUT' THEN
                    SELECT COALESCE(SUM(
                        CASE 
                            WHEN transaction_type = 'IN' THEN quantity
                            WHEN transaction_type = 'OUT' THEN -quantity
                            WHEN transaction_type = 'ADJUST' THEN quantity
                            ELSE 0 
                        END
                    ), 0) INTO v_current_stock
                    FROM inventory_transactions
                    WHERE product_id = NEW.product_id;

                    IF v_current_stock < NEW.quantity THEN
                        SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'LỖI TỒN KHO (TRIGGER): Số lượng xuất vượt quá tồn kho khả dụng hiện tại!';
                    END IF;
                END IF;
            END
        ");

        // Trigger 4: Cập nhật lần khám gần nhất của bệnh nhân
        DB::unprepared("
            CREATE TRIGGER trg_demo_cap_nhat_lan_kham_gan_nhat
            AFTER INSERT ON visits
            FOR EACH ROW
            BEGIN
                IF NEW.patient_id IS NOT NULL THEN
                    UPDATE patients
                    SET last_visit_date = NEW.visit_date, updated_at = NOW()
                    WHERE id = NEW.patient_id;
                END IF;
            END
        ");

        // Trigger 5: Ghi nhận lịch sử khi xóa bệnh nhân
        DB::unprepared("
            CREATE TRIGGER trg_demo_ghi_nhat_ky_xoa_benh_nhan
            AFTER DELETE ON patients
            FOR EACH ROW
            BEGIN
                INSERT INTO db_demo_audit_logs (
                    executed_at, sql_object_name, sql_object_type, target_table, action_type,
                    before_data, after_data, status, execution_message, duration_ms, created_at, updated_at
                ) VALUES (
                    NOW(), 'trg_demo_ghi_nhat_ky_xoa_benh_nhan', 'TRIGGER', 'patients', 'DELETE',
                    JSON_OBJECT(
                        'id', OLD.id,
                        'patient_code', OLD.patient_code,
                        'full_name', OLD.full_name,
                        'phone', OLD.phone
                    ),
                    NULL, 'VERIFIED',
                    CONCAT('Kích hoạt trigger lưu vết: Đã xóa bệnh nhân mã ', OLD.patient_code, ' - ', OLD.full_name),
                    1, NOW(), NOW()
                );
            END
        ");

        // -------------------------------------------------------------
        // C. 3 FUNCTIONS
        // -------------------------------------------------------------

        // Function 1: Tính công nợ bệnh nhân
        DB::unprepared("
            CREATE FUNCTION fn_demo_tinh_cong_no_benh_nhan(p_patient_id BIGINT)
            RETURNS DECIMAL(15,2)
            DETERMINISTIC
            READS SQL DATA
            BEGIN
                DECLARE v_total_debt DECIMAL(15,2) DEFAULT 0;

                SELECT COALESCE(SUM(remaining_amount), 0)
                INTO v_total_debt
                FROM invoices
                WHERE patient_id = p_patient_id
                  AND status != 'CANCELLED';

                RETURN v_total_debt;
            END
        ");

        // Function 2: Tính tỷ lệ hoàn thành KPI bác sĩ
        DB::unprepared("
            CREATE FUNCTION fn_demo_tinh_kpi_bac_si(
                p_employee_id BIGINT,
                p_start_date DATE,
                p_end_date DATE
            )
            RETURNS DECIMAL(5,2)
            DETERMINISTIC
            READS SQL DATA
            BEGIN
                DECLARE v_target_revenue DECIMAL(15,2) DEFAULT 0;
                DECLARE v_target_visits INT DEFAULT 0;
                DECLARE v_actual_revenue DECIMAL(15,2) DEFAULT 0;
                DECLARE v_actual_visits INT DEFAULT 0;
                DECLARE v_rev_rate DECIMAL(7,4) DEFAULT 0;
                DECLARE v_vis_rate DECIMAL(7,4) DEFAULT 0;
                DECLARE v_final_score DECIMAL(5,2) DEFAULT 0;

                -- 1. Lấy chỉ tiêu KPI được giao
                SELECT COALESCE(target_revenue, 0), COALESCE(target_visits, 0)
                INTO v_target_revenue, v_target_visits
                FROM kpi_targets
                WHERE employee_id = p_employee_id
                  AND period_start <= p_end_date 
                  AND period_end >= p_start_date
                ORDER BY id DESC LIMIT 1;

                -- 2. Lấy số liệu thực đạt
                SELECT 
                    COALESCE(COUNT(DISTINCT v.id), 0),
                    COALESCE(SUM(inv.paid_amount), 0)
                INTO v_actual_visits, v_actual_revenue
                FROM visits v
                LEFT JOIN invoices inv ON inv.visit_id = v.id AND inv.status != 'CANCELLED'
                WHERE v.employee_id = p_employee_id
                  AND v.visit_date BETWEEN p_start_date AND p_end_date;

                -- 3. Tính điểm có trọng số (60% Doanh thu + 40% Ca khám)
                IF v_target_revenue > 0 THEN
                    SET v_rev_rate = (v_actual_revenue / v_target_revenue);
                ELSE
                    SET v_rev_rate = 1.0;
                END IF;

                IF v_target_visits > 0 THEN
                    SET v_vis_rate = (v_actual_visits / v_target_visits);
                ELSE
                    SET v_vis_rate = 1.0;
                END IF;

                SET v_final_score = ((v_rev_rate * 0.6) + (v_vis_rate * 0.4)) * 100;
                
                IF v_final_score > 999.99 THEN
                    SET v_final_score = 999.99;
                END IF;

                RETURN v_final_score;
            END
        ");

        // Function 3: Kiểm tra tình trạng tồn kho thuốc
        DB::unprepared("
            CREATE FUNCTION fn_demo_kiem_tra_ton_kho_thuoc(p_product_id BIGINT)
            RETURNS VARCHAR(30)
            DETERMINISTIC
            READS SQL DATA
            BEGIN
                DECLARE v_min_stock DECIMAL(15,3) DEFAULT 0;
                DECLARE v_current_stock DECIMAL(15,3) DEFAULT 0;

                SELECT COALESCE(minimum_stock, 0) INTO v_min_stock
                FROM products
                WHERE id = p_product_id;

                SELECT COALESCE(SUM(
                    CASE 
                        WHEN transaction_type = 'IN' THEN quantity
                        WHEN transaction_type = 'OUT' THEN -quantity
                        WHEN transaction_type = 'ADJUST' THEN quantity
                        ELSE 0 
                    END
                ), 0) INTO v_current_stock
                FROM inventory_transactions
                WHERE product_id = p_product_id;

                IF v_current_stock <= 0 THEN
                    RETURN 'OUT_OF_STOCK';
                ELSEIF v_current_stock <= v_min_stock THEN
                    RETURN 'LOW_STOCK';
                ELSE
                    RETURN 'NORMAL';
                END IF;
            END
        ");

        // -------------------------------------------------------------
        // D. 2 CURSORS (Triển khai trong Stored Procedure có DECLARE, LOOP, HANDLER)
        // -------------------------------------------------------------

        // Cursor 1: Phân loại công nợ quá hạn
        DB::unprepared("
            CREATE PROCEDURE sp_demo_cursor_phan_loai_tuoi_no()
            BEGIN
                DECLARE done INT DEFAULT FALSE;
                DECLARE v_inv_id BIGINT;
                DECLARE v_code VARCHAR(50);
                DECLARE v_patient_name VARCHAR(150);
                DECLARE v_remaining DECIMAL(15,2);
                DECLARE v_days_overdue INT;
                DECLARE v_aging_tier VARCHAR(30);

                -- Khai báo CURSOR duyệt các hóa đơn còn nợ
                DECLARE cur_invoices CURSOR FOR
                    SELECT 
                        inv.id, inv.invoice_code, p.full_name, inv.remaining_amount,
                        DATEDIFF(NOW(), COALESCE(inv.issued_at, inv.created_at)) AS days_overdue
                    FROM invoices inv
                    JOIN patients p ON p.id = inv.patient_id
                    WHERE inv.remaining_amount > 0 AND inv.status != 'CANCELLED';

                -- Handler kết thúc con trỏ
                DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

                -- Bảng tạm lưu kết quả phân loại
                DROP TEMPORARY TABLE IF EXISTS tmp_aging_debt_result;
                CREATE TEMPORARY TABLE tmp_aging_debt_result (
                    invoice_id BIGINT,
                    invoice_code VARCHAR(50),
                    patient_name VARCHAR(150),
                    remaining_amount DECIMAL(15,2),
                    days_overdue INT,
                    aging_tier VARCHAR(50),
                    risk_assessment VARCHAR(100)
                );

                OPEN cur_invoices;

                read_loop: LOOP
                    FETCH cur_invoices INTO v_inv_id, v_code, v_patient_name, v_remaining, v_days_overdue;
                    IF done THEN
                        LEAVE read_loop;
                    END IF;

                    -- Xử lý phân loại tuổi nợ theo ngày
                    IF v_days_overdue <= 7 THEN
                        SET v_aging_tier = '0 - 7 Ngày (Nợ trong hạn)';
                        INSERT INTO tmp_aging_debt_result VALUES (v_inv_id, v_code, v_patient_name, v_remaining, v_days_overdue, v_aging_tier, 'An toàn - Gửi hóa đơn đợt 1');
                    ELSEIF v_days_overdue <= 30 THEN
                        SET v_aging_tier = '8 - 30 Ngày (Cần nhắc nợ)';
                        INSERT INTO tmp_aging_debt_result VALUES (v_inv_id, v_code, v_patient_name, v_remaining, v_days_overdue, v_aging_tier, 'Cảnh báo - Gửi SMS nhắc nợ');
                    ELSE
                        SET v_aging_tier = '> 30 Ngày (Nợ xấu có nguy cơ)';
                        INSERT INTO tmp_aging_debt_result VALUES (v_inv_id, v_code, v_patient_name, v_remaining, v_days_overdue, v_aging_tier, 'Rủi ro cao - Chuyển Ban quản lý xử lý');
                    END IF;
                END LOOP;

                CLOSE cur_invoices;

                -- Trả về bảng kết quả phân loại
                SELECT * FROM tmp_aging_debt_result ORDER BY days_overdue DESC;
                DROP TEMPORARY TABLE IF EXISTS tmp_aging_debt_result;
            END
        ");

        // Cursor 2: Tổng hợp và xếp hạng KPI bác sĩ
        DB::unprepared("
            CREATE PROCEDURE sp_demo_cursor_xep_hang_kpi_bac_si(
                IN p_start_date DATE,
                IN p_end_date DATE
            )
            BEGIN
                DECLARE done INT DEFAULT FALSE;
                DECLARE v_doc_id BIGINT;
                DECLARE v_doc_code VARCHAR(50);
                DECLARE v_doc_name VARCHAR(150);
                DECLARE v_dept VARCHAR(100);
                DECLARE v_kpi_score DECIMAL(5,2);
                DECLARE v_rank_tier VARCHAR(50);

                -- Khai báo CURSOR duyệt danh sách tất cả các nhân viên y tế
                DECLARE cur_doctors CURSOR FOR
                    SELECT id, employee_code, full_name, department
                    FROM employees
                    WHERE status = 'ACTIVE';

                DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

                DROP TEMPORARY TABLE IF EXISTS tmp_doctor_kpi_ranking;
                CREATE TEMPORARY TABLE tmp_doctor_kpi_ranking (
                    doctor_id BIGINT,
                    employee_code VARCHAR(50),
                    doctor_name VARCHAR(150),
                    department VARCHAR(100),
                    kpi_score DECIMAL(5,2),
                    ranking_tier VARCHAR(50),
                    recommendation VARCHAR(150)
                );

                OPEN cur_doctors;

                doctor_loop: LOOP
                    FETCH cur_doctors INTO v_doc_id, v_doc_code, v_doc_name, v_dept;
                    IF done THEN
                        LEAVE doctor_loop;
                    END IF;

                    -- Gọi hàm tính KPI cho từng bác sĩ
                    SET v_kpi_score = fn_demo_tinh_kpi_bac_si(v_doc_id, p_start_date, p_end_date);

                    -- Xếp loại thi đua
                    IF v_kpi_score >= 100.00 THEN
                        SET v_rank_tier = 'Xuất sắc (Vượt chỉ tiêu)';
                        INSERT INTO tmp_doctor_kpi_ranking VALUES (v_doc_id, v_doc_code, v_doc_name, v_dept, v_kpi_score, v_rank_tier, 'Khen thưởng & Tuyên dương thi đua');
                    ELSEIF v_kpi_score >= 80.00 THEN
                        SET v_rank_tier = 'Tốt (Đạt chuẩn phòng khám)';
                        INSERT INTO tmp_doctor_kpi_ranking VALUES (v_doc_id, v_doc_code, v_doc_name, v_dept, v_kpi_score, v_rank_tier, 'Duy trì năng suất hiện tại');
                    ELSEIF v_kpi_score >= 50.00 THEN
                        SET v_rank_tier = 'Đạt (Cần cố gắng)';
                        INSERT INTO tmp_doctor_kpi_ranking VALUES (v_doc_id, v_doc_code, v_doc_name, v_dept, v_kpi_score, v_rank_tier, 'Tăng cường số ca khám buổi sáng');
                    ELSE
                        SET v_rank_tier = 'Chưa đạt (Cần cải thiện)';
                        INSERT INTO tmp_doctor_kpi_ranking VALUES (v_doc_id, v_doc_code, v_doc_name, v_dept, v_kpi_score, v_rank_tier, 'Họp rà soát và điều phối lịch trực');
                    END IF;
                END LOOP;

                CLOSE cur_doctors;

                -- Trả về bảng xếp hạng giảm dần theo điểm KPI
                SELECT * FROM tmp_doctor_kpi_ranking ORDER BY kpi_score DESC;
                DROP TEMPORARY TABLE IF EXISTS tmp_doctor_kpi_ranking;
            END
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $this->dropAllObjects();
        Schema::dropIfExists('db_demo_audit_logs');
    }

    /**
     * Dọn dẹp sạch sẽ toàn bộ các SP, Trigger, Function, Cursor
     */
    protected function dropAllObjects(): void
    {
        // Drop Procedures
        DB::unprepared("DROP PROCEDURE IF EXISTS sp_demo_tiep_nhan_benh_nhan;");
        DB::unprepared("DROP PROCEDURE IF EXISTS sp_demo_tao_hoa_don_xuat_thuoc;");
        DB::unprepared("DROP PROCEDURE IF EXISTS sp_demo_thanh_toan_hoa_don;");
        DB::unprepared("DROP PROCEDURE IF EXISTS sp_demo_bao_cao_doanh_thu_bac_si;");
        DB::unprepared("DROP PROCEDURE IF EXISTS sp_demo_huy_lich_hen_giai_phong_bs;");
        DB::unprepared("DROP PROCEDURE IF EXISTS sp_demo_cursor_phan_loai_tuoi_no;");
        DB::unprepared("DROP PROCEDURE IF EXISTS sp_demo_cursor_xep_hang_kpi_bac_si;");

        // Drop Triggers
        DB::unprepared("DROP TRIGGER IF EXISTS trg_demo_chong_trung_lich_bs;");
        DB::unprepared("DROP TRIGGER IF EXISTS trg_demo_kiem_soat_sua_benh_an_paid;");
        DB::unprepared("DROP TRIGGER IF EXISTS trg_demo_ngan_so_luong_thuoc_am;");
        DB::unprepared("DROP TRIGGER IF EXISTS trg_demo_cap_nhat_lan_kham_gan_nhat;");
        DB::unprepared("DROP TRIGGER IF EXISTS trg_demo_ghi_nhat_ky_xoa_benh_nhan;");

        // Drop Functions
        DB::unprepared("DROP FUNCTION IF EXISTS fn_demo_tinh_cong_no_benh_nhan;");
        DB::unprepared("DROP FUNCTION IF EXISTS fn_demo_tinh_kpi_bac_si;");
        DB::unprepared("DROP FUNCTION IF EXISTS fn_demo_kiem_tra_ton_kho_thuoc;");
    }
};
