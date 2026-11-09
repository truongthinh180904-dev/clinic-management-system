<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Get the list of composite indexes for large transaction tables.
     *
     * @return list<array{table: string, columns: list<string>, name: string}>
     */
    protected function getCompositeIndexDefinitions(): array
    {
        return [
            // 1. Visits: Fast lookup by patient, visit status, and chronological ordering
            [
                'table' => 'visits',
                'columns' => ['patient_id', 'status', 'created_at'],
                'name' => 'idx_visits_patient_status_created',
            ],
            // Visits: Also index patient with payment_status if present
            [
                'table' => 'visits',
                'columns' => ['patient_id', 'payment_status', 'created_at'],
                'name' => 'idx_visits_patient_payment_status_created',
            ],

            // 2. Appointments: Filtering by date range, state machine status, and assigned doctor/staff
            [
                'table' => 'appointments',
                'columns' => ['appointment_date', 'status', 'employee_id'],
                'name' => 'idx_appointments_date_status_employee',
            ],

            // 3. Invoices: Patient invoice history and payment reconciliation
            [
                'table' => 'invoices',
                'columns' => ['patient_id', 'status', 'created_at'],
                'name' => 'idx_invoices_patient_status_created',
            ],
            // Invoices: Fallback/variant if payment_status column exists
            [
                'table' => 'invoices',
                'columns' => ['patient_id', 'payment_status', 'created_at'],
                'name' => 'idx_invoices_patient_payment_status_created',
            ],

            // 4. Cash Transactions: Cash book ledger filtering by type, payment method, and date
            [
                'table' => 'cash_transactions',
                'columns' => ['transaction_type', 'payment_method', 'transaction_date'],
                'name' => 'idx_cash_trans_type_method_date',
            ],
            // Cash Transactions: Fallback if short column name 'type' is used
            [
                'table' => 'cash_transactions',
                'columns' => ['type', 'payment_method', 'transaction_date'],
                'name' => 'idx_cash_trans_type_short_method_date',
            ],

            // 5. Inventory Transactions: Material stock movements by product, transaction type, and timestamp
            [
                'table' => 'inventory_transactions',
                'columns' => ['product_id', 'transaction_type', 'created_at'],
                'name' => 'idx_inv_trans_prod_type_created',
            ],
            // Inventory Transactions: Fallback if short column name 'type' is used
            [
                'table' => 'inventory_transactions',
                'columns' => ['product_id', 'type', 'created_at'],
                'name' => 'idx_inv_trans_prod_type_short_created',
            ],

            // 6. Audit Logs: Append-only compliance log filtering by operator, action, and timestamp
            [
                'table' => 'audit_logs',
                'columns' => ['user_id', 'action', 'created_at'],
                'name' => 'idx_audit_logs_user_action_created',
            ],
        ];
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach ($this->getCompositeIndexDefinitions() as $def) {
            $table = $def['table'];
            $columns = $def['columns'];
            $name = $def['name'];

            if (! Schema::hasTable($table)) {
                continue;
            }

            // Verify all target columns exist on the table before attempting to index
            $allColumnsExist = true;
            foreach ($columns as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    $allColumnsExist = false;
                    break;
                }
            }

            if (! $allColumnsExist) {
                continue;
            }

            // Guard against duplicate index creation (check by index name or identical column set)
            if (Schema::hasIndex($table, $name) || Schema::hasIndex($table, $columns)) {
                continue;
            }

            Schema::table($table, function (Blueprint $tableBlueprint) use ($columns, $name) {
                $tableBlueprint->index($columns, $name);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ($this->getCompositeIndexDefinitions() as $def) {
            $table = $def['table'];
            $name = $def['name'];

            if (! Schema::hasTable($table)) {
                continue;
            }

            if (Schema::hasIndex($table, $name)) {
                Schema::table($table, function (Blueprint $tableBlueprint) use ($name) {
                    $tableBlueprint->dropIndex($name);
                });
            }
        }
    }
};
