<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\CashTransaction;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class Phase3CompositeIndexesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that the expected composite indexes exist on all large transaction tables.
     */
    public function test_phase_3_composite_indexes_exist_on_all_target_tables(): void
    {
        // 1. visits: (patient_id, status, created_at)
        $this->assertTrue(Schema::hasTable('visits'), 'Table visits must exist.');
        $this->assertTrue(
            Schema::hasIndex('visits', 'idx_visits_patient_status_created') ||
            Schema::hasIndex('visits', ['patient_id', 'status', 'created_at']),
            'Composite index on visits(patient_id, status, created_at) must exist.'
        );

        // 2. appointments: (appointment_date, status, employee_id)
        $this->assertTrue(Schema::hasTable('appointments'), 'Table appointments must exist.');
        $this->assertTrue(
            Schema::hasIndex('appointments', 'idx_appointments_date_status_employee') ||
            Schema::hasIndex('appointments', ['appointment_date', 'status', 'employee_id']),
            'Composite index on appointments(appointment_date, status, employee_id) must exist.'
        );

        // 3. invoices: (patient_id, status, created_at)
        $this->assertTrue(Schema::hasTable('invoices'), 'Table invoices must exist.');
        $statusCol = Schema::hasColumn('invoices', 'payment_status') ? 'payment_status' : 'status';
        $this->assertTrue(
            Schema::hasIndex('invoices', 'idx_invoices_patient_status_created') ||
            Schema::hasIndex('invoices', ['patient_id', $statusCol, 'created_at']),
            'Composite index on invoices(patient_id, status/payment_status, created_at) must exist.'
        );

        // 4. cash_transactions: (transaction_type, payment_method, transaction_date)
        $this->assertTrue(Schema::hasTable('cash_transactions'), 'Table cash_transactions must exist.');
        $typeCol = Schema::hasColumn('cash_transactions', 'transaction_type') ? 'transaction_type' : 'type';
        $this->assertTrue(
            Schema::hasIndex('cash_transactions', 'idx_cash_trans_type_method_date') ||
            Schema::hasIndex('cash_transactions', [$typeCol, 'payment_method', 'transaction_date']),
            'Composite index on cash_transactions(transaction_type, payment_method, transaction_date) must exist.'
        );

        // 5. inventory_transactions: (product_id, transaction_type, created_at)
        $this->assertTrue(Schema::hasTable('inventory_transactions'), 'Table inventory_transactions must exist.');
        $invTypeCol = Schema::hasColumn('inventory_transactions', 'transaction_type') ? 'transaction_type' : 'type';
        $this->assertTrue(
            Schema::hasIndex('inventory_transactions', 'idx_inv_trans_prod_type_created') ||
            Schema::hasIndex('inventory_transactions', ['product_id', $invTypeCol, 'created_at']),
            'Composite index on inventory_transactions(product_id, transaction_type, created_at) must exist.'
        );

        // 6. audit_logs: (user_id, action, created_at)
        $this->assertTrue(Schema::hasTable('audit_logs'), 'Table audit_logs must exist.');
        $this->assertTrue(
            Schema::hasIndex('audit_logs', 'idx_audit_logs_user_action_created') ||
            Schema::hasIndex('audit_logs', ['user_id', 'action', 'created_at']),
            'Composite index on audit_logs(user_id, action, created_at) must exist.'
        );
    }

    /**
     * Test migration idempotency (running up again does not fail or duplicate indexes).
     */
    public function test_composite_index_migration_is_idempotent_and_safe_to_rerun(): void
    {
        $migration = require database_path('migrations/2026_10_29_110000_add_phase_3_composite_indexes.php');

        // Running up() again should cleanly exit without throwing exceptions
        $migration->up();

        $this->assertTrue(true, 'Migration up() executed a second time without throwing duplicate key errors.');
    }

    /**
     * Test query builder operations on indexed columns execute without syntax or database errors.
     */
    public function test_composite_indexed_queries_execute_cleanly(): void
    {
        $now = now();

        // 1. Visit query using (patient_id, status, created_at)
        $visitResult = Visit::query()
            ->where('patient_id', 1)
            ->where('status', 'WAITING')
            ->where('created_at', '>=', $now->copy()->subDays(7))
            ->get();
        $this->assertNotNull($visitResult);

        // 2. Appointment query using (appointment_date, status, employee_id)
        $appointmentResult = Appointment::query()
            ->whereDate('appointment_date', $now->toDateString())
            ->where('status', 'PENDING')
            ->where('employee_id', 1)
            ->get();
        $this->assertNotNull($appointmentResult);

        // 3. Invoice query using (patient_id, status, created_at)
        $invoiceResult = Invoice::query()
            ->where('patient_id', 1)
            ->where('status', 'UNPAID')
            ->where('created_at', '>=', $now->copy()->subDays(30))
            ->get();
        $this->assertNotNull($invoiceResult);

        // 4. CashTransaction query using (transaction_type, payment_method, transaction_date)
        $typeCol = Schema::hasColumn('cash_transactions', 'transaction_type') ? 'transaction_type' : 'type';
        $cashResult = CashTransaction::query()
            ->where($typeCol, 'IN')
            ->where('payment_method', 'CASH')
            ->whereDate('transaction_date', $now->toDateString())
            ->get();
        $this->assertNotNull($cashResult);

        // 5. InventoryTransaction query using (product_id, transaction_type, created_at)
        $invTypeCol = Schema::hasColumn('inventory_transactions', 'transaction_type') ? 'transaction_type' : 'type';
        $invResult = InventoryTransaction::query()
            ->where('product_id', 1)
            ->where($invTypeCol, 'IMPORT')
            ->where('created_at', '>=', $now->copy()->subDays(30))
            ->get();
        $this->assertNotNull($invResult);

        // 6. AuditLog query using (user_id, action, created_at)
        $auditResult = AuditLog::query()
            ->where('user_id', 1)
            ->where('action', 'LOGIN')
            ->where('created_at', '>=', $now->copy()->subDays(30))
            ->get();
        $this->assertNotNull($auditResult);
    }
}
