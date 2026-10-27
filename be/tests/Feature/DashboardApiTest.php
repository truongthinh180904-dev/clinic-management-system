<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\ApprovalRequest;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\PatientPackage;
use App\Models\Payment;
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

class DashboardApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    /**
     * Helper to create an active authenticated user.
     */
    protected function createActiveUser(string $roleName = 'ADMIN'): User
    {
        $employee = Employee::create([
            'employee_code' => 'NV'.fake()->unique()->numerify('######'),
            'full_name' => fake()->name(),
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ]);

        $user = User::create([
            'employee_id' => $employee->id,
            'username' => 'dash_user_'.fake()->unique()->lexify('??????'),
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
     * Authenticate a user via Sanctum bearer token.
     */
    protected function authenticate(User $user): self
    {
        $token = $user->createToken('test-token')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * Helper to create a test patient.
     */
    protected function createPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'patient_code' => 'BN'.fake()->unique()->numerify('######'),
            'full_name' => 'Bệnh Nhân Test',
            'date_of_birth' => '1992-05-10',
            'gender' => 'MALE',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test employee/doctor.
     */
    protected function createDoctor(array $attributes = []): Employee
    {
        return Employee::create(array_merge([
            'employee_code' => 'BS'.fake()->unique()->numerify('######'),
            'full_name' => 'Bác Sĩ Test',
            'phone' => '09'.fake()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'department' => 'Khoa Khám Bệnh',
            'position' => 'Bác sĩ chuyên khoa',
            'status' => 'ACTIVE',
        ], $attributes));
    }

    /**
     * Helper to create a test service.
     */
    protected function createService(array $attributes = []): Service
    {
        return Service::create(array_merge([
            'service_code' => 'SRV-'.fake()->unique()->numerify('#####'),
            'name' => 'Dịch Vụ Khám Mẫu',
            'description' => 'Mô tả dịch vụ',
            'price' => 200000.00,
            'duration_minutes' => 30,
            'status' => 'ACTIVE',
        ], $attributes));
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/dashboard/summary')
            ->assertStatus(401);

        $this->getJson('/api/v1/dashboard/revenue-chart')
            ->assertStatus(401);

        $this->getJson('/api/v1/dashboard/visit-trends')
            ->assertStatus(401);

        $this->getJson('/api/v1/dashboard/top-performers')
            ->assertStatus(401);
    }

    public function test_inactive_users_are_forbidden(): void
    {
        $user = $this->createActiveUser();
        $user->update(['status' => 'INACTIVE']);

        $token = $user->createToken('test-token')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/dashboard/summary')
            ->assertStatus(403);
    }

    public function test_dashboard_summary_returns_accurate_metrics(): void
    {
        $user = $this->createActiveUser('ADMIN');
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();

        // 1. Visit today (Total = 2)
        $visit1 = Visit::create([
            'visit_code' => 'VIS'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_status' => 'PARTIAL',
            'status' => 'COMPLETED',
            'created_by' => $user->id,
        ]);

        $visit2 = Visit::create([
            'visit_code' => 'VIS'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 1000000,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_status' => 'PAID',
            'status' => 'COMPLETED',
            'created_by' => $user->id,
        ]);

        // 2. Appointment today
        Appointment::create([
            'appointment_code' => 'APT'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'appointment_date' => today(),
            'start_time' => '09:00:00',
            'end_time' => '09:30:00',
            'status' => 'SCHEDULED',
            'created_by' => $user->id,
        ]);

        // 3. Invoices: Total invoiced = 1,500,000, Paid = 1,000,000, Remaining debt = 500,000
        $invoice1 = Invoice::create([
            'invoice_code' => 'INV-001',
            'patient_id' => $patient->id,
            'visit_id' => $visit1->id,
            'subtotal_amount' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'paid_amount' => 0,
            'remaining_amount' => 500000,
            'status' => 'UNPAID',
            'issued_at' => now(),
            'created_by' => $user->id,
        ]);

        $invoice2 = Invoice::create([
            'invoice_code' => 'INV-002',
            'patient_id' => $patient->id,
            'visit_id' => $visit2->id,
            'subtotal_amount' => 1000000,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'paid_amount' => 1000000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => now(),
            'created_by' => $user->id,
        ]);

        // 4. Payment: Total collected = 1,000,000
        Payment::create([
            'payment_code' => 'PAY-001',
            'invoice_id' => $invoice2->id,
            'amount' => 1000000,
            'payment_method' => 'CASH',
            'payment_date' => now(),
            'received_by' => $user->id,
        ]);

        // 5. Expense: Category & Approved expense = 300,000
        $category = ExpenseCategory::create([
            'name' => 'Chi phí vật tư',
            'status' => 'ACTIVE',
        ]);

        $expense = Expense::create([
            'expense_code' => 'EXP-001',
            'category_id' => $category->id,
            'amount' => 300000,
            'payment_method' => 'CASH',
            'expense_date' => now(),
            'approval_status' => 'APPROVED',
            'created_by' => $user->id,
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        // 6. Pending approval request
        ApprovalRequest::create([
            'request_type' => 'EXPENSE',
            'reference_type' => Expense::class,
            'reference_id' => $expense->id,
            'requested_by' => $user->id,
            'status' => 'PENDING',
            'reason' => 'Đề nghị duyệt chi',
        ]);

        // 7. Product with low stock
        Product::create([
            'product_code' => 'PRD-TEST-LOW',
            'name' => 'Băng gạc tiệt trùng',
            'unit' => 'Cuộn',
            'minimum_stock' => 50,
            'status' => 'ACTIVE',
        ]);

        $response = $this->getJson('/api/v1/dashboard/summary');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $data = $response->json('data');

        $this->assertEquals(1500000.0, (float) $data['invoiced_amount']);
        $this->assertEquals(1500000.0, (float) $data['total_revenue']);
        $this->assertEquals(1000000.0, (float) $data['collected_amount']);
        $this->assertEquals(500000.0, (float) $data['debt_amount']);
        $this->assertEquals(300000.0, (float) $data['expense_amount']);
        $this->assertEquals(700000.0, (float) $data['net_cashflow']); // 1,000,000 - 300,000
        $this->assertEquals(2, $data['total_visits']);
        $this->assertEquals(2, $data['visits_today']);
        $this->assertEquals(1, $data['appointments_today']);
        $this->assertGreaterThanOrEqual(1, $data['new_patients']);
        $this->assertGreaterThanOrEqual(1, $data['low_stock_products']);
        $this->assertEquals(1, $data['pending_approvals']);
    }

    public function test_dashboard_summary_respects_custom_date_filtering(): void
    {
        $user = $this->createActiveUser('ADMIN');
        $this->authenticate($user);

        $patient = $this->createPatient();

        // Old invoice in May 2026
        Invoice::create([
            'invoice_code' => 'INV-OLD',
            'patient_id' => $patient->id,
            'subtotal_amount' => 400000,
            'discount_amount' => 0,
            'total_amount' => 400000,
            'paid_amount' => 400000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => Carbon::parse('2026-05-15 10:00:00'),
            'created_by' => $user->id,
        ]);

        // Newer invoice in June 2026
        Invoice::create([
            'invoice_code' => 'INV-NEW',
            'patient_id' => $patient->id,
            'subtotal_amount' => 900000,
            'discount_amount' => 0,
            'total_amount' => 900000,
            'paid_amount' => 900000,
            'remaining_amount' => 0,
            'status' => 'PAID',
            'issued_at' => Carbon::parse('2026-06-20 10:00:00'),
            'created_by' => $user->id,
        ]);

        // Filter only May 2026
        $response = $this->getJson('/api/v1/dashboard/summary?start_date=2026-05-01&end_date=2026-05-31');

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertEquals(400000.0, (float) $data['invoiced_amount']);
        $this->assertEquals('2026-05-01', $data['period']['start_date']);
        $this->assertEquals('2026-05-31', $data['period']['end_date']);
    }

    public function test_dashboard_revenue_chart_returns_daily_timeseries(): void
    {
        $user = $this->createActiveUser('ADMIN');
        $this->authenticate($user);

        $patient = $this->createPatient();

        $targetDate = now()->subDays(2)->toDateString();

        $invoice = Invoice::create([
            'invoice_code' => 'INV-CHART-1',
            'patient_id' => $patient->id,
            'subtotal_amount' => 800000,
            'discount_amount' => 0,
            'total_amount' => 800000,
            'paid_amount' => 500000,
            'remaining_amount' => 300000,
            'status' => 'PARTIAL',
            'issued_at' => Carbon::parse($targetDate.' 10:00:00'),
            'created_by' => $user->id,
        ]);

        Payment::create([
            'payment_code' => 'PAY-CHART-1',
            'invoice_id' => $invoice->id,
            'amount' => 500000,
            'payment_method' => 'BANK_TRANSFER',
            'payment_date' => Carbon::parse($targetDate.' 11:00:00'),
            'received_by' => $user->id,
        ]);

        $category = ExpenseCategory::create([
            'name' => 'Điện nước',
            'status' => 'ACTIVE',
        ]);

        Expense::create([
            'expense_code' => 'EXP-CHART-1',
            'category_id' => $category->id,
            'amount' => 200000,
            'payment_method' => 'BANK_TRANSFER',
            'expense_date' => Carbon::parse($targetDate.' 14:00:00'),
            'approval_status' => 'APPROVED',
            'created_by' => $user->id,
            'approved_by' => $user->id,
            'approved_at' => Carbon::parse($targetDate.' 15:00:00'),
        ]);

        $response = $this->getJson('/api/v1/dashboard/revenue-chart?days=7');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $chart = $response->json('data');
        $this->assertCount(7, $chart);

        // Find the record for $targetDate
        $targetRecord = null;
        foreach ($chart as $entry) {
            $this->assertArrayHasKey('date', $entry);
            $this->assertArrayHasKey('invoiced_amount', $entry);
            $this->assertArrayHasKey('collected_amount', $entry);
            $this->assertArrayHasKey('expense_amount', $entry);
            $this->assertArrayHasKey('net_cashflow', $entry);

            if ($entry['date'] === $targetDate) {
                $targetRecord = $entry;
            }
        }

        $this->assertNotNull($targetRecord);
        $this->assertEquals(800000.0, (float) $targetRecord['invoiced_amount']);
        $this->assertEquals(500000.0, (float) $targetRecord['collected_amount']);
        $this->assertEquals(200000.0, (float) $targetRecord['expense_amount']);
        $this->assertEquals(300000.0, (float) $targetRecord['net_cashflow']); // 500,000 - 200,000
    }

    public function test_dashboard_visit_trends_returns_daily_breakdown_and_status_distribution(): void
    {
        $user = $this->createActiveUser('ADMIN');
        $this->authenticate($user);

        $patient = $this->createPatient();
        $doctor = $this->createDoctor();
        $service = $this->createService();

        $statuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

        foreach ($statuses as $status) {
            Visit::create([
                'visit_code' => 'VIS'.fake()->unique()->numerify('######'),
                'patient_id' => $patient->id,
                'employee_id' => $doctor->id,
                'service_id' => $service->id,
                'visit_date' => now(),
                'quantity' => 1,
                'unit_price' => 150000,
                'discount_amount' => 0,
                'total_amount' => 150000,
                'payment_status' => 'UNPAID',
                'status' => $status,
                'created_by' => $user->id,
            ]);
        }

        $response = $this->getJson('/api/v1/dashboard/visit-trends?days=7');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $data = $response->json('data');

        $this->assertArrayHasKey('trends', $data);
        $this->assertArrayHasKey('by_status', $data);
        $this->assertCount(7, $data['trends']);

        $byStatus = $data['by_status'];
        $this->assertGreaterThanOrEqual(1, $byStatus['WAITING']);
        $this->assertGreaterThanOrEqual(1, $byStatus['SCHEDULED']);
        $this->assertGreaterThanOrEqual(1, $byStatus['IN_PROGRESS']);
        $this->assertGreaterThanOrEqual(1, $byStatus['COMPLETED']);
        $this->assertGreaterThanOrEqual(1, $byStatus['CANCELLED']);
    }

    public function test_dashboard_top_performers_returns_top_services_packages_and_doctors(): void
    {
        $user = $this->createActiveUser('ADMIN');
        $this->authenticate($user);

        $patient = $this->createPatient();

        // 1. Services
        $serviceA = $this->createService(['name' => 'Dịch vụ Phổ Biến Nhất', 'price' => 200000]);
        $serviceB = $this->createService(['name' => 'Dịch vụ Ít Phổ Biến', 'price' => 100000]);

        $doctorA = $this->createDoctor(['full_name' => 'Bác Sĩ Giỏi Nhất']);
        $doctorB = $this->createDoctor(['full_name' => 'Bác Sĩ Dự Bị']);

        // Doctor A with 3 visits for Service A
        for ($i = 0; $i < 3; $i++) {
            Visit::create([
                'visit_code' => 'VIS'.fake()->unique()->numerify('######'),
                'patient_id' => $patient->id,
                'employee_id' => $doctorA->id,
                'service_id' => $serviceA->id,
                'visit_date' => now(),
                'quantity' => 1,
                'unit_price' => 200000,
                'discount_amount' => 0,
                'total_amount' => 200000,
                'payment_status' => 'PAID',
                'status' => 'COMPLETED',
                'created_by' => $user->id,
            ]);
        }

        // Doctor B with 1 visit for Service B
        Visit::create([
            'visit_code' => 'VIS'.fake()->unique()->numerify('######'),
            'patient_id' => $patient->id,
            'employee_id' => $doctorB->id,
            'service_id' => $serviceB->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 100000,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_status' => 'PAID',
            'status' => 'COMPLETED',
            'created_by' => $user->id,
        ]);

        // 2. Service Packages
        $pkgTop = ServicePackage::create([
            'package_code' => 'PKG-TOP',
            'name' => 'Gói Khám VIP',
            'description' => 'VIP',
            'price' => 2000000,
            'total_sessions' => 10,
            'validity_days' => 180,
            'status' => 'ACTIVE',
        ]);

        for ($i = 0; $i < 2; $i++) {
            PatientPackage::create([
                'patient_id' => $patient->id,
                'package_id' => $pkgTop->id,
                'purchase_date' => now()->toDateString(),
                'expiry_date' => now()->addMonths(6)->toDateString(),
                'total_sessions' => 10,
                'used_sessions' => 0,
                'remaining_sessions' => 10,
                'price' => 2000000,
                'status' => 'ACTIVE',
            ]);
        }

        $response = $this->getJson('/api/v1/dashboard/top-performers?limit=5');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $data = $response->json('data');

        $this->assertArrayHasKey('top_services', $data);
        $this->assertArrayHasKey('top_packages', $data);
        $this->assertArrayHasKey('top_doctors', $data);

        // Top service should be Service A
        $this->assertNotEmpty($data['top_services']);
        $this->assertEquals($serviceA->id, $data['top_services'][0]['service_id']);
        $this->assertEquals(3, $data['top_services'][0]['visit_count']);

        // Top doctor should be Doctor A
        $this->assertNotEmpty($data['top_doctors']);
        $this->assertEquals($doctorA->id, $data['top_doctors'][0]['employee_id']);
        $this->assertEquals(3, $data['top_doctors'][0]['total_visits']);
        $this->assertEquals(3, $data['top_doctors'][0]['completed_visits']);

        // Top package should be PKG-TOP
        $this->assertNotEmpty($data['top_packages']);
        $this->assertEquals($pkgTop->id, $data['top_packages'][0]['package_id']);
        $this->assertEquals(2, $data['top_packages'][0]['sold_count']);
    }
}
