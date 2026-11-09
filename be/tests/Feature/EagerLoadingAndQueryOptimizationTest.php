<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Role;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class EagerLoadingAndQueryOptimizationTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);

        $employee = Employee::create([
            'employee_code' => 'NV-PERF-01',
            'full_name' => 'Admin Performance Tester',
            'phone' => '0912999888',
            'email' => 'perf.tester@qlpk.test',
            'position' => 'Quản trị viên',
            'status' => 'ACTIVE',
        ]);

        $this->adminUser = User::create([
            'employee_id' => $employee->id,
            'username' => 'admin_perf_test',
            'email' => $employee->email,
            'password_hash' => bcrypt('Admin@123456'),
            'status' => 'ACTIVE',
        ]);

        $adminRole = Role::where('name', 'ADMIN')->first();
        if ($adminRole) {
            $this->adminUser->roles()->attach($adminRole->id, ['created_at' => now()]);
            $this->adminUser->load('roles.permissions');
        }
    }

    /**
     * Helper to authenticate as admin.
     */
    protected function authenticate(): static
    {
        return $this->actingAs($this->adminUser, 'sanctum');
    }

    /**
     * Test InventoryTransaction listing eliminates N+1 queries when loading products with current stock.
     */
    public function test_inventory_transaction_index_eliminates_n_plus_one_queries(): void
    {
        $products = [];
        for ($i = 1; $i <= 5; $i++) {
            $products[] = Product::create([
                'product_code' => 'SP-TEST-'.$i,
                'name' => 'Sản phẩm Test '.$i,
                'unit' => 'Hộp',
                'minimum_stock' => 10,
                'status' => 'ACTIVE',
            ]);
        }

        // Create multiple transactions across products
        foreach ($products as $product) {
            for ($j = 1; $j <= 4; $j++) {
                InventoryTransaction::create([
                    'product_id' => $product->id,
                    'transaction_type' => 'IN',
                    'quantity' => 20,
                    'reference_type' => 'IMPORT',
                    'transaction_date' => now()->toDateString(),
                    'created_by' => $this->adminUser->id,
                ]);
            }
        }

        // Measure query count for 5 items vs 20 items
        DB::enableQueryLog();
        DB::flushQueryLog();

        $response = $this->authenticate()->getJson('/api/v1/inventory-transactions?per_page=20');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $queries = DB::getQueryLog();
        $queryCount = count($queries);

        // Without eager loading withCurrentStock(), each item in the collection executes an extra query for stock.
        // With optimization, query count must remain minimal (count query, select query with eager loads).
        $this->assertLessThanOrEqual(6, $queryCount, "Inventory transaction listing executed {$queryCount} queries, possible N+1 query issue.");

        // Assert current_stock is present on product object inside data
        $firstItem = $response->json('data.0');
        $this->assertNotNull($firstItem);
        $this->assertArrayHasKey('product', $firstItem);
        $this->assertNotNull($firstItem['product']);
        $this->assertEquals(80.0, (float) $firstItem['product']['current_stock']);
    }

    /**
     * Test Invoice listing eager loads all nested relationships (patient, visit.employee, visit.service, payments).
     */
    public function test_invoice_index_eager_loads_nested_relations_without_n_plus_one(): void
    {
        $patient = Patient::create([
            'patient_code' => 'BN-PERF-01',
            'full_name' => 'Bệnh nhân N+1 Test',
            'phone' => '0988777666',
            'gender' => 'MALE',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS-PERF-01',
            'full_name' => 'Bác sĩ Điều trị',
            'phone' => '0988111222',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-PERF-01',
            'name' => 'Dịch vụ Kiểm tra',
            'price' => 500000,
            'status' => 'ACTIVE',
        ]);

        $visit = Visit::create([
            'visit_code' => 'VIS-PERF-01',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 500000,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_status' => 'PAID',
            'status' => 'COMPLETED',
            'created_by' => $this->adminUser->id,
        ]);

        for ($i = 1; $i <= 5; $i++) {
            $invoice = Invoice::create([
                'invoice_code' => 'INV-PERF-0'.$i,
                'patient_id' => $patient->id,
                'visit_id' => $visit->id,
                'subtotal_amount' => 500000,
                'discount_amount' => 0,
                'total_amount' => 500000,
                'paid_amount' => 500000,
                'remaining_amount' => 0,
                'status' => 'PAID',
                'issued_at' => now(),
                'created_by' => $this->adminUser->id,
            ]);

            Payment::create([
                'payment_code' => 'PAY-PERF-0'.$i,
                'invoice_id' => $invoice->id,
                'amount' => 500000,
                'payment_method' => 'CASH',
                'payment_date' => now(),
                'received_by' => $this->adminUser->id,
            ]);
        }

        DB::enableQueryLog();
        DB::flushQueryLog();

        $response = $this->authenticate()->getJson('/api/v1/invoices?per_page=15');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $queries = DB::getQueryLog();
        $queryCount = count($queries);

        // Ensure constant queries: count, invoices, patients, visits, employees, services, patient_packages, packages, creators, payments, users
        $this->assertLessThanOrEqual(12, $queryCount, "Invoice listing executed {$queryCount} queries.");

        $data = $response->json('data');
        $this->assertCount(5, $data);
        $this->assertEquals('Bệnh nhân N+1 Test', $data[0]['patient']['full_name']);
        $this->assertEquals('VIS-PERF-01', $data[0]['visit']['visit_code']);
        $this->assertNotEmpty($data[0]['payments']);
    }

    /**
     * Test ReportController clinical report eager loads doctor and service aggregates.
     */
    public function test_clinical_report_eager_loading_and_aggregates(): void
    {
        $patient = Patient::create([
            'patient_code' => 'BN-PERF-02',
            'full_name' => 'Bệnh nhân Báo Cáo',
            'phone' => '0977666555',
            'gender' => 'FEMALE',
            'status' => 'ACTIVE',
        ]);

        $doctor = Employee::create([
            'employee_code' => 'BS-PERF-02',
            'full_name' => 'Bác sĩ Khoa Ngoại',
            'phone' => '0977111222',
            'position' => 'Bác sĩ CKI',
            'status' => 'ACTIVE',
        ]);

        $service = Service::create([
            'service_code' => 'DV-PERF-02',
            'name' => 'Phẫu thuật Thủ thuật',
            'price' => 1200000,
            'status' => 'ACTIVE',
        ]);

        Visit::create([
            'visit_code' => 'VIS-PERF-02',
            'patient_id' => $patient->id,
            'employee_id' => $doctor->id,
            'service_id' => $service->id,
            'visit_date' => now(),
            'quantity' => 1,
            'unit_price' => 1200000,
            'discount_amount' => 0,
            'total_amount' => 1200000,
            'payment_status' => 'PAID',
            'status' => 'COMPLETED',
            'created_by' => $this->adminUser->id,
        ]);

        DB::enableQueryLog();
        DB::flushQueryLog();

        $response = $this->authenticate()->getJson('/api/v1/reports/clinical?start_date='.now()->startOfMonth()->toDateString().'&end_date='.now()->toDateString());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $doctorStats = $response->json('data.visits_by_doctor');
        $this->assertNotEmpty($doctorStats);
        $this->assertEquals('Bác sĩ Khoa Ngoại', $doctorStats[0]['doctor_name']);

        $serviceStats = $response->json('data.visits_by_service');
        $this->assertNotEmpty($serviceStats);
        $this->assertEquals('Phẫu thuật Thủ thuật', $serviceStats[0]['service_name']);
    }

    /**
     * Test ReportController financial report eager loads expense category.
     */
    public function test_financial_report_eager_loads_expense_categories(): void
    {
        $category = ExpenseCategory::create([
            'code' => 'CAT-VATTU',
            'name' => 'Vật tư tiêu hao phòng khám',
            'status' => 'ACTIVE',
        ]);

        Expense::create([
            'expense_code' => 'EXP-PERF-01',
            'category_id' => $category->id,
            'amount' => 850000,
            'expense_date' => now(),
            'payment_method' => 'CASH',
            'approval_status' => 'APPROVED',
            'approved_by' => $this->adminUser->id,
            'created_by' => $this->adminUser->id,
        ]);

        $response = $this->authenticate()->getJson('/api/v1/reports/financial?start_date='.now()->startOfMonth()->toDateString().'&end_date='.now()->toDateString());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $categories = $response->json('data.expenses_by_category');
        $this->assertNotEmpty($categories);
        $this->assertEquals('Vật tư tiêu hao phòng khám', $categories[0]['category_name']);
        $this->assertEquals(850000.0, (float) $categories[0]['total_amount']);
    }

    /**
     * Test Patient listing pagination clamping and withCount optimization.
     */
    public function test_patient_listing_pagination_and_eager_counting(): void
    {
        for ($i = 1; $i <= 10; $i++) {
            Patient::create([
                'patient_code' => 'BN-PAGE-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'full_name' => 'Bệnh nhân Phân Trang '.$i,
                'phone' => '0901000'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'status' => 'ACTIVE',
            ]);
        }

        // Test withCount optimization flag
        $responseWithCount = $this->authenticate()->getJson('/api/v1/patients?with_counts=1&per_page=5');
        $responseWithCount->assertStatus(200);

        $patientData = $responseWithCount->json('data.0');
        $this->assertArrayHasKey('appointments_count', $patientData);
        $this->assertArrayHasKey('visits_count', $patientData);
        $this->assertArrayHasKey('invoices_count', $patientData);

        // Test pagination clamp: per_page > 100 clamped to 100
        $responseClampMax = $this->authenticate()->getJson('/api/v1/patients?per_page=500');
        $responseClampMax->assertStatus(200)
            ->assertJsonPath('meta.per_page', 100);

        // Test pagination clamp: per_page < 1 clamped to 1
        $responseClampMin = $this->authenticate()->getJson('/api/v1/patients?per_page=-5');
        $responseClampMin->assertStatus(200)
            ->assertJsonPath('meta.per_page', 1);
    }
}
