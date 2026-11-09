<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\ServicePackage;
use App\Models\User;
use App\Models\Visit;
use Carbon\Carbon;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManagementReportApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create an active user with a specific role.
     */
    protected function createUserWithRole(string $roleName = 'ADMIN'): User
    {
        $employee = Employee::create([
            'employee_code' => 'NV'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'Bác sĩ CK1',
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'rep_user_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::where('name', $roleName)->first();
        if ($role) {
            $user->roles()->attach($role->id, ['created_at' => now()]);
        }

        return $user;
    }

    /**
     * Helper to create a user with specific permissions.
     *
     * @param  list<string>  $permissionKeys
     */
    protected function createUserWithPermissions(array $permissionKeys): User
    {
        $employee = Employee::create([
            'employee_code' => 'NV'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'Nhân viên',
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'perm_rep_'.fake()->unique()->lexify('??????'),
            'email' => $employee->email,
            'password_hash' => bcrypt('Secret@123'),
            'status' => 'ACTIVE',
        ]);

        $role = Role::create([
            'name' => 'ROLE_REP_'.fake()->unique()->numerify('####'),
            'description' => 'Test role for reports',
        ]);

        $permissionIds = Permission::whereIn('permission_key', $permissionKeys)->pluck('id');
        $syncData = [];
        foreach ($permissionIds as $id) {
            $syncData[$id] = ['created_at' => now()];
        }
        $role->permissions()->sync($syncData);
        $user->roles()->attach($role->id, ['created_at' => now()]);

        return $user;
    }

    /**
     * Authenticate a user via Sanctum bearer token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test_token')->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    /**
     * Helper to create a test patient.
     */
    protected function createPatient(): Patient
    {
        return Patient::create([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh nhân '.fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'status' => 'ACTIVE',
        ]);
    }

    public function test_cannot_access_reports_without_authentication(): void
    {
        $this->getJson('/api/v1/reports/financial')->assertStatus(401);
        $this->getJson('/api/v1/reports/clinical')->assertStatus(401);
        $this->getJson('/api/v1/reports/inventory')->assertStatus(401);
    }

    public function test_user_without_reports_view_permission_is_forbidden(): void
    {
        // DOCTOR does not have reports.view
        $user = $this->createUserWithRole('DOCTOR');

        $this->authenticate($user)->getJson('/api/v1/reports/financial')->assertStatus(403);
        $this->authenticate($user)->getJson('/api/v1/reports/clinical')->assertStatus(403);
        $this->authenticate($user)->getJson('/api/v1/reports/inventory')->assertStatus(403);
    }

    public function test_financial_report_returns_correct_aggregates(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient();

        $targetDate = Carbon::parse('2026-10-15 10:00:00');

        // Invoice 1: 5,000,000 (Paid 3,000,000, Remaining 2,000,000)
        $inv1 = Invoice::create([
            'invoice_code' => 'INV-001',
            'patient_id' => $patient->id,
            'subtotal_amount' => 5000000,
            'discount_amount' => 0,
            'total_amount' => 5000000,
            'paid_amount' => 3000000,
            'remaining_amount' => 2000000,
            'status' => 'PARTIAL',
            'issued_at' => $targetDate,
            'created_by' => $admin->id,
        ]);

        // Invoice 2: 2,000,000 (Fully Paid)
        $inv2 = Invoice::create([
            'invoice_code' => 'INV-002',
            'patient_id' => $patient->id,
            'subtotal_amount' => 2000000,
            'discount_amount' => 0,
            'total_amount' => 2000000,
            'paid_amount' => 2000000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => $targetDate,
            'created_by' => $admin->id,
        ]);

        // Invoice 3 (CANCELLED): Should be excluded from revenue & debt
        Invoice::create([
            'invoice_code' => 'INV-003',
            'patient_id' => $patient->id,
            'subtotal_amount' => 10000000,
            'discount_amount' => 0,
            'total_amount' => 10000000,
            'paid_amount' => 0,
            'remaining_amount' => 10000000,
            'status' => 'CANCELLED',
            'issued_at' => $targetDate,
            'created_by' => $admin->id,
        ]);

        // Payments: 3,000,000 via CASH, 2,000,000 via BANK_TRANSFER
        Payment::create([
            'payment_code' => 'PAY-001',
            'invoice_id' => $inv1->id,
            'amount' => 3000000,
            'payment_method' => 'CASH',
            'payment_date' => $targetDate,
            'received_by' => $admin->id,
        ]);

        Payment::create([
            'payment_code' => 'PAY-002',
            'invoice_id' => $inv2->id,
            'amount' => 2000000,
            'payment_method' => 'BANK_TRANSFER',
            'payment_date' => $targetDate,
            'received_by' => $admin->id,
        ]);

        // Expense Categories
        $catSupplies = ExpenseCategory::create(['name' => 'Vật tư y tế', 'status' => 'ACTIVE']);
        $catOffice = ExpenseCategory::create(['name' => 'Văn phòng phẩm', 'status' => 'ACTIVE']);

        // Expenses: 1,000,000 Approved (Supplies, Bank Transfer), 500,000 Approved (Office, Cash)
        Expense::create([
            'expense_code' => 'EXP-001',
            'category_id' => $catSupplies->id,
            'amount' => 1000000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => $targetDate,
            'approval_status' => 'APPROVED',
            'created_by' => $admin->id,
            'approved_by' => $admin->id,
            'approved_at' => $targetDate,
        ]);

        Expense::create([
            'expense_code' => 'EXP-002',
            'category_id' => $catOffice->id,
            'amount' => 500000,
            'payment_method' => 'CASH',
            'expense_date' => $targetDate,
            'approval_status' => 'APPROVED',
            'created_by' => $admin->id,
            'approved_by' => $admin->id,
            'approved_at' => $targetDate,
        ]);

        // Expense 3 (PENDING): Should be excluded from expenses
        Expense::create([
            'expense_code' => 'EXP-003',
            'category_id' => $catSupplies->id,
            'amount' => 8000000,
            'payment_method' => 'CASH',
            'expense_date' => $targetDate,
            'approval_status' => 'PENDING',
            'created_by' => $admin->id,
        ]);

        $response = $this->authenticate($admin)->getJson('/api/v1/reports/financial?start_date=2026-10-01&end_date=2026-10-31');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'invoiced_amount' => 7000000,
                    'collected_amount' => 5000000,
                    'debt_amount' => 2000000,
                    'expense_amount' => 1500000,
                    'net_profit' => 5500000,
                    'net_cashflow' => 3500000,
                ],
            ]);

        // Verify expenses by category
        $categories = $response->json('data.expenses_by_category');
        $this->assertCount(2, $categories);
        $this->assertEquals('Vật tư y tế', $categories[0]['category_name']);
        $this->assertEquals(1000000, $categories[0]['total_amount']);

        // Verify by payment method
        $paymentMethods = collect($response->json('data.by_payment_method'))->keyBy('payment_method');
        $this->assertEquals(3000000, $paymentMethods['CASH']['collected_amount']);
        $this->assertEquals(500000, $paymentMethods['CASH']['expense_amount']);
        $this->assertEquals(2500000, $paymentMethods['CASH']['net_amount']);

        $this->assertEquals(2000000, $paymentMethods['BANK_TRANSFER']['collected_amount']);
        $this->assertEquals(1000000, $paymentMethods['BANK_TRANSFER']['expense_amount']);
        $this->assertEquals(1000000, $paymentMethods['BANK_TRANSFER']['net_amount']);

        // Verify daily series includes the target date
        $dailySeries = collect($response->json('data.daily_series'))->keyBy('date');
        $this->assertTrue($dailySeries->has('2026-10-15'));
        $this->assertEquals(7000000, $dailySeries['2026-10-15']['invoiced_amount']);
        $this->assertEquals(5000000, $dailySeries['2026-10-15']['collected_amount']);
        $this->assertEquals(1500000, $dailySeries['2026-10-15']['expense_amount']);
    }

    public function test_financial_report_filters_by_date_range(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient();

        // Invoice in September 2026
        Invoice::create([
            'invoice_code' => 'INV-SEP',
            'patient_id' => $patient->id,
            'subtotal_amount' => 4000000,
            'discount_amount' => 0,
            'total_amount' => 4000000,
            'paid_amount' => 4000000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => Carbon::parse('2026-09-15 10:00:00'),
            'created_by' => $admin->id,
        ]);

        // Invoice in October 2026
        Invoice::create([
            'invoice_code' => 'INV-OCT',
            'patient_id' => $patient->id,
            'subtotal_amount' => 6000000,
            'discount_amount' => 0,
            'total_amount' => 6000000,
            'paid_amount' => 6000000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => Carbon::parse('2026-10-15 10:00:00'),
            'created_by' => $admin->id,
        ]);

        // Filter only October
        $response = $this->authenticate($admin)->getJson('/api/v1/reports/financial?start_date=2026-10-01&end_date=2026-10-31');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'invoiced_amount' => 6000000,
                ],
            ]);
    }

    public function test_clinical_report_returns_correct_activity_and_performance_stats(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient();

        $doctorEmployee = Employee::create([
            'employee_code' => 'BS-001',
            'full_name' => 'Bác sĩ Nguyễn Văn A',
            'phone' => '0912345678',
            'email' => 'dr.a@qlpk.test',
            'position' => 'Bác sĩ Trưởng khoa',
            'status' => 'ACTIVE',
        ]);

        $service1 = Service::create([
            'service_code' => 'DV-KHAM',
            'name' => 'Khám Nội khoa',
            'price' => 200000,
            'status' => 'ACTIVE',
        ]);

        $service2 = Service::create([
            'service_code' => 'DV-SIEUAM',
            'name' => 'Siêu âm Doppler',
            'price' => 500000,
            'status' => 'ACTIVE',
        ]);

        $package = ServicePackage::create([
            'package_code' => 'GOI-001',
            'name' => 'Gói Chăm Sóc Toàn Diện',
            'price' => 3000000,
            'total_sessions' => 10,
            'validity_days' => 90,
            'status' => 'ACTIVE',
        ]);

        $patientPackage = PatientPackage::create([
            'patient_id' => $patient->id,
            'package_id' => $package->id,
            'purchase_date' => '2026-10-01',
            'expiry_date' => '2026-12-31',
            'total_sessions' => 10,
            'used_sessions' => 2,
            'remaining_sessions' => 8,
            'price' => 3000000,
            'status' => 'ACTIVE',
        ]);

        $reportDate = Carbon::parse('2026-10-10 09:00:00');

        // Appointments: 1 COMPLETED, 1 SCHEDULED, 1 CANCELLED -> Total 3, Attended 1 -> Attendance rate: 33.33%
        Appointment::create([
            'appointment_code' => 'APT-001',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service1->id,
            'appointment_date' => $reportDate->toDateString(),
            'start_time' => '09:00',
            'end_time' => '09:30',
            'status' => 'COMPLETED',
            'created_by' => $admin->id,
        ]);

        Appointment::create([
            'appointment_code' => 'APT-002',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service2->id,
            'appointment_date' => $reportDate->toDateString(),
            'start_time' => '10:00',
            'end_time' => '10:30',
            'status' => 'SCHEDULED',
            'created_by' => $admin->id,
        ]);

        Appointment::create([
            'appointment_code' => 'APT-003',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service1->id,
            'appointment_date' => $reportDate->toDateString(),
            'start_time' => '11:00',
            'end_time' => '11:30',
            'status' => 'CANCELLED',
            'created_by' => $admin->id,
        ]);

        // Visits:
        // Visit 1: Completed, service 1, doctorEmployee, regular
        Visit::create([
            'visit_code' => 'VIS-001',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service1->id,
            'visit_date' => $reportDate,
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'payment_status' => 'PAID',
            'status' => 'COMPLETED',
            'created_by' => $admin->id,
        ]);

        // Visit 2: Completed, service 2, doctorEmployee, uses package
        Visit::create([
            'visit_code' => 'VIS-002',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service2->id,
            'patient_package_id' => $patientPackage->id,
            'visit_date' => $reportDate,
            'quantity' => 1,
            'unit_price' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_status' => 'PACKAGED',
            'status' => 'COMPLETED',
            'created_by' => $admin->id,
        ]);

        // Visit 3: Cancelled
        Visit::create([
            'visit_code' => 'VIS-003',
            'patient_id' => $patient->id,
            'employee_id' => $doctorEmployee->id,
            'service_id' => $service1->id,
            'visit_date' => $reportDate,
            'quantity' => 1,
            'unit_price' => 200000,
            'discount_amount' => 0,
            'total_amount' => 200000,
            'payment_status' => 'UNPAID',
            'status' => 'CANCELLED',
            'created_by' => $admin->id,
        ]);

        $response = $this->authenticate($admin)->getJson('/api/v1/reports/clinical?start_date=2026-10-01&end_date=2026-10-31');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'appointments' => [
                        'total' => 3,
                        'completed' => 1,
                        'cancelled' => 1,
                        'scheduled' => 1,
                        'attendance_rate' => 33.33,
                    ],
                    'attendance_rate' => 33.33,
                    'visits' => [
                        'total' => 3,
                        'completed' => 2,
                        'cancelled' => 1,
                    ],
                    'used_package_sessions' => 1,
                ],
            ]);

        // Verify doctor performance breakdown
        $doctors = collect($response->json('data.visits_by_doctor'))->keyBy('employee_id');
        $this->assertTrue($doctors->has($doctorEmployee->id));
        $this->assertEquals(2, $doctors[$doctorEmployee->id]['total_visits']);
        $this->assertEquals(2, $doctors[$doctorEmployee->id]['completed_visits']);
        $this->assertEquals(700000, $doctors[$doctorEmployee->id]['total_revenue']);

        // Verify service utilization breakdown
        $services = collect($response->json('data.visits_by_service'))->keyBy('service_id');
        $this->assertTrue($services->has($service1->id));
        $this->assertTrue($services->has($service2->id));
        $this->assertEquals(1, $services[$service1->id]['total_visits']);
        $this->assertEquals(200000, $services[$service1->id]['total_revenue']);
        $this->assertEquals(1, $services[$service2->id]['total_visits']);
        $this->assertEquals(500000, $services[$service2->id]['total_revenue']);
    }

    public function test_clinical_report_filters_by_date_range(): void
    {
        $admin = $this->createUserWithRole('ADMIN');
        $patient = $this->createPatient();

        $service = Service::create([
            'service_code' => 'DV-DATE-FILTER',
            'name' => 'Dịch vụ lọc ngày',
            'price' => 150000,
            'status' => 'ACTIVE',
        ]);

        // Appointment in September
        Appointment::create([
            'appointment_code' => 'APT-SEP',
            'patient_id' => $patient->id,
            'employee_id' => $admin->employee_id,
            'service_id' => $service->id,
            'appointment_date' => '2026-09-20',
            'start_time' => '09:00',
            'end_time' => '09:30',
            'status' => 'COMPLETED',
            'created_by' => $admin->id,
        ]);

        // Appointment in October
        Appointment::create([
            'appointment_code' => 'APT-OCT',
            'patient_id' => $patient->id,
            'employee_id' => $admin->employee_id,
            'service_id' => $service->id,
            'appointment_date' => '2026-10-20',
            'start_time' => '10:00',
            'end_time' => '10:30',
            'status' => 'COMPLETED',
            'created_by' => $admin->id,
        ]);

        $response = $this->authenticate($admin)->getJson('/api/v1/reports/clinical?start_date=2026-10-01&end_date=2026-10-31');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'appointments' => [
                        'total' => 1,
                        'completed' => 1,
                    ],
                ],
            ]);
    }

    public function test_inventory_report_calculates_opening_and_closing_stock(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $prod1 = Product::create([
            'product_code' => 'PRD-001',
            'name' => 'Khẩu trang y tế 4 lớp',
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        $prod2 = Product::create([
            'product_code' => 'PRD-002',
            'name' => 'Cồn sát khuẩn 70 độ',
            'unit' => 'Chai',
            'minimum_stock' => 5,
            'status' => 'ACTIVE',
        ]);

        // Product 1 transactions:
        // Prior to period: IN 50 -> Opening balance: 50
        InventoryTransaction::create([
            'product_id' => $prod1->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'transaction_date' => Carbon::parse('2026-09-25 10:00:00'),
            'created_by' => $admin->id,
        ]);

        // In period: OUT 20
        InventoryTransaction::create([
            'product_id' => $prod1->id,
            'transaction_type' => 'OUT',
            'quantity' => 20,
            'transaction_date' => Carbon::parse('2026-10-10 10:00:00'),
            'created_by' => $admin->id,
        ]);

        // In period: ADJUST -5 -> Closing balance: 50 - 20 - 5 = 25 (status: IN_STOCK)
        InventoryTransaction::create([
            'product_id' => $prod1->id,
            'transaction_type' => 'ADJUST',
            'quantity' => -5,
            'transaction_date' => Carbon::parse('2026-10-12 10:00:00'),
            'created_by' => $admin->id,
        ]);

        // Product 2 transactions:
        // Prior to period: IN 10 -> Opening balance: 10
        InventoryTransaction::create([
            'product_id' => $prod2->id,
            'transaction_type' => 'IN',
            'quantity' => 10,
            'transaction_date' => Carbon::parse('2026-09-30 10:00:00'),
            'created_by' => $admin->id,
        ]);

        // In period: OUT 8 -> Closing balance: 2 (status: LOW_STOCK, since 2 <= 5)
        InventoryTransaction::create([
            'product_id' => $prod2->id,
            'transaction_type' => 'OUT',
            'quantity' => 8,
            'transaction_date' => Carbon::parse('2026-10-05 10:00:00'),
            'created_by' => $admin->id,
        ]);

        $response = $this->authenticate($admin)->getJson('/api/v1/reports/inventory?start_date=2026-10-01&end_date=2026-10-31');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_products' => 2,
                    'total_in_quantity' => 0,
                    'total_out_quantity' => 28,
                    'total_adjust_quantity' => -5,
                    'in_stock_count' => 1,
                    'low_stock_count' => 1,
                ],
            ]);

        $items = collect($response->json('data.items'))->keyBy('product_code');

        // Product 1 assertions
        $this->assertEquals(50, $items['PRD-001']['opening_stock']);
        $this->assertEquals(0, $items['PRD-001']['in_quantity']);
        $this->assertEquals(20, $items['PRD-001']['out_quantity']);
        $this->assertEquals(-5, $items['PRD-001']['adjust_quantity']);
        $this->assertEquals(25, $items['PRD-001']['closing_stock']);
        $this->assertEquals('IN_STOCK', $items['PRD-001']['status']);
        $this->assertFalse($items['PRD-001']['is_low_stock']);

        // Product 2 assertions
        $this->assertEquals(10, $items['PRD-002']['opening_stock']);
        $this->assertEquals(0, $items['PRD-002']['in_quantity']);
        $this->assertEquals(8, $items['PRD-002']['out_quantity']);
        $this->assertEquals(0, $items['PRD-002']['adjust_quantity']);
        $this->assertEquals(2, $items['PRD-002']['closing_stock']);
        $this->assertEquals('LOW_STOCK', $items['PRD-002']['status']);
        $this->assertTrue($items['PRD-002']['is_low_stock']);
    }

    public function test_inventory_report_filters_low_stock_only_and_search(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $prod1 = Product::create([
            'product_code' => 'PRD-A',
            'name' => 'Găng tay y tế',
            'unit' => 'Hộp',
            'minimum_stock' => 10,
            'status' => 'ACTIVE',
        ]);

        $prod2 = Product::create([
            'product_code' => 'PRD-B',
            'name' => 'Băng gạc tiệt trùng',
            'unit' => 'Cuộn',
            'minimum_stock' => 20,
            'status' => 'ACTIVE',
        ]);

        // Prod 1 has 50 in stock (IN_STOCK)
        InventoryTransaction::create([
            'product_id' => $prod1->id,
            'transaction_type' => 'IN',
            'quantity' => 50,
            'transaction_date' => Carbon::parse('2026-10-01 10:00:00'),
            'created_by' => $admin->id,
        ]);

        // Prod 2 has 5 in stock (LOW_STOCK <= 20)
        InventoryTransaction::create([
            'product_id' => $prod2->id,
            'transaction_type' => 'IN',
            'quantity' => 5,
            'transaction_date' => Carbon::parse('2026-10-01 10:00:00'),
            'created_by' => $admin->id,
        ]);

        // Filter low stock only
        $responseLow = $this->authenticate($admin)->getJson('/api/v1/reports/inventory?start_date=2026-10-01&end_date=2026-10-31&low_stock_only=true');

        $responseLow->assertStatus(200);
        $this->assertCount(1, $responseLow->json('data.items'));
        $this->assertEquals('PRD-B', $responseLow->json('data.items.0.product_code'));

        // Filter by keyword search
        $responseSearch = $this->authenticate($admin)->getJson('/api/v1/reports/inventory?start_date=2026-10-01&end_date=2026-10-31&q=Găng tay');

        $responseSearch->assertStatus(200);
        $this->assertCount(1, $responseSearch->json('data.items'));
        $this->assertEquals('PRD-A', $responseSearch->json('data.items.0.product_code'));
    }

    public function test_accountant_and_manager_roles_can_access_reports(): void
    {
        $accountant = $this->createUserWithRole('ACCOUNTANT');
        $manager = $this->createUserWithRole('MANAGER');

        foreach ([$accountant, $manager] as $authorizedUser) {
            $this->authenticate($authorizedUser)->getJson('/api/v1/reports/financial')->assertStatus(200);
            $this->authenticate($authorizedUser)->getJson('/api/v1/reports/clinical')->assertStatus(200);
            $this->authenticate($authorizedUser)->getJson('/api/v1/reports/inventory')->assertStatus(200);
        }
    }

    public function test_financial_report_handles_zero_records_gracefully(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)->getJson('/api/v1/reports/financial?start_date=2026-01-01&end_date=2026-01-31');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'invoiced_amount' => 0,
                    'collected_amount' => 0,
                    'debt_amount' => 0,
                    'expense_amount' => 0,
                    'net_profit' => 0,
                    'net_cashflow' => 0,
                    'expenses_by_category' => [],
                    'daily_series' => [],
                ],
            ]);
    }

    public function test_clinical_report_handles_zero_records_gracefully(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        $response = $this->authenticate($admin)->getJson('/api/v1/reports/clinical?start_date=2026-01-01&end_date=2026-01-31');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'appointments' => [
                        'total' => 0,
                        'completed' => 0,
                        'attendance_rate' => 0,
                    ],
                    'attendance_rate' => 0,
                    'visits' => [
                        'total' => 0,
                        'completed' => 0,
                    ],
                    'used_package_sessions' => 0,
                    'visits_by_doctor' => [],
                    'visits_by_service' => [],
                ],
            ]);
    }

    public function test_reports_handle_swapped_date_range_gracefully(): void
    {
        $admin = $this->createUserWithRole('ADMIN');

        // Pass start_date greater than end_date
        $response = $this->authenticate($admin)->getJson('/api/v1/reports/financial?start_date=2026-10-31&end_date=2026-10-01');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'period' => [
                        'start_date' => '2026-10-01',
                        'end_date' => '2026-10-31',
                    ],
                ],
            ]);
    }
}
