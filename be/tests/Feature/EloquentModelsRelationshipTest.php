<?php

namespace Tests\Feature;

use App\Models\AlertRule;
use App\Models\Appointment;
use App\Models\ApprovalRequest;
use App\Models\AuditLog;
use App\Models\CashTransaction;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\ImportBatch;
use App\Models\ImportError;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\KpiTarget;
use App\Models\MedicalRecord;
use App\Models\Notification;
use App\Models\PackageService;
use App\Models\Patient;
use App\Models\PatientFile;
use App\Models\PatientPackage;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\RolePermission;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserRole;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EloquentModelsRelationshipTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_30_models_and_relationships_work_end_to_end(): void
    {
        // Nhóm 2 & 1: Employee, User, Role, Permission, RolePermission, UserRole, AuditLog
        $employee = Employee::create([
            'employee_code' => 'EMP-001',
            'full_name' => 'BS. Tran Van B',
            'position' => 'Doctor',
            'department' => 'General',
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'bstranvanb',
            'email' => 'bsb@clinic.local',
            'password_hash' => 'secret123',
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'ADMIN',
            'description' => 'System Administrator',
        ]);

        $permission = Permission::create([
            'module' => 'patients',
            'action' => 'create',
            'permission_key' => 'patients.create',
            'description' => 'Create patient records',
        ]);

        $role->permissions()->attach($permission->id, ['created_at' => now()]);
        $user->roles()->attach($role->id, ['created_at' => now()]);

        $auditLog = AuditLog::create([
            'user_id' => $user->id,
            'module' => 'auth',
            'action' => 'login',
            'table_name' => 'users',
            'record_id' => (string) $user->id,
            'old_values' => ['last_login_at' => null],
            'new_values' => ['last_login_at' => '2026-10-26 10:00:00'],
            'ip_address' => '127.0.0.1',
            'created_at' => now(),
        ]);

        $this->assertTrue($user->employee->is($employee));
        $this->assertTrue($employee->users->contains($user));
        $this->assertCount(1, $role->permissions);
        $this->assertInstanceOf(RolePermission::class, $role->permissions->first()->pivot);
        $this->assertCount(1, $user->roles);
        $this->assertInstanceOf(UserRole::class, $user->roles->first()->pivot);
        $this->assertTrue($auditLog->user->is($user));

        // Nhóm 3, 4, 5: Patient, Service, ServicePackage, PackageService, PatientPackage, Appointment, Visit, PatientFile, MedicalRecord
        $patient = Patient::create([
            'patient_code' => 'PAT-001',
            'full_name' => 'Le Thi C',
            'phone' => '0901234567',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'SRV-001',
            'name' => 'Kham tong quat',
            'price' => 300000,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ]);

        $servicePackage = ServicePackage::create([
            'package_code' => 'PKG-001',
            'name' => 'Goi cham soc 10 buoi',
            'price' => 2500000,
            'total_sessions' => 10,
            'validity_days' => 180,
            'status' => 'ACTIVE',
        ]);

        $servicePackage->services()->attach($service->id, [
            'quantity' => 10,
            'created_at' => now(),
        ]);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $servicePackage->id,
            'purchase_date' => '2026-10-26',
            'expiry_date' => '2027-04-24',
            'total_sessions' => 10,
            'used_sessions' => 1,
            'remaining_sessions' => 9,
            'price' => 2500000,
            'status' => 'ACTIVE',
        ]);

        $appointment = Appointment::create([
            'appointment_code' => 'APT-001',
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'appointment_date' => '2026-10-26',
            'start_time' => '09:00:00',
            'end_time' => '09:30:00',
            'status' => 'CONFIRMED',
            'created_by' => $user->id,
        ]);

        $visit = Visit::create([
            'visit_code' => 'VST-001',
            'patient_id' => $patient->id,
            'employee_id' => $employee->id,
            'service_id' => $service->id,
            'patient_package_id' => $patientPackage->id,
            'appointment_id' => $appointment->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 300000,
            'discount_amount' => 0,
            'total_amount' => 300000,
            'payment_status' => 'PAID',
            'status' => 'COMPLETED',
            'created_by' => $user->id,
        ]);

        $patientFile = PatientFile::create([
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'file_name' => 'xray.png',
            'storage_path' => 'patients/PAT-001/xray.png',
            'mime_type' => 'image/png',
            'file_size' => 102400,
            'uploaded_by' => $user->id,
            'created_at' => now(),
        ]);

        $medicalRecord = MedicalRecord::create([
            'visit_id' => $visit->id,
            'doctor_id' => $employee->id,
            'diagnosis' => 'Khoe manh',
            'treatment' => 'Tai kham dinh ky',
            'follow_up_date' => '2026-11-26',
        ]);

        $this->assertInstanceOf(PackageService::class, $servicePackage->services->first()->pivot);
        $this->assertSame(10, $servicePackage->services->first()->pivot->quantity);
        $this->assertTrue($visit->patient->is($patient));
        $this->assertTrue($visit->medicalRecord->is($medicalRecord));
        $this->assertTrue($medicalRecord->doctor->is($employee));
        $this->assertTrue($patientFile->visit->is($visit));

        // Nhóm 6 & 7: Invoice, Payment, ExpenseCategory, Expense, CashTransaction
        $invoice = Invoice::create([
            'invoice_code' => 'INV-001',
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'patient_package_id' => $patientPackage->id,
            'subtotal_amount' => 300000,
            'discount_amount' => 0,
            'total_amount' => 300000,
            'paid_amount' => 300000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => now(),
            'created_by' => $user->id,
        ]);

        $payment = Payment::create([
            'payment_code' => 'PAY-001',
            'invoice_id' => $invoice->id,
            'amount' => 300000,
            'payment_method' => 'CASH',
            'payment_date' => now(),
            'received_by' => $user->id,
        ]);

        $expenseCategory = ExpenseCategory::create([
            'name' => 'Vat tu y te',
            'status' => 'ACTIVE',
        ]);

        $expense = Expense::create([
            'expense_code' => 'EXP-001',
            'category_id' => $expenseCategory->id,
            'amount' => 500000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => now(),
            'approval_status' => 'APPROVED',
            'created_by' => $user->id,
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        $cashTransaction = CashTransaction::create([
            'transaction_code' => 'CSH-001',
            'transaction_type' => 'IN',
            'reference_type' => Payment::class,
            'reference_id' => $payment->id,
            'amount' => 300000,
            'payment_method' => 'CASH',
            'transaction_date' => now(),
            'created_by' => $user->id,
            'created_at' => now(),
        ]);

        $this->assertTrue($payment->invoice->is($invoice));
        $this->assertTrue($cashTransaction->reference->is($payment));
        $this->assertTrue($expense->category->is($expenseCategory));

        // Nhóm 8, 9, 10, 11: KpiTarget, Notification, ApprovalRequest, AlertRule, Product, InventoryTransaction, ImportBatch, ImportError, SystemSetting
        $kpiTarget = KpiTarget::create([
            'employee_id' => $employee->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'target_revenue' => 50000000,
            'target_visits' => 100,
            'created_by' => $user->id,
        ]);

        $notification = Notification::create([
            'user_id' => $user->id,
            'type' => 'APPOINTMENT_REMINDER',
            'title' => 'Lich hen moi',
            'message' => 'Co lich hen APT-001',
            'reference_type' => Appointment::class,
            'reference_id' => $appointment->id,
            'is_read' => false,
            'created_at' => now(),
        ]);

        $approvalRequest = ApprovalRequest::create([
            'request_type' => 'EXPENSE_APPROVAL',
            'reference_type' => Expense::class,
            'reference_id' => $expense->id,
            'requested_by' => $user->id,
            'approved_by' => $user->id,
            'status' => 'APPROVED',
            'created_at' => now(),
            'approved_at' => now(),
        ]);

        $alertRule = AlertRule::create([
            'name' => 'Canh bao sap het buoi goi dich vu',
            'alert_type' => 'LOW_PACKAGE_SESSIONS',
            'threshold_sessions' => 2,
            'status' => 'ACTIVE',
        ]);

        $product = Product::create([
            'product_code' => 'PRD-001',
            'name' => 'Gang tay y te',
            'unit' => 'Hop',
            'minimum_stock' => 10.000,
            'status' => 'ACTIVE',
        ]);

        $inventoryTx = InventoryTransaction::create([
            'product_id' => $product->id,
            'transaction_type' => 'IN',
            'quantity' => 50.000,
            'reference_type' => Expense::class,
            'reference_id' => $expense->id,
            'transaction_date' => now(),
            'created_by' => $user->id,
            'created_at' => now(),
        ]);

        $importBatch = ImportBatch::create([
            'module' => 'patients',
            'file_name' => 'patients_oct.xlsx',
            'total_rows' => 10,
            'success_rows' => 9,
            'error_rows' => 1,
            'status' => 'COMPLETED',
            'imported_by' => $user->id,
            'created_at' => now(),
            'completed_at' => now(),
        ]);

        $importError = ImportError::create([
            'batch_id' => $importBatch->id,
            'row_number' => 5,
            'column_name' => 'phone',
            'error_message' => 'Invalid phone format',
            'raw_data' => ['phone' => 'abc'],
            'created_at' => now(),
        ]);

        $setting = SystemSetting::create([
            'setting_key' => 'clinic.name',
            'setting_value' => 'Phong Kham QLPK',
            'updated_by' => $user->id,
        ]);

        $this->assertTrue($kpiTarget->employee->is($employee));
        $this->assertTrue($notification->reference->is($appointment));
        $this->assertTrue($approvalRequest->reference->is($expense));
        $this->assertSame(2, $alertRule->threshold_sessions);
        $this->assertTrue($inventoryTx->product->is($product));
        $this->assertTrue($importError->batch->is($importBatch));
        $this->assertTrue($setting->updater->is($user));
    }
}
