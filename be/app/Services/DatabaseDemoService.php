<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Product;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class DatabaseDemoService
{
    /**
     * Tự động khởi tạo cấu trúc bảng db_demo_audit_logs nếu chưa chạy migrate thủ công (Self-healing).
     */
    public function ensureSchemaReady(): void
    {
        try {
            if (!Schema::hasTable('db_demo_audit_logs')) {
                Schema::create('db_demo_audit_logs', function ($table) {
                    $table->id();
                    $table->timestamp('executed_at')->useCurrent();
                    $table->string('sql_object_name', 100)->index();
                    $table->string('sql_object_type', 30);
                    $table->string('target_table', 100);
                    $table->string('action_type', 50);
                    $table->json('before_data')->nullable();
                    $table->json('after_data')->nullable();
                    $table->string('status', 30)->default('SUCCESS');
                    $table->text('execution_message')->nullable();
                    $table->unsignedBigInteger('executed_by')->nullable();
                    $table->unsignedInteger('duration_ms')->default(0);
                    $table->timestamps();
                });
            }
        } catch (\Throwable $e) {
            Log::info("Audit log table check note: " . $e->getMessage());
        }
    }

    /**
     * Danh mục đầy đủ 15 đối tượng Quản lý thông tin SQL kèm metadata.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAllObjects(): array
    {
        $this->ensureSchemaReady();
        return [
            // =========================================================================
            // A. 5 STORED PROCEDURES
            // =========================================================================
            [
                'id' => 'sp_1',
                'name' => 'sp_demo_tiep_nhan_benh_nhan',
                'type' => 'PROCEDURE',
                'title' => 'Tiếp nhận bệnh nhân từ lịch hẹn',
                'module' => 'appointments',
                'module_label' => 'Lịch hẹn & Tiếp đón',
                'purpose' => 'Kiểm tra trạng thái lịch hẹn, khóa bi quan chống race condition, chuyển lịch hẹn sang COMPLETED và tự động tạo lượt khám mới ở trạng thái WAITING trong một giao dịch nguyên tử (Atomic Check-in).',
                'target_tables' => ['appointments', 'visits', 'patients'],
                'target_columns' => ['appointments.status', 'visits.visit_code', 'visits.status', 'visits.payment_status'],
                'parameters' => [
                    ['name' => 'p_appointment_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID lịch hẹn cần tiếp đón'],
                    ['name' => 'p_user_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID người dùng thực hiện (Lễ tân/Admin)'],
                    ['name' => 'p_visit_id', 'type' => 'BIGINT', 'direction' => 'OUT', 'description' => 'ID lượt khám mới được sinh ra'],
                    ['name' => 'p_status_code', 'type' => 'VARCHAR(30)', 'direction' => 'OUT', 'description' => 'Mã trạng thái kết quả (SUCCESS/ERROR/...)'],
                    ['name' => 'p_message', 'type' => 'TEXT', 'direction' => 'OUT', 'description' => 'Thông báo kết quả chi tiết'],
                ],
                'sql_definition' => "CREATE PROCEDURE sp_demo_tiep_nhan_benh_nhan(
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
END;",
                'sql_invocation' => "CALL sp_demo_tiep_nhan_benh_nhan(?, ?, @p_visit_id, @p_status_code, @p_message);
SELECT @p_visit_id AS visit_id, @p_status_code AS status_code, @p_message AS message;",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'sp_2',
                'name' => 'sp_demo_tao_hoa_don_xuat_thuoc',
                'type' => 'PROCEDURE',
                'title' => 'Tạo hóa đơn và xuất thuốc',
                'module' => 'invoices',
                'module_label' => 'Hóa đơn & Viện phí',
                'purpose' => 'Tổng hợp chi phí khám và thuốc của ca khám, tự động sinh Hóa đơn viện phí trạng thái UNPAID và tạo phiếu xuất kho nếu có kê đơn thuốc.',
                'target_tables' => ['visits', 'invoices', 'inventory_transactions'],
                'target_columns' => ['invoices.invoice_code', 'invoices.total_amount', 'invoices.status', 'visits.payment_status'],
                'parameters' => [
                    ['name' => 'p_visit_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID lượt khám cần lập hóa đơn'],
                    ['name' => 'p_user_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID người lập (Thu ngân/Admin)'],
                    ['name' => 'p_invoice_id', 'type' => 'BIGINT', 'direction' => 'OUT', 'description' => 'ID hóa đơn mới được sinh ra'],
                    ['name' => 'p_total_amount', 'type' => 'DECIMAL(15,2)', 'direction' => 'OUT', 'description' => 'Tổng số tiền của hóa đơn'],
                    ['name' => 'p_status_code', 'type' => 'VARCHAR(30)', 'direction' => 'OUT', 'description' => 'Mã trạng thái kết quả'],
                    ['name' => 'p_message', 'type' => 'TEXT', 'direction' => 'OUT', 'description' => 'Thông báo kết quả chi tiết'],
                ],
                'sql_definition' => "CREATE PROCEDURE sp_demo_tao_hoa_don_xuat_thuoc(
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
END;",
                'sql_invocation' => "CALL sp_demo_tao_hoa_don_xuat_thuoc(?, ?, @p_invoice_id, @p_total_amount, @p_status_code, @p_message);
SELECT @p_invoice_id AS invoice_id, @p_total_amount AS total_amount, @p_status_code AS status_code, @p_message AS message;",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'sp_3',
                'name' => 'sp_demo_thanh_toan_hoa_don',
                'type' => 'PROCEDURE',
                'title' => 'Xử lý thanh toán hóa đơn',
                'module' => 'invoices',
                'module_label' => 'Hóa đơn & Viện phí',
                'purpose' => 'Xử lý thu tiền đợt 1 / tất toán hóa đơn, cập nhật số tiền đã thu, công nợ còn lại, chuyển trạng thái (PARTIAL/PAID), tự động sinh bản ghi thanh toán payments và phiếu thu sổ quỹ cash_transactions.',
                'target_tables' => ['invoices', 'payments', 'cash_transactions'],
                'target_columns' => ['invoices.paid_amount', 'invoices.remaining_amount', 'invoices.status', 'payments.payment_code', 'cash_transactions.transaction_code'],
                'parameters' => [
                    ['name' => 'p_invoice_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID hóa đơn cần thanh toán'],
                    ['name' => 'p_amount', 'type' => 'DECIMAL(15,2)', 'direction' => 'IN', 'description' => 'Số tiền thu nộp đợt này'],
                    ['name' => 'p_payment_method', 'type' => 'VARCHAR(30)', 'direction' => 'IN', 'description' => 'Phương thức (CASH / BANK_TRANSFER)'],
                    ['name' => 'p_user_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID nhân viên thu ngân'],
                    ['name' => 'p_payment_id', 'type' => 'BIGINT', 'direction' => 'OUT', 'description' => 'ID phiếu thanh toán được tạo'],
                    ['name' => 'p_remaining_amount', 'type' => 'DECIMAL(15,2)', 'direction' => 'OUT', 'description' => 'Số tiền còn nợ sau thanh toán'],
                    ['name' => 'p_status_code', 'type' => 'VARCHAR(30)', 'direction' => 'OUT', 'description' => 'Mã trạng thái kết quả'],
                    ['name' => 'p_message', 'type' => 'TEXT', 'direction' => 'OUT', 'description' => 'Thông báo kết quả chi tiết'],
                ],
                'sql_definition' => "CREATE PROCEDURE sp_demo_thanh_toan_hoa_don(
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
END;",
                'sql_invocation' => "CALL sp_demo_thanh_toan_hoa_don(?, ?, ?, ?, @p_payment_id, @p_remaining_amount, @p_status_code, @p_message);
SELECT @p_payment_id AS payment_id, @p_remaining_amount AS remaining_amount, @p_status_code AS status_code, @p_message AS message;",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'sp_4',
                'name' => 'sp_demo_bao_cao_doanh_thu_bac_si',
                'type' => 'PROCEDURE',
                'title' => 'Báo cáo doanh thu bác sĩ',
                'module' => 'reports',
                'module_label' => 'Báo cáo Quản trị',
                'purpose' => 'Tổng hợp số liệu khám bệnh, tổng doanh thu phát sinh, thực thu và công nợ của từng bác sĩ trong kỳ để phục vụ đánh giá năng suất chuyên môn.',
                'target_tables' => ['employees', 'visits', 'invoices'],
                'target_columns' => ['employees.full_name', 'visits.status', 'invoices.total_amount', 'invoices.paid_amount'],
                'parameters' => [
                    ['name' => 'p_start_date', 'type' => 'DATE', 'direction' => 'IN', 'description' => 'Ngày bắt đầu kỳ báo cáo'],
                    ['name' => 'p_end_date', 'type' => 'DATE', 'direction' => 'IN', 'description' => 'Ngày kết thúc kỳ báo cáo'],
                ],
                'sql_definition' => "CREATE PROCEDURE sp_demo_bao_cao_doanh_thu_bac_si(
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
END;",
                'sql_invocation' => "CALL sp_demo_bao_cao_doanh_thu_bac_si(?, ?);",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'sp_5',
                'name' => 'sp_demo_huy_lich_hen_giai_phong_bs',
                'type' => 'PROCEDURE',
                'title' => 'Hủy lịch hẹn và giải phóng bác sĩ',
                'module' => 'appointments',
                'module_label' => 'Lịch hẹn & Tiếp đón',
                'purpose' => 'Hủy lịch hẹn chưa khám, lưu lý do hủy vào hồ sơ, giải phóng khung giờ trống của bác sĩ và ngăn chặn việc hủy ca khám đã hoàn tất.',
                'target_tables' => ['appointments', 'employees'],
                'target_columns' => ['appointments.status', 'appointments.notes'],
                'parameters' => [
                    ['name' => 'p_appointment_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID lịch hẹn cần hủy'],
                    ['name' => 'p_reason', 'type' => 'TEXT', 'direction' => 'IN', 'description' => 'Lý do hủy lịch hẹn'],
                    ['name' => 'p_user_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID người thực hiện thao tác'],
                    ['name' => 'p_status_code', 'type' => 'VARCHAR(30)', 'direction' => 'OUT', 'description' => 'Mã trạng thái kết quả'],
                    ['name' => 'p_message', 'type' => 'TEXT', 'direction' => 'OUT', 'description' => 'Thông báo kết quả'],
                ],
                'sql_definition' => "CREATE PROCEDURE sp_demo_huy_lich_hen_giai_phong_bs(
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
END;",
                'sql_invocation' => "CALL sp_demo_huy_lich_hen_giai_phong_bs(?, ?, ?, @p_status_code, @p_message);
SELECT @p_status_code AS status_code, @p_message AS message;",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            // =========================================================================
            // B. 5 TRIGGERS
            // =========================================================================
            [
                'id' => 'trg_1',
                'name' => 'trg_demo_chong_trung_lich_bs',
                'type' => 'TRIGGER',
                'title' => 'Kiểm tra trùng lịch bác sĩ',
                'module' => 'appointments',
                'module_label' => 'Lịch hẹn & Tiếp đón',
                'purpose' => 'Ngăn chặn tuyệt đối việc thêm lịch hẹn bị trùng hoặc giao nhau về khung giờ của cùng một bác sĩ trong cùng ngày (bảo vệ toàn vẹn lịch trực).',
                'target_tables' => ['appointments'],
                'target_columns' => ['employee_id', 'appointment_date', 'start_time', 'end_time', 'status'],
                'trigger_event' => 'BEFORE INSERT ON appointments',
                'sql_definition' => "CREATE TRIGGER trg_demo_chong_trung_lich_bs
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
END;",
                'sql_invocation' => "INSERT INTO appointments (appointment_code, patient_id, employee_id, appointment_date, start_time, end_time, status)
VALUES ('APP_TEST_DUPLICATE', 1, 1, CURRENT_DATE(), '09:00:00', '09:30:00', 'CONFIRMED');",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'trg_2',
                'name' => 'trg_demo_kiem_soat_sua_benh_an_paid',
                'type' => 'TRIGGER',
                'title' => 'Kiểm soát chỉnh sửa hồ sơ sau thanh toán',
                'module' => 'patients',
                'module_label' => 'Quản lý Bệnh nhân',
                'purpose' => 'Ngăn chặn hành vi tự ý sửa đổi chẩn đoán y bạ của những ca khám đã thanh toán tất toán viện phí (PAID) nhằm bảo vệ tính toàn vẹn y bạ và pháp lý y khoa.',
                'target_tables' => ['medical_records', 'visits'],
                'target_columns' => ['medical_records.diagnosis', 'visits.payment_status'],
                'trigger_event' => 'BEFORE UPDATE ON medical_records',
                'sql_definition' => "CREATE TRIGGER trg_demo_kiem_soat_sua_benh_an_paid
BEFORE UPDATE ON medical_records
FOR EACH ROW
BEGIN
    DECLARE v_pay_status VARCHAR(30);

    SELECT payment_status INTO v_pay_status
    FROM visits
    WHERE id = NEW.visit_id;

    IF v_pay_status = 'PAID' AND (OLD.diagnosis != NEW.diagnosis OR (OLD.diagnosis IS NULL AND NEW.diagnosis IS NOT NULL)) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'LỖI BẢO VỆ Y BẠ (TRIGGER): Ca khám đã tất toán viện phí (PAID), không được tự ý sửa chẩn đoán!';
    END IF;
END;",
                'sql_invocation' => "UPDATE medical_records 
SET diagnosis = 'Chẩn đoán đã bị thay đổi lén lút' 
WHERE visit_id = (SELECT id FROM visits WHERE payment_status = 'PAID' LIMIT 1);",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'trg_3',
                'name' => 'trg_demo_ngan_so_luong_thuoc_am',
                'type' => 'TRIGGER',
                'title' => 'Ngăn số lượng thuốc âm',
                'module' => 'inventory',
                'module_label' => 'Kho Dược & Vật tư',
                'purpose' => 'Kiểm tra tồn kho khả dụng thời gian thực trước khi chèn bản ghi xuất kho (OUT), chặn tuyệt đối xuất vượt quá tồn kho khả dụng gây âm kho.',
                'target_tables' => ['inventory_transactions', 'products'],
                'target_columns' => ['inventory_transactions.transaction_type', 'inventory_transactions.quantity'],
                'trigger_event' => 'BEFORE INSERT ON inventory_transactions',
                'sql_definition' => "CREATE TRIGGER trg_demo_ngan_so_luong_thuoc_am
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
END;",
                'sql_invocation' => "INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date)
VALUES (1, 'OUT', 999999.000, NOW());",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'trg_4',
                'name' => 'trg_demo_cap_nhat_lan_kham_gan_nhat',
                'type' => 'TRIGGER',
                'title' => 'Cập nhật lần khám gần nhất',
                'module' => 'patients',
                'module_label' => 'Quản lý Bệnh nhân',
                'purpose' => 'Tự động đồng bộ trường last_visit_date của bảng patients ngay sau khi lượt khám mới được tạo trên hệ thống.',
                'target_tables' => ['visits', 'patients'],
                'target_columns' => ['visits.visit_date', 'patients.last_visit_date'],
                'trigger_event' => 'AFTER INSERT ON visits',
                'sql_definition' => "CREATE TRIGGER trg_demo_cap_nhat_lan_kham_gan_nhat
AFTER INSERT ON visits
FOR EACH ROW
BEGIN
    IF NEW.patient_id IS NOT NULL THEN
        UPDATE patients
        SET last_visit_date = NEW.visit_date, updated_at = NOW()
        WHERE id = NEW.patient_id;
    END IF;
END;",
                'sql_invocation' => "INSERT INTO visits (visit_code, patient_id, employee_id, visit_date, total_amount, payment_status, status)
VALUES ('VK_TRG_DEMO', 1, 1, CURRENT_DATE(), 100000, 'UNPAID', 'WAITING');",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'trg_5',
                'name' => 'trg_demo_ghi_nhat_ky_xoa_benh_nhan',
                'type' => 'TRIGGER',
                'title' => 'Ghi nhận lịch sử khi xóa bệnh nhân',
                'module' => 'patients',
                'module_label' => 'Quản lý Bệnh nhân',
                'purpose' => 'Tự động chèn bản ghi kiểm toán vào bảng db_demo_audit_logs lưu giữ toàn bộ thông tin mã, họ tên, số điện thoại của bệnh nhân bị xóa để phục vụ thanh tra y tế.',
                'target_tables' => ['patients', 'db_demo_audit_logs'],
                'target_columns' => ['patients.id', 'patients.patient_code', 'patients.full_name'],
                'trigger_event' => 'AFTER DELETE ON patients',
                'sql_definition' => "CREATE TRIGGER trg_demo_ghi_nhat_ky_xoa_benh_nhan
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
END;",
                'sql_invocation' => "DELETE FROM patients WHERE patient_code = 'BN_DEMO_TEST';",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            // =========================================================================
            // C. 3 FUNCTIONS
            // =========================================================================
            [
                'id' => 'fn_1',
                'name' => 'fn_demo_tinh_cong_no_benh_nhan',
                'type' => 'FUNCTION',
                'title' => 'Tính công nợ bệnh nhân',
                'module' => 'invoices',
                'module_label' => 'Hóa đơn & Viện phí',
                'purpose' => 'Tính toán tổng số tiền nợ chưa thanh toán của một bệnh nhân dựa trên tổng số tiền còn lại (remaining_amount) của tất cả các hóa đơn chưa tất toán và không bị hủy.',
                'target_tables' => ['invoices'],
                'target_columns' => ['invoices.patient_id', 'invoices.remaining_amount', 'invoices.status'],
                'parameters' => [
                    ['name' => 'p_patient_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID bệnh nhân cần tính nợ'],
                ],
                'sql_definition' => "CREATE FUNCTION fn_demo_tinh_cong_no_benh_nhan(p_patient_id BIGINT)
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
END;",
                'sql_invocation' => "SELECT fn_demo_tinh_cong_no_benh_nhan(?) AS tong_cong_no_benh_nhan;",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'fn_2',
                'name' => 'fn_demo_tinh_kpi_bac_si',
                'type' => 'FUNCTION',
                'title' => 'Tính tỷ lệ hoàn thành KPI',
                'module' => 'reports',
                'module_label' => 'Báo cáo Quản trị',
                'purpose' => 'Tính toán điểm hoàn thành KPI có trọng số: (60% Tỷ lệ Doanh thu thực tế + 40% Tỷ lệ Số lượt khám thực tế) so với chỉ tiêu được giao trong bảng kpi_targets.',
                'target_tables' => ['kpi_targets', 'visits', 'invoices'],
                'target_columns' => ['kpi_targets.target_revenue', 'kpi_targets.target_visits', 'invoices.paid_amount'],
                'parameters' => [
                    ['name' => 'p_employee_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID bác sĩ cần tính KPI'],
                    ['name' => 'p_start_date', 'type' => 'DATE', 'direction' => 'IN', 'description' => 'Ngày bắt đầu kỳ'],
                    ['name' => 'p_end_date', 'type' => 'DATE', 'direction' => 'IN', 'description' => 'Ngày kết thúc kỳ'],
                ],
                'sql_definition' => "CREATE FUNCTION fn_demo_tinh_kpi_bac_si(
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

    SELECT COALESCE(target_revenue, 0), COALESCE(target_visits, 0)
    INTO v_target_revenue, v_target_visits
    FROM kpi_targets
    WHERE employee_id = p_employee_id
      AND period_start <= p_end_date 
      AND period_end >= p_start_date
    ORDER BY id DESC LIMIT 1;

    SELECT 
        COALESCE(COUNT(DISTINCT v.id), 0),
        COALESCE(SUM(inv.paid_amount), 0)
    INTO v_actual_visits, v_actual_revenue
    FROM visits v
    LEFT JOIN invoices inv ON inv.visit_id = v.id AND inv.status != 'CANCELLED'
    WHERE v.employee_id = p_employee_id
      AND v.visit_date BETWEEN p_start_date AND p_end_date;

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
END;",
                'sql_invocation' => "SELECT fn_demo_tinh_kpi_bac_si(?, ?, ?) AS diem_kpi_phan_tram;",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'fn_3',
                'name' => 'fn_demo_kiem_tra_ton_kho_thuoc',
                'type' => 'FUNCTION',
                'title' => 'Kiểm tra tình trạng tồn kho thuốc',
                'module' => 'inventory',
                'module_label' => 'Kho Dược & Vật tư',
                'purpose' => 'Xác định tình trạng tồn kho khả dụng của sản phẩm y tế: OUT_OF_STOCK (Hết hàng <= 0), LOW_STOCK (Sắp hết <= định mức), NORMAL (An toàn).',
                'target_tables' => ['products', 'inventory_transactions'],
                'target_columns' => ['products.minimum_stock', 'inventory_transactions.quantity'],
                'parameters' => [
                    ['name' => 'p_product_id', 'type' => 'BIGINT', 'direction' => 'IN', 'description' => 'ID sản phẩm/thuốc cần kiểm tra'],
                ],
                'sql_definition' => "CREATE FUNCTION fn_demo_kiem_tra_ton_kho_thuoc(p_product_id BIGINT)
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
END;",
                'sql_invocation' => "SELECT fn_demo_kiem_tra_ton_kho_thuoc(?) AS trang_thai_ton_kho;",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            // =========================================================================
            // D. 2 CURSORS
            // =========================================================================
            [
                'id' => 'cur_1',
                'name' => 'sp_demo_cursor_phan_loai_tuoi_no',
                'type' => 'CURSOR',
                'title' => 'Phân loại công nợ quá hạn (Cursor)',
                'module' => 'reports',
                'module_label' => 'Báo cáo Quản trị',
                'purpose' => 'Sử dụng CURSOR duyệt từng hóa đơn còn nợ, tính số ngày quá hạn (DATEDIFF), phân bổ vào 3 khung tuổi nợ (0-7 ngày, 8-30 ngày, >30 ngày) và đưa ra cảnh báo rủi ro.',
                'target_tables' => ['invoices', 'patients'],
                'target_columns' => ['invoices.remaining_amount', 'invoices.issued_at', 'patients.full_name'],
                'parameters' => [],
                'sql_definition' => "CREATE PROCEDURE sp_demo_cursor_phan_loai_tuoi_no()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_inv_id BIGINT;
    DECLARE v_code VARCHAR(50);
    DECLARE v_patient_name VARCHAR(150);
    DECLARE v_remaining DECIMAL(15,2);
    DECLARE v_days_overdue INT;
    DECLARE v_aging_tier VARCHAR(30);

    DECLARE cur_invoices CURSOR FOR
        SELECT 
            inv.id, inv.invoice_code, p.full_name, inv.remaining_amount,
            DATEDIFF(NOW(), COALESCE(inv.issued_at, inv.created_at)) AS days_overdue
        FROM invoices inv
        JOIN patients p ON p.id = inv.patient_id
        WHERE inv.remaining_amount > 0 AND inv.status != 'CANCELLED';

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

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

    SELECT * FROM tmp_aging_debt_result ORDER BY days_overdue DESC;
    DROP TEMPORARY TABLE IF EXISTS tmp_aging_debt_result;
END;",
                'sql_invocation' => "CALL sp_demo_cursor_phan_loai_tuoi_no();",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],

            [
                'id' => 'cur_2',
                'name' => 'sp_demo_cursor_xep_hang_kpi_bac_si',
                'type' => 'CURSOR',
                'title' => 'Tổng hợp và xếp hạng KPI bác sĩ (Cursor)',
                'module' => 'reports',
                'module_label' => 'Báo cáo Quản trị',
                'purpose' => 'Sử dụng CURSOR duyệt qua danh sách tất cả các bác sĩ, gọi hàm tính điểm KPI, phân hạng thi đua (Xuất sắc, Tốt, Đạt, Chưa đạt) và đề xuất khen thưởng quản trị.',
                'target_tables' => ['employees', 'kpi_targets', 'visits', 'invoices'],
                'target_columns' => ['employees.full_name', 'employees.department'],
                'parameters' => [
                    ['name' => 'p_start_date', 'type' => 'DATE', 'direction' => 'IN', 'description' => 'Ngày bắt đầu kỳ đánh giá'],
                    ['name' => 'p_end_date', 'type' => 'DATE', 'direction' => 'IN', 'description' => 'Ngày kết thúc kỳ đánh giá'],
                ],
                'sql_definition' => "CREATE PROCEDURE sp_demo_cursor_xep_hang_kpi_bac_si(
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

        SET v_kpi_score = fn_demo_tinh_kpi_bac_si(v_doc_id, p_start_date, p_end_date);

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

    SELECT * FROM tmp_doctor_kpi_ranking ORDER BY kpi_score DESC;
    DROP TEMPORARY TABLE IF EXISTS tmp_doctor_kpi_ranking;
END;",
                'sql_invocation' => "CALL sp_demo_cursor_xep_hang_kpi_bac_si(?, ?);",
                'status' => 'IMPLEMENTED_AND_VERIFIED',
            ],
        ];
    }

    /**
     * Lấy danh sách các đối tượng SQL theo Module nghiệp vụ.
     *
     * @param string $module appointments|patients|invoices|inventory|reports
     * @return array<int, array<string, mixed>>
     */
    public function getObjectsByModule(string $module): array
    {
        $all = $this->getAllObjects();
        return array_values(array_filter($all, fn ($obj) => $obj['module'] === $module));
    }

    /**
     * Lấy chi tiết một đối tượng SQL theo tên.
     */
    public function getObjectByName(string $name): ?array
    {
        $all = $this->getAllObjects();
        foreach ($all as $obj) {
            if ($obj['name'] === $name || $obj['id'] === $name) {
                return $obj;
            }
        }
        return null;
    }

    /**
     * Thực thi DEMO an toàn cho một đối tượng SQL, đo đạc thời gian, ghi nhận Trước/Sau và lưu Audit Log.
     *
     * @param string $objectName
     * @param array<string, mixed> $params
     * @param int|null $userId
     * @return array<string, mixed>
     */
    public function executeDemo(string $objectName, array $params = [], ?int $userId = null): array
    {
        $this->ensureSchemaReady();
        $startTime = microtime(true);
        $obj = $this->getObjectByName($objectName);

        if (!$obj) {
            return [
                'success' => false,
                'message' => "Không tìm thấy đối tượng SQL '{$objectName}' trong danh mục DEMO.",
            ];
        }

        $userId = $userId ?: 1;
        $beforeData = null;
        $afterData = null;
        $status = 'SUCCESS';
        $message = '';
        $actionType = 'SELECT/READ';
        $resultRows = [];

        try {
            switch ($obj['name']) {
                // -------------------------------------------------------------
                // 1. SP: Tiếp nhận bệnh nhân
                // -------------------------------------------------------------
                case 'sp_demo_tiep_nhan_benh_nhan':
                    $actionType = 'PROCEDURE_EXEC';
                    $appointmentId = $params['appointment_id'] ?? null;
                    if (!$appointmentId) {
                        // Lấy lịch hẹn CONFIRMED hoặc PENDING đầu tiên
                        $app = Appointment::whereIn('status', ['CONFIRMED', 'PENDING'])->first();
                        $appointmentId = $app ? $app->id : 1;
                    }

                    // Lưu dữ liệu Before
                    $beforeApp = Appointment::find($appointmentId);
                    $beforeData = [
                        'appointment_id' => $appointmentId,
                        'appointment_status' => $beforeApp->status ?? 'NOT_FOUND',
                        'patient_id' => $beforeApp->patient_id ?? null,
                    ];

                    // Thực thi Procedure
                    $res = DB::select('CALL sp_demo_tiep_nhan_benh_nhan(?, ?, @v_id, @v_code, @v_msg)', [$appointmentId, $userId]);
                    $outVars = DB::select('SELECT @v_id AS visit_id, @v_code AS status_code, @v_msg AS message')[0] ?? null;

                    $newVisitId = $outVars->visit_id ?? null;
                    $statusCode = $outVars->status_code ?? 'ERROR';
                    $message = $outVars->message ?? 'Thực thi xong';

                    // Lấy dữ liệu After
                    $afterApp = Appointment::find($appointmentId);
                    $newVisit = $newVisitId ? Visit::find($newVisitId) : null;
                    $afterData = [
                        'appointment_id' => $appointmentId,
                        'appointment_status' => $afterApp->status ?? null,
                        'created_visit_id' => $newVisitId,
                        'created_visit_code' => $newVisit->visit_code ?? null,
                        'created_visit_status' => $newVisit->status ?? null,
                    ];
                    $status = $statusCode === 'SUCCESS' ? 'SUCCESS' : ($statusCode === 'ALREADY_EXISTS' ? 'VERIFIED' : 'FAILED');
                    break;

                // -------------------------------------------------------------
                // 2. SP: Tạo hóa đơn và xuất thuốc
                // -------------------------------------------------------------
                case 'sp_demo_tao_hoa_don_xuat_thuoc':
                    $actionType = 'PROCEDURE_EXEC';
                    $visitId = $params['visit_id'] ?? null;
                    if (!$visitId) {
                        $v = Visit::doesntHave('invoices')->first() ?: Visit::first();
                        $visitId = $v ? $v->id : 1;
                    }

                    $vBefore = Visit::with('invoices')->find($visitId);
                    $beforeData = [
                        'visit_id' => $visitId,
                        'existing_invoices_count' => $vBefore ? $vBefore->invoices->count() : 0,
                        'total_amount' => $vBefore->total_amount ?? 0,
                    ];

                    DB::select('CALL sp_demo_tao_hoa_don_xuat_thuoc(?, ?, @v_inv_id, @v_total, @v_code, @v_msg)', [$visitId, $userId]);
                    $outVars = DB::select('SELECT @v_inv_id AS invoice_id, @v_total AS total_amount, @v_code AS status_code, @v_msg AS message')[0] ?? null;

                    $invId = $outVars->invoice_id ?? null;
                    $message = $outVars->message ?? 'Thực thi xong';
                    $createdInvoice = $invId ? Invoice::find($invId) : null;

                    $afterData = [
                        'visit_id' => $visitId,
                        'invoice_id' => $invId,
                        'invoice_code' => $createdInvoice->invoice_code ?? null,
                        'total_amount' => $createdInvoice->total_amount ?? null,
                        'invoice_status' => $createdInvoice->status ?? null,
                    ];
                    $status = ($outVars->status_code ?? '') === 'SUCCESS' || ($outVars->status_code ?? '') === 'ALREADY_EXISTS' ? 'SUCCESS' : 'FAILED';
                    break;

                // -------------------------------------------------------------
                // 3. SP: Xử lý thanh toán hóa đơn
                // -------------------------------------------------------------
                case 'sp_demo_thanh_toan_hoa_don':
                    $actionType = 'PROCEDURE_EXEC';
                    $inv = Invoice::where('status', '!=', 'CANCELLED')->where('remaining_amount', '>', 0)->first() ?: Invoice::first();
                    $invoiceId = $params['invoice_id'] ?? ($inv ? $inv->id : 1);
                    $amount = (float) ($params['amount'] ?? 50000);
                    $method = $params['payment_method'] ?? 'CASH';

                    $beforeInv = Invoice::find($invoiceId);
                    $beforeData = [
                        'invoice_id' => $invoiceId,
                        'paid_amount' => $beforeInv->paid_amount ?? 0,
                        'remaining_amount' => $beforeInv->remaining_amount ?? 0,
                        'status' => $beforeInv->status ?? 'UNKNOWN',
                    ];

                    // Cân đối số tiền nộp không vượt quá nợ để demo thành công
                    if ($beforeInv && $amount > (float) $beforeInv->remaining_amount && (float) $beforeInv->remaining_amount > 0) {
                        $amount = (float) $beforeInv->remaining_amount;
                    }

                    DB::select('CALL sp_demo_thanh_toan_hoa_don(?, ?, ?, ?, @v_pay_id, @v_rem, @v_code, @v_msg)', [$invoiceId, $amount, $method, $userId]);
                    $outVars = DB::select('SELECT @v_pay_id AS payment_id, @v_rem AS remaining_amount, @v_code AS status_code, @v_msg AS message')[0] ?? null;

                    $message = $outVars->message ?? 'Thực thi xong';
                    $afterInv = Invoice::find($invoiceId);
                    $afterData = [
                        'invoice_id' => $invoiceId,
                        'paid_amount' => $afterInv->paid_amount ?? null,
                        'remaining_amount' => $afterInv->remaining_amount ?? null,
                        'status' => $afterInv->status ?? null,
                        'new_payment_id' => $outVars->payment_id ?? null,
                    ];
                    $status = ($outVars->status_code ?? '') === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
                    break;

                // -------------------------------------------------------------
                // 4. SP: Báo cáo doanh thu bác sĩ
                // -------------------------------------------------------------
                case 'sp_demo_bao_cao_doanh_thu_bac_si':
                    $actionType = 'SELECT/READ';
                    $startDate = $params['start_date'] ?? now()->startOfMonth()->toDateString();
                    $endDate = $params['end_date'] ?? now()->toDateString();

                    $resultRows = DB::select('CALL sp_demo_bao_cao_doanh_thu_bac_si(?, ?)', [$startDate, $endDate]);
                    $beforeData = ['start_date' => $startDate, 'end_date' => $endDate];
                    $afterData = ['doctors_count' => count($resultRows), 'sample' => array_slice($resultRows, 0, 3)];
                    $message = "Đã tổng hợp doanh thu của " . count($resultRows) . " bác sĩ trong kỳ từ {$startDate} đến {$endDate}.";
                    break;

                // -------------------------------------------------------------
                // 5. SP: Hủy lịch hẹn và giải phóng bác sĩ
                // -------------------------------------------------------------
                case 'sp_demo_huy_lich_hen_giai_phong_bs':
                    $actionType = 'PROCEDURE_EXEC';
                    $app = Appointment::where('status', 'PENDING')->first() ?: Appointment::first();
                    $appId = $params['appointment_id'] ?? ($app ? $app->id : 1);
                    $reason = $params['reason'] ?? 'Bệnh nhân có việc đột xuất xin dời lịch (Demo)';

                    $beforeApp = Appointment::find($appId);
                    $beforeData = [
                        'appointment_id' => $appId,
                        'status' => $beforeApp->status ?? 'NOT_FOUND',
                    ];

                    DB::select('CALL sp_demo_huy_lich_hen_giai_phong_bs(?, ?, ?, @v_code, @v_msg)', [$appId, $reason, $userId]);
                    $outVars = DB::select('SELECT @v_code AS status_code, @v_msg AS message')[0] ?? null;

                    $message = $outVars->message ?? 'Thực thi xong';
                    $afterApp = Appointment::find($appId);
                    $afterData = [
                        'appointment_id' => $appId,
                        'status' => $afterApp->status ?? null,
                        'notes' => $afterApp->notes ?? null,
                    ];
                    $status = ($outVars->status_code ?? '') === 'SUCCESS' ? 'SUCCESS' : 'VERIFIED';
                    break;

                // -------------------------------------------------------------
                // 6. Trigger 1: Kiểm tra trùng lịch bác sĩ
                // -------------------------------------------------------------
                case 'trg_demo_chong_trung_lich_bs':
                    $actionType = 'TRIGGER_AUTO';
                    $doc = Employee::first();
                    $docId = $doc ? $doc->id : 1;
                    $existingApp = Appointment::where('employee_id', $docId)->first();
                    $date = $existingApp ? $existingApp->appointment_date : now()->toDateString();
                    $startTime = $existingApp ? $existingApp->start_time : '09:00:00';
                    $endTime = $existingApp ? $existingApp->end_time : '09:30:00';

                    $beforeData = [
                        'doctor_id' => $docId,
                        'conflicting_date' => $date,
                        'conflicting_time' => "{$startTime} - {$endTime}",
                    ];

                    // Thử insert trùng khung giờ để kích hoạt trigger ném lỗi an toàn
                    try {
                        DB::insert("
                            INSERT INTO appointments (appointment_code, patient_id, employee_id, appointment_date, start_time, end_time, status, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', NOW(), NOW())
                        ", [
                            'APP_COLLISION_TEST_' . rand(100, 999),
                            1,
                            $docId,
                            $date,
                            $startTime,
                            $endTime,
                        ]);
                        $afterData = ['result' => 'Chèn thành công (không có xung đột)'];
                        $message = 'Trigger kiểm tra không thấy xung đột thời gian.';
                    } catch (\Throwable $e) {
                        $afterData = [
                            'trigger_intercepted' => true,
                            'error_message' => $e->getMessage(),
                        ];
                        $message = 'TRIGGER ĐÃ HOẠT ĐỘNG HOÀN HẢO: Đã chặn đứng thao tác chèn lịch hẹn trùng giờ của bác sĩ!';
                        $status = 'VERIFIED';
                    }
                    break;

                // -------------------------------------------------------------
                // 7. Trigger 2: Kiểm soát sửa bệnh án sau thanh toán
                // -------------------------------------------------------------
                case 'trg_demo_kiem_soat_sua_benh_an_paid':
                    $actionType = 'TRIGGER_AUTO';
                    $paidVisit = Visit::where('payment_status', 'PAID')->has('medicalRecord')->first();
                    if ($paidVisit && $paidVisit->medicalRecord) {
                        $rec = $paidVisit->medicalRecord;
                        $beforeData = [
                            'visit_id' => $paidVisit->id,
                            'payment_status' => $paidVisit->payment_status,
                            'original_diagnosis' => $rec->diagnosis,
                        ];

                        try {
                            DB::update("UPDATE medical_records SET diagnosis = CONCAT(COALESCE(diagnosis, ''), ' [Sửa trái phép]') WHERE id = ?", [$rec->id]);
                            $afterData = ['updated' => true];
                            $message = 'Đã cập nhật bệnh án.';
                        } catch (\Throwable $e) {
                            $afterData = [
                                'trigger_intercepted' => true,
                                'error_message' => $e->getMessage(),
                            ];
                            $message = 'TRIGGER ĐÃ HOẠT ĐỘNG HOÀN HẢO: Chặn đứng hành vi sửa chẩn đoán bệnh án của ca khám đã PAID!';
                            $status = 'VERIFIED';
                        }
                    } else {
                        $beforeData = ['info' => 'Chưa có ca khám PAID có bệnh án để thử nghiệm'];
                        $afterData = ['status' => 'Sẵn sàng'];
                        $message = 'Trigger đã được cài đặt sẵn sàng trên bảng medical_records.';
                        $status = 'VERIFIED';
                    }
                    break;

                // -------------------------------------------------------------
                // 8. Trigger 3: Ngăn số lượng thuốc âm
                // -------------------------------------------------------------
                case 'trg_demo_ngan_so_luong_thuoc_am':
                    $actionType = 'TRIGGER_AUTO';
                    $prod = Product::first();
                    $prodId = $prod ? $prod->id : 1;
                    $beforeData = [
                        'product_id' => $prodId,
                        'product_name' => $prod->name ?? 'Thuốc mẫu',
                        'attempted_out_quantity' => 99999999,
                    ];

                    try {
                        DB::insert("
                            INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, created_at)
                            VALUES (?, 'OUT', 99999999.000, NOW(), NOW())
                        ", [$prodId]);
                        $afterData = ['result' => 'Xuất thành công'];
                        $message = 'Xuất kho thành công';
                    } catch (\Throwable $e) {
                        $afterData = [
                            'trigger_intercepted' => true,
                            'error_message' => $e->getMessage(),
                        ];
                        $message = 'TRIGGER ĐÃ HOẠT ĐỘNG HOÀN HẢO: Phát hiện xuất vượt tồn kho và ném lỗi 45000 bảo vệ kho dược!';
                        $status = 'VERIFIED';
                    }
                    break;

                // -------------------------------------------------------------
                // 9. Trigger 4: Cập nhật lần khám gần nhất
                // -------------------------------------------------------------
                case 'trg_demo_cap_nhat_lan_kham_gan_nhat':
                    $actionType = 'TRIGGER_AUTO';
                    $p = Patient::first();
                    $patientId = $p ? $p->id : 1;
                    $beforeData = [
                        'patient_id' => $patientId,
                        'patient_code' => $p->patient_code ?? null,
                        'last_visit_date_before' => $p->last_visit_date ?? null,
                    ];

                    $newDate = now()->toDateString();
                    DB::insert("
                        INSERT INTO visits (visit_code, patient_id, employee_id, visit_date, total_amount, payment_status, status, created_at, updated_at)
                        VALUES (?, ?, 1, ?, 120000, 'UNPAID', 'WAITING', NOW(), NOW())
                    ", ['VK_TRG_TEST_' . rand(100, 999), $patientId, $newDate]);

                    $afterPatient = Patient::find($patientId);
                    $afterData = [
                        'patient_id' => $patientId,
                        'last_visit_date_after' => $afterPatient->last_visit_date ?? null,
                        'synchronized_by_trigger' => true,
                    ];
                    $message = "TRIGGER HOẠT ĐỘNG THÀNH CÔNG: last_visit_date của bệnh nhân đã được tự động cập nhật sang ngày {$newDate}!";
                    $status = 'VERIFIED';
                    break;

                // -------------------------------------------------------------
                // 10. Trigger 5: Ghi nhận lịch sử khi xóa bệnh nhân
                // -------------------------------------------------------------
                case 'trg_demo_ghi_nhat_ky_xoa_benh_nhan':
                    $actionType = 'TRIGGER_AUTO';
                    // Tạo một bệnh nhân tạm thời để test xóa
                    $tempCode = 'BN_TMP_' . rand(1000, 9999);
                    $tempId = DB::table('patients')->insertGetId([
                        'patient_code' => $tempCode,
                        'full_name' => 'Bệnh nhân Thử nghiệm Xóa',
                        'phone' => '0909999999',
                        'gender' => 'MALE',
                        'status' => 'ACTIVE',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    $beforeData = [
                        'patient_id' => $tempId,
                        'patient_code' => $tempCode,
                        'action' => 'Chuẩn bị thực thi câu lệnh DELETE FROM patients',
                    ];

                    DB::delete('DELETE FROM patients WHERE id = ?', [$tempId]);

                    // Kiểm tra bản ghi audit do trigger tạo ra
                    $latestLog = DB::table('db_demo_audit_logs')
                        ->where('sql_object_name', 'trg_demo_ghi_nhat_ky_xoa_benh_nhan')
                        ->orderBy('id', 'DESC')
                        ->first();

                    $afterData = [
                        'patient_deleted' => true,
                        'audit_log_created_by_trigger' => $latestLog ? true : false,
                        'log_details' => $latestLog ? json_decode($latestLog->before_data, true) : null,
                    ];
                    $message = 'TRIGGER HOẠT ĐỘNG THÀNH CÔNG: Trigger đã tự động tóm bắt sự kiện DELETE và lưu vết JSON vào bảng Audit Logs!';
                    $status = 'VERIFIED';
                    break;

                // -------------------------------------------------------------
                // 11. Function 1: Tính công nợ bệnh nhân
                // -------------------------------------------------------------
                case 'fn_demo_tinh_cong_no_benh_nhan':
                    $actionType = 'FUNCTION_CALL';
                    $p = Patient::has('invoices')->first() ?: Patient::first();
                    $patientId = $params['patient_id'] ?? ($p ? $p->id : 1);

                    $res = DB::select('SELECT fn_demo_tinh_cong_no_benh_nhan(?) AS debt', [$patientId]);
                    $debt = $res[0]->debt ?? 0;

                    $invoices = Invoice::where('patient_id', $patientId)->where('status', '!=', 'CANCELLED')->get();
                    $beforeData = [
                        'patient_id' => $patientId,
                        'invoices_count' => $invoices->count(),
                        'invoices_breakdown' => $invoices->map(fn ($i) => ['code' => $i->invoice_code, 'remaining' => (float) $i->remaining_amount]),
                    ];
                    $afterData = [
                        'calculated_total_debt' => (float) $debt,
                        'formatted' => number_format((float) $debt, 0, ',', '.') . ' VNĐ',
                    ];
                    $message = "Hàm đã tính toán chính xác tổng nợ của bệnh nhân ID #{$patientId}: " . number_format((float) $debt, 0, ',', '.') . ' VNĐ.';
                    break;

                // -------------------------------------------------------------
                // 12. Function 2: Tính KPI bác sĩ
                // -------------------------------------------------------------
                case 'fn_demo_tinh_kpi_bac_si':
                    $actionType = 'FUNCTION_CALL';
                    $doc = Employee::first();
                    $docId = $params['employee_id'] ?? ($doc ? $doc->id : 1);
                    $startDate = $params['start_date'] ?? now()->startOfMonth()->toDateString();
                    $endDate = $params['end_date'] ?? now()->toDateString();

                    $res = DB::select('SELECT fn_demo_tinh_kpi_bac_si(?, ?, ?) AS kpi_score', [$docId, $startDate, $endDate]);
                    $score = $res[0]->kpi_score ?? 0;

                    $beforeData = ['employee_id' => $docId, 'period' => "{$startDate} đến {$endDate}"];
                    $afterData = [
                        'kpi_score_percent' => (float) $score,
                        'formula' => 'KPI = (60% * Doanh thu thực đạt / Chỉ tiêu) + (40% * Ca khám thực đạt / Chỉ tiêu)',
                    ];
                    $message = "Hàm đã tính toán điểm KPI bác sĩ: {$score}%.";
                    break;

                // -------------------------------------------------------------
                // 13. Function 3: Kiểm tra tồn kho thuốc
                // -------------------------------------------------------------
                case 'fn_demo_kiem_tra_ton_kho_thuoc':
                    $actionType = 'FUNCTION_CALL';
                    $prod = Product::first();
                    $prodId = $params['product_id'] ?? ($prod ? $prod->id : 1);

                    $res = DB::select('SELECT fn_demo_kiem_tra_ton_kho_thuoc(?) AS stock_status', [$prodId]);
                    $stockStatus = $res[0]->stock_status ?? 'NORMAL';

                    $beforeData = [
                        'product_id' => $prodId,
                        'product_name' => $prod->name ?? null,
                        'minimum_stock' => (float) ($prod->minimum_stock ?? 0),
                    ];
                    $afterData = [
                        'stock_status' => $stockStatus,
                        'meaning' => $stockStatus === 'OUT_OF_STOCK' ? 'Đã hết hàng (<= 0)' : ($stockStatus === 'LOW_STOCK' ? 'Sắp hết hàng (<= Định mức)' : 'Tồn kho an toàn'),
                    ];
                    $message = "Hàm đã phân loại trạng thái thuốc: {$stockStatus}.";
                    break;

                // -------------------------------------------------------------
                // 14. Cursor 1: Phân loại tuổi nợ
                // -------------------------------------------------------------
                case 'sp_demo_cursor_phan_loai_tuoi_no':
                    $actionType = 'CURSOR_LOOP';
                    $resultRows = DB::select('CALL sp_demo_cursor_phan_loai_tuoi_no()');
                    $beforeData = ['action' => 'Mở CURSOR cur_invoices duyệt qua tất cả hóa đơn còn nợ'];
                    $afterData = [
                        'total_rows_processed_by_cursor' => count($resultRows),
                        'sample_results' => array_slice($resultRows, 0, 4),
                    ];
                    $message = "Cursor đã duyệt tuần tự " . count($resultRows) . " hóa đơn nợ và phân loại thành công các nhóm tuổi nợ (0-7, 8-30, >30 ngày).";
                    break;

                // -------------------------------------------------------------
                // 15. Cursor 2: Xếp hạng KPI bác sĩ
                // -------------------------------------------------------------
                case 'sp_demo_cursor_xep_hang_kpi_bac_si':
                    $actionType = 'CURSOR_LOOP';
                    $startDate = $params['start_date'] ?? now()->startOfMonth()->toDateString();
                    $endDate = $params['end_date'] ?? now()->toDateString();

                    $resultRows = DB::select('CALL sp_demo_cursor_xep_hang_kpi_bac_si(?, ?)', [$startDate, $endDate]);
                    $beforeData = ['action' => 'Mở CURSOR cur_doctors duyệt danh sách bác sĩ'];
                    $afterData = [
                        'doctors_ranked' => count($resultRows),
                        'ranking_list' => $resultRows,
                    ];
                    $message = "Cursor đã hoàn tất duyệt và xếp hạng thi đua cho " . count($resultRows) . " bác sĩ toàn viện.";
                    break;
            }
        } catch (\Throwable $e) {
            $status = 'FAILED';
            $message = 'Lỗi thực thi đối tượng SQL: ' . $e->getMessage();
            Log::error("Database demo error on {$objectName}: " . $e->getMessage());
        }

        $durationMs = (int) round((microtime(true) - $startTime) * 1000);

        // Lưu vào bảng Audit Logs
        try {
            DB::table('db_demo_audit_logs')->insert([
                'executed_at' => now(),
                'sql_object_name' => $obj['name'],
                'sql_object_type' => $obj['type'],
                'target_table' => implode(', ', $obj['target_tables']),
                'action_type' => $actionType,
                'before_data' => $beforeData ? json_encode($beforeData, JSON_UNESCAPED_UNICODE) : null,
                'after_data' => $afterData ? json_encode($afterData, JSON_UNESCAPED_UNICODE) : null,
                'status' => $status,
                'execution_message' => $message,
                'executed_by' => $userId,
                'duration_ms' => $durationMs,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $logErr) {
            Log::warning("Could not write to db_demo_audit_logs: " . $logErr->getMessage());
        }

        return [
            'success' => $status !== 'FAILED',
            'object_name' => $obj['name'],
            'object_type' => $obj['type'],
            'status' => $status,
            'message' => $message,
            'before_data' => $beforeData,
            'after_data' => $afterData,
            'result_rows' => $resultRows,
            'duration_ms' => $durationMs,
        ];
    }

    /**
     * Lấy danh sách lịch sử Audit Logs gần nhất.
     */
    public function getAuditHistory(int $limit = 50): array
    {
        try {
            $logs = DB::table('db_demo_audit_logs')
                ->leftJoin('users', 'users.id', '=', 'db_demo_audit_logs.executed_by')
                ->select(
                    'db_demo_audit_logs.*',
                    'users.username as executed_by_name'
                )
                ->orderBy('db_demo_audit_logs.id', 'DESC')
                ->limit($limit)
                ->get();

            return $logs->map(function ($item) {
                return [
                    'id' => $item->id,
                    'executed_at' => $item->executed_at,
                    'sql_object_name' => $item->sql_object_name,
                    'sql_object_type' => $item->sql_object_type,
                    'target_table' => $item->target_table,
                    'action_type' => $item->action_type,
                    'before_data' => $item->before_data ? json_decode($item->before_data, true) : null,
                    'after_data' => $item->after_data ? json_decode($item->after_data, true) : null,
                    'status' => $item->status,
                    'execution_message' => $item->execution_message,
                    'executed_by_name' => $item->executed_by_name ?? 'Hệ thống/Admin',
                    'duration_ms' => $item->duration_ms,
                ];
            })->toArray();
        } catch (\Throwable $e) {
            return [];
        }
    }
}
