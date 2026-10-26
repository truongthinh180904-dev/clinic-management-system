<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseSchemaTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Expected columns for all 30 tables from the Clinic Management ERD.
     *
     * @return array<string, list<string>>
     */
    public static function expectedTablesProvider(): array
    {
        return [
            // Nhóm 1 — Người dùng và bảo mật
            'roles' => ['id', 'name', 'description', 'created_at', 'updated_at'],
            'permissions' => ['id', 'module', 'action', 'permission_key', 'description', 'created_at', 'updated_at'],
            'role_permissions' => ['role_id', 'permission_id', 'created_at'],
            'user_roles' => ['user_id', 'role_id', 'created_at'],
            'users' => ['id', 'employee_id', 'username', 'email', 'password_hash', 'status', 'last_login_at', 'created_at', 'updated_at'],
            'audit_logs' => ['id', 'user_id', 'module', 'action', 'table_name', 'record_id', 'old_values', 'new_values', 'ip_address', 'user_agent', 'created_at'],

            // Nhóm 2 — Nhân sự
            'employees' => ['id', 'employee_code', 'full_name', 'phone', 'email', 'date_of_birth', 'gender', 'position', 'department', 'hire_date', 'status', 'notes', 'created_at', 'updated_at'],

            // Nhóm 3 — Bệnh nhân
            'patients' => ['id', 'patient_code', 'full_name', 'date_of_birth', 'gender', 'phone', 'email', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'first_visit_date', 'last_visit_date', 'status', 'notes', 'created_at', 'updated_at'],
            'patient_files' => ['id', 'patient_id', 'visit_id', 'file_name', 'storage_path', 'mime_type', 'file_size', 'uploaded_by', 'created_at'],
            'medical_records' => ['id', 'visit_id', 'doctor_id', 'medical_history', 'diagnosis', 'indication', 'result', 'treatment', 'follow_up_date', 'created_at', 'updated_at'],

            // Nhóm 4 — Lịch hẹn và lượt khám
            'appointments' => ['id', 'appointment_code', 'patient_id', 'employee_id', 'service_id', 'appointment_date', 'start_time', 'end_time', 'status', 'notes', 'created_by', 'created_at', 'updated_at'],
            'visits' => ['id', 'visit_code', 'patient_id', 'employee_id', 'service_id', 'patient_package_id', 'appointment_id', 'visit_date', 'quantity', 'unit_price', 'discount_amount', 'total_amount', 'payment_status', 'status', 'notes', 'created_by', 'created_at', 'updated_at'],

            // Nhóm 5 — Dịch vụ và gói dịch vụ
            'services' => ['id', 'service_code', 'name', 'description', 'price', 'duration_minutes', 'status', 'created_at', 'updated_at'],
            'service_packages' => ['id', 'package_code', 'name', 'description', 'price', 'total_sessions', 'validity_days', 'status', 'created_at', 'updated_at'],
            'package_services' => ['package_id', 'service_id', 'quantity', 'created_at'],
            'patient_packages' => ['id', 'patient_id', 'package_id', 'purchase_date', 'expiry_date', 'total_sessions', 'used_sessions', 'remaining_sessions', 'price', 'status', 'created_at', 'updated_at'],

            // Nhóm 6 — Tài chính
            'invoices' => ['id', 'invoice_code', 'patient_id', 'visit_id', 'patient_package_id', 'subtotal_amount', 'discount_amount', 'total_amount', 'paid_amount', 'remaining_amount', 'status', 'issued_at', 'created_by', 'created_at', 'updated_at'],
            'payments' => ['id', 'payment_code', 'invoice_id', 'amount', 'payment_method', 'reference_code', 'payment_date', 'received_by', 'notes', 'created_at', 'updated_at'],

            // Nhóm 7 — Thu chi và quỹ
            'expense_categories' => ['id', 'name', 'description', 'status', 'created_at', 'updated_at'],
            'expenses' => ['id', 'expense_code', 'category_id', 'amount', 'payment_method', 'expense_date', 'description', 'approval_status', 'created_by', 'approved_by', 'approved_at', 'created_at', 'updated_at'],
            'cash_transactions' => ['id', 'transaction_code', 'transaction_type', 'reference_type', 'reference_id', 'amount', 'payment_method', 'transaction_date', 'description', 'created_by', 'created_at'],

            // Nhóm 8 — Quản lý
            'kpi_targets' => ['id', 'employee_id', 'period_start', 'period_end', 'target_revenue', 'target_visits', 'created_by', 'created_at', 'updated_at'],
            'notifications' => ['id', 'user_id', 'type', 'title', 'message', 'reference_type', 'reference_id', 'is_read', 'created_at', 'read_at'],
            'approval_requests' => ['id', 'request_type', 'reference_type', 'reference_id', 'requested_by', 'approved_by', 'status', 'reason', 'rejection_reason', 'created_at', 'approved_at'],
            'alert_rules' => ['id', 'name', 'alert_type', 'threshold_value', 'threshold_days', 'threshold_sessions', 'status', 'created_at', 'updated_at'],

            // Nhóm 9 — Kho
            'products' => ['id', 'product_code', 'name', 'unit', 'minimum_stock', 'status', 'created_at', 'updated_at'],
            'inventory_transactions' => ['id', 'product_id', 'transaction_type', 'quantity', 'reference_type', 'reference_id', 'transaction_date', 'created_by', 'created_at'],

            // Nhóm 10 — Import/Export
            'import_batches' => ['id', 'module', 'file_name', 'total_rows', 'success_rows', 'error_rows', 'status', 'imported_by', 'created_at', 'completed_at'],
            'import_errors' => ['id', 'batch_id', 'row_number', 'column_name', 'error_message', 'raw_data', 'created_at'],

            // Nhóm 11 — Hệ thống
            'system_settings' => ['id', 'setting_key', 'setting_value', 'description', 'updated_by', 'created_at', 'updated_at'],
        ];
    }

    public function test_all_30_clinic_tables_and_columns_exist(): void
    {
        $expectedTables = self::expectedTablesProvider();
        $this->assertCount(30, $expectedTables);

        foreach ($expectedTables as $table => $columns) {
            $this->assertTrue(
                Schema::hasTable($table),
                "Expected table [{$table}] does not exist."
            );

            $actualColumns = Schema::getColumnListing($table);
            $this->assertEquals(
                $columns,
                $actualColumns,
                "Column mismatch on table [{$table}]."
            );
        }
    }

    public function test_user_model_uses_password_hash_column_and_relations_work(): void
    {
        $employeeId = DB::table('employees')->insertGetId([
            'employee_code' => 'EMP-001',
            'full_name' => 'Dr. Nguyen Van A',
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = User::factory()->create([
            'employee_id' => $employeeId,
            'username' => 'dr.nguyenvana',
            'password_hash' => 'secret123',
            'status' => 'ACTIVE',
        ]);

        $this->assertSame('password_hash', $user->getAuthPasswordName());
        $this->assertTrue(Hash::check('secret123', $user->getAuthPassword()));
        $this->assertSame($employeeId, $user->employee_id);
    }
}
