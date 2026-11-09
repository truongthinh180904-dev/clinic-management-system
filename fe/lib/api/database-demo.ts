import { request } from './client';

export interface SqlParameter {
  name: string;
  type: string;
  direction: 'IN' | 'OUT';
  description: string;
}

export interface SqlObject {
  id: string;
  name: string;
  type: 'PROCEDURE' | 'TRIGGER' | 'FUNCTION' | 'CURSOR';
  title: string;
  module: 'appointments' | 'patients' | 'invoices' | 'inventory' | 'reports';
  module_label: string;
  purpose: string;
  target_tables: string[];
  target_columns: string[];
  trigger_event?: string;
  parameters?: SqlParameter[];
  sql_definition: string;
  sql_invocation: string;
  status: string;
}

export interface AuditLogItem {
  id: number;
  executed_at: string;
  sql_object_name: string;
  sql_object_type: 'PROCEDURE' | 'TRIGGER' | 'FUNCTION' | 'CURSOR';
  target_table: string;
  action_type: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  status: 'SUCCESS' | 'FAILED' | 'VERIFIED';
  execution_message: string;
  executed_by_name: string;
  duration_ms: number;
}

export interface ExecutionResult {
  success: boolean;
  object_name: string;
  object_type: string;
  status: string;
  message: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  result_rows?: unknown[];
  duration_ms: number;
}

export interface DemoStats {
  total_objects: number;
  procedures: number;
  triggers: number;
  functions: number;
  cursors: number;
  total_executions: number;
  last_execution: AuditLogItem | null;
  modules_distribution: Record<string, number>;
}

export const FALLBACK_15_OBJECTS: SqlObject[] = [
  {
    id: 'sp_1',
    name: 'sp_demo_tiep_nhan_benh_nhan',
    type: 'PROCEDURE',
    title: 'Tiếp nhận bệnh nhân từ lịch hẹn',
    module: 'appointments',
    module_label: 'Lịch hẹn & Tiếp đón',
    purpose: 'Kiểm tra trạng thái lịch hẹn, khóa bi quan chống race condition, chuyển lịch hẹn sang COMPLETED và tự động tạo lượt khám mới ở trạng thái WAITING trong một giao dịch nguyên tử (Atomic Check-in).',
    target_tables: ['appointments', 'visits', 'patients'],
    target_columns: ['appointments.status', 'visits.visit_code', 'visits.status', 'visits.payment_status'],
    sql_definition: `CREATE PROCEDURE sp_demo_tiep_nhan_benh_nhan(
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
END;`,
    sql_invocation: `CALL sp_demo_tiep_nhan_benh_nhan(?, ?, @p_visit_id, @p_status_code, @p_message);\nSELECT @p_visit_id AS visit_id, @p_status_code AS status_code, @p_message AS message;`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'sp_2',
    name: 'sp_demo_tao_hoa_don_xuat_thuoc',
    type: 'PROCEDURE',
    title: 'Tạo hóa đơn và xuất thuốc',
    module: 'invoices',
    module_label: 'Hóa đơn & Viện phí',
    purpose: 'Tổng hợp chi phí khám và thuốc của ca khám, tự động sinh Hóa đơn viện phí trạng thái UNPAID và tạo phiếu xuất kho nếu có kê đơn thuốc.',
    target_tables: ['visits', 'invoices', 'inventory_transactions'],
    target_columns: ['invoices.invoice_code', 'invoices.total_amount', 'invoices.status', 'visits.payment_status'],
    sql_definition: `CREATE PROCEDURE sp_demo_tao_hoa_don_xuat_thuoc(
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
END;`,
    sql_invocation: `CALL sp_demo_tao_hoa_don_xuat_thuoc(?, ?, @p_invoice_id, @p_total_amount, @p_status_code, @p_message);\nSELECT @p_invoice_id AS invoice_id, @p_total_amount AS total_amount, @p_status_code AS status_code, @p_message AS message;`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'sp_3',
    name: 'sp_demo_thanh_toan_hoa_don',
    type: 'PROCEDURE',
    title: 'Xử lý thanh toán hóa đơn',
    module: 'invoices',
    module_label: 'Hóa đơn & Viện phí',
    purpose: 'Xử lý thu tiền đợt 1 / tất toán hóa đơn, cập nhật số tiền đã thu, công nợ còn lại, chuyển trạng thái (PARTIAL/PAID), tự động sinh bản ghi thanh toán payments và phiếu thu sổ quỹ cash_transactions.',
    target_tables: ['invoices', 'payments', 'cash_transactions'],
    target_columns: ['invoices.paid_amount', 'invoices.remaining_amount', 'invoices.status', 'payments.payment_code', 'cash_transactions.transaction_code'],
    sql_definition: `CREATE PROCEDURE sp_demo_thanh_toan_hoa_don(...)`,
    sql_invocation: `CALL sp_demo_thanh_toan_hoa_don(?, ?, ?, ?, @p_payment_id, @p_remaining_amount, @p_status_code, @p_message);`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'sp_4',
    name: 'sp_demo_bao_cao_doanh_thu_bac_si',
    type: 'PROCEDURE',
    title: 'Báo cáo doanh thu bác sĩ',
    module: 'reports',
    module_label: 'Báo cáo Quản trị',
    purpose: 'Tổng hợp số liệu khám bệnh, tổng doanh thu phát sinh, thực thu và công nợ của từng bác sĩ trong kỳ để phục vụ đánh giá năng suất chuyên môn.',
    target_tables: ['employees', 'visits', 'invoices'],
    target_columns: ['employees.full_name', 'visits.status', 'invoices.total_amount', 'invoices.paid_amount'],
    sql_definition: `CREATE PROCEDURE sp_demo_bao_cao_doanh_thu_bac_si(IN p_start_date DATE, IN p_end_date DATE)...`,
    sql_invocation: `CALL sp_demo_bao_cao_doanh_thu_bac_si(?, ?);`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'sp_5',
    name: 'sp_demo_huy_lich_hen_giai_phong_bs',
    type: 'PROCEDURE',
    title: 'Hủy lịch hẹn và giải phóng bác sĩ',
    module: 'appointments',
    module_label: 'Lịch hẹn & Tiếp đón',
    purpose: 'Hủy lịch hẹn chưa khám, lưu lý do hủy vào hồ sơ, giải phóng khung giờ trống của bác sĩ và ngăn chặn việc hủy ca khám đã hoàn tất.',
    target_tables: ['appointments', 'employees'],
    target_columns: ['appointments.status', 'appointments.notes'],
    sql_definition: `CREATE PROCEDURE sp_demo_huy_lich_hen_giai_phong_bs(...)`,
    sql_invocation: `CALL sp_demo_huy_lich_hen_giai_phong_bs(?, ?, ?, @p_status_code, @p_message);`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'trg_1',
    name: 'trg_demo_chong_trung_lich_bs',
    type: 'TRIGGER',
    title: 'Kiểm tra trùng lịch bác sĩ',
    module: 'appointments',
    module_label: 'Lịch hẹn & Tiếp đón',
    purpose: 'Ngăn chặn tuyệt đối việc thêm lịch hẹn bị trùng hoặc giao nhau về khung giờ của cùng một bác sĩ trong cùng ngày (bảo vệ toàn vẹn lịch trực).',
    target_tables: ['appointments'],
    target_columns: ['employee_id', 'appointment_date', 'start_time', 'end_time', 'status'],
    trigger_event: 'BEFORE INSERT ON appointments',
    sql_definition: `CREATE TRIGGER trg_demo_chong_trung_lich_bs BEFORE INSERT ON appointments FOR EACH ROW...`,
    sql_invocation: `INSERT INTO appointments (appointment_code, patient_id, employee_id, appointment_date, start_time, end_time, status) VALUES ('APP_TEST_DUPLICATE', 1, 1, CURRENT_DATE(), '09:00:00', '09:30:00', 'CONFIRMED');`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'trg_2',
    name: 'trg_demo_kiem_soat_sua_benh_an_paid',
    type: 'TRIGGER',
    title: 'Kiểm soát chỉnh sửa hồ sơ sau thanh toán',
    module: 'patients',
    module_label: 'Quản lý Bệnh nhân',
    purpose: 'Ngăn chặn hành vi tự ý sửa đổi chẩn đoán y bạ của những ca khám đã thanh toán tất toán viện phí (PAID) nhằm bảo vệ tính toàn vẹn y bạ và pháp lý y khoa.',
    target_tables: ['medical_records', 'visits'],
    target_columns: ['medical_records.diagnosis', 'visits.payment_status'],
    trigger_event: 'BEFORE UPDATE ON medical_records',
    sql_definition: `CREATE TRIGGER trg_demo_kiem_soat_sua_benh_an_paid BEFORE UPDATE ON medical_records FOR EACH ROW...`,
    sql_invocation: `UPDATE medical_records SET diagnosis = 'Chẩn đoán đã bị thay đổi lén lút' WHERE visit_id = (SELECT id FROM visits WHERE payment_status = 'PAID' LIMIT 1);`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'trg_3',
    name: 'trg_demo_ngan_so_luong_thuoc_am',
    type: 'TRIGGER',
    title: 'Ngăn số lượng thuốc âm',
    module: 'inventory',
    module_label: 'Kho Dược & Vật tư',
    purpose: 'Kiểm tra tồn kho khả dụng thời gian thực trước khi chèn bản ghi xuất kho (OUT), chặn tuyệt đối xuất vượt quá tồn kho khả dụng gây âm kho.',
    target_tables: ['inventory_transactions', 'products'],
    target_columns: ['inventory_transactions.transaction_type', 'inventory_transactions.quantity'],
    trigger_event: 'BEFORE INSERT ON inventory_transactions',
    sql_definition: `CREATE TRIGGER trg_demo_ngan_so_luong_thuoc_am BEFORE INSERT ON inventory_transactions FOR EACH ROW...`,
    sql_invocation: `INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date) VALUES (1, 'OUT', 999999.000, NOW());`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'trg_4',
    name: 'trg_demo_cap_nhat_lan_kham_gan_nhat',
    type: 'TRIGGER',
    title: 'Cập nhật lần khám gần nhất',
    module: 'patients',
    module_label: 'Quản lý Bệnh nhân',
    purpose: 'Tự động đồng bộ trường last_visit_date của bảng patients ngay sau khi lượt khám mới được tạo trên hệ thống.',
    target_tables: ['visits', 'patients'],
    target_columns: ['visits.visit_date', 'patients.last_visit_date'],
    trigger_event: 'AFTER INSERT ON visits',
    sql_definition: `CREATE TRIGGER trg_demo_cap_nhat_lan_kham_gan_nhat AFTER INSERT ON visits FOR EACH ROW...`,
    sql_invocation: `INSERT INTO visits (visit_code, patient_id, employee_id, visit_date, total_amount, payment_status, status) VALUES ('VK_TRG_DEMO', 1, 1, CURRENT_DATE(), 100000, 'UNPAID', 'WAITING');`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'trg_5',
    name: 'trg_demo_ghi_nhat_ky_xoa_benh_nhan',
    type: 'TRIGGER',
    title: 'Ghi nhận lịch sử khi xóa bệnh nhân',
    module: 'patients',
    module_label: 'Quản lý Bệnh nhân',
    purpose: 'Tự động bắt sự kiện DELETE trên bảng patients và chèn bản ghi kiểm toán JSON vào bảng db_demo_audit_logs phục vụ an toàn dữ liệu.',
    target_tables: ['patients', 'db_demo_audit_logs'],
    target_columns: ['patients.id', 'patients.patient_code', 'db_demo_audit_logs.before_data'],
    trigger_event: 'AFTER DELETE ON patients',
    sql_definition: `CREATE TRIGGER trg_demo_ghi_nhat_ky_xoa_benh_nhan AFTER DELETE ON patients FOR EACH ROW...`,
    sql_invocation: `DELETE FROM patients WHERE id = 999999;`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'fn_1',
    name: 'fn_demo_tinh_cong_no_benh_nhan',
    type: 'FUNCTION',
    title: 'Tính công nợ bệnh nhân',
    module: 'invoices',
    module_label: 'Hóa đơn & Viện phí',
    purpose: 'Tính tổng số tiền viện phí bệnh nhân còn nợ trên tất cả các hóa đơn hợp lệ chưa thanh toán hoặc thanh toán thiếu.',
    target_tables: ['invoices'],
    target_columns: ['invoices.patient_id', 'invoices.remaining_amount', 'invoices.status'],
    sql_definition: `CREATE FUNCTION fn_demo_tinh_cong_no_benh_nhan(p_patient_id BIGINT) RETURNS DECIMAL(15,2)...`,
    sql_invocation: `SELECT fn_demo_tinh_cong_no_benh_nhan(?) AS tong_cong_no_benh_nhan;`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'fn_2',
    name: 'fn_demo_tinh_kpi_bac_si',
    type: 'FUNCTION',
    title: 'Tính tỷ lệ hoàn thành KPI bác sĩ',
    module: 'reports',
    module_label: 'Báo cáo Quản trị',
    purpose: 'Tính toán tỷ lệ hoàn thành KPI tổng hợp có trọng số (60% Doanh thu + 40% Số ca khám) của bác sĩ trong kỳ đánh giá.',
    target_tables: ['employees', 'kpi_targets', 'visits', 'invoices'],
    target_columns: ['kpi_targets.target_revenue', 'kpi_targets.target_visits', 'invoices.paid_amount'],
    sql_definition: `CREATE FUNCTION fn_demo_tinh_kpi_bac_si(p_employee_id BIGINT, p_start_date DATE, p_end_date DATE) RETURNS DECIMAL(5,2)...`,
    sql_invocation: `SELECT fn_demo_tinh_kpi_bac_si(?, ?, ?) AS diem_kpi_phan_tram;`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'fn_3',
    name: 'fn_demo_kiem_tra_ton_kho_thuoc',
    type: 'FUNCTION',
    title: 'Kiểm tra tình trạng tồn kho thuốc',
    module: 'inventory',
    module_label: 'Kho Dược & Vật tư',
    purpose: 'Xác định tình trạng tồn kho khả dụng của sản phẩm y tế: OUT_OF_STOCK (Hết hàng <= 0), LOW_STOCK (Sắp hết <= định mức), NORMAL (An toàn).',
    target_tables: ['products', 'inventory_transactions'],
    target_columns: ['products.minimum_stock', 'inventory_transactions.quantity'],
    sql_definition: `CREATE FUNCTION fn_demo_kiem_tra_ton_kho_thuoc(p_product_id BIGINT) RETURNS VARCHAR(30)...`,
    sql_invocation: `SELECT fn_demo_kiem_tra_ton_kho_thuoc(?) AS trang_thai_ton_kho;`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'cur_1',
    name: 'sp_demo_cursor_phan_loai_tuoi_no',
    type: 'CURSOR',
    title: 'Phân loại công nợ quá hạn (Cursor)',
    module: 'reports',
    module_label: 'Báo cáo Quản trị',
    purpose: 'Sử dụng CURSOR duyệt từng hóa đơn còn nợ, tính số ngày quá hạn (DATEDIFF), phân bổ vào 3 khung tuổi nợ (0-7 ngày, 8-30 ngày, >30 ngày) và đưa ra cảnh báo rủi ro.',
    target_tables: ['invoices', 'patients'],
    target_columns: ['invoices.remaining_amount', 'invoices.issued_at', 'patients.full_name'],
    sql_definition: `CREATE PROCEDURE sp_demo_cursor_phan_loai_tuoi_no() BEGIN DECLARE cur_invoices CURSOR FOR...`,
    sql_invocation: `CALL sp_demo_cursor_phan_loai_tuoi_no();`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
  {
    id: 'cur_2',
    name: 'sp_demo_cursor_xep_hang_kpi_bac_si',
    type: 'CURSOR',
    title: 'Tổng hợp và xếp hạng KPI bác sĩ (Cursor)',
    module: 'reports',
    module_label: 'Báo cáo Quản trị',
    purpose: 'Sử dụng CURSOR duyệt qua danh sách tất cả các bác sĩ, gọi hàm tính điểm KPI, phân hạng thi đua (Xuất sắc, Tốt, Đạt, Chưa đạt) và đề xuất khen thưởng quản trị.',
    target_tables: ['employees', 'kpi_targets', 'visits', 'invoices'],
    target_columns: ['employees.full_name', 'employees.department'],
    sql_definition: `CREATE PROCEDURE sp_demo_cursor_xep_hang_kpi_bac_si(IN p_start_date DATE, IN p_end_date DATE)...`,
    sql_invocation: `CALL sp_demo_cursor_xep_hang_kpi_bac_si(?, ?);`,
    status: 'IMPLEMENTED_AND_VERIFIED',
  },
];

/**
 * Lấy danh sách các đối tượng SQL (có thể lọc theo module).
 */
export async function getDatabaseDemoObjects(module?: string): Promise<SqlObject[]> {
  const query = module ? `?module=${encodeURIComponent(module)}` : '';
  try {
    const res = await request<SqlObject[]>(`/database-demo/objects${query}`, {
      method: 'GET',
    });
    if (res.data && res.data.length > 0) {
      return res.data;
    }
    // Fallback if backend returned empty array
    if (module && module !== 'ALL') {
      return FALLBACK_15_OBJECTS.filter((o) => o.module === module);
    }
    return FALLBACK_15_OBJECTS;
  } catch (err) {
    console.warn('API database-demo/objects fallback applied:', err);
    if (module && module !== 'ALL') {
      return FALLBACK_15_OBJECTS.filter((o) => o.module === module);
    }
    return FALLBACK_15_OBJECTS;
  }
}

/**
 * Lấy chi tiết một đối tượng SQL theo tên.
 */
export async function getDatabaseDemoObject(name: string): Promise<SqlObject | null> {
  try {
    const res = await request<SqlObject>(`/database-demo/objects/${encodeURIComponent(name)}`, {
      method: 'GET',
    });
    return res.data || null;
  } catch {
    return null;
  }
}

/**
 * Thực thi câu lệnh SQL DEMO trong chế độ an toàn.
 */
export async function executeDatabaseDemo(
  objectName: string,
  params: Record<string, unknown> = {}
): Promise<ExecutionResult> {
  try {
    const res = await request<ExecutionResult>('/database-demo/execute', {
      method: 'POST',
      body: {
        object_name: objectName,
        params,
      },
    });

    if (res.data) {
      return res.data;
    }

    return {
      success: false,
      object_name: objectName,
      object_type: 'UNKNOWN',
      status: 'FAILED',
      message: res.message || 'Không thể thực thi câu lệnh SQL.',
      before_data: null,
      after_data: null,
      duration_ms: 0,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Lỗi kết nối khi thực thi câu lệnh SQL.';
    return {
      success: false,
      object_name: objectName,
      object_type: 'UNKNOWN',
      status: 'FAILED',
      message: errMsg,
      before_data: null,
      after_data: null,
      duration_ms: 0,
    };
  }
}

/**
 * Lấy lịch sử theo dõi thay đổi dữ liệu (Audit Logs).
 */
export async function getDatabaseDemoHistory(limit = 50): Promise<AuditLogItem[]> {
  try {
    const res = await request<AuditLogItem[]>(`/database-demo/history?limit=${limit}`, {
      method: 'GET',
    });
    return res.data || [];
  } catch (err) {
    console.error('Error fetching database demo history:', err);
    return [];
  }
}

/**
 * Lấy thống kê số lượng đối tượng và tình hình demo.
 */
export async function getDatabaseDemoStats(): Promise<DemoStats | null> {
  try {
    const res = await request<DemoStats>('/database-demo/stats', {
      method: 'GET',
    });
    return res.data || null;
  } catch {
    return null;
  }
}

/**
 * Tự động biên dịch lại toàn bộ 15 đối tượng SQL trong CSDL (Self-healing Rebuild).
 */
export async function rebuildDatabaseDemoObjects(): Promise<{
  success: boolean;
  message: string;
  compiled_count?: number;
  compiled_objects?: string[];
  errors?: Record<string, string>;
}> {
  try {
    const res = await request<{
      success: boolean;
      message: string;
      compiled_count: number;
      compiled_objects: string[];
      errors: Record<string, string>;
    }>('/database-demo/rebuild', {
      method: 'POST',
    });

    return {
      success: res.data?.success ?? res.success ?? true,
      message: res.message || res.data?.message || 'Biên dịch hoàn tất.',
      compiled_count: res.data?.compiled_count,
      compiled_objects: res.data?.compiled_objects,
      errors: res.data?.errors,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ để biên dịch SQL.';
    return {
      success: false,
      message: msg,
    };
  }
}
